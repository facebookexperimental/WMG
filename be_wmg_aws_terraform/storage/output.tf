# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

output "OUTPUT_BUCKET" {
  value = aws_s3_bucket.wmg_bucket.bucket
}

output "OUTPUT_BUCKET_ARN" {
  value = aws_s3_bucket.wmg_bucket.arn
}
