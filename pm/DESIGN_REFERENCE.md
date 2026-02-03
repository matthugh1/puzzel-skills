# Design Reference - Puzzel Nordic Design System

**All UI jobs (JOB-09 through JOB-12) must follow these design principles.**

---

## Core Philosophy

> **"No clutter, no complexity"** - practical, people-first design

Puzzel's Nordic design values: **Simplicity, Trust, and Innovation**

---

## Critical Rules

### ✅ DO
- White backgrounds (`var(--color-background)`)
- Dark text (`var(--color-text)`)
- Purple accents (`var(--color-primary)`)
- Generous whitespace
- Height-constrained pages (`max-height: 100vh`)
- Scrollable content sections
- CSS variables for all values

### ❌ DON'T
- Dark backgrounds
- White text on dark
- Glass morphism effects
- Cyan/teal colors
- Unlimited page heights
- Tailwind opacity classes (`bg-white/5`)

---

## Color Palette

```css
/* Primary - Purple */
--color-primary: #8b5cf6
--color-primary-dark: #7c3aed
--color-primary-light: #a78bfa

/* Backgrounds - Always White */
--color-background: #ffffff
--color-surface: #ffffff
--color-surface-secondary: #f8fafc
--color-surface-tertiary: #f1f5f9

/* Text - Dark */
--color-text: #0f172a
--color-text-secondary: #64748b
--color-text-muted: #94a3b8

/* Borders */
--color-border: #e2e8f0

/* Semantic */
--color-success: #10b981
--color-warning: #f59e0b
--color-danger: #ef4444
```

---

## Typography

- **Display Font**: Space Grotesk (headings)
- **Body Font**: DM Sans (body text)

| Element | Size | Weight |
|---------|------|--------|
| H1 | 2.25rem (36px) | 700 |
| H2 | 1.875rem (30px) | 600 |
| H3 | 1.5rem (24px) | 600 |
| Body | 1rem (16px) | 400 |
| Small | 0.875rem (14px) | 400 |

---

## Components

### Cards
```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: var(--radius-lg);
box-shadow: var(--shadow-md);
padding: var(--spacing-lg);
```

### Buttons
```css
/* Primary */
background: var(--color-primary);
color: white;
border-radius: var(--radius-md);

/* Secondary */
background: var(--color-surface-secondary);
color: var(--color-text);
border: 1px solid var(--color-border);
```

### Inputs
```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: var(--radius-md);
/* Focus: purple border + subtle glow */
```

### Badges (Status)
- **Draft**: Gray (`--color-surface-secondary`)
- **Pending**: Amber (#fef3c7)
- **Published**: Green (#d1fae5)
- **Rejected**: Red (#fee2e2)

---

## Page Layout

```tsx
// Height-constrained layout
<div className="page-container"> {/* h-screen max-h-screen overflow-hidden */}
  <header className="page-header"> {/* flex-shrink-0, border-bottom */}
    {/* Title, actions */}
  </header>
  <main className="page-content"> {/* flex-1 overflow-y-auto */}
    {/* Scrollable content */}
  </main>
</div>
```

---

## Navigation

- **Desktop**: Vertical sidebar (240px) on left
- **Active State**: Purple accent bar + light purple background
- **Hover**: Subtle background change

### Structure
```
User Navigation (visible to all)
├── Skills Browser
├── My Skills
└── Approvals (if approver)

System Navigation (admin only)
├── Users
├── Roles
├── Categories
└── Audit Log
```

---

## Design Checklist

Before submitting any UI work:

- [ ] White backgrounds only
- [ ] Dark text on white
- [ ] Purple accents for primary actions
- [ ] Page height constrained
- [ ] Scrollable content areas
- [ ] CSS variables used
- [ ] Responsive design
- [ ] Loading states
- [ ] Error states
- [ ] Accessible (keyboard nav, ARIA labels)

---

## Reference Files

- **Full Design System**: `docs/DESIGN_SYSTEM.md`
- **CSS Variables**: `src/app/globals.css`
