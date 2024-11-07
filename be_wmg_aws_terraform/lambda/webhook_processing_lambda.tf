resource "null_resource" "webhook_lambda_dependencies" {
  provisioner "local-exec" {
    command = "cd ${path.module}/webhook_processing/src && npm install"
  }

  triggers = {
    index = sha256(file("${path.module}/webhook_processing/src/index.mjs"))
    package = sha256(file("${path.module}/webhook_processing/src/package.json"))
  }
}


data "null_data_source" "webhook_wait_for_lambda_exporter" {
  inputs = {
    lambda_dependency_id = "${null_resource.webhook_lambda_dependencies.id}"
    source_dir           = "${path.module}/webhook_processing/src/"
  }
}

data "archive_file" "webhook_lambda" {
  output_path = "${path.module}/webhook_processing/lambda-bundle.zip"
  source_dir  = "${data.null_data_source.webhook_wait_for_lambda_exporter.outputs["source_dir"]}"
  type        = "zip"
}


resource "aws_lambda_function" "webhook_processing" {
  filename         = data.archive_file.webhook_lambda.output_path
  function_name    = "${var.stack_name}-webhook_processing"
  handler          = "index.lambdaHandler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_role.arn
  source_code_hash = data.archive_file.webhook_lambda.output_base64sha256
  timeout          = 300

  vpc_config {
    security_group_ids = [ var.WMGLambdaSecurityGroup ]
    subnet_ids         = [ var.WMGPrivateLambdaSubnet1,  var.WMGPrivateLambdaSubnet2]
  }

  environment {
    variables = {
      DB_HOST       = var.DB_HOST
      DB_NAME       = var.DB_NAME
      DB_SECRET_ARN = var.DB_SECRET_ARN
      DB_USER       = var.DB_USER

      CAPI_TOKEN_SECRET_ARN    = aws_secretsmanager_secret.capicreds.arn
      CAPI_DATASOURCE_ID       = var.CAPIDataSourceId
      CAPI_GRAPHAPI_VERSION    = var.CAPI_GRAPHAPI_VERSION
      CAPI_INTEGRATION_ENABLED = var.CAPIIntegrationEnabled
      CAPI_PAGE_ID             = var.CAPIPageId
    }
  }
}


resource "aws_sns_topic_subscription" "invoke_with_sns" {
  topic_arn = var.WEBHOOK_MESSAGE_SNS_ARN
  protocol  = "lambda"
  endpoint  = aws_lambda_function.webhook_processing.arn
}

resource "aws_lambda_permission" "allow_sns_invoke" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_processing.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = var.WEBHOOK_MESSAGE_SNS_ARN
}

resource "aws_secretsmanager_secret" "capicreds" {
  name                    = "${var.stack_name}-CAPISecurityTokenSecret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "cai_secret_credentials" {
 secret_id      = aws_secretsmanager_secret.capicreds.id
 secret_string  = "{\"CAPISecurityToken\":\"${var.CAPISecurityToken}\"}"
}
