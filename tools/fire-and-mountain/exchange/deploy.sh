#!/usr/bin/env bash
# Creates or updates the exchange backend: DynamoDB table, private S3 bucket, IAM role,
# Lambda function and its public function URL. Safe to re-run.
#
# Usage:
#   KEY_HASH_JOEL=<hex> KEY_HASH_NANCY=<hex> bash deploy.sh     # set key hashes
#   bash deploy.sh                                              # keep the hashes already deployed
#   EXTRA_ORIGIN=http://localhost:8811 bash deploy.sh           # also allow a dev origin (CORS)
#
# Push notifications: the VAPID key pair is read from ~/.secrets/tokens/fm-exchange-vapid-{public,private}
# at deploy time (or kept from the deployed function when those files are missing) and handed to AWS
# through a mode-600 temp file, never on a command line.
set -euo pipefail

PROFILE=personal
REGION=ca-central-1
TABLE=fm-exchanges
ROLE=fm-exchange-role
FUNCTION=fm-exchange
FIRST_DAY=2026-11-10
LAST_DAY=2027-11-09
SITE_ORIGIN=https://joelmgallant.com
VAPID_SUBJECT=https://joelmgallant.com/fire-and-mountain/
VAPID_DIR="${HOME}/.secrets/tokens"
HERE="$(cd "$(dirname "$0")" && pwd)"

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

ACCOUNT=$(aws_ sts get-caller-identity --query Account --output text)
BUCKET="fm-exchange-media-${ACCOUNT}"
ORIGINS_JSON="[\"${SITE_ORIGIN}\"${EXTRA_ORIGIN:+,\"${EXTRA_ORIGIN}\"}]"
echo "account ${ACCOUNT}, region ${REGION}, origins ${ORIGINS_JSON}"

# --- DynamoDB -------------------------------------------------------------
if ! aws_ dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  aws_ dynamodb create-table --table-name "$TABLE" --billing-mode PAY_PER_REQUEST \
    --attribute-definitions AttributeName=date,AttributeType=S --key-schema AttributeName=date,KeyType=HASH >/dev/null
  aws_ dynamodb wait table-exists --table-name "$TABLE"
  echo "created table ${TABLE}"
fi
TABLE_ARN=$(aws_ dynamodb describe-table --table-name "$TABLE" --query Table.TableArn --output text)

# --- S3 ---------------------------------------------------------------------
if ! aws_ s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  aws_ s3api create-bucket --bucket "$BUCKET" --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
  echo "created bucket ${BUCKET}"
fi
aws_ s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws_ s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws_ s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration \
  "{\"CORSRules\":[{\"AllowedOrigins\":${ORIGINS_JSON},\"AllowedMethods\":[\"POST\",\"GET\"],\"AllowedHeaders\":[\"*\"],\"MaxAgeSeconds\":3600}]}"

# --- IAM role ---------------------------------------------------------------
if ! aws_ iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws_ iam create-role --role-name "$ROLE" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  echo "created role ${ROLE}; waiting for IAM to propagate"
  sleep 12
fi
aws_ iam put-role-policy --role-name "$ROLE" --policy-name fm-exchange-access --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {\"Effect\": \"Allow\", \"Action\": [\"dynamodb:GetItem\", \"dynamodb:PutItem\", \"dynamodb:UpdateItem\", \"dynamodb:Scan\"], \"Resource\": \"${TABLE_ARN}\"},
    {\"Effect\": \"Allow\", \"Action\": [\"s3:GetObject\", \"s3:PutObject\"], \"Resource\": \"arn:aws:s3:::${BUCKET}/*\"},
    {\"Effect\": \"Allow\", \"Action\": [\"logs:CreateLogGroup\", \"logs:CreateLogStream\", \"logs:PutLogEvents\"], \"Resource\": \"*\"}
  ]}"
ROLE_ARN=$(aws_ iam get-role --role-name "$ROLE" --query Role.Arn --output text)

# --- Package ----------------------------------------------------------------
DIST="${HERE}/dist"
rm -rf "$DIST" && mkdir -p "$DIST/pkg"
[[ -f "${HERE}/games.json" ]] || { echo "games.json missing: run node ../build.mjs first" >&2; exit 1; }
cp -R "${HERE}/src" "${HERE}/package.json" "${HERE}/package-lock.json" "${HERE}/games.json" "$DIST/pkg/"
(cd "$DIST/pkg" && npm ci --omit=dev --silent && zip -qr "$DIST/function.zip" .)
echo "packaged $(du -h "$DIST/function.zip" | cut -f1)"

# --- Lambda -----------------------------------------------------------------
deployed_var() {
  aws_ lambda get-function-configuration --function-name "$FUNCTION" --query "Environment.Variables.$1" --output text
}
VAPID_PUBLIC="" VAPID_PRIVATE=""
if [[ -f "${VAPID_DIR}/fm-exchange-vapid-public" && -f "${VAPID_DIR}/fm-exchange-vapid-private" ]]; then
  VAPID_PUBLIC=$(tr -d '[:space:]' < "${VAPID_DIR}/fm-exchange-vapid-public")
  VAPID_PRIVATE=$(tr -d '[:space:]' < "${VAPID_DIR}/fm-exchange-vapid-private")
fi
if aws_ lambda get-function --function-name "$FUNCTION" >/dev/null 2>&1; then
  KEY_HASH_JOEL=${KEY_HASH_JOEL:-$(deployed_var KEY_HASH_JOEL)}
  KEY_HASH_NANCY=${KEY_HASH_NANCY:-$(deployed_var KEY_HASH_NANCY)}
  [[ -n "$VAPID_PUBLIC" ]] || VAPID_PUBLIC=$(deployed_var VAPID_PUBLIC)
  [[ -n "$VAPID_PRIVATE" ]] || VAPID_PRIVATE=$(deployed_var VAPID_PRIVATE)
fi
: "${KEY_HASH_JOEL:?KEY_HASH_JOEL is required on first deploy}"
: "${KEY_HASH_NANCY:?KEY_HASH_NANCY is required on first deploy}"
[[ "$VAPID_PUBLIC" == "None" || "$VAPID_PRIVATE" == "None" ]] && { VAPID_PUBLIC=""; VAPID_PRIVATE=""; }
[[ -n "$VAPID_PRIVATE" ]] || echo "warning: no VAPID keys; push notifications stay off" >&2

ENV_FILE=$(mktemp)
chmod 600 "$ENV_FILE"
trap 'rm -f "$ENV_FILE"' EXIT
TABLE="$TABLE" BUCKET="$BUCKET" FIRST_DAY="$FIRST_DAY" LAST_DAY="$LAST_DAY" KEY_HASH_JOEL="$KEY_HASH_JOEL" \
  KEY_HASH_NANCY="$KEY_HASH_NANCY" VAPID_PUBLIC="$VAPID_PUBLIC" VAPID_PRIVATE="$VAPID_PRIVATE" VAPID_SUBJECT="$VAPID_SUBJECT" \
  node -e '
    const names = ["TABLE", "BUCKET", "FIRST_DAY", "LAST_DAY", "KEY_HASH_JOEL", "KEY_HASH_NANCY", "VAPID_PUBLIC", "VAPID_PRIVATE", "VAPID_SUBJECT"];
    const Variables = Object.fromEntries(names.filter((name) => process.env[name]).map((name) => [name, process.env[name]]));
    process.stdout.write(JSON.stringify({ Variables }));' > "$ENV_FILE"
ENVIRONMENT="file://${ENV_FILE}"

if aws_ lambda get-function --function-name "$FUNCTION" >/dev/null 2>&1; then
  aws_ lambda update-function-code --function-name "$FUNCTION" --zip-file "fileb://${DIST}/function.zip" >/dev/null
  aws_ lambda wait function-updated-v2 --function-name "$FUNCTION"
  aws_ lambda update-function-configuration --function-name "$FUNCTION" --environment "$ENVIRONMENT" >/dev/null
  aws_ lambda wait function-updated-v2 --function-name "$FUNCTION"
  echo "updated function ${FUNCTION}"
else
  aws_ lambda create-function --function-name "$FUNCTION" --runtime nodejs22.x --handler src/index.handler \
    --role "$ROLE_ARN" --timeout 10 --memory-size 256 --architectures arm64 \
    --zip-file "fileb://${DIST}/function.zip" --environment "$ENVIRONMENT" >/dev/null
  aws_ lambda wait function-active-v2 --function-name "$FUNCTION"
  echo "created function ${FUNCTION}"
fi
aws_ lambda put-function-concurrency --function-name "$FUNCTION" --reserved-concurrent-executions 5 >/dev/null

# --- Function URL -------------------------------------------------------------
CORS="{\"AllowOrigins\":${ORIGINS_JSON},\"AllowMethods\":[\"GET\",\"PUT\",\"POST\"],\"AllowHeaders\":[\"authorization\",\"content-type\"],\"MaxAge\":86400}"
if aws_ lambda get-function-url-config --function-name "$FUNCTION" >/dev/null 2>&1; then
  aws_ lambda update-function-url-config --function-name "$FUNCTION" --auth-type NONE --cors "$CORS" >/dev/null
else
  aws_ lambda create-function-url-config --function-name "$FUNCTION" --auth-type NONE --cors "$CORS" >/dev/null
fi
aws_ lambda add-permission --function-name "$FUNCTION" --statement-id fm-url-public \
  --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE >/dev/null 2>&1 || true
aws_ lambda add-permission --function-name "$FUNCTION" --statement-id fm-url-invoke \
  --action lambda:InvokeFunction --principal '*' --invoked-via-function-url >/dev/null 2>&1 || true

URL=$(aws_ lambda get-function-url-config --function-name "$FUNCTION" --query FunctionUrl --output text)
echo "function URL: ${URL}"
