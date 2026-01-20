resource "aws_api_gateway_resource" "audience_rules_lambda" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  parent_id   = aws_api_gateway_rest_api.example.root_resource_id
  path_part   = "audience_rules"
}


resource "aws_api_gateway_method" "audience_rules_proxy_post" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.audience_rules_lambda.id
  http_method   = "POST"
  authorization = "NONE"
}


resource "aws_api_gateway_integration" "audience_rules_lambda_post" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.audience_rules_proxy_post.resource_id
  http_method = aws_api_gateway_method.audience_rules_proxy_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.audience_rules_lambda.invoke_arn
}

resource "aws_api_gateway_method" "audience_rules_proxy_get" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.audience_rules_lambda.id
  http_method   = "GET"
  authorization = "NONE"
}


resource "aws_api_gateway_integration" "audience_rules_lambda_get" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.audience_rules_proxy_get.resource_id
  http_method = aws_api_gateway_method.audience_rules_proxy_get.http_method

  integration_http_method = "GET"
  type                    = "AWS_PROXY"
  uri                     = var.audience_rules_lambda.invoke_arn
}

resource "aws_api_gateway_method" "audience_rules_proxy_delete" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.audience_rules_lambda.id
  http_method   = "DELETE"
  authorization = "NONE"
}


resource "aws_api_gateway_integration" "audience_rules_lambda_delete" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.audience_rules_proxy_delete.resource_id
  http_method = aws_api_gateway_method.audience_rules_proxy_delete.http_method

  integration_http_method = "DELETE"
  type                    = "AWS_PROXY"
  uri                     = var.audience_rules_lambda.invoke_arn
  #   uri                     = "${module.aws_lambda_function.message_filter_lambda.invoke_arn}"
}

resource "aws_lambda_permission" "apigw_audience_rules" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.audience_rules_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.example.execution_arn}/*/*"
}
