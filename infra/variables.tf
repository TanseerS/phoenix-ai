variable "aws_region" {
  description = "AWS region where Phoenix is deployed"
  type        = string
  default     = "ap-south-1"
}

variable "db_username" {
  description = "Master username for the Phoenix RDS MySQL instance"
  type        = string
}

variable "db_password" {
  description = "Master password for the Phoenix RDS MySQL instance"
  type        = string
  sensitive   = true
}

variable "ses_sender_email" {
  description = "Verified SES identity used as the sender of the nightly report"
  type        = string
}
