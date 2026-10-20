# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

resource "aws_s3_bucket" "wmg_bucket" {
  bucket        = "${var.stack_name}-wmg-bucket-output"
  force_destroy = true

  tags = {
    Name = "${var.stack_name}-wmg-bucket-output"
  }
}
