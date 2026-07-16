function env(name) {
  return (process.env[name] ?? '').trim();
}

export async function getConfig() {
  const githubToken = env('GITHUB_TOKEN');
  if (!githubToken) {
    throw new Error('Missing required environment variable: GITHUB_TOKEN');
  }

  return {
    githubToken,
    dbHost: env('DB_HOST'),
    dbUser: env('DB_USER'),
    dbPassword: env('DB_PASSWORD'),
    dbName: env('DB_NAME'),
    sesSender: env('SES_SENDER'),
    reportRecipient: env('REPORT_RECIPIENT'),
  };
}
