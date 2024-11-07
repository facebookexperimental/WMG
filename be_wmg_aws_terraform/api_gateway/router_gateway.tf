resource "aws_api_gateway_resource" "proxy_phonen_number" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  parent_id   = "${aws_api_gateway_rest_api.example.root_resource_id}"
  path_part   = "{business_phone_number_id}"
}

resource "aws_api_gateway_resource" "proxy_messages" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  parent_id   = "${aws_api_gateway_resource.proxy_phonen_number.id}"
  path_part   = "messages"
}

resource "aws_api_gateway_method" "messages_proxy_post" {
  rest_api_id   = "${aws_api_gateway_rest_api.example.id}"
  resource_id   = "${aws_api_gateway_resource.proxy_messages.id}"
  http_method   = "POST"
  authorization = "NONE"
}


resource "aws_api_gateway_integration" "router_lambda" {
  rest_api_id = "${aws_api_gateway_rest_api.example.id}"
  resource_id = "${aws_api_gateway_method.messages_proxy_post.resource_id}"
  http_method = "${aws_api_gateway_method.messages_proxy_post.http_method}"

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "${var.router_lambda.invoke_arn}"
}

resource "aws_lambda_permission" "apigw_router" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = "${var.router_lambda.function_name}"
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.example.execution_arn}/*/*"
}
