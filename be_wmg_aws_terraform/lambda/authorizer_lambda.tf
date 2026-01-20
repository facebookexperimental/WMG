resource "null_resource" "authorizer_lambda_dependencies" {
  provisioner "local-exec" {
    command = "cd ${path.module}/authorizer/src && npm install"
  }

  triggers = {
    index   = sha256(file("${path.module}/authorizer/src/index.mjs"))
    package = sha256(file("${path.module}/authorizer/src/package.json"))
  }
}


data "null_data_source" "authorizer_wait_for_lambda_exporter" {
  inputs = {
    lambda_dependency_id = "${null_resource.authorizer_lambda_dependencies.id}"
    source_dir           = "${path.module}/authorizer/src/"
  }
}

data "archive_file" "authorizer_lambda" {
  output_path = "${path.module}/authorizer/lambda-bundle.zip"
  source_dir  = data.null_data_source.authorizer_wait_for_lambda_exporter.outputs["source_dir"]
  type        = "zip"
}


resource "aws_lambda_function" "authorizer" {
  filename         = data.archive_file.authorizer_lambda.output_path
  function_name    = "${var.stack_name}-authorizer"
  handler          = "index.lambdaHandler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_role.arn
  source_code_hash = data.archive_file.authorizer_lambda.output_base64sha256
  timeout          = 300

  vpc_config {
    security_group_ids = [var.WMGLambdaSecurityGroup]
    subnet_ids         = [var.WMGPrivateLambdaSubnet1, var.WMGPrivateLambdaSubnet2]
  }

  environment {
    variables = {
      SECURITY_TOKEN_ARN = aws_secretsmanager_secret_version.secret_credentials.arn
    }
  }
}

resource "aws_secretsmanager_secret" "wmgcreds" {
  name                    = "${var.stack_name}-WMG-Security-token"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "secret_credentials" {
  secret_id     = aws_secretsmanager_secret.wmgcreds.id
  secret_string = "{\"WMGSecurityToken\":\"${var.WMGSecurityToken}\"}"
}
