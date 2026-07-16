output "lambda_function_name" {
  description = "Name of the Phoenix Lambda function"
  value       = aws_lambda_function.phoenix.function_name
}

output "scheduler_name" {
  description = "Name of the EventBridge Scheduler schedule"
  value       = aws_scheduler_schedule.phoenix_daily_run.name
}

output "rds_endpoint" {
  description = "Connection endpoint of the Phoenix MySQL instance"
  value       = aws_db_instance.phoenix.endpoint
}
