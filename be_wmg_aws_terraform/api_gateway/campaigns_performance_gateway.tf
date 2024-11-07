resource "aws_api_gateway_resource" "proxy_campaigns_performance" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  parent_id   = "${aws_api_gateway_rest_api.example.root_resource_id}"
  path_part   = "campaigns-performance"
}

resource "aws_api_gateway_resource" "proxy_waba_id" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  parent_id   = "${aws_api_gateway_resource.proxy_campaigns_performance.id}"
  path_part   = "{waba_id}"
}

resource "aws_api_gateway_method" "campaigns_performance_proxy_post" {
  rest_api_id   = "${aws_api_gateway_rest_api.example.id}"
  resource_id   = "${aws_api_gateway_resource.proxy_waba_id.id}"
  http_method   = "POST"
  authorization = "NONE"
}


resource "aws_api_gateway_integration" "campaigns_performance_lambda" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  resource_id = "${aws_api_gateway_method.campaigns_performance_proxy_post.resource_id}"
  http_method = "${aws_api_gateway_method.campaigns_performance_proxy_post.http_method}"

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "${var.campaigns_performance_lambda.invoke_arn}"
}

resource "aws_lambda_permission" "apigw_campaign_performance" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = "${var.campaigns_performance_lambda.function_name}"
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.example.execution_arn}/*/*"
}
