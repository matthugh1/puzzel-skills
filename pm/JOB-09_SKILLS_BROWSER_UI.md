# JOB-09: Skills Browser UI

## Objective
Create a browsable interface for discovering and viewing published skills.

---

## Features

### 1. Skills List Page (`/skills`)
- Grid/list view of published skills
- Search by name, description, tags
- Filter by category
- Sort by: newest, most used, alphabetical
- Pagination

### 2. Skill Detail Page (`/skills/[id]`)
- Skill metadata (name, description, category, tags)
- Owner information
- Version history
- Current published prompt (read-only view)
- "Copy to Clipboard" button
- Usage statistics (if tracked)

### 3. Category Navigation
- Sidebar or top nav with categories
- Tag cloud for quick filtering

---

## Files to Create

```
src/app/
├── skills/
│   ├── page.tsx              # Skills list
│   ├── [id]/
│   │   └── page.tsx          # Skill detail
│   └── layout.tsx            # Skills layout with nav
src/components/
├── skills/
│   ├── SkillCard.tsx         # Card component for list
│   ├── SkillDetail.tsx       # Detail view component
│   ├── SkillSearch.tsx       # Search input
│   ├── CategoryFilter.tsx    # Category filter
│   └── VersionHistory.tsx    # Version list
```

---

## UI Components

### SkillCard
```tsx
interface SkillCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  owner: { name: string };
  updatedAt: Date;
}
```

### SkillDetail
```tsx
interface SkillDetailProps {
  skill: Skill;
  versions: SkillVersion[];
  latestPublished: SkillVersion;
}
```

---

## Acceptance Criteria

- [ ] Users can browse all published skills
- [ ] Search filters skills by name/description/tags
- [ ] Category filter works correctly
- [ ] Skill detail shows full information
- [ ] Prompt content can be copied to clipboard
- [ ] Responsive design (mobile-friendly)
- [ ] Loading states and error handling
