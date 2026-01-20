output "SENT_MESSAGE_QUEUE_URL" {
  value = aws_sqs_queue.wmg_processing_messages_queue.url
}

output "SENT_MESSAGE_QUEUE_ARN" {
  value = aws_sqs_queue.wmg_processing_messages_queue.arn
}

output "WEBHOOK_MESSAGE_SNS_ARN" {
  value = aws_sns_topic.wmg_sns_topic_webhook.arn

}
