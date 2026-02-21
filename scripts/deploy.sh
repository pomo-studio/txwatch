#!/bin/bash
# TxWatch deployment script — mirrors pomo-dev pattern
set -e

CONFIG_FILE="${INFRA_CONFIG:-config/infra-outputs.json}"

echo "Checking dependencies..."
MISSING_DEPS=()
for dep in zip aws jq; do
  command -v "$dep" &>/dev/null || MISSING_DEPS+=("$dep")
done

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
  echo "Missing: ${MISSING_DEPS[*]}"
  exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Infrastructure config not found: $CONFIG_FILE"
  echo "Run: terraform output -json > $CONFIG_FILE"
  exit 1
fi

echo "Loading config from $CONFIG_FILE"
PROJECT_NAME=$(jq -r '.app_config.value.project_name'               "$CONFIG_FILE")
PRIMARY_REGION=$(jq -r '.app_config.value.primary_region'           "$CONFIG_FILE")
DR_REGION=$(jq -r '.app_config.value.dr_region'                     "$CONFIG_FILE")
LAMBDA_PRIMARY=$(jq -r '.app_config.value.lambda.primary.function_name' "$CONFIG_FILE")
LAMBDA_DR=$(jq -r '.app_config.value.lambda.dr.function_name'       "$CONFIG_FILE")
S3_BUCKET_PRIMARY=$(jq -r '.app_config.value.lambda.primary.s3_bucket' "$CONFIG_FILE")
S3_BUCKET_DR=$(jq -r '.app_config.value.lambda.dr.s3_bucket'        "$CONFIG_FILE")
S3_STATIC=$(jq -r '.app_config.value.static_assets.s3_bucket'       "$CONFIG_FILE")
CF_DIST_ID=$(jq -r '.app_config.value.cloudfront.distribution_id'   "$CONFIG_FILE")
APPSYNC_URL=$(jq -r '.app_config.value.appsync.api_url'             "$CONFIG_FILE")
APPSYNC_REALTIME=$(jq -r '.app_config.value.appsync.realtime_url'   "$CONFIG_FILE")
COGNITO_POOL_ID=$(jq -r '.app_config.value.cognito.user_pool_id'    "$CONFIG_FILE")
COGNITO_CLIENT_ID=$(jq -r '.app_config.value.cognito.client_id'     "$CONFIG_FILE")
COGNITO_REGION=$(jq -r '.app_config.value.cognito.user_pool_region' "$CONFIG_FILE")
EVENT_BUS_NAME=$(jq -r '.app_config.value.event_pipeline.event_bus_name' "$CONFIG_FILE")
DYNAMODB_TABLE=$(jq -r '.app_config.value.dynamodb.table_name'      "$CONFIG_FILE")

# API key is sensitive — read from environment or secret
APPSYNC_API_KEY="${APPSYNC_API_KEY:-}"

echo "Deploying $PROJECT_NAME"
echo "  Primary: $PRIMARY_REGION | DR: $DR_REGION"
echo "  AppSync: $APPSYNC_URL"
echo "  Cognito: $COGNITO_POOL_ID"

# Build
echo "Building application..."
cd app
rm -rf .output

export PRIMARY_REGION
export DR_REGION
export APPSYNC_URL
export APPSYNC_REALTIME_URL="$APPSYNC_REALTIME"
export COGNITO_USER_POOL_ID="$COGNITO_POOL_ID"
export COGNITO_CLIENT_ID
export COGNITO_REGION
export EVENT_BUS_NAME
export DYNAMODB_TABLE
export APPSYNC_API_KEY

NITRO_PRESET=aws-lambda npm install
NITRO_PRESET=aws-lambda npm run build

# Package
echo "Creating deployment package..."
cd .output/server
zip -r ../../lambda-deploy.zip .
cd ../..

# Upload to S3
echo "Uploading to S3..."
aws s3 cp lambda-deploy.zip "s3://${S3_BUCKET_PRIMARY}/lambda/function.zip"
if [ -n "$S3_BUCKET_DR" ] && [ "$S3_BUCKET_DR" != "null" ]; then
  aws s3 cp lambda-deploy.zip "s3://${S3_BUCKET_DR}/lambda/function.zip" --region "$DR_REGION"
fi

# Update Lambda
echo "Updating Lambda functions..."
aws lambda update-function-code \
  --function-name "$LAMBDA_PRIMARY" \
  --s3-bucket "$S3_BUCKET_PRIMARY" \
  --s3-key lambda/function.zip \
  --region "$PRIMARY_REGION" \
  --publish

if [ -n "$LAMBDA_DR" ] && [ "$LAMBDA_DR" != "null" ]; then
  aws lambda update-function-code \
    --function-name "$LAMBDA_DR" \
    --s3-bucket "$S3_BUCKET_DR" \
    --s3-key lambda/function.zip \
    --region "$DR_REGION" \
    --publish
fi

# Sync static assets
echo "Syncing static assets..."
aws s3 sync .output/public/ "s3://${S3_STATIC}/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

# Invalidate CloudFront
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST_ID" \
  --paths "/" "/login" "/about" "/_nuxt/*" "/favicon.ico"

echo "Deployment complete!"
echo "  URL: $(jq -r '.application_url.value' "../$CONFIG_FILE")"
