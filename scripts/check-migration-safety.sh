#!/bin/bash
# Migration Safety Checker
# Scans migration files for potentially destructive operations
# Usage: pnpm check:migration-safety

set -e

echo "🔍 Migration Safety Check"
echo "========================="
echo ""

ERRORS=0
WARNINGS=0

# Check if we're in production mode
if [ "$NODE_ENV" = "production" ] || [ "$CI" = "true" ]; then
  PRODUCTION_MODE=true
  echo "⚠️  Production/CI mode detected - strict checks enabled"
else
  PRODUCTION_MODE=false
  echo "ℹ️  Development mode - warnings only"
fi

# Find all migration SQL files
MIGRATION_DIR="prisma/migrations"
if [ ! -d "$MIGRATION_DIR" ]; then
  echo "❌ Migration directory not found: $MIGRATION_DIR"
  exit 1
fi

# Dangerous SQL patterns to check for
DANGEROUS_PATTERNS=(
  "DROP TABLE"
  "DROP DATABASE"
  "TRUNCATE"
  "DELETE FROM"
  "ALTER TABLE.*DROP COLUMN"
  "ALTER TABLE.*DROP CONSTRAINT"
)

# Warning patterns (less dangerous but should be reviewed)
WARNING_PATTERNS=(
  "ALTER TABLE.*ALTER COLUMN"
  "ALTER TABLE.*RENAME"
  "DROP INDEX"
  "DROP TYPE"
)

echo "Scanning migration files..."
echo ""

# Check each migration file
find "$MIGRATION_DIR" -name "*.sql" -type f | sort | while read -r migration_file; do
  migration_name=$(basename "$(dirname "$migration_file")")
  echo "📄 Checking: $migration_name"
  
  # Check for dangerous patterns
  for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if grep -qiE "$pattern" "$migration_file"; then
      echo "  ❌ DANGEROUS: Found '$pattern' in migration"
      ERRORS=$((ERRORS + 1))
      echo "     File: $migration_file"
      grep -niE "$pattern" "$migration_file" | sed 's/^/        /'
    fi
  done
  
  # Check for warning patterns
  for pattern in "${WARNING_PATTERNS[@]}"; do
    if grep -qiE "$pattern" "$migration_file"; then
      echo "  ⚠️  WARNING: Found '$pattern' in migration"
      WARNINGS=$((WARNINGS + 1))
      echo "     File: $migration_file"
      grep -niE "$pattern" "$migration_file" | sed 's/^/        /'
    fi
  done
done

# Check for db:reset script usage
echo ""
echo "Checking package.json scripts..."
if grep -q "force-reset\|--force-reset" package.json; then
  echo "  ⚠️  WARNING: Found 'force-reset' in package.json scripts"
  echo "     This will DROP ALL DATA - never use in production!"
  WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "========================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "✅ All migrations appear safe"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo "⚠️  Found $WARNINGS warning(s) - please review"
  if [ "$PRODUCTION_MODE" = "true" ]; then
    echo "❌ Warnings treated as errors in production mode"
    exit 1
  fi
  exit 0
else
  echo "❌ Found $ERRORS dangerous operation(s) and $WARNINGS warning(s)"
  echo ""
  echo "⚠️  DO NOT DEPLOY migrations with dangerous operations!"
  echo "    Review each migration carefully before applying to production."
  exit 1
fi
