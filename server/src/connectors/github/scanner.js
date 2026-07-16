import { request, getJson, getPaginated } from './client.js';

const MAX_REPOS = 10;
const COMMIT_WINDOW_DAYS = 30;
const README_EXCERPT_CHARS = 500;

async function fetchCommitStats(fullName, since) {
  // 409 = empty repository (no commits at all)
  const result = await request(`/repos/${fullName}/commits`, {
    query: { since, per_page: 100 },
    okStatuses: [409],
  });
  const commits = result ? result.data : [];
  return {
    commitsLast30Days: commits.length,
    lastCommitDate: commits[0]?.commit?.committer?.date ?? null,
  };
}

async function fetchOpenPRCount(fullName) {
  const result = await request(`/repos/${fullName}/pulls`, {
    query: { state: 'open', per_page: 1 },
  });
  // With per_page=1 the "last" page number equals the total open PR count;
  // no Link header means the first page is the only page (0 or 1 PRs).
  const lastUrl = result.links.last;
  if (lastUrl) {
    return Number(new URL(lastUrl).searchParams.get('page')) || result.data.length;
  }
  return result.data.length;
}

async function fetchLatestReleaseDate(fullName) {
  const release = await getJson(`/repos/${fullName}/releases/latest`, { okStatuses: [404] });
  return release?.published_at ?? null;
}

async function fetchCiStatus(fullName) {
  const runs = await getJson(`/repos/${fullName}/actions/runs`, { query: { per_page: 1 } });
  const latest = runs?.workflow_runs?.[0];
  if (!latest) return 'no CI';
  // conclusion is null while a run is still in progress
  return latest.conclusion ?? latest.status;
}

async function fetchReadme(fullName) {
  const readme = await getJson(`/repos/${fullName}/readme`, { okStatuses: [404] });
  if (!readme?.content) return { readmeLength: 0, readmeExcerpt: null };
  const text = Buffer.from(readme.content, 'base64').toString('utf8');
  return {
    readmeLength: text.length,
    readmeExcerpt: text.slice(0, README_EXCERPT_CHARS),
  };
}

async function analyzeRepo(repo, since) {
  const fullName = repo.full_name;

  const [commitStats, openPRs, lastReleaseDate, ciStatus, readme] = await Promise.all([
    fetchCommitStats(fullName, since),
    fetchOpenPRCount(fullName),
    fetchLatestReleaseDate(fullName),
    fetchCiStatus(fullName),
    fetchReadme(fullName),
  ]);

  return {
    name: repo.name,
    fullName,
    description: repo.description ?? null,
    defaultBranch: repo.default_branch,
    pushedAt: repo.pushed_at,
    stars: repo.stargazers_count,
    // open_issues_count includes PRs, so subtract them out
    openIssues: Math.max(0, repo.open_issues_count - openPRs),
    openPRs,
    commitsLast30Days: commitStats.commitsLast30Days,
    lastCommitDate: commitStats.lastCommitDate,
    lastReleaseDate,
    ciStatus,
    readmeLength: readme.readmeLength,
    readmeExcerpt: readme.readmeExcerpt,
    error: null,
  };
}

export async function scanRepositories() {
  const repos = await getPaginated('/user/repos', {
    query: { sort: 'pushed', per_page: 30, affiliation: 'owner' },
  });

  const candidates = repos
    .filter((repo) => !repo.fork && !repo.archived)
    .slice(0, MAX_REPOS);

  console.log(`scanner: ${repos.length} repos fetched, analyzing ${candidates.length}`);

  const since = new Date(Date.now() - COMMIT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  return Promise.all(
    candidates.map(async (repo) => {
      try {
        return await analyzeRepo(repo, since);
      } catch (err) {
        console.error(`scanner: repo=${repo.full_name} failed: ${err.message}`);
        return { name: repo.name, fullName: repo.full_name, error: err.message };
      }
    })
  );
}
