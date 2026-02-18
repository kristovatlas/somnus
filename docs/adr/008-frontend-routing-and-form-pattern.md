# ADR 008: Frontend Routing and Form Pattern

## Status
Accepted

## Context
Step 3 introduces the first user-facing frontend: an onboarding wizard and daily log form. We need patterns for client-side routing, navigation guards (onboarding gate), form state management, and data submission.

## Decision

### Routing
- **react-router-dom v7** for client-side routing.
- Date embedded in URL: `/log/:date` enables browser back/forward and bookmarks.
- `/onboarding` for the setup wizard.
- Layout component acts as guard: redirects to `/onboarding` if `onboarding_completed` is false, and away from `/onboarding` if already completed.

### Form Pattern: Whole-Log PUT
- The daily log form collects all edits in local React state (`useState` with a `DailyLogCreate` object).
- On save, the entire object is submitted via `PUT /api/daily-log/{date}`.
- The backend handles the upsert atomically — deleting old entries and creating new ones.
- This avoids complex per-entry CRUD from the frontend and prevents race conditions.

### Out-to-Create Transform
- When loading an existing log via GET, the `useDailyLog` hook strips `id` and `date` from each `*Out` entry to produce `*Create` form state.
- This keeps the form state shape identical whether creating or editing.

### No Form Library
- Controlled components with `useState`. The form shape mirrors the Pydantic schema exactly.
- No Formik, react-hook-form, or similar — the overhead is not justified for a single composite form.

### Onboarding Per-Step Save
- Each onboarding step PATCHes settings immediately on change.
- Progress survives browser close since settings are persisted server-side.

### Section Collapse Persistence
- Each collapsible section stores open/closed state in localStorage.
- Key format: `somnus-section-{storageKey}`.

## Consequences
- URL-based date navigation is bookmarkable and shareable.
- Whole-log PUT is simple but means the entire log is replaced on each save — acceptable for a single-user local app.
- No form library means manual validation, but Pydantic handles server-side validation and returns warnings.
