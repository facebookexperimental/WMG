output "OUTPUT_BUCKET" {
  value = aws_s3_bucket.wmg_bucket.bucket
}

output "OUTPUT_BUCKET_ARN" {
  value = aws_s3_bucket.wmg_bucket.arn
}
