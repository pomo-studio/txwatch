moved {
  from = module.ingest_pipeline.aws_cloudwatch_event_bus.this[0]
  to   = module.ingest_bus.aws_cloudwatch_event_bus.primary
}

moved {
  from = module.ingest_pipeline.aws_cloudwatch_event_rule.this
  to   = module.ingest_consumer.aws_cloudwatch_event_rule.primary
}

moved {
  from = module.ingest_pipeline.aws_cloudwatch_event_target.sqs
  to   = module.ingest_consumer.aws_cloudwatch_event_target.sqs_primary
}

moved {
  from = module.ingest_pipeline.aws_cloudwatch_event_target.logs[0]
  to   = module.ingest_consumer.aws_cloudwatch_event_target.logs_primary[0]
}

moved {
  from = module.ingest_pipeline.aws_cloudwatch_log_group.eventbridge[0]
  to   = module.ingest_consumer.aws_cloudwatch_log_group.eventbridge_primary[0]
}

moved {
  from = module.ingest_pipeline.aws_cloudwatch_log_resource_policy.eventbridge[0]
  to   = module.ingest_consumer.aws_cloudwatch_log_resource_policy.eventbridge_primary[0]
}

moved {
  from = module.ingest_pipeline.aws_sqs_queue.this
  to   = module.ingest_consumer.aws_sqs_queue.primary
}

moved {
  from = module.ingest_pipeline.aws_sqs_queue.dlq[0]
  to   = module.ingest_consumer.aws_sqs_queue.dlq_primary[0]
}

moved {
  from = module.ingest_pipeline.aws_sqs_queue_policy.this
  to   = module.ingest_consumer.aws_sqs_queue_policy.primary
}

moved {
  from = module.ingest_pipeline.aws_lambda_function.processor[0]
  to   = module.ingest_consumer.aws_lambda_function.primary[0]
}

moved {
  from = module.ingest_pipeline.aws_lambda_event_source_mapping.sqs[0]
  to   = module.ingest_consumer.aws_lambda_event_source_mapping.primary[0]
}

moved {
  from = module.ingest_pipeline.aws_iam_role.lambda[0]
  to   = module.ingest_consumer.aws_iam_role.lambda[0]
}

moved {
  from = module.ingest_pipeline.aws_iam_role_policy_attachment.lambda_basic[0]
  to   = module.ingest_consumer.aws_iam_role_policy_attachment.lambda_basic[0]
}

moved {
  from = module.ingest_pipeline.aws_iam_role_policy.lambda_sqs[0]
  to   = module.ingest_consumer.aws_iam_role_policy.lambda_sqs_primary[0]
}

moved {
  from = module.ingest_pipeline.aws_sns_topic.alarms[0]
  to   = module.ingest_consumer.aws_sns_topic.alarms_primary[0]
}

moved {
  from = module.ingest_pipeline.aws_sns_topic_subscription.alarm_email[0]
  to   = module.ingest_consumer.aws_sns_topic_subscription.email_primary[0]
}

moved {
  from = module.ingest_pipeline.aws_cloudwatch_metric_alarm.dlq_depth[0]
  to   = module.ingest_consumer.aws_cloudwatch_metric_alarm.dlq_depth_primary[0]
}

moved {
  from = module.ingest_pipeline.aws_cloudwatch_metric_alarm.lambda_errors[0]
  to   = module.ingest_consumer.aws_cloudwatch_metric_alarm.lambda_errors_primary[0]
}

moved {
  from = module.ingest_pipeline.aws_cloudwatch_metric_alarm.lambda_throttles[0]
  to   = module.ingest_consumer.aws_cloudwatch_metric_alarm.lambda_throttles_primary[0]
}

import {
  to = module.ingest_consumer.aws_cloudwatch_log_group.lambda_primary[0]
  id = "/aws/lambda/txwatch-enricher"
}
