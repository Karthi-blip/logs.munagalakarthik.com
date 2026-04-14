#!/bin/bash
# logs.munagalakarthik.com — AWS Infrastructure Setup
# Run each block one at a time. Copy the output values into myreadme.md as you go.
# Prerequisites: aws cli configured, correct AWS account

set -e

BUCKET="logs.munagalakarthik.com"
REGION="us-east-1"
DOMAIN="logs.munagalakarthik.com"
ROOT_DOMAIN="munagalakarthik.com"

# ─────────────────────────────────────────────
# STEP 1 — S3 Bucket
# ─────────────────────────────────────────────

echo ">>> Creating S3 bucket..."

aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION"

aws s3api delete-public-access-block \
  --bucket "$BUCKET"

aws s3api put-bucket-policy \
  --bucket "$BUCKET" \
  --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Sid\": \"PublicReadGetObject\",
      \"Effect\": \"Allow\",
      \"Principal\": \"*\",
      \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::${BUCKET}/*\"
    }]
  }"

aws s3api put-bucket-website \
  --bucket "$BUCKET" \
  --website-configuration '{
    "IndexDocument": {"Suffix": "index.html"},
    "ErrorDocument": {"Key": "404.html"}
  }'

echo "✅ S3 bucket ready: $BUCKET"

# ─────────────────────────────────────────────
# STEP 2 — ACM Certificate
# ─────────────────────────────────────────────

echo ">>> Requesting ACM certificate..."

CERT_ARN=$(aws acm request-certificate \
  --domain-name "$DOMAIN" \
  --validation-method DNS \
  --region "$REGION" \
  --query "CertificateArn" \
  --output text)

echo "Certificate ARN: $CERT_ARN"
echo ">>> Save this ↑ in myreadme.md"

# Get the DNS validation CNAME record
echo ">>> Waiting 10s for cert details..."
sleep 10

aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region "$REGION" \
  --query "Certificate.DomainValidationOptions[0].ResourceRecord" \
  --output table

echo ">>> Add the CNAME record above to Route 53 (Step 3 does this automatically)"

# ─────────────────────────────────────────────
# STEP 3 — Route 53: ACM Validation CNAME
# ─────────────────────────────────────────────

echo ">>> Getting hosted zone ID..."

ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='${ROOT_DOMAIN}.'].Id" \
  --output text | sed 's|/hostedzone/||')

echo "Hosted Zone ID: $ZONE_ID"

# Get validation CNAME name and value
CNAME_NAME=$(aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region "$REGION" \
  --query "Certificate.DomainValidationOptions[0].ResourceRecord.Name" \
  --output text)

CNAME_VALUE=$(aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region "$REGION" \
  --query "Certificate.DomainValidationOptions[0].ResourceRecord.Value" \
  --output text)

echo ">>> Adding ACM validation CNAME to Route 53..."

aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"${CNAME_NAME}\",
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"${CNAME_VALUE}\"}]
      }
    }]
  }"

echo ">>> Waiting for certificate to be issued (up to 5 min)..."
aws acm wait certificate-validated \
  --certificate-arn "$CERT_ARN" \
  --region "$REGION"

echo "✅ Certificate issued: $CERT_ARN"

# ─────────────────────────────────────────────
# STEP 4 — CloudFront Distribution
# ─────────────────────────────────────────────

echo ">>> Creating CloudFront distribution..."

S3_ORIGIN="${BUCKET}.s3-website-${REGION}.amazonaws.com"

CF_DIST_ID=$(aws cloudfront create-distribution \
  --distribution-config "{
    \"CallerReference\": \"logs-blog-$(date +%s)\",
    \"Comment\": \"logs.munagalakarthik.com blog\",
    \"Enabled\": true,
    \"DefaultRootObject\": \"index.html\",
    \"Aliases\": {
      \"Quantity\": 1,
      \"Items\": [\"${DOMAIN}\"]
    },
    \"Origins\": {
      \"Quantity\": 1,
      \"Items\": [{
        \"Id\": \"S3-${BUCKET}\",
        \"DomainName\": \"${S3_ORIGIN}\",
        \"CustomOriginConfig\": {
          \"HTTPPort\": 80,
          \"HTTPSPort\": 443,
          \"OriginProtocolPolicy\": \"http-only\"
        }
      }]
    },
    \"DefaultCacheBehavior\": {
      \"TargetOriginId\": \"S3-${BUCKET}\",
      \"ViewerProtocolPolicy\": \"redirect-to-https\",
      \"AllowedMethods\": {
        \"Quantity\": 2,
        \"Items\": [\"GET\", \"HEAD\"]
      },
      \"ForwardedValues\": {
        \"QueryString\": false,
        \"Cookies\": {\"Forward\": \"none\"}
      },
      \"MinTTL\": 0,
      \"DefaultTTL\": 86400,
      \"MaxTTL\": 31536000,
      \"Compress\": true
    },
    \"CustomErrorResponses\": {
      \"Quantity\": 2,
      \"Items\": [
        {
          \"ErrorCode\": 403,
          \"ResponsePagePath\": \"/404.html\",
          \"ResponseCode\": \"404\",
          \"ErrorCachingMinTTL\": 300
        },
        {
          \"ErrorCode\": 404,
          \"ResponsePagePath\": \"/404.html\",
          \"ResponseCode\": \"404\",
          \"ErrorCachingMinTTL\": 300
        }
      ]
    },
    \"ViewerCertificate\": {
      \"ACMCertificateArn\": \"${CERT_ARN}\",
      \"SSLSupportMethod\": \"sni-only\",
      \"MinimumProtocolVersion\": \"TLSv1.2_2021\"
    },
    \"PriceClass\": \"PriceClass_100\"
  }" \
  --query "Distribution.Id" \
  --output text)

echo "CloudFront Distribution ID: $CF_DIST_ID"
echo ">>> Save this ↑ in myreadme.md and GitHub secrets"

CF_DOMAIN=$(aws cloudfront get-distribution \
  --id "$CF_DIST_ID" \
  --query "Distribution.DomainName" \
  --output text)

echo "CloudFront Domain: $CF_DOMAIN"

# ─────────────────────────────────────────────
# STEP 5 — Route 53: logs → CloudFront
# ─────────────────────────────────────────────

echo ">>> Adding Route 53 A record: logs → CloudFront..."

aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"${DOMAIN}\",
        \"Type\": \"A\",
        \"AliasTarget\": {
          \"HostedZoneId\": \"Z2FDTNDATAQYW2\",
          \"DNSName\": \"${CF_DOMAIN}\",
          \"EvaluateTargetHealth\": false
        }
      }
    }]
  }"

echo "✅ DNS record created: logs.munagalakarthik.com → $CF_DOMAIN"

# ─────────────────────────────────────────────
# DONE — Print summary
# ─────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
echo "  AWS setup complete. Save these values:"
echo "════════════════════════════════════════"
echo "  S3 Bucket              : $BUCKET"
echo "  ACM Certificate ARN    : $CERT_ARN"
echo "  CloudFront Dist ID     : $CF_DIST_ID"
echo "  CloudFront Domain      : $CF_DOMAIN"
echo "  Route 53 Zone ID       : $ZONE_ID"
echo "════════════════════════════════════════"
echo ""
echo "Next: add CF_DIST_ID to GitHub secret CLOUDFRONT_DISTRIBUTION_ID"
echo "Then: run the first Hugo deploy (see myreadme.md)"
