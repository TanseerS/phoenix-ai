data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# Lambda function
# ---------------------------------------------------------------------------

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../server"
  output_path = "${path.module}/../server/phoenix.zip"

  # phoenix.zip is excluded so the archive never includes a previous build of itself
  excludes = [
    "tests",
    "phoenix.zip",
  ]
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "phoenix-agent-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_secrets" {
  name = "phoenix-read-config-secret"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:phoenix/config-*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_bedrock" {
  name = "phoenix-invoke-bedrock"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "bedrock:InvokeModel"
        Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.nova-lite-v1:0"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_ses" {
  name = "phoenix-send-email"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ses:SendEmail"
        Resource = "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.ses_sender_email}"
      }
    ]
  })
}

resource "aws_lambda_function" "phoenix" {
  function_name = "phoenix-agent"
  role          = aws_iam_role.lambda.arn

  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  handler       = "src/index.handler"
  timeout       = 120
  memory_size   = 256

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}

# ---------------------------------------------------------------------------
# EventBridge Scheduler — daily run at 1:00 PM Asia/Kolkata
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "scheduler_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "phoenix-scheduler-role"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume_role.json
}

resource "aws_iam_role_policy" "scheduler_invoke_lambda" {
  name = "phoenix-invoke-lambda"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = aws_lambda_function.phoenix.arn
      }
    ]
  })
}

resource "aws_scheduler_schedule" "phoenix_daily_run" {
  name = "phoenix-daily-run"

  schedule_expression          = "cron(0 13 * * ? *)"
  schedule_expression_timezone = "Asia/Kolkata"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.phoenix.arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ source = "scheduler" })
  }
}

# ---------------------------------------------------------------------------
# RDS MySQL
# ---------------------------------------------------------------------------

data "aws_vpc" "default" {
  default = true
}

# DEMO-ONLY CONFIGURATION: the database is publicly accessible and open to
# 0.0.0.0/0 so it can be reached without a bastion or VPN. In production,
# place RDS in private subnets and restrict ingress to the Lambda's security
# group.
resource "aws_security_group" "phoenix_db" {
  name        = "phoenix-db"
  description = "Allow MySQL access to the Phoenix database"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "MySQL from anywhere (demo only)"
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "phoenix" {
  identifier = "phoenix-db"

  engine         = "mysql"
  engine_version = "8.0"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  # max_allocated_storage intentionally unset: storage autoscaling disabled

  db_name  = "phoenix"
  username = var.db_username
  password = var.db_password

  publicly_accessible    = true
  vpc_security_group_ids = [aws_security_group.phoenix_db.id]

  skip_final_snapshot     = true
  backup_retention_period = 0
}

# ---------------------------------------------------------------------------
# Secrets Manager
# ---------------------------------------------------------------------------

# Secret values (GitHub token, DB credentials, report recipient) are set
# manually in the console — they are never stored in this code or in state.
resource "aws_secretsmanager_secret" "phoenix_config" {
  name = "phoenix/config"
}
