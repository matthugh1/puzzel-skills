# JOB-06: Versioning API ✅ COMPLETE

## Objective
Implement version management for skills - creating new versions and listing version history.

---

## Deliverables

- [x] List versions endpoint
- [x] Create new version endpoint
- [x] Version number auto-increment

---

## Files Created

```
src/app/api/skills/[id]/versions/
└── route.ts          # GET list, POST create
```

---

## API Endpoints

### GET /api/skills/:id/versions
List all versions of a skill.

**Response:**
```json
{
  "versions": [
    {
      "id": "...",
      "version": 2,
      "content": "The prompt...",
      "changelog": "Added new section",
      "status": "DRAFT",
      "createdBy": { "id": "...", "name": "..." },
      "createdAt": "2024-..."
    },
    {
      "id": "...",
      "version": 1,
      "status": "PUBLISHED",
      "approvedBy": { "id": "...", "name": "..." },
      "approvedAt": "2024-..."
    }
  ]
}
```

### POST /api/skills/:id/versions
Create a new version.

**Body:**
```json
{
  "content": "Updated prompt content...",
  "changelog": "What changed in this version"
}
```

**Response:**
```json
{
  "version": {
    "id": "...",
    "version": 3,
    "content": "...",
    "changelog": "...",
    "status": "DRAFT",
    "createdBy": { ... }
  }
}
```

---

## Version Status Flow

```
DRAFT → (submit) → PENDING_APPROVAL → (approve) → PUBLISHED
                                    → (reject)  → REJECTED
```
