# JOB-10: Skill Editor UI

## Objective
Create an interface for creating and editing skills with version management.

---

## Features

### 1. My Skills Page (`/my-skills`)
- List of skills owned by current user
- Status badges (Draft, Pending, Published)
- Quick actions: Edit, Submit, Archive

### 2. Create Skill Page (`/my-skills/new`)
- Form for skill metadata
- Prompt editor (large textarea or Monaco editor)
- Save as draft
- Submit for approval

### 3. Edit Skill Page (`/my-skills/[id]/edit`)
- Edit metadata
- View all versions
- Create new version
- Compare versions (diff view)

### 4. Prompt Editor Component
- Large text area with syntax highlighting (optional)
- Variable placeholder support: `{{variable_name}}`
- Character/token count
- Preview mode

---

## Files to Create

```
src/app/
├── my-skills/
│   ├── page.tsx              # My skills list
│   ├── new/
│   │   └── page.tsx          # Create skill
│   └── [id]/
│       ├── page.tsx          # View own skill
│       └── edit/
│           └── page.tsx      # Edit skill
src/components/
├── editor/
│   ├── PromptEditor.tsx      # Main editor component
│   ├── VariableHelper.tsx    # Variable insertion UI
│   ├── PreviewPane.tsx       # Preview with sample data
│   └── VersionDiff.tsx       # Version comparison
├── forms/
│   ├── SkillForm.tsx         # Metadata form
│   └── VersionForm.tsx       # New version form
```

---

## Form Fields

### Skill Metadata
- Name (required)
- Description (optional, markdown)
- Category (dropdown)
- Tags (multi-select/chips)
- Visibility (Private/Team/Org)

### Version
- Content (the prompt)
- Changelog (what changed)

---

## Workflows

### Create New Skill
1. Fill metadata form
2. Write initial prompt
3. Save as draft
4. Submit for approval (optional)

### Create New Version
1. Load current version content
2. Edit prompt
3. Add changelog
4. Save as draft
5. Submit for approval

---

## Acceptance Criteria

- [ ] Users can create new skills with metadata
- [ ] Prompt editor supports multiline text
- [ ] Skills save as DRAFT initially
- [ ] Users can create new versions of existing skills
- [ ] Changelog is required for new versions
- [ ] Submit for approval changes status to PENDING_APPROVAL
- [ ] Form validation with helpful error messages
- [ ] Unsaved changes warning
