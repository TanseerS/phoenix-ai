# Phoenix — Infrastructure

This Terraform code documents the architecture Phoenix actually runs on. The
real deployment was done through the AWS console; these files mirror that
setup one-to-one so the public repo stays reproducible. It is a single root
module with plain resources only — no registry modules — so every piece of
the architecture is visible in the code.

## What it defines

- **Lambda** `phoenix-agent` — Node.js 22, arm64, packaged from `../server`
  via the `archive_file` data source; all configuration (GitHub token, DB
  credentials, email addresses, Bedrock model ID) is passed as environment
  variables
- **EventBridge Scheduler** `phoenix-daily-run` — daily at 1:00 PM
  Asia/Kolkata, invoking the Lambda with `{"source": "scheduler"}`
- **RDS MySQL** `phoenix-db` — db.t4g.micro, 20 GB gp3
- IAM roles and policies for the Lambda and the scheduler

## Manual prerequisites

Two dependencies are not fully managed by this Terraform and must be set up
in the console before applying:

- **SES identities** — the sender address (and the recipient too, while the
  account is in the SES sandbox) must be verified manually in SES.
- **Bedrock model access** — access to Amazon Nova Lite must be enabled
  manually in the Bedrock console for the region.

## Network warning

The RDS security group intentionally allows inbound MySQL (3306) from
`0.0.0.0/0` and the instance is publicly accessible. This is a demo-only
configuration kept for easy inspection of the data; production should use
private subnets with ingress restricted to the Lambda's security group.

## How to apply

```bash
cd infra
terraform init
terraform plan   # review what would be created
terraform apply
```

Copy `terraform.tfvars.example` to `terraform.tfvars` and fill in real
values (`region` defaults to `ap-south-1`, `bedrock_model_id` defaults to
`apac.amazon.nova-lite-v1:0`).

## Git hygiene

`terraform.tfvars` and all state files (`*.tfstate`, `.terraform/`) are
gitignored — they contain credentials and account-specific data and must
never be committed.
