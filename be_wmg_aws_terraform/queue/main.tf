resource "aws_sqs_queue" "wmg_processing_messages_queue" {
  name                       = "${var.stack_name}-wmg-processing-messages-queue"
  delay_seconds              = 0
  max_message_size           = 256 * 1024
  message_retention_seconds  = 4 * 86400
  receive_wait_time_seconds  = 0
  visibility_timeout_seconds = 300
}

resource "aws_sqs_queue" "wmg_dlq_webhook_processing_queue" {
  name                       = "${var.stack_name}-wmg_dlq_webhook_processing_queue"
  delay_seconds              = 0
  max_message_size           = 256 * 1024
  message_retention_seconds  = 4 * 86400
  receive_wait_time_seconds  = 0
  visibility_timeout_seconds = 300
}

resource "aws_sns_topic" "wmg_sns_topic_webhook" {
  name = "SNSTopicForWABizNotifs"
  display_name = "${var.stack_name}-SNSTopicForWABizNotifs"
}
