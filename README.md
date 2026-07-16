# Phoenix

Phoenix is a personal always-on AI agent that runs unattended every night. Triggered by EventBridge Scheduler at 1:00 PM Asia/Kolkata, it wakes up an AWS Lambda function (Node.js 22) that fetches activity from my GitHub repositories, scores each repository's health, generates improvement recommendations using Amazon Bedrock (Nova Lite), stores the results in a MySQL database on RDS, and emails me a summary report via Amazon SES — no manual intervention required.

## Architecture

```
EventBridge Scheduler (daily, 1:00 PM Asia/Kolkata)
        |
        v
     Lambda (Node.js 22)
        |
        v
    GitHub API  -->  Health Engine
                        |
                        v
              MySQL (RDS) + Bedrock (Nova Lite)
                        |
                        v
                   SES email report
```

## Status

Status: work in progress
