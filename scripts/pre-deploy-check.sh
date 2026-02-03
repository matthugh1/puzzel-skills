#!/bin/bash
# Pre-Deployment Security Check
# Validates environment variables and security configuration before deployment
# Usage: pnpm pre-deploy:check

set -e

echo "🔍 Pre-Deployment Security Check"
echo "=================================="
echo ""

ERRORS=0

# Check if .env file exists
if [ -f .env.local ]; then
  echo "📄 Loading .env.local..."
  export $(cat .env.local | grep -v '^#' | xargs)
elif [ -f .env ]; then
  echo "📄 Loading .env..."
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "⚠️  No .env file found. Checking environment variables..."
fi

# Required environment variables
REQUIRED_VARS=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL")

echo ""
echo "Checking required environment variables..."
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ $var is set"
  fi
done

# Validate NEXTAUTH_SECRET strength
echo ""
echo "Validating NEXTAUTH_SECRET..."
if [ -n "$NEXTAUTH_SECRET" ]; then
  SECRET_LENGTH=${#NEXTAUTH_SECRET}
  if [ $SECRET_LENGTH -lt 32 ]; then
    echo "❌ NEXTAUTH_SECRET is too short (${SECRET_LENGTH} chars, minimum 32)"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ NEXTAUTH_SECRET length is sufficient (${SECRET_LENGTH} chars)"
  fi
  
  # Check for weak default values
  if [[ "$NEXTAUTH_SECRET" == *"dev-secret"* ]] || [[ "$NEXTAUTH_SECRET" == *"change-in-production"* ]]; then
    echo "❌ NEXTAUTH_SECRET contains weak default values"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "⚠️  NEXTAUTH_SECRET not set (will fail at runtime)"
fi

# Validate NEXTAUTH_URL
echo ""
echo "Validating NEXTAUTH_URL..."
if [ -n "$NEXTAUTH_URL" ]; then
  if [ "$NODE_ENV" = "production" ] && [[ ! "$NEXTAUTH_URL" =~ ^https:// ]]; then
    echo "❌ NEXTAUTH_URL must use HTTPS in production"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ NEXTAUTH_URL format is valid"
  fi
fi

# Validate ALLOWED_ORIGIN (if set)
echo ""
echo "Validating ALLOWED_ORIGIN..."
if [ -n "$ALLOWED_ORIGIN" ]; then
  if [ "$NODE_ENV" = "production" ] && [[ ! "$ALLOWED_ORIGIN" =~ ^https:// ]]; then
    echo "❌ ALLOWED_ORIGIN must use HTTPS in production"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ ALLOWED_ORIGIN format is valid"
  fi
else
  echo "⚠️  ALLOWED_ORIGIN not set (will default to localhost:3000)"
fi

# Validate DATABASE_URL
echo ""
echo "Validating DATABASE_URL..."
if [ -n "$DATABASE_URL" ]; then
  if [ "$NODE_ENV" = "production" ] && [[ ! "$DATABASE_URL" =~ sslmode=require ]]; then
    echo "⚠️  DATABASE_URL should use SSL (sslmode=require) in production"
  else
    echo "✅ DATABASE_URL format is valid"
  fi
fi

# Check NODE_ENV
echo ""
echo "Checking NODE_ENV..."
if [ -z "$NODE_ENV" ]; then
  echo "⚠️  NODE_ENV not set (will default to 'development')"
elif [ "$NODE_ENV" = "production" ]; then
  echo "✅ NODE_ENV is set to production"
else
  echo "ℹ️  NODE_ENV is set to: $NODE_ENV"
fi

# Check migration safety
echo ""
echo "=========================================="
echo "Checking migration safety..."
if bash scripts/check-migration-safety.sh; then
  echo "✅ Migration safety check passed"
else
  echo "❌ Migration safety check failed"
  ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ All security checks passed!"
  exit 0
else
  echo "❌ Found $ERRORS error(s). Please fix before deploying."
  exit 1
fi
