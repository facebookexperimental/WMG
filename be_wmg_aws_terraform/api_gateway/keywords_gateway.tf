resource "aws_api_gateway_resource" "proxy_keywords" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  parent_id   = aws_api_gateway_rest_api.example.root_resource_id
  path_part   = "keywords"
}

resource "aws_api_gateway_method" "keywords_proxy_post" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.proxy_keywords.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.demo.id
}

resource "aws_api_gateway_integration" "keywords_lambda_post" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.keywords_proxy_post.resource_id
  http_method = aws_api_gateway_method.keywords_proxy_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.keywords_lambda.invoke_arn
}

resource "aws_api_gateway_method" "keywords_proxy_get" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.proxy_keywords.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.demo.id
}

resource "aws_api_gateway_integration" "keywords_lambda_get" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.keywords_proxy_get.resource_id
  http_method = aws_api_gateway_method.keywords_proxy_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.keywords_lambda.invoke_arn
}

resource "aws_api_gateway_resource" "proxy_keyword_id" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  parent_id   = aws_api_gateway_resource.proxy_keywords.id
  path_part   = "{id}"
}

resource "aws_api_gateway_method" "keyword_id_proxy_get" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.proxy_keyword_id.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.demo.id
}

resource "aws_api_gateway_integration" "keyword_id_lambda_get" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.keyword_id_proxy_get.resource_id
  http_method = aws_api_gateway_method.keyword_id_proxy_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.keywords_lambda.invoke_arn
}

resource "aws_api_gateway_method" "keyword_id_proxy_put" {
  rest_api_id   = aws_api_gateway_rest_api.example.id
  resource_id   = aws_api_gateway_resource.proxy_keyword_id.id
  http_method   = "PUT"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.demo.id
}

resource "aws_api_gateway_integration" "keyword_id_lambda_put" {
  rest_api_id = aws_api_gateway_rest_api.example.id
  resource_id = aws_api_gateway_method.keyword_id_proxy_put.resource_id
  http_method = aws_api_gateway_method.keyword_id_proxy_put.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.keywords_lambda.invoke_arn
}

resource "aws_lambda_permission" "apigw_keywords" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.keywords_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.example.execution_arn}/*/*"
}
