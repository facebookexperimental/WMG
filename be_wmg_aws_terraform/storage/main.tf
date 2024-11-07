resource "aws_s3_bucket" "wmg_bucket" {
  bucket        = "${var.stack_name}-wmg-bucket-output"
  force_destroy = true

  tags = {
    Name        = "${var.stack_name}-wmg-bucket-output"
  }
}
