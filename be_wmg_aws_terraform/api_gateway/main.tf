data "aws_region" "current" {}

resource "aws_api_gateway_rest_api" "example" {
  name        = "${var.stack_name}-WMG-API-GATEWAY"
}

resource "aws_api_gateway_deployment" "example" {
  depends_on = [
    "aws_api_gateway_integration.router_lambda",
    "aws_api_gateway_integration.events_lambda_get",
    "aws_api_gateway_integration.events_lambda_post",
    "aws_api_gateway_integration.events_lambda_delete",
    "aws_api_gateway_integration.audience_rules_lambda_get",
    "aws_api_gateway_integration.audience_rules_lambda_post",
    "aws_api_gateway_integration.audience_rules_lambda_delete",
    "aws_api_gateway_integration.campaigns_performance_lambda",
    "aws_api_gateway_integration.capi_events_lambda_get",
    "aws_api_gateway_integration.keywords_lambda_post",
    "aws_api_gateway_integration.keywords_lambda_get",
    "aws_api_gateway_integration.keyword_id_lambda_get",
    "aws_api_gateway_integration.keyword_id_lambda_put",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  stage_name  = "prod"
}


resource "aws_api_gateway_rest_api" "wmg_webhook_processing" {
  name        = "${var.stack_name}-WMG-Webhook-Processing"
  description = "API Gateway to handle webhook requests"
}


resource "aws_api_gateway_deployment" "wmg_webhook_processing_deployment" {
  depends_on = [
    "aws_api_gateway_integration.webhook_endpoint_get",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.wmg_webhook_processing.id}"
  stage_name  = "${var.WebhookStageName}"
}
