import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({});

const SYSTEM_PROMPT =
  "You are Phoenix, an engineering advisor reviewing a developer's GitHub portfolio. " +
  'You are concise, specific, and practical. You never give generic advice like ' +
  "'write more tests'; you tie every recommendation to the actual signals provided.";

const FALLBACK = { portfolio_summary: 'AI analysis unavailable this run', repos: [] };

function buildUserMessage(scoredRepos) {
  const data = scoredRepos.map(({ repo, health }) => ({
    name: repo.name,
    description: repo.description,
    score: health.score,
    breakdown: health.breakdown,
    flags: health.flags,
    commitsLast30Days: repo.commitsLast30Days,
    lastCommitDate: repo.lastCommitDate,
    openIssues: repo.openIssues,
    openPRs: repo.openPRs,
    ciStatus: repo.ciStatus,
    lastReleaseDate: repo.lastReleaseDate,
    readmeExcerpt: repo.readmeExcerpt,
  }));

  return `Here is today's scan of my repositories as JSON:

${JSON.stringify(data)}

For EACH repository return:
(a) "diagnosis": 2-3 sentences explaining what state the project is in and why. Infer the story from the signals (e.g. active but never released, stalled after early momentum, healthy but undocumented).
(b) "next_best_action": ONE concrete task completable in under an hour, specific to that repo.

Also return (c) a top-level "portfolio_summary": 2-3 sentences about the overall portfolio, naming which single repo most deserves attention today and why.

Respond ONLY with JSON matching exactly this shape, no other text:
{ "portfolio_summary": string, "repos": [ { "name": string, "diagnosis": string, "next_best_action": string } ] }`;
}

function parseResponse(text) {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(stripped);
    return {
      portfolio_summary: parsed.portfolio_summary ?? FALLBACK.portfolio_summary,
      repos: Array.isArray(parsed.repos) ? parsed.repos : [],
    };
  } catch {
    console.error(`bedrock: response was not valid JSON, raw text follows:\n${text}`);
    return FALLBACK;
  }
}

export async function analyzeRepositories(scoredRepos) {
  const modelId = (process.env.BEDROCK_MODEL_ID ?? '').trim();
  if (!modelId) {
    throw new Error('Missing required environment variable: BEDROCK_MODEL_ID');
  }

  const response = await client.send(
    new ConverseCommand({
      modelId,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: [{ text: buildUserMessage(scoredRepos) }] }],
      inferenceConfig: { maxTokens: 1500, temperature: 0.4 },
    })
  );

  const text = (response.output?.message?.content ?? [])
    .map((block) => block.text ?? '')
    .join('');

  return parseResponse(text);
}
