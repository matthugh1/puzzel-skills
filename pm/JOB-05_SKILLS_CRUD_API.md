# JOB-05: Skills CRUD API ✅ COMPLETE

## Objective
Implement the core Skills API for creating, reading, updating, and archiving skills.

---

## Deliverables

- [x] List skills endpoint
- [x] Create skill endpoint
- [x] Get skill by ID
- [x] Update skill metadata
- [x] Archive skill (soft delete)

---

## Files Created

```
src/app/api/skills/
├── route.ts              # GET list, POST create
└── [id]/
    └── route.ts          # GET, PUT, DELETE
```

---

## API Endpoints

### GET /api/skills
List skills visible to the user.

**Query Params:**
- `category` - Filter by category
- `search` - Search name/description
- `status` - Filter by status (admin only)

**Response:**
```json
{
  "skills": [
    {
      "id": "...",
      "name": "Contract Analyzer",
      "description": "...",
      "category": "Legal",
      "tags": ["contracts", "legal"],
      "status": "PUBLISHED",
      "owner": { "id": "...", "name": "..." }
    }
  ]
}
```

### POST /api/skills
Create a new skill with initial version.

**Body:**
```json
{
  "name": "My Skill",
  "description": "...",
  "category": "Legal",
  "tags": ["tag1", "tag2"],
  "content": "The prompt content..."
}
```

### GET /api/skills/:id
Get skill with all versions.

### PUT /api/skills/:id
Update skill metadata (name, description, category, tags).

### DELETE /api/skills/:id
Archive the skill (soft delete, sets status to ARCHIVED).
