resource "aws_api_gateway_resource" "webhook_endpoint" {
  rest_api_id = aws_api_gateway_rest_api.wmg_webhook_processing.id
  parent_id   = aws_api_gateway_rest_api.wmg_webhook_processing.root_resource_id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "webhook_endpoint_get_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.wmg_webhook_processing.id
  resource_id   = aws_api_gateway_resource.webhook_endpoint.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhook_endpoint_get" {
  rest_api_id = aws_api_gateway_rest_api.wmg_webhook_processing.id
  resource_id = aws_api_gateway_method.webhook_endpoint_get_proxy.resource_id
  http_method = aws_api_gateway_method.webhook_endpoint_get_proxy.http_method

  type                 = "MOCK"
  passthrough_behavior = "NEVER"
  request_templates = {
    "application/json" : "{\n \"statusCode\": 200\n}"
  }
}

resource "aws_api_gateway_method_response" "webhook_endpoint_get_response_200" {
  rest_api_id = aws_api_gateway_rest_api.wmg_webhook_processing.id
  resource_id = aws_api_gateway_resource.webhook_endpoint.id
  http_method = aws_api_gateway_method.webhook_endpoint_get_proxy.http_method
  status_code = "200"
}

resource "aws_api_gateway_integration_response" "webhook_endpoint_get_response" {
  rest_api_id = aws_api_gateway_rest_api.wmg_webhook_processing.id
  resource_id = aws_api_gateway_resource.webhook_endpoint.id
  http_method = aws_api_gateway_method.webhook_endpoint_get_proxy.http_method
  status_code = aws_api_gateway_method_response.webhook_endpoint_get_response_200.status_code

  response_templates = {
    "application/json" : <<EOF
        $input.params()['querystring']['hub.challenge']
      EOF
  }
}

resource "aws_api_gateway_method" "webhook_endpoint_post_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.wmg_webhook_processing.id
  resource_id   = aws_api_gateway_resource.webhook_endpoint.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhook_endpoint_post" {
  rest_api_id             = aws_api_gateway_rest_api.wmg_webhook_processing.id
  resource_id             = aws_api_gateway_method.webhook_endpoint_post_proxy.resource_id
  http_method             = aws_api_gateway_method.webhook_endpoint_post_proxy.http_method
  integration_http_method = "POST"
  passthrough_behavior    = "NEVER"

  type        = "AWS"
  uri         = "arn:aws:apigateway:${data.aws_region.current.name}:sns:path//"
  credentials = aws_iam_role.sns_publish.arn

  request_parameters = {
    "integration.request.header.Content-Type" = "'application/x-www-form-urlencoded'"
  }

  request_templates = {
    "application/json" = "Action=Publish&TopicArn=$util.urlEncode('${var.webhook_message_sns_arn}')&Message=$util.urlEncode($input.body)"
  }
}

resource "aws_api_gateway_method_response" "webhook_endpoint_post_response_200" {
  rest_api_id = aws_api_gateway_rest_api.wmg_webhook_processing.id
  resource_id = aws_api_gateway_resource.webhook_endpoint.id
  http_method = aws_api_gateway_method.webhook_endpoint_post_proxy.http_method
  status_code = "200"
}

resource "aws_api_gateway_integration_response" "webhook_endpoint_post_response" {
  rest_api_id = aws_api_gateway_rest_api.wmg_webhook_processing.id
  resource_id = aws_api_gateway_resource.webhook_endpoint.id
  http_method = aws_api_gateway_method.webhook_endpoint_post_proxy.http_method
  status_code = aws_api_gateway_method_response.webhook_endpoint_post_response_200.status_code
}

resource "aws_iam_role" "sns_publish" {
  name               = "${var.stack_name}-ep-sns-publish"
  assume_role_policy = data.aws_iam_policy_document.apigw.json
}

data "aws_iam_policy_document" "apigw" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = [
        "apigateway.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role_policy" "sns_publish" {
  name   = "${var.stack_name}-SNS-Publish"
  role   = aws_iam_role.sns_publish.id
  policy = data.aws_iam_policy_document.sns_publish.json
}

data "aws_iam_policy_document" "sns_publish" {
  statement {
    actions = [
      "sns:Publish",
    ]

    resources = [
      "${var.webhook_message_sns_arn}",
    ]
  }
}
