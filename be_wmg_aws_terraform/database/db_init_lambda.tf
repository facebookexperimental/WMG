resource "null_resource" "db_init_lambda_dependencies" {
  provisioner "local-exec" {
    command = "cd ${path.module}/db_init/src && npm install"
  }

  triggers = {
    index = sha256(file("${path.module}/db_init/src/index.mjs"))
    package = sha256(file("${path.module}/db_init/src/package.json"))
  }
}


data "null_data_source" "db_init_wait_for_lambda_exporter" {
  inputs = {
    lambda_dependency_id = "${null_resource.db_init_lambda_dependencies.id}"
    source_dir           = "${path.module}/db_init/src/"
  }
}

data "archive_file" "db_init_lambda" {
  output_path = "${path.module}/db_init/lambda-bundle.zip"
  source_dir  = "${data.null_data_source.db_init_wait_for_lambda_exporter.outputs["source_dir"]}"
  type        = "zip"
}


resource "aws_lambda_function" "db_init" {
  filename         = data.archive_file.db_init_lambda.output_path
  function_name    = "${var.stack_name}-db_init"
  handler          = "index.lambdaHandler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_role.arn
  source_code_hash = data.archive_file.db_init_lambda.output_base64sha256
  timeout          = 300

  vpc_config {
    security_group_ids = [ var.WMGLambdaSecurityGroup ]
    subnet_ids         = [ var.WMGPrivateLambdaSubnet1,  var.WMGPrivateLambdaSubnet2]
  }

  environment {
    variables = {
      DB_HOST = aws_rds_cluster.default.endpoint
      DB_NAME = aws_rds_cluster.default.database_name
      DB_SECRET_ARN = aws_secretsmanager_secret.dbcreds.arn
      DB_USER = aws_rds_cluster.default.master_username
    }
  }
  depends_on = [
    aws_iam_role_policy_attachment.DbAWSLambdaVPCAccessExecutionRole-attach,
    aws_iam_role_policy_attachment.function_db_logging_policy_attachment,
    aws_iam_role_policy_attachment.function_db_secret_manager_attachment,
  ]
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_policy" "lambda_db_logging_policy" {
  name   = "${var.stack_name}-lambda_db_log_policy"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
            "logs:CreateLogStream",
            "logs:CreateLogGroup",
            "logs:PutLogEvents"
        ],
        Effect : "Allow",
        Resource : "arn:aws:logs:${local.region}:${local.account_id}:*"
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_secret_manager_policy" {
  name   = "${var.stack_name}-lambda_secret_manager_policy"
  policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": [
                "${aws_secretsmanager_secret.dbcreds.arn}",
            ],
            "Effect": "Allow"
        }
    ]
})
}



resource "aws_iam_role" "lambda_role" {
  name               = "${var.stack_name}-lambda-rds-iam-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_iam_role_policy_attachment" "function_db_secret_manager_attachment" {
  role = aws_iam_role.lambda_role.id
  policy_arn = aws_iam_policy.lambda_secret_manager_policy.arn
}

resource "aws_iam_role_policy_attachment" "function_db_logging_policy_attachment" {
  role = aws_iam_role.lambda_role.id
  policy_arn = aws_iam_policy.lambda_db_logging_policy.arn
}

data "aws_iam_policy" "DbAWSLambdaVPCAccessExecutionRole" {
  arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "DbAWSLambdaVPCAccessExecutionRole-attach" {
  role       =  aws_iam_role.lambda_role.id
  policy_arn = data.aws_iam_policy.DbAWSLambdaVPCAccessExecutionRole.arn
}


resource "aws_lambda_invocation" "example" {
  function_name = aws_lambda_function.db_init.function_name

  triggers = {
    redeployment = sha1(jsonencode([
      aws_lambda_function.db_init.environment
    ]))
  }

  input = jsonencode({
  })

  depends_on = [
      aws_lambda_function.db_init,
      aws_rds_cluster.default,
      aws_rds_cluster_instance.example,
      aws_secretsmanager_secret.dbcreds,
      aws_secretsmanager_secret_version.secret_credentials,
  ]
}
