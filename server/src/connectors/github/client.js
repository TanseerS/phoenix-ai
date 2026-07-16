import { getConfig } from '../../utils/config.js';

const BASE_URL = 'https://api.github.com';
const MAX_PAGES = 3;

async function authHeaders() {
  const config = await getConfig();
  return {
    Authorization: `Bearer ${config.githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// Parses a Link header into { next: url, last: url, ... }
function parseLinkHeader(header) {
  const links = {};
  if (!header) return links;
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

// Single request. Returns { status, data, links }, or null when the status
// is in okStatuses (e.g. 404 for "no README").
export async function request(path, { query, okStatuses = [] } = {}) {
  const url = new URL(path.startsWith('http') ? path : BASE_URL + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, { headers: await authHeaders() });

  if (okStatuses.includes(res.status)) return null;

  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const resetEpoch = Number(res.headers.get('x-ratelimit-reset'));
    const resetAt = resetEpoch ? new Date(resetEpoch * 1000).toISOString() : 'unknown';
    throw new Error(`GitHub rate limit exhausted; resets at ${resetAt}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status} on ${url.pathname}: ${body.slice(0, 200)}`);
  }

  return {
    status: res.status,
    data: await res.json(),
    links: parseLinkHeader(res.headers.get('link')),
  };
}

// Single request, JSON body only. Returns null for statuses in okStatuses.
export async function getJson(path, options = {}) {
  const result = await request(path, options);
  return result && result.data;
}

// Follows Link rel="next" and concatenates array responses, capped at
// MAX_PAGES pages to keep runs fast.
export async function getPaginated(path, { query, maxPages = MAX_PAGES } = {}) {
  const items = [];
  let next = { path, query };

  for (let page = 0; next && page < maxPages; page++) {
    const result = await request(next.path, { query: next.query });
    items.push(...result.data);
    // The next URL already carries all query params.
    next = result.links.next ? { path: result.links.next } : null;
  }

  return items;
}
