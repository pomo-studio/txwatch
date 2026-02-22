# =============================================================================
# TxWatch Infrastructure
# Real-time transaction monitoring demo — all five pomo-studio modules in one app
# Updated: Manual CloudFront OAC removal completed, ready for v2.4.1 module update
# =============================================================================

data "aws_caller_identity" "current" {
  provider = aws.primary
}

data "aws_region" "primary" {
  provider = aws.primary
}

# =============================================================================
# 1. SSR Frontend (serverless-ssr module)
# =============================================================================
# CloudFront → Lambda SSR (us-east-1 + us-west-2) + S3 static assets
# enable_dynamo = true creates the txwatch-visits table (page visit counter)

module "ssr" {
  # Using git reference until v2.4.3 is available in Terraform Registry
  source  = "git::https://github.com/pomo-studio/terraform-aws-serverless-ssr.git?ref=main"
  # version = "~> 2.4.3"  # Temporarily using git reference

  providers = {
    aws.primary = aws.primary
    aws.dr      = aws.dr
  }

  project_name    = "txwatch"
  domain_name     = "pomo.dev"
  subdomain       = "txwatch"
  route53_managed = true
  enable_dynamo   = true

  create_ci_cd_user = false

  tags = {
    Project   = "txwatch"
    Purpose   = "ssr-frontend"
    ManagedBy = "terraform"
  }
}


# Grant SSR Lambda permission to publish to txwatch-bus
resource "aws_iam_role_policy" "ssr_eventbridge" {
  provider = aws.primary
  name     = "txwatch-ssr-eventbridge"
  role     = "txwatch-lambda-role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "PutEventsToTxwatchBus"
      Effect   = "Allow"
      Action   = "events:PutEvents"
      Resource = module.ingest_pipeline.event_bus_arn
    }]
  })

  depends_on = [module.ssr, module.ingest_pipeline]
}

# =============================================================================
# 2. Transactions DynamoDB Table
# =============================================================================
# Separate from the SSR visits table. AppSync data source maps directly to it.
# GSI AllTransactionsIndex enables efficient time-sorted queries.
# GSI CategoryTimestampIndex enables category analytics.

resource "aws_dynamodb_table" "transactions" {
  provider     = aws.primary
  name         = "txwatch-transactions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "entity_type"
    type = "S"
  }
  attribute {
    name = "category"
    type = "S"
  }
  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "AllTransactionsIndex"
    hash_key        = "entity_type"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "CategoryTimestampIndex"
    hash_key        = "category"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = {
    Project   = "txwatch"
    ManagedBy = "terraform"
  }
}

# =============================================================================
# 3. Cognito User Pool
# =============================================================================

resource "aws_cognito_user_pool" "main" {
  provider = aws.primary
  name     = "txwatch-users"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = false
  }

  auto_verified_attributes = ["email"]

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  tags = {
    Project   = "txwatch"
    ManagedBy = "terraform"
  }
}

resource "aws_cognito_user_pool_client" "main" {
  provider     = aws.primary
  name         = "txwatch-app"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  allowed_oauth_flows_user_pool_client = false

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
}

# =============================================================================
# 4. AppSync API (appsync module)
# =============================================================================
# Auth: Cognito (browser WebSocket subscriptions)
#       AWS_IAM (enricher Lambda mutations)
#       API_KEY (SSR server-side listTransactions query)

module "api" {
  source  = "pomo-studio/appsync/aws"
  version = "~> 1.0"

  name   = "txwatch-api"
  schema = file("${path.module}/schema.graphql")

  cognito_user_pool_arn = aws_cognito_user_pool.main.arn

  additional_auth_modes = [
    { auth_type = "AWS_IAM" },
    { auth_type = "API_KEY" }
  ]

  enable_api_key       = true
  api_key_expires_days = 365

  dynamodb_data_sources = {
    transactions = {
      table_name = aws_dynamodb_table.transactions.name
      table_arn  = aws_dynamodb_table.transactions.arn
    }
  }

  tags = {
    Project   = "txwatch"
    ManagedBy = "terraform"
  }
}

# AppSync Resolvers

resource "aws_appsync_resolver" "list_transactions" {
  provider    = aws.primary
  api_id      = module.api.api_id
  type        = "Query"
  field       = "listTransactions"
  data_source = module.api.data_source_names["transactions"]

  runtime {
    name            = "APPSYNC_JS"
    runtime_version = "1.0.0"
  }
  code = file("${path.module}/resolvers/listTransactions.js")
}

resource "aws_appsync_resolver" "get_stats" {
  provider    = aws.primary
  api_id      = module.api.api_id
  type        = "Query"
  field       = "getStats"
  data_source = module.api.data_source_names["transactions"]

  runtime {
    name            = "APPSYNC_JS"
    runtime_version = "1.0.0"
  }
  code = file("${path.module}/resolvers/getStats.js")
}

resource "aws_appsync_resolver" "notify_transaction" {
  provider    = aws.primary
  api_id      = module.api.api_id
  type        = "Mutation"
  field       = "notifyTransaction"
  data_source = module.api.none_data_source_name

  runtime {
    name            = "APPSYNC_JS"
    runtime_version = "1.0.0"
  }
  code = file("${path.module}/resolvers/notifyTransaction.js")
}

resource "aws_appsync_resolver" "on_transaction_added" {
  provider    = aws.primary
  api_id      = module.api.api_id
  type        = "Subscription"
  field       = "onTransactionAdded"
  data_source = module.api.none_data_source_name

  runtime {
    name            = "APPSYNC_JS"
    runtime_version = "1.0.0"
  }
  code = file("${path.module}/resolvers/onTransactionAdded.js")
}

# =============================================================================
# 5. Event Pipeline (event-pipeline module)
# =============================================================================
# EventBridge txwatch-bus → SQS → enricher Lambda

data "archive_file" "enricher" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/enricher"
  output_path = "${path.module}/lambda/enricher.zip"
}

module "ingest_pipeline" {
  source  = "pomo-studio/event-pipeline/aws"
  version = "~> 1.1"

  name = "txwatch-enricher"

  create_event_bus = true

  event_pattern = {
    source = ["txwatch.transactions"]
  }

  create_lambda      = true
  lambda_code        = data.archive_file.enricher.output_path
  lambda_runtime     = "nodejs20.x"
  lambda_timeout     = 30
  lambda_memory_size = 256

  lambda_environment_variables = {
    DYNAMODB_TABLE = aws_dynamodb_table.transactions.name
    APPSYNC_URL    = module.api.api_url
  }

  enable_dlq        = true
  max_receive_count = 3

  sqs_visibility_timeout_seconds = 180

  enable_alarms = true
  alarm_email   = var.alarm_email

  tags = {
    Project   = "txwatch"
    ManagedBy = "terraform"
  }

  depends_on = [aws_dynamodb_table.transactions, module.api]
}

# Grant enricher Lambda permission to write enriched transactions to DynamoDB
resource "aws_iam_role_policy" "enricher_dynamodb" {
  provider = aws.primary
  name     = "txwatch-enricher-dynamodb"
  role     = element(split("/", module.ingest_pipeline.lambda_role_arn), 1)

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "WriteTransactions"
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem"
      ]
      Resource = aws_dynamodb_table.transactions.arn
    }]
  })

  depends_on = [module.ingest_pipeline, aws_dynamodb_table.transactions]
}

# Grant enricher Lambda permission to call AppSync notifyTransaction mutation
resource "aws_iam_role_policy" "enricher_appsync" {
  provider = aws.primary
  name     = "txwatch-enricher-appsync"
  role     = element(split("/", module.ingest_pipeline.lambda_role_arn), 1)

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AppSyncMutate"
      Effect = "Allow"
      Action = "appsync:GraphQL"
      Resource = [
        "${replace(replace(module.api.api_url, "https://", "arn:aws:appsync:${var.primary_region}:${data.aws_caller_identity.current.account_id}:apis/"), "/graphql", "")}/types/Mutation/fields/notifyTransaction"
      ]
    }]
  })

  depends_on = [module.ingest_pipeline, module.api]
}

# =============================================================================
# 6. Generator Lambda (auto transaction source)
# =============================================================================

data "archive_file" "generator" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/generator"
  output_path = "${path.module}/lambda/generator.zip"
}

resource "aws_iam_role" "generator" {
  provider = aws.primary
  name     = "txwatch-generator"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = {
    Project   = "txwatch"
    ManagedBy = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "generator_basic" {
  provider   = aws.primary
  role       = aws_iam_role.generator.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "generator_events" {
  provider = aws.primary
  name     = "txwatch-generator-events"
  role     = aws_iam_role.generator.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "PutEventsToTxwatchBus"
      Effect   = "Allow"
      Action   = "events:PutEvents"
      Resource = module.ingest_pipeline.event_bus_arn
    }]
  })
}

resource "aws_lambda_function" "generator" {
  provider = aws.primary

  function_name    = "txwatch-generator"
  description      = "TxWatch — generates random transactions on a schedule"
  role             = aws_iam_role.generator.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.generator.output_path
  source_code_hash = data.archive_file.generator.output_base64sha256
  timeout          = 15
  memory_size      = 128

  environment {
    variables = {
      EVENT_BUS_NAME = module.ingest_pipeline.event_bus_name
    }
  }

  tags = {
    Project   = "txwatch"
    ManagedBy = "terraform"
  }

  depends_on = [data.archive_file.generator]
}

# CloudWatch log group for generator Lambda
resource "aws_cloudwatch_log_group" "generator" {
  provider          = aws.primary
  name              = "/aws/lambda/txwatch-generator"
  retention_in_days = 7

  tags = {
    Project   = "txwatch"
    ManagedBy = "terraform"
  }
}

# =============================================================================
# 7. EventBridge Scheduler → Generator
# =============================================================================

resource "aws_iam_role" "scheduler" {
  provider = aws.primary
  name     = "txwatch-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })

  tags = {
    Project   = "txwatch"
    ManagedBy = "terraform"
  }
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  provider = aws.primary
  name     = "txwatch-scheduler-invoke"
  role     = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "InvokeGeneratorLambda"
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.generator.arn
    }]
  })
}

resource "aws_scheduler_schedule" "generator" {
  provider = aws.primary
  name     = "txwatch-generator"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(1 minute)"

  target {
    arn      = aws_lambda_function.generator.arn
    role_arn = aws_iam_role.scheduler.arn
  }
}
