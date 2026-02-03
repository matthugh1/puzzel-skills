# JOB-11: Approval Dashboard UI

## Objective
Create a dashboard for approvers to review and approve/reject skill submissions.

---

## Features

### 1. Approval Queue (`/approvals`)
- List of skills/versions pending approval
- Filter by category, submitter
- Sort by submission date
- Quick preview

### 2. Review Page (`/approvals/[skillId]/[versionId]`)
- Full skill metadata
- Version content (the prompt)
- Diff against previous published version (if exists)
- Submitter information
- Submission date/time
- Approve/Reject buttons with comment field

### 3. Approval History
- List of recently approved/rejected items
- Filter by status, date range
- Export capability (optional)

---

## Files to Create

```
src/app/
├── approvals/
│   ├── page.tsx              # Approval queue
│   ├── [skillId]/
│   │   └── [versionId]/
│   │       └── page.tsx      # Review page
│   └── history/
│       └── page.tsx          # Approval history
src/components/
├── approvals/
│   ├── ApprovalQueue.tsx     # Queue list
│   ├── ApprovalCard.tsx      # Queue item card
│   ├── ReviewPanel.tsx       # Review interface
│   ├── ApprovalActions.tsx   # Approve/Reject buttons
│   └── VersionDiff.tsx       # Diff viewer (reuse from editor)
```

---

## Review Interface

### Information Display
- Skill name and description
- Category and tags
- Submitter name and email
- Submission timestamp
- Version number
- Previous version (if exists)

### Diff View
- Side-by-side or unified diff
- Highlight additions (green) and deletions (red)
- Line numbers

### Actions
- **Approve**: Publishes the version, optional comment
- **Reject**: Returns to draft, requires reason
- **Request Changes**: (future) Add inline comments

---

## Acceptance Criteria

- [ ] Approvers see only PENDING_APPROVAL items
- [ ] Queue shows relevant metadata for quick triage
- [ ] Review page shows full version content
- [ ] Diff view compares against previous published version
- [ ] Approve action publishes the version
- [ ] Reject action requires a reason
- [ ] Approvers cannot approve their own submissions
- [ ] History page shows past decisions
- [ ] Email notification to submitter (future/optional)
