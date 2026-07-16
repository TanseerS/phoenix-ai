function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function scoreColor(score) {
  if (score >= 75) return '#2e7d32';
  if (score >= 50) return '#b26a00';
  return '#c62828';
}

function formatDelta(scoreDelta) {
  if (scoreDelta === null || scoreDelta === undefined) return '';
  return scoreDelta >= 0 ? `(+${scoreDelta})` : `(${scoreDelta})`;
}

function sortWorstFirst(repos) {
  return [...repos].sort((a, b) => a.score - b.score);
}

function repoCardHtml(repo) {
  const color = scoreColor(repo.score);
  const delta = formatDelta(repo.scoreDelta);

  const flagsHtml = repo.flags?.length
    ? `<p style="margin: 6px 0; color: #c62828; font-size: 13px;">&#9873; ${repo.flags
        .map(escapeHtml)
        .join(' &middot; ')}</p>`
    : '';

  const diagnosisHtml = repo.diagnosis
    ? `<p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.5;">${escapeHtml(
        repo.diagnosis
      )}</p>`
    : '';

  const actionHtml = repo.nextBestAction
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
        <tr>
          <td style="background-color: #fff8e1; border-left: 4px solid #f9a825; padding: 8px 12px; font-size: 14px; color: #333333;">
            <strong>Next best action:</strong> ${escapeHtml(repo.nextBestAction)}
          </td>
        </tr>
      </table>`
    : '';

  return `
    <tr>
      <td style="padding: 16px 20px; border-bottom: 1px solid #e0e0e0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 16px; font-weight: bold; color: #1a1a1a;">${escapeHtml(repo.name)}</td>
            <td align="right" style="white-space: nowrap;">
              <span style="font-size: 28px; font-weight: bold; color: ${color};">${repo.score}</span>
              <span style="font-size: 13px; color: #666666;"> /100 ${delta}</span>
            </td>
          </tr>
        </table>
        ${flagsHtml}
        ${diagnosisHtml}
        ${actionHtml}
      </td>
    </tr>`;
}

export function buildReportHtml({ runDate, portfolioSummary, repos }) {
  const date = new Date(runDate);
  const dateLabel = date.toDateString();
  const timestamp = date.toISOString();

  const summaryHtml = portfolioSummary
    ? `<tr>
        <td style="padding: 16px 20px; background-color: #f5f5f5; font-size: 14px; color: #333333; line-height: 1.6;">
          ${escapeHtml(portfolioSummary)}
        </td>
      </tr>`
    : '';

  const cards = sortWorstFirst(repos).map(repoCardHtml).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eeeeee; padding: 20px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; font-family: Arial, Helvetica, sans-serif; border-collapse: collapse;">
        <tr>
          <td style="background-color: #1a1a1a; padding: 20px; color: #ffffff;">
            <span style="font-size: 20px; font-weight: bold;">&#128293; Phoenix Daily Report</span>
            <span style="font-size: 14px; color: #bbbbbb; float: right;">${escapeHtml(dateLabel)}</span>
          </td>
        </tr>
        ${summaryHtml}
        ${cards}
        <tr>
          <td style="padding: 14px 20px; font-size: 12px; color: #999999; text-align: center;">
            Generated automatically by Phoenix &middot; run ${escapeHtml(timestamp)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function buildReportText({ runDate, portfolioSummary, repos }) {
  const date = new Date(runDate);
  const lines = [`PHOENIX DAILY REPORT — ${date.toDateString()}`, ''];

  if (portfolioSummary) {
    lines.push(portfolioSummary, '');
  }

  for (const repo of sortWorstFirst(repos)) {
    lines.push(`${repo.name} — ${repo.score}/100 ${formatDelta(repo.scoreDelta)}`.trimEnd());
    if (repo.flags?.length) lines.push(`  Flags: ${repo.flags.join('; ')}`);
    if (repo.diagnosis) lines.push(`  ${repo.diagnosis}`);
    if (repo.nextBestAction) lines.push(`  Next best action: ${repo.nextBestAction}`);
    lines.push('');
  }

  lines.push(`Generated automatically by Phoenix · run ${date.toISOString()}`);
  return lines.join('\n');
}
