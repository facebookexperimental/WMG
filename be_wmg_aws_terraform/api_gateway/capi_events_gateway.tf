resource "aws_api_gateway_resource" "capi_events_lambda" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  parent_id   = "${aws_api_gateway_rest_api.example.root_resource_id}"
  path_part   = "capi_events"
}

resource "aws_api_gateway_method" "capi_events_proxy_get" {
  rest_api_id   = "${aws_api_gateway_rest_api.example.id}"
  resource_id   = "${aws_api_gateway_resource.capi_events_lambda.id}"
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "capi_events_lambda_get" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  resource_id = "${aws_api_gateway_method.capi_events_proxy_get.resource_id}"
  http_method = "${aws_api_gateway_method.capi_events_proxy_get.http_method}"

  integration_http_method = "GET"
  type                    = "AWS_PROXY"
  uri                     = "${var.capi_integration_lambda.invoke_arn}"
}

resource "aws_lambda_permission" "apigw_capi_events" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = "${var.capi_integration_lambda.function_name}"
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.example.execution_arn}/*/*"
}
