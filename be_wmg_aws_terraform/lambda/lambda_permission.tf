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

resource "aws_iam_policy" "lambda_loggin_policy" {
  name   = "${var.stack_name}-lambda_log_policy"
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

resource "aws_iam_role" "lambda_role" {
  name               = "${var.stack_name}-iam-role-lambda-api-gateway"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_iam_role_policy_attachment" "function_logging_policy_attachment" {
  role = aws_iam_role.lambda_role.id
  policy_arn = aws_iam_policy.lambda_loggin_policy.arn
}

data "aws_iam_policy" "AWSLambdaVPCAccessExecutionRole" {
  arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "AWSLambdaVPCAccessExecutionRole-attach" {
  role       =  aws_iam_role.lambda_role.id
  policy_arn = data.aws_iam_policy.AWSLambdaVPCAccessExecutionRole.arn
}

resource "aws_iam_role_policy_attachment" "function_lambda_secret_manager_attachment" {
  role = aws_iam_role.lambda_role.id
  policy_arn = var.SECRET_MANAGER_POLICY_ARN
}


resource "aws_iam_policy" "lambda_sqs_write_policy" {
  name   = "${var.stack_name}-lambda_sqs_write_policy"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
            "sqs:SendMessage",
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes"
        ],
        Effect : "Allow",
        Resource : var.SENT_MESSAGE_QUEUE_ARN
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_sqs_policy_attachment" {
  role = aws_iam_role.lambda_role.id
  policy_arn = aws_iam_policy.lambda_sqs_write_policy.arn
}

resource "aws_iam_policy" "wmg_secret_manager_policy" {
  name   = "${var.stack_name}-wmg_secret_manager_policy"
  policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": [
                "${aws_secretsmanager_secret.wmgcreds.arn}",
            ],
            "Effect": "Allow"
        }
    ]
})
}

resource "aws_iam_role_policy_attachment" "function_db_secret_manager_attachment" {
  role = aws_iam_role.lambda_role.id
  policy_arn = aws_iam_policy.wmg_secret_manager_policy.arn
}



resource "aws_iam_policy" "s3_write_permissions" {
  name   = "${var.stack_name}-s3_write_permissions"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Action : [
            "s3:PutObject",
        ],
        Effect : "Allow",
        Resource : "${var.OUTPUT_BUCKET_ARN}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_write_policy_attachment" {
  role = aws_iam_role.lambda_role.id
  policy_arn = aws_iam_policy.s3_write_permissions.arn
}
