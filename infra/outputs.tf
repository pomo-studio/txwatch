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
      api_url      = module.api.api_url
      realtime_url = module.api.realtime_url
      api_key_id   = module.api.api_key_id
    }

    cognito = {
      user_pool_id     = aws_cognito_user_pool.main.id
      user_pool_region = var.primary_region
      client_id        = aws_cognito_user_pool_client.main.id
    }

    event_pipeline = {
      event_bus_name = module.ingest_pipeline.event_bus_name
      queue_url      = module.ingest_pipeline.queue_url
      dlq_url        = module.ingest_pipeline.dlq_url
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

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "event_bus_name" {
  description = "EventBridge custom bus name"
  value       = module.ingest_pipeline.event_bus_name
}
