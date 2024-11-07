resource "null_resource" "process_signals_lambda_dependencies" {
  provisioner "local-exec" {
    command = "cd ${path.module}/process_signals/src && npm install"
  }

  triggers = {
    index = sha256(file("${path.module}/process_signals/src/index.mjs"))
    package = sha256(file("${path.module}/process_signals/src/package.json"))
  }
}


data "null_data_source" "process_signals_wait_for_lambda_exporter" {
  inputs = {
    lambda_dependency_id = "${null_resource.process_signals_lambda_dependencies.id}"
    source_dir           = "${path.module}/process_signals/src/"
  }
}

data "archive_file" "process_signals_lambda" {
  output_path = "${path.module}/process_signals/lambda-bundle.zip"
  source_dir  = "${data.null_data_source.process_signals_wait_for_lambda_exporter.outputs["source_dir"]}"
  type        = "zip"
}


resource "aws_lambda_function" "process_signals" {
  filename         = data.archive_file.process_signals_lambda.output_path
  function_name    = "${var.stack_name}-process_signals"
  handler          = "index.lambdaHandler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_role.arn
  source_code_hash = data.archive_file.process_signals_lambda.output_base64sha256
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
    }
  }
}

resource "aws_lambda_event_source_mapping" "event_source_mapping" {
  event_source_arn = var.SENT_MESSAGE_QUEUE_ARN
  enabled          = true
  function_name    = aws_lambda_function.process_signals.function_name
  batch_size       = 1
}
