# JOB-07: Approval Workflow API ✅ COMPLETE

## Objective
Implement the approval workflow for skill versions - submit, approve, and reject actions.

---

## Deliverables

- [x] Submit for approval endpoint
- [x] Approve version endpoint
- [x] Reject version endpoint
- [x] Self-approval prevention

---

## Files Created

```
src/app/api/skills/[id]/
├── submit/route.ts     # POST - submit for approval
├── approve/route.ts    # POST - approve version
└── reject/route.ts     # POST - reject version
```

---

## API Endpoints

### POST /api/skills/:id/submit
Submit a version for approval.

**Body:**
```json
{
  "versionId": "version-uuid"
}
```

**Requirements:**
- Version must be in DRAFT status
- User must own the skill

**Effects:**
- Version status → PENDING_APPROVAL
- Skill status → PENDING_APPROVAL (if first submission)

---

### POST /api/skills/:id/approve
Approve a pending version.

**Body:**
```json
{
  "versionId": "version-uuid",
  "comments": "Optional approval comments"
}
```

**Requirements:**
- Version must be in PENDING_APPROVAL status
- User must have `skills:approve` permission
- User cannot approve their own submission

**Effects:**
- Version status → PUBLISHED
- Skill status → PUBLISHED
- Records approver and timestamp

---

### POST /api/skills/:id/reject
Reject a pending version.

**Body:**
```json
{
  "versionId": "version-uuid",
  "reason": "Required rejection reason"
}
```

**Requirements:**
- Version must be in PENDING_APPROVAL status
- User must have `skills:approve` permission
- Reason is required

**Effects:**
- Version status → REJECTED
- Skill status → DRAFT (if no published versions exist)
- Records rejector, reason, and timestamp
