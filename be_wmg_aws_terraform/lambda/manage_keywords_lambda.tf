resource "null_resource" "manage_keywords_lambda_dependencies" {
  provisioner "local-exec" {
    command = "cd ${path.module}/manage_keywords/src && npm install"
  }

  triggers = {
    index = sha256(file("${path.module}/manage_keywords/src/index.mjs"))
    package = sha256(file("${path.module}/manage_keywords/src/package.json"))
  }
}


data "null_data_source" "manage_keywords_wait_for_lambda_exporter" {
  inputs = {
    lambda_dependency_id = "${null_resource.manage_keywords_lambda_dependencies.id}"
    source_dir           = "${path.module}/manage_keywords/src/"
  }
}

data "archive_file" "manage_keywords_lambda" {
  output_path = "${path.module}/manage_keywords/lambda-bundle.zip"
  source_dir  = "${data.null_data_source.manage_keywords_wait_for_lambda_exporter.outputs["source_dir"]}"
  type        = "zip"
}


resource "aws_lambda_function" "manage_keywords" {
  filename         = data.archive_file.manage_keywords_lambda.output_path
  function_name    = "${var.stack_name}-manage_keywords"
  handler          = "index.lambdaHandler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_role.arn
  source_code_hash = data.archive_file.manage_keywords_lambda.output_base64sha256
  timeout          = 300

  vpc_config {
    security_group_ids = [ var.WMGLambdaSecurityGroup ]
    subnet_ids         = [ var.WMGPrivateLambdaSubnet1,  var.WMGPrivateLambdaSubnet2]
  }

  environment {
    variables = {
      DB_HOST = var.DB_HOST
      DB_NAME = var.DB_NAME
      DB_SECRET_ARN = var.DB_SECRET_ARN
      DB_USER = var.DB_USER
    }
  }
}
