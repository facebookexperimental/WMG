# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

output "SENT_MESSAGE_QUEUE_URL" {
  value = aws_sqs_queue.wmg_processing_messages_queue.url
}

output "SENT_MESSAGE_QUEUE_ARN" {
  value = aws_sqs_queue.wmg_processing_messages_queue.arn
}

output "WEBHOOK_MESSAGE_SNS_ARN" {
  value = aws_sns_topic.wmg_sns_topic_webhook.arn

}
