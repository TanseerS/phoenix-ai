import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const SECRET_ID = 'phoenix/config';

// Expected secret shape (values set manually in Secrets Manager):
// { "githubToken": "...", "dbHost": "...", "dbUser": "...", "dbPassword": "...",
//   "reportRecipient": "...", "sesSender": "..." }

let cached;

async function fetchConfig() {
  const client = new SecretsManagerClient({});
  const result = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));

  if (!result.SecretString) {
    throw new Error(`Secret ${SECRET_ID} has no SecretString`);
  }

  try {
    return JSON.parse(result.SecretString);
  } catch {
    throw new Error(`Secret ${SECRET_ID} is not valid JSON`);
  }
}

export async function getConfig() {
  if (!cached) {
    // Cache the promise so concurrent callers share one fetch; clear it on
    // failure so a transient error doesn't poison warm starts.
    cached = fetchConfig().catch((err) => {
      cached = undefined;
      throw err;
    });
  }
  return cached;
}
