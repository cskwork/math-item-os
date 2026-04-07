<!-- SYNC IMPACT REPORT
Version change: 1.0.0 -> 2.0.0 (MAJOR - all principles redefined)
Reason: Project scope changed from HWP-to-HTML converter to
  Math Knowledge Graph + Item OS (LaTeX math item platform)

Principles modified:
  I.   Parsing Fidelity -> Math Representation Integrity
  II.  Output Correctness and Accessibility -> Explainable Knowledge Structure
  III. Regression-Guarded Testing -> Automated Correctness Verification
  IV.  Bounded Resource Consumption -> Curriculum-Aligned Data Integrity

Sections modified:
  Quality Gates: HWP/HTML-specific gates removed, CAS/search gates added
  Development Workflow: HWP corpus management -> math item fixture management

Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ no changes needed (Constitution Check is dynamic)
  - .specify/templates/spec-template.md: ✅ no changes needed (generic template)
  - .specify/templates/tasks-template.md: ✅ no changes needed (generic template)

Follow-up TODOs:
  - Create tests/fixtures/items/ directory for reference math items
  - Create tests/fixtures/curriculum/ for 2022 curriculum skill graph data
  - Configure CAS verification test harness
  - Set up search performance benchmark with 80K+ item dataset
-->

# Math Item OS Constitution

## Core Principles

### I. Math Representation Integrity

Every math item MUST maintain a faithful, lossless triple
representation: LaTeX (authoring) + MathML (rendering) +
CAS expression tree (verification/comparison).

- LaTeX → MathML conversion MUST preserve all mathematical
  semantics. The rendered output MUST be visually identical to
  the authored LaTeX intent. Any conversion that alters meaning
  MUST be rejected with a structured error.
- LaTeX → CAS expression tree conversion MUST produce a
  normalized form suitable for equivalence checking, structural
  comparison, and automated solving. The CAS tree MUST round-trip
  back to semantically equivalent LaTeX.
- If any leg of the triple conversion fails, the item MUST be
  stored with the successful representations and the failed leg
  marked as `conversion_failed` with diagnostic detail. The item
  MUST NOT be silently dropped.
- Bulk import (CSV/JSON/QTI) MUST validate every item's LaTeX
  before storage. Items with unparseable LaTeX MUST be quarantined
  in an error report, not mixed into the main item pool.
- Item version history MUST be immutable. Edits MUST create a new
  version; previous versions MUST remain accessible and
  diffable.

**Rationale**: The triple representation is the foundation of
every downstream feature — search ranking uses CAS structure,
rendering uses MathML, authoring uses LaTeX. A corruption in any
leg cascades into wrong similarity scores, broken display, or
invalid generated variants.

### II. Explainable Knowledge Structure

Every recommendation, similarity ranking, and remediation path
MUST include a human-readable explanation of why it was produced.

- Similar item rankings MUST expose the contributing signals
  (skill match, formula structure similarity, prerequisite
  distance, difficulty proximity, misconception profile) and
  their relative weights for each result.
- Misconception-based remediation MUST present a step-by-step
  correction path (prerequisite review -> basic practice ->
  confirmation) with an explanation for each step's inclusion.
- The prerequisite skill graph MUST be a directed acyclic graph
  (DAG). Cycle detection MUST run on every edge insertion; a
  cycle MUST be rejected with an error identifying the offending
  path.
- Recommendation events MUST be persisted with full provenance:
  recommendation type, input parameters, output items, signal
  weights, and the explanation text. This log MUST be queryable
  for auditing and model improvement.
- Teacher feedback ("not relevant", "good match") on
  recommendations MUST be recorded and MUST influence future
  rankings for the same query context.

**Rationale**: The core differentiator of this platform is that
teachers can understand *why* an item is recommended, not just
*that* it is recommended. Black-box recommendations erode trust
and prevent pedagogical judgment. Explainability also enables
debugging of ranking quality issues.

### III. Automated Correctness Verification

Every generated or imported math item MUST pass automated CAS
verification before it can reach "approved" status.

- For generated variants: CAS MUST verify answer equivalence
  (the generated answer solves the generated equation), solution
  uniqueness (no extraneous solutions), and difficulty-range
  compliance (generated parameters fall within teacher-specified
  bounds).
- CAS verification MUST complete within 10 seconds per item.
  Items exceeding this timeout MUST be marked
  `verification_timeout` and MUST NOT be auto-approved.
- Items that fail CAS verification MUST be blocked from
  distribution. The failure reason MUST be recorded and
  surfaced to the teacher.
- AI-generated items MUST carry an "AI generated" label that
  persists through all downstream uses (assignments, exports,
  recommendations). This label MUST NOT be removable.
- Bulk-generated batches MUST achieve a 95%+ CAS pass rate.
  If a batch falls below this threshold, the entire generation
  template MUST be flagged for review.
- All verification results (pass/fail/timeout, failure reason,
  CAS engine version) MUST be stored as part of the item's
  audit trail.

**Rationale**: Math items with incorrect answers, extraneous
solutions, or unsolvable constraints actively harm students.
Unlike text content where errors are cosmetic, a wrong math
answer teaches wrong math. Automated verification is the only
scalable defense at 80K+ item scale.

### IV. Curriculum-Aligned Data Integrity

Every item MUST be classified against the Korean 2022 Revised
Curriculum structure, and metadata completeness MUST be
continuously enforced.

- Each item MUST carry: school level (elementary/middle/high),
  grade/semester, subject, unit hierarchy (large/medium/small),
  skill ID, achievement standard ID, difficulty profile,
  item type, expression type, and usage purpose
  (diagnostic/remediation/pre-exam/enrichment).
- Metadata completeness MUST be maintained at 95%+ across the
  entire item pool. Items missing required metadata MUST be
  flagged in a review queue and MUST NOT appear in
  recommendation results until tagged.
- Skill-to-standard mappings MUST follow the CASE
  (Competency and Academic Standards Exchange) format for
  machine-readability and interoperability.
- Item quality states (draft/reviewed/approved/retired) MUST
  be enforced as a state machine. Transitions MUST be audited.
  Only "approved" items MUST appear in teacher-facing search
  and recommendations.
- Copyright provenance MUST be tracked for every item. Items
  derived from copyrighted sources (exam archives, textbooks)
  MUST be flagged and MUST NOT be stored verbatim — only
  pattern analysis and AI-generated alternatives are permitted.
- All item mutations (create, edit, tag, state change,
  generate, recommend) MUST be recorded in an append-only
  audit log with actor, timestamp, and change detail.

**Rationale**: A math item bank without curriculum alignment is
just a search engine. The value proposition is that teachers find
items by pedagogical purpose (which skill, which prerequisite gap,
which misconception), not by keyword. Incomplete or inconsistent
metadata makes the knowledge graph unreliable and degrades every
feature built on top of it.

## Quality Gates

### Automated Checks (enforced on every pull request)

1. **Linting**: All source code MUST pass the project linter with
   zero warnings. The linter configuration MUST be committed to
   the repository and MUST NOT be overridden in individual files.
2. **Formatting**: All source code MUST conform to the project
   formatter. CI MUST run a format-check step that fails on diff.
3. **Type Checking**: All public API surfaces MUST have complete
   type annotations. The type checker MUST pass with zero errors
   in strict mode.
4. **CAS Verification Suite**: A reference set of math items
   (covering each supported item type and edge case) MUST pass
   triple-representation conversion and CAS verification on every
   PR. Any verification regression fails the build.
5. **Math Rendering Snapshot**: Reference items MUST render
   identically in MathML output. Visual diff of rendered math
   MUST be included in PR review when rendering logic changes.
6. **Search Performance Benchmark**: On release-tagged commits,
   search queries against the 80K+ item benchmark dataset MUST
   return results within 1.5 seconds (p95). A regression
   exceeding 10% MUST block the release.
7. **Coverage Gate**: CAS conversion and verification modules
   MUST maintain 90%+ line coverage. Overall project coverage
   SHOULD NOT drop below 80%. Coverage decreases MUST be flagged.
8. **DAG Integrity Check**: The prerequisite skill graph MUST
   pass cycle detection and orphan-node detection on every PR
   that modifies graph data or graph-manipulation logic.

### Review Requirements

- Every pull request MUST receive at least one approving review
  before merge.
- PRs modifying CAS conversion or verification logic MUST be
  reviewed with a math-correctness focus: reviewer MUST verify
  that edge cases (division by zero, imaginary roots, degenerate
  equations) are handled.
- PRs modifying recommendation ranking weights or signals MUST
  include before/after comparison on a standard query set.
- PRs changing public API signatures MUST update the corresponding
  documentation before merge.

## Development Workflow

### Branch Strategy

- `main` is the stable branch. Direct commits to `main` are
  prohibited.
- Feature branches MUST follow the naming convention
  `NNN-short-description` (e.g., `003-cas-verification-engine`).
- Each branch SHOULD address a single domain concern (item CRUD,
  search, graph, generation, recommendation).

### Test Fixture Management

- Reference math item fixtures live in `tests/fixtures/items/`.
  Items MUST be organized by type subdirectory (`equations/`,
  `geometry/`, `statistics/`, `word-problems/`).
- Curriculum skill graph fixtures live in
  `tests/fixtures/curriculum/`. Files MUST follow CASE format.
- Adding a new fixture MUST be accompanied by expected CAS
  verification results and a brief description of what the
  fixture exercises.
- Fixtures MUST NOT contain items copied verbatim from
  copyrighted sources. All fixtures MUST be synthetic or
  explicitly licensed.

### Feature Development Sequence

1. **Identify** the domain capability to implement.
2. **Add** reference math item fixtures that exercise the
   capability.
3. **Write** a failing test that asserts the expected behavior
   (CAS result, search ranking, recommendation output).
4. **Implement** the domain logic.
5. **Verify** all existing fixtures and tests still pass
   (no regressions).
6. **Run** the CAS verification suite and search benchmark
   if applicable.
7. **Open** a pull request with test evidence and rendered
   math screenshots if display logic changed.

### Release Process

- Releases follow semantic versioning: MAJOR for breaking
  API/data-model changes, MINOR for new domain capabilities
  (new item type, new recommendation type), PATCH for bug fixes.
- Every release MUST include a changelog entry listing newly
  supported capabilities, fixed bugs, and data model changes.
- Release builds MUST run the full CAS verification suite and
  search benchmark, reporting results in the release notes.

## Governance

### Amendment Procedure

1. Any contributor MAY propose a constitution amendment by opening
   a pull request that modifies this file.
2. The amendment PR MUST include: (a) the specific text change,
   (b) a rationale explaining why the change is needed, (c) an
   impact assessment listing code, tests, or workflows that must
   change to comply.
3. Amendment PRs MUST remain open for a minimum of 72 hours.
4. Amendments MUST be approved by the project maintainer(s). For
   Core Principles, unanimous maintainer approval is required.
   For workflow or gate changes, a single maintainer suffices.
5. Upon merge, `CONSTITUTION_VERSION` MUST be incremented: MAJOR
   for principle removal/redefinition, MINOR for principle
   addition/expansion, PATCH for clarifications/wording.
6. `LAST_AMENDED_DATE` MUST be updated to the merge date.

### Compliance

- All pull requests and code reviews MUST verify compliance with
  the active constitution. Reviewers SHOULD reference specific
  principle numbers when requesting changes.
- The constitution supersedes informal conventions. If a practice
  conflicts with the constitution, the constitution governs until
  amended.
- Complexity exceeding what the constitution permits MUST be
  justified in writing in the PR description, referencing the
  specific principle.

### Guidance File

Runtime development guidance (coding style, tooling setup,
environment configuration) that is too granular for the
constitution SHOULD be maintained in a separate `CONTRIBUTING.md`
or `.specify/memory/guidance.md` file. The constitution defines
principles; guidance files define procedures.

**Version**: 2.0.0 | **Ratified**: 2026-04-07 | **Last Amended**: 2026-04-07
