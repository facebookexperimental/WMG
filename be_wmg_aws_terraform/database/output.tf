# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

output "DB_HOST" {
  value = aws_rds_cluster.default.endpoint
}

output "DB_NAME" {
  value = aws_rds_cluster.default.database_name
}

output "DB_SECRET_ARN" {
  value = aws_secretsmanager_secret.dbcreds.arn
}

output "DB_USER" {
  value = aws_rds_cluster.default.master_username
}

output "SECRET_MANAGER_POLICY_ARN" {
  value = aws_iam_policy.lambda_secret_manager_policy.arn
}
