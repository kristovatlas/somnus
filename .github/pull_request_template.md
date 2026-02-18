## Summary
<!-- 1-3 bullet points describing what changed and why -->

## Test plan
<!-- How was this tested? -->

## Security checklist
- [ ] No secrets or tokens in code or logs
- [ ] No raw SQL — all queries through SQLAlchemy ORM
- [ ] User input validated via Pydantic schemas
- [ ] CORS restricted to localhost origins
- [ ] No new dependencies without justification
- [ ] `pip-audit` / `npm audit` clean
- [ ] No sensitive data (Oura tokens, health data) logged
