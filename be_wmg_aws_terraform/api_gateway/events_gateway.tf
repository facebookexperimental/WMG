resource "aws_api_gateway_resource" "events_lambda" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  parent_id   = aws_api_gateway_rest_api.example.root_resource_id
  path_part   = "events"
}


resource "aws_api_gateway_method" "events_proxy_post" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.events_lambda.id
  http_method   = "POST"
  authorization = "NONE"
}


resource "aws_api_gateway_integration" "events_lambda_post" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.events_proxy_post.resource_id
  http_method = aws_api_gateway_method.events_proxy_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.events_lambda.invoke_arn
}

resource "aws_api_gateway_method" "events_proxy_get" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.events_lambda.id
  http_method   = "GET"
  authorization = "NONE"
}


resource "aws_api_gateway_integration" "events_lambda_get" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.events_proxy_get.resource_id
  http_method = aws_api_gateway_method.events_proxy_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.events_lambda.invoke_arn
}

resource "aws_api_gateway_method" "events_proxy_delete" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.events_lambda.id
  http_method   = "DELETE"
  authorization = "NONE"
}


resource "aws_api_gateway_integration" "events_lambda_delete" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.events_proxy_delete.resource_id
  http_method = aws_api_gateway_method.events_proxy_delete.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.events_lambda.invoke_arn
}

resource "aws_lambda_permission" "apigw_events" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.events_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.example.execution_arn}/*/*"
}
