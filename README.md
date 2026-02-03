# Skills Library

A platform for creating, versioning, approving, and sharing AI prompts (skills) across Puzzel.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start the database
pnpm db:up

# 3. Generate Prisma client
pnpm db:generate

# 4. Push schema to database
pnpm db:push

# 5. Start development server
pnpm dev

# 6. Verify health check
curl http://localhost:3000/api/health
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm db:up` | Start PostgreSQL (Docker) |
| `pnpm db:down` | Stop PostgreSQL |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database (dev only) |
| `pnpm db:seed` | Seed database with initial data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm check:migration-safety` | Check migrations for dangerous operations |
| `pnpm pre-deploy:check` | Run all pre-deployment checks |

### ⚠️ Database Migration Safety

**NEVER use these commands in production:**
- `pnpm db:reset` - **DROPS ALL DATA** (development only)
- `prisma db push --force-reset` - **DROPS ALL TABLES**

**Always use for production:**
- `npx prisma migrate deploy` - Safely applies pending migrations
- `pnpm check:migration-safety` - Validates migrations before deployment
- `pnpm pre-deploy:check` - Includes migration safety check

See [Migration Safety Guide](./docs/migration-safety.md) for detailed best practices.

## Project Structure

```
skills-library/
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── health/    # Health check endpoint
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── db.ts          # Prisma client
│   │   └── env.ts         # Environment validation
│   ├── providers/
│   │   └── index.tsx      # React providers
│   └── types/
│       └── index.ts       # Shared types
├── docker-compose.yml     # Local database
├── .env.example           # Environment template
└── .env.local             # Local environment (gitignored)
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Auth session secret |
| `NEXTAUTH_URL` | Application URL |

## Build Jobs

This project is being built following the job specifications in:
`/Claude CoWork/skills-library-build/`

Current status: JOB-01 (Project Scaffolding) - In Progress

## Documentation

- [Project Reference](../Claude%20CoWork/skills-library-build/PROJECT_REFERENCE.md)
- [Job Specifications](../Claude%20CoWork/skills-library-build/jobs/)
