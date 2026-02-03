# Compliance Analyzer Application

A compliance analysis application that enables users to upload documents, select compliance skills from the skills-library, and analyze documents for compliance against specific standards or requirements.

## Features

- ✅ Upload multiple document types (PDF, DOCX, DOC, TXT, RTF)
- ✅ Select compliance skills from skills-library
- ✅ Automated compliance analysis using LLM
- ✅ Structured compliance results with scores, findings, violations, and recommendations
- ✅ Analysis history tracking
- ✅ Document management and filtering

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL database
- Skills-library application running (port 3006)
- Platform-core with LLM provider configured

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables (if needed):
```bash
# .env
SKILLS_LIBRARY_URL=http://localhost:3006
UPLOAD_DIR=./uploads/compliance-analyzer
```

3. Run database migrations:
```bash
cd shared/packages/database
pnpm prisma migrate deploy
pnpm prisma generate
```

4. Register the application in platform-core:
```bash
# Register application
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Compliance Analyzer",
    "slug": "compliance-analyzer",
    "description": "Analyze documents for compliance against specific standards",
    "url": "http://localhost:3008"
  }'
```

5. Create permissions:
```bash
# Get the application ID from step 4, then create permissions
curl -X POST http://localhost:3002/api/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "YOUR_APP_ID",
    "name": "View Documents",
    "slug": "view",
    "description": "Permission to view documents"
  }'

curl -X POST http://localhost:3002/api/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "YOUR_APP_ID",
    "name": "Upload Documents",
    "slug": "upload",
    "description": "Permission to upload documents"
  }'

curl -X POST http://localhost:3002/api/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "YOUR_APP_ID",
    "name": "Analyze Documents",
    "slug": "analyze",
    "description": "Permission to analyze documents"
  }'
```

6. Enable application for users:
```bash
curl -X POST http://localhost:3000/api/applications/YOUR_APP_ID/enable \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "enabled": true
  }'
```

7. Start the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:3008`

## API Endpoints

- `POST /api/documents/upload` - Upload document(s)
- `GET /api/documents` - List user's documents
- `GET /api/documents/[id]` - Get document details
- `POST /api/documents/[id]/analyze` - Analyze a document
- `GET /api/documents/[id]/analysis` - Get analysis results
- `GET /api/skills` - List available skills from skills-library

## Architecture

- **File Storage**: Local filesystem (can be upgraded to cloud storage)
- **Document Extraction**: pdf-parse for PDFs, mammoth for DOCX
- **Skills Integration**: HTTP API calls to skills-library
- **Compliance Analysis**: LLM service from platform-core
- **Database**: Prisma ORM with PostgreSQL

## Technology Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Prisma ORM
- Tailwind CSS (for styling)

## Development

### Running the Application

```bash
pnpm dev
```

### Building

```bash
pnpm build
```

### Type Checking

```bash
pnpm type-check
```

## License

Private - Internal Use Only
