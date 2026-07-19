# ADR 013: Threat Model Methodology and Scope

## Status
Accepted — Kristov approved `docs/THREAT_MODEL.md` on 2026-07-05 (PLAN.md Step 9.2); the threat model is now authoritative.

## Context
Somnus stores some of the most sensitive personal data an app can hold: sexual activity (including adult-content usage), illness, alcohol consumption, nightly sleep schedules, coarse location (zip code), and an Oura personal access token that grants read access to cloud-stored health data. Security so far has been checklist-driven (PLAN.md "Security Review Process"): useful, but a checklist only catches what someone already thought to write down. PLAN.md Step 9 requires an explicit, human-approved threat model that all future code is written and reviewed against, using a systematic method that "makes omissions visible, not just catalogs known worries."

Several methodologies were considered:

- **STRIDE-per-element**: enumerate Spoofing/Tampering/Repudiation/Information disclosure/Denial of service/Elevation of privilege against every component and data flow in a diagram. Systematic by construction — a skipped cell is visible as a gap in the matrix.
- **LINDDUN**: privacy-specific (linkability, identifiability, …). Strong for multi-party data ecosystems; most of its categories collapse for a single-user local app, where the privacy threat *is* disclosure.
- **PASTA / attack trees**: attacker-centric simulation. Richer for adversary-heavy systems, but heavyweight to maintain per-PR and easy to leave incomplete without noticing — the opposite of the Step 9 requirement.

## Decision

1. **Method: STRIDE-per-element** over the system decomposition already maintained in `ARCHITECTURE.md` (C4). Elements are the C4 containers plus the trust-boundary-crossing data flows; each element gets all six STRIDE categories considered, and every cell is either populated with threat IDs or explicitly marked not-applicable **with a reason**. Omissions are therefore visible as empty, unexplained cells.
2. **Privacy folded into STRIDE**: for this single-user, local-first app, privacy harm is modeled as Information Disclosure against the data assets, plus explicit modeling of what third parties (Oura, Open-Meteo, NREL) learn by design. No separate LINDDUN pass.
3. **Asset-first framing**: threats are ranked by which asset they reach (the SQLite DB and the Oura token outrank everything else), not by exploit novelty.
4. **Bounded adversary model**: the model names the adversaries a local-first app realistically faces (malicious website in the same browser, co-resident users/processes, supply chain, malicious API responses, device theft) and declares the rest out of scope with rationale (e.g. a root-level OS compromise defeats any application-layer control). Out-of-scope items are listed in the document, not silently dropped.
5. **Every threat resolves**: each enumerated threat carries exactly one status — **Mitigated** (with code/config citation), **Partial**, **Accepted** (residual risk Kristov signs off on), or **Open** (must become a fix, an explicitly documented accepted risk, or a tracked issue in the Step 9.3 audit). Nothing may remain unclassified.
6. **Stable IDs**: threats are numbered `T-<nn>` and never renumbered; retired threats are struck through with a note, so PR impact statements and audit reports can cite them durably.
7. **Living document**: `docs/THREAT_MODEL.md` is canonical and must never lag the code — the same currency rule as `ARCHITECTURE.md`, enforced by the per-PR "Threat model impact" statement (PLAN.md Step 9.4). The trust-boundary diagram is a consolidated Mermaid view built against the same C4 containers and flows as `ARCHITECTURE.md` (kept consistent with them); a full per-view C4 overlay is deferred.

## Consequences

**Positive:**
- Systematic coverage with visible gaps; a reviewer can audit the matrix, not just the prose.
- Stable threat IDs give PR reviews, audit reports, and accepted-risk sign-offs something durable to cite.
- Asset-first ranking keeps attention on the DB + token rather than exotic low-impact vectors.

**Negative / costs:**
- STRIDE-per-element produces some low-value cells (e.g. DoS against a localhost API the user can just restart); marking them n/a with reasons is deliberate overhead.
- Two documents (ARCHITECTURE.md, THREAT_MODEL.md) must now be kept current per-PR; the impact statement makes that a merge-blocking check rather than a hope.

## References
- PLAN.md Step 9 (gate definition, deliverables, done-criteria)
- `docs/THREAT_MODEL.md` (the model this ADR governs)
- Shostack, *Threat Modeling: Designing for Security* (STRIDE-per-element)
