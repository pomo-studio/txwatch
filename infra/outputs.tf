# =============================================================================
# TxWatch Infrastructure Outputs
# =============================================================================
# These outputs are committed to config/infra-outputs.json by sync-infra-config.yml
# and consumed by the Nuxt app at build time and runtime.

output "app_config" {
  description = "Complete application configuration for deployment"
  sensitive   = true
  value = {
    project_name   = "txwatch"
    primary_region = var.primary_region
    dr_region      = var.dr_region

    lambda = {
      primary = {
        function_name = module.ssr.lambda_function_name_primary
        function_url  = module.ssr.lambda_function_url_primary
        s3_bucket     = module.ssr.s3_bucket_deployments_primary
        s3_key        = "lambda/function.zip"
      }
      dr = {
        function_name = module.ssr.lambda_function_name_dr
        function_url  = module.ssr.lambda_function_url_dr
        s3_bucket     = module.ssr.s3_bucket_deployments_dr
        s3_key        = "lambda/function.zip"
      }
    }

    static_assets = {
      s3_bucket = module.ssr.s3_bucket_static
    }

    cloudfront = {
      distribution_id = module.ssr.cloudfront_distribution_id
      domain_name     = module.ssr.cloudfront_domain_name
    }

    appsync = {
      api_url         = module.api.api_url
      realtime_url    = module.api.realtime_url
      api_key_id      = module.api.api_key_id
      dr_api_url      = module.api.dr_api_url
      dr_realtime_url = module.api.dr_realtime_url
      dr_api_key_id   = module.api.dr_api_key_id
    }

    cognito = {
      user_pool_id           = module.auth.user_pool_id
      user_pool_region       = module.auth.region
      client_id              = module.auth.client_id
      hosted_ui_domain       = module.auth.hosted_ui_domain
      hosted_ui_signin_url   = module.auth.hosted_ui_signin_url
      hosted_ui_signout_url  = module.auth.hosted_ui_signout_url
      hosted_ui_callback_url = "${var.app_base_url}/api/auth/callback"
      hosted_ui_logout_url   = "${var.app_base_url}/login"
    }

    event_pipeline = {
      event_bus_name = module.ingest_bus.bus_name_primary
      queue_url      = module.ingest_consumer.queue_url_primary
      dlq_url = module.ingest_consumer.dlq_arn_primary != null ? format(
        "https://sqs.%s.amazonaws.com/%s/%s",
        split(":", module.ingest_consumer.dlq_arn_primary)[3],
        split(":", module.ingest_consumer.dlq_arn_primary)[4],
        split(":", module.ingest_consumer.dlq_arn_primary)[5]
      ) : null
    }

    dynamodb = {
      table_name = aws_dynamodb_table.transactions.name
    }
  }
}

output "application_url" {
  description = "Application URL"
  value       = module.ssr.application_url
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.ssr.cloudfront_domain_name
}

output "appsync_url" {
  description = "AppSync GraphQL endpoint"
  value       = module.api.api_url
}

output "appsync_realtime_url" {
  description = "AppSync WebSocket endpoint for subscriptions"
  value       = module.api.realtime_url
}

output "appsync_dr_url" {
  description = "DR AppSync GraphQL endpoint"
  value       = module.api.dr_api_url
}

output "appsync_dr_realtime_url" {
  description = "DR AppSync WebSocket endpoint for subscriptions"
  value       = module.api.dr_realtime_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.auth.client_id
}

output "cognito_hosted_ui_domain" {
  description = "Cognito Hosted UI domain prefix"
  value       = module.auth.hosted_ui_domain
}

output "cognito_hosted_ui_signin_url" {
  description = "Cognito Hosted UI sign-in URL"
  value       = module.auth.hosted_ui_signin_url
}

output "event_bus_name" {
  description = "EventBridge custom bus name"
  value       = module.ingest_bus.bus_name_primary
}
