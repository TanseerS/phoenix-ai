import { getConfig } from './utils/config.js';
import { scanRepositories } from './connectors/github/scanner.js';

export const handler = async () => {
  console.log('Phoenix run started');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  await getConfig();

  const repos = await scanRepositories();

  for (const repo of repos) {
    if (repo.error) {
      console.error(`repo=${repo.fullName} error=${repo.error}`);
    } else {
      console.log(
        `repo=${repo.fullName} commits30d=${repo.commitsLast30Days} ` +
          `openIssues=${repo.openIssues} ci=${repo.ciStatus}`
      );
    }
  }

  console.log(`Phoenix run finished: ${repos.length} repos scanned`);

  return { statusCode: 200, reposScanned: repos.length };
};
