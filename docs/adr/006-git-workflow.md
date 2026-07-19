# ADR 006: Relaxed Git Flow with Security Review

## Status
Accepted

## Context
Somnus handles sensitive personal health data. We need a contribution workflow that:
- Keeps `main` always in a user-ready, releasable state
- Allows feature development without destabilizing the integration branch
- Enforces security review on every change (health data, API tokens, external integrations)
- Is simple enough for a small team without excessive ceremony

Options considered:
- **GitHub Flow** (feature → main): Simple, but main would contain incomplete features between releases
- **Full Git Flow** (feature → develop → release → main → hotfix): Too ceremonial for our scale
- **Trunk-based development**: Fast, but no clear "release-ready" gate — risky for a health data app

## Decision
Use a relaxed git flow:

```
main    ← Tagged releases only. Always user-ready.
  └── dev    ← Integration branch. Working state, tests pass.
       ├── feature/*   ← One branch per feature
       └── fix/*       ← Bug fix branches
```

**Rules:**
- `main` only receives merges from `dev` when a version is complete
- Every merge to `main` is tagged with semver (`vX.Y.Z`)
- Feature/fix branches merge to `dev` via PR with squash merge
- All PRs require: passing CI (tests, lint, types, coverage) + security review

**Security review on every PR:**
- Automated: `pip-audit`, `npm audit`, `bandit`, secret scanning (`gitleaks`)
- Manual checklist: no token leaks, no raw SQL, validated inputs, CORS localhost-only, no unnecessary external calls, justified dependencies

**Versioning:** Semantic versioning
- `0.x.y` during initial development
- MAJOR: Breaking data model/API changes
- MINOR: New features
- PATCH: Bug fixes

## Consequences
**Positive:**
- `main` is always safe to clone and run — users get a complete, tested version
- Security review catches vulnerabilities before they reach any shared branch
- Feature branches allow parallel development without conflicts
- Squash merges keep history clean and reviewable
- Clear release process with tags and changelog

**Negative:**
- Slightly more overhead than direct-to-main (extra branch, extra merge)
- `dev` can temporarily be unstable if a bad feature merge slips through
- Requires discipline to keep `dev` in a working state
- Small team may find the ceremony unnecessary at first — but it scales well and protects data
