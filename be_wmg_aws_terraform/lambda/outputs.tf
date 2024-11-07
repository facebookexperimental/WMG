output "webhook_processing_lambda" {
    value = aws_lambda_function.webhook_processing
}

output "events_lambda" {
    value = aws_lambda_function.events
}

output "audience_rules_lambda" {
    value = aws_lambda_function.audience_rules
}

output "authorizer_lambda" {
    value = aws_lambda_function.authorizer
}

output "campaigns_performance_lambda" {
    value = aws_lambda_function.campaigns_performance
}

output "capi_integration_lambda" {
    value = aws_lambda_function.capi_integration
}

output "manage_keywords_lambda" {
    value = aws_lambda_function.manage_keywords
}

output "process_signals_lambda" {
    value = aws_lambda_function.process_signals
}

output "router_lambda" {
    value = aws_lambda_function.router
}
