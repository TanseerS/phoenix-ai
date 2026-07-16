function daysSince(dateString, now) {
  if (!dateString) return null;
  return Math.floor((now - new Date(dateString).getTime()) / (24 * 60 * 60 * 1000));
}

function scoreCommitRecency(repo, now, flags) {
  // lastCommitDate only covers the 30-day scan window; pushedAt is the
  // fallback signal for repos with no commits in that window.
  const days = daysSince(repo.lastCommitDate, now) ?? daysSince(repo.pushedAt, now);

  if (days === null) {
    flags.push('No commits found');
    return 0;
  }
  if (days > 14) flags.push(`No commits in ${days} days`);

  if (days <= 7) return 25;
  if (days <= 14) return 15;
  if (days <= 30) return 8;
  return 0;
}

function scoreCommitVolume(repo) {
  const commits = repo.commitsLast30Days ?? 0;
  if (commits >= 10) return 10;
  if (commits >= 3) return 5;
  return 0;
}

function scoreCiStatus(repo, flags) {
  if (repo.ciStatus === 'success') return 20;
  if (repo.ciStatus === 'no CI') {
    flags.push('No CI configured');
    return 0;
  }
  // CI exists but the latest run didn't succeed (failed, cancelled, in progress...)
  if (repo.ciStatus === 'failure') flags.push('CI failing');
  return 8;
}

function scoreReadme(repo, flags) {
  const length = repo.readmeLength ?? 0;
  if (length === 0) {
    flags.push('README missing');
    return 0;
  }
  if (length >= 1500) return 15;
  if (length >= 300) return 8;
  flags.push('README very short');
  return 3;
}

function scoreIssueHygiene(repo, flags) {
  const issues = repo.openIssues ?? 0;
  if (issues > 10) flags.push(`${issues} open issues piling up`);

  if (issues <= 3) return 15;
  if (issues <= 10) return 8;
  if (issues <= 25) return 3;
  return 0;
}

function scoreReleaseRecency(repo, now, flags) {
  const days = daysSince(repo.lastReleaseDate, now);

  if (days === null) {
    flags.push('No releases');
    return 0;
  }
  if (days <= 30) return 15;
  if (days <= 90) return 8;
  flags.push(`Last release ${days} days ago`);
  return 3;
}

export function scoreRepository(repo) {
  const now = Date.now();
  const flags = [];

  const breakdown = {
    commitRecency: scoreCommitRecency(repo, now, flags),
    commitVolume: scoreCommitVolume(repo),
    ciStatus: scoreCiStatus(repo, flags),
    readme: scoreReadme(repo, flags),
    issueHygiene: scoreIssueHygiene(repo, flags),
    releaseRecency: scoreReleaseRecency(repo, now, flags),
  };

  const total = Object.values(breakdown).reduce((sum, points) => sum + points, 0);
  const score = Math.min(100, Math.max(0, total));

  return { score, breakdown, flags };
}
