# Migration Safety Guide

This document outlines best practices for safe database migrations in production environments.

## ⚠️ Critical Rules

### NEVER Use in Production

1. **`prisma db push --force-reset`** - This DROPS ALL TABLES and recreates them
2. **`prisma migrate reset`** - This drops the database and recreates it
3. **`db:reset` script** - Uses `--force-reset` flag (development only)

### Always Use in Production

1. **`prisma migrate deploy`** - Applies pending migrations safely
2. **Review migrations before deploying** - Use `pnpm check:migration-safety`
3. **Backup database before migrations** - Always have a rollback plan

## Migration Workflow

### Development

```bash
# 1. Make schema changes
# Edit prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name descriptive_name

# 3. Check migration safety
pnpm check:migration-safety

# 4. Review the generated SQL
cat prisma/migrations/[timestamp]_descriptive_name/migration.sql

# 5. Test locally
pnpm db:seed  # If needed
```

### Production Deployment

```bash
# 1. Pre-deployment checks (includes migration safety)
pnpm pre-deploy:check

# 2. Backup database (CRITICAL)
# Use your database provider's backup tool or:
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Apply migrations
npx prisma migrate deploy

# 4. Verify application works
# Test critical paths after migration
```

## Dangerous Operations

The migration safety checker flags these dangerous patterns:

### ❌ Blocked Operations
- `DROP TABLE` - Deletes entire tables
- `DROP DATABASE` - Deletes entire database
- `TRUNCATE` - Deletes all rows from table
- `DELETE FROM` - Deletes rows (without WHERE clause)
- `ALTER TABLE ... DROP COLUMN` - Removes columns
- `ALTER TABLE ... DROP CONSTRAINT` - Removes constraints

### ⚠️ Warning Operations (Review Required)
- `ALTER TABLE ... ALTER COLUMN` - Changes column types (may lose data)
- `ALTER TABLE ... RENAME` - Renames tables/columns
- `DROP INDEX` - Removes indexes (may impact performance)
- `DROP TYPE` - Removes custom types

## Safe Migration Patterns

### Adding New Tables/Columns
```sql
-- ✅ Safe: Adding new nullable column
ALTER TABLE "users" ADD COLUMN "new_field" TEXT;

-- ✅ Safe: Adding new table
CREATE TABLE "new_table" (...);
```

### Modifying Existing Data
```sql
-- ✅ Safe: Adding default value to existing column
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';

-- ⚠️ Review: Changing column type (may lose data)
ALTER TABLE "users" ALTER COLUMN "age" TYPE INTEGER USING age::integer;
```

### Removing Columns (Dangerous)
```sql
-- ❌ Dangerous: Drops column immediately
ALTER TABLE "users" DROP COLUMN "old_field";

-- ✅ Safer: Multi-step process
-- Step 1: Stop using the column in application code
-- Step 2: Wait for deployment
-- Step 3: Drop column in next migration
ALTER TABLE "users" DROP COLUMN "old_field";
```

## Migration Safety Checklist

Before deploying any migration to production:

- [ ] Migration safety check passes (`pnpm check:migration-safety`)
- [ ] Reviewed migration SQL file manually
- [ ] Database backup created
- [ ] Tested migration on staging/dev database
- [ ] Rollback plan documented
- [ ] Team notified of migration (if significant)
- [ ] Low-traffic window scheduled (if major changes)

## CI/CD Integration

The migration safety checker runs automatically in:
- Pre-deployment checks (`pnpm pre-deploy:check`)
- CI pipelines (when `CI=true`)

In CI/production mode, warnings are treated as errors.

## Emergency Rollback

If a migration causes issues:

1. **Stop the application** (prevent further damage)
2. **Restore from backup**:
   ```bash
   psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
   ```
3. **Revert application code** to previous version
4. **Investigate** what went wrong
5. **Fix migration** and test thoroughly before retrying

## Best Practices

1. **Small, incremental migrations** - Easier to review and rollback
2. **Backward compatible changes** - Add columns as nullable first
3. **Data migration scripts** - Separate from schema migrations
4. **Test migrations** - Always test on copy of production data
5. **Document breaking changes** - Note any required application changes
6. **Monitor after deployment** - Watch for errors or performance issues

## Example: Safe Column Addition

```typescript
// Step 1: Add nullable column
// Migration: 001_add_optional_field.sql
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

// Step 2: Deploy application that uses new field
// Application code can now read/write phone field

// Step 3: Backfill data (if needed)
// Migration: 002_backfill_phone.sql
UPDATE "users" SET "phone" = ... WHERE "phone" IS NULL;

// Step 4: Make column required (if needed)
// Migration: 003_make_phone_required.sql
ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;
```

## Resources

- [Prisma Migration Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)
- [Database Migration Strategies](https://martinfowler.com/articles/evodb.html)
