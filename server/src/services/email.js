import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getConfig } from '../utils/config.js';

const client = new SESClient({});

export async function sendReport({ subject, html, text }) {
  const config = await getConfig();

  if (!config.sesSender) {
    throw new Error('Missing required environment variable: SES_SENDER');
  }
  if (!config.reportRecipient) {
    throw new Error('Missing required environment variable: REPORT_RECIPIENT');
  }

  await client.send(
    new SendEmailCommand({
      Source: config.sesSender,
      Destination: { ToAddresses: [config.reportRecipient] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          Text: { Data: text, Charset: 'UTF-8' },
        },
      },
    })
  );
}
