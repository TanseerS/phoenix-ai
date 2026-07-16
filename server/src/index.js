import { getConfig } from './utils/config.js';
import { scanRepositories } from './connectors/github/scanner.js';
import { scoreRepository } from './analysis/healthEngine.js';
import { saveScores, logRun } from './services/db.js';

async function safeLogRun(entry) {
  try {
    await logRun(entry);
  } catch (err) {
    console.error(`db: logRun failed: ${err.message}`);
  }
}

export const handler = async (event, context) => {
  // Don't let the warm connection pool keep the invocation alive
  if (context) context.callbackWaitsForEmptyEventLoop = false;

  console.log('Phoenix run started');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    await getConfig();

    const repos = await scanRepositories();
    const failed = repos.filter((repo) => repo.error);
    const scanned = repos.filter((repo) => !repo.error);

    const scored = scanned.map((repo) => ({ repo, health: scoreRepository(repo) }));

    for (const { repo, health } of scored) {
      const topFlags = health.flags.slice(0, 2).join('; ') || '-';
      console.log(`${repo.fullName.padEnd(45)} score=${String(health.score).padStart(3)}  ${topFlags}`);
    }
    for (const repo of failed) {
      console.error(`${repo.fullName.padEnd(45)} scan failed: ${repo.error}`);
    }

    try {
      await saveScores(
        scored.map(({ repo, health }) => ({
          repoName: repo.fullName,
          healthScore: health.score,
          metrics: {
            breakdown: health.breakdown,
            flags: health.flags,
            raw: {
              commitsLast30Days: repo.commitsLast30Days,
              lastCommitDate: repo.lastCommitDate,
              openIssues: repo.openIssues,
              openPRs: repo.openPRs,
              ciStatus: repo.ciStatus,
              lastReleaseDate: repo.lastReleaseDate,
              readmeLength: repo.readmeLength,
              pushedAt: repo.pushedAt,
              stars: repo.stars,
            },
          },
          recommendation: null,
          nextBestAction: null,
        }))
      );
      console.log(`db: saved ${scored.length} scores`);
    } catch (err) {
      console.error(`db: saveScores failed: ${err.message}`);
    }

    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, { health }) => sum + health.score, 0) / scored.length)
      : 0;

    console.log(
      `Phoenix run finished: ${scored.length} repos scored, ${failed.length} scan failures, avgScore=${avgScore}`
    );

    await safeLogRun({ reposScanned: scored.length, status: 'success', error: null });

    return { statusCode: 200, reposScanned: scored.length, avgScore };
  } catch (err) {
    console.error(`Phoenix run failed: ${err.message}`);
    await safeLogRun({ reposScanned: 0, status: 'failed', error: err.message });
    throw err;
  }
};
