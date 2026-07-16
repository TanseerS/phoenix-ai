# Phoenix — Infrastructure

This Terraform code documents the architecture Phoenix actually runs on. The
real deployment was done through the AWS console; these files mirror that
setup one-to-one so the public repo stays reproducible. It is a single root
module with plain resources only — no registry modules — so every piece of
the architecture is visible in the code.

## What it defines

- **Lambda** `phoenix-agent` — Node.js 22, arm64, packaged from `../server`
  via the `archive_file` data source
- **EventBridge Scheduler** `phoenix-daily-run` — daily at 1:00 PM
  Asia/Kolkata, invoking the Lambda with `{"source": "scheduler"}`
- **RDS MySQL** `phoenix-db` — db.t4g.micro, 20 GB gp3 (demo-only network
  configuration; see the comment in `main.tf`)
- **Secrets Manager** `phoenix/config` — secret container only; values are
  set manually and never appear in code
- IAM roles and policies for the Lambda and the scheduler

## How to apply

```bash
cd infra
terraform init
terraform plan   # review what would be created
terraform apply
```

You will need a `terraform.tfvars` providing `db_username`, `db_password`,
and `ses_sender_email` (region defaults to `ap-south-1`):

```hcl
db_username      = "phoenix_admin"
db_password      = "..."
ses_sender_email = "you@example.com"
```

## Git hygiene

`terraform.tfvars` and all state files (`*.tfstate`, `.terraform/`) are
gitignored — they contain credentials and account-specific data and must
never be committed.
