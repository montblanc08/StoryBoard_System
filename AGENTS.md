# FRAMEFORGE — Repository Agent Rules

This file governs the whole repository.

User instructions in the current conversation have higher priority.

`storyboard-system/AGENTS.md` contains additional Legacy-specific rules when working inside that subtree.

---

# 1. Primary Goal

FRAMEFORGE is migrating from a hybrid Legacy application toward one canonical architecture:

```text
apps/web
  = canonical Web UI

apps/api
  = canonical backend API

packages/*
  = canonical shared packages

PostgreSQL
  = target persistent database

Redis
  = target ephemeral Presence backend
```

`storyboard-system/` remains an active Legacy/migration source until each real runtime responsibility has been cut over.

Do not create additional parallel architectures.

---

# 2. Current Migration Rule

A file, class, route, component or test existing does NOT mean migration is complete.

Use these states:

```text
VERIFIED
IMPLEMENTED_NOT_INTEGRATED
INTEGRATED_NOT_CUT_OVER
CUTOVER_READY
CUT_OVER
LEGACY_RETIRED
BLOCKED
```

Only call something complete when the real runtime consumer uses the new owner and the old authoritative owner has exited.

---

# 3. Start-of-Task Protocol

Before modifying anything:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log --oneline -8
```

Never overwrite unknown dirty work.

Never use:

```bash
git reset --hard
git clean -fd
git push --force
```

unless the user explicitly instructs it.

---

# 4. Context Budget Protocol

Do not read the whole repository or every architecture document at the beginning of every task.

Use this context ladder:

```text
1. this AGENTS.md
2. git status / current diff
3. storyboard-system/docs/ACTIVE_WORKSTREAMS.md
4. only the relevant specification heading
5. exact source files
6. exact tests
```

Read long historical worklogs only when needed to resolve a concrete contradiction.

Prefer:

```text
rg
git grep
git diff --stat
git diff -- <scope>
git show --name-only
```

before opening large files.

Do not repeatedly reopen files already understood unless they changed.

---

# 5. Canonical Owner Rule

Every capability must converge to one authoritative owner.

Before implementation identify:

```text
DOM/Render Owner
State Owner
Event Owner
Request Owner
Mutation Owner
Persistence Owner
CSS Owner
Test Owner
```

If two owners exist, this is a migration problem to resolve, not a reason to add a third implementation.

---

# 6. Known Duplicate Areas

Treat these as convergence work:

```text
apps/api
vs
storyboard-system/fastapi_app

apps/api AI
vs
storyboard-system/ai_system

apps/api Presence
vs
storyboard-system/presence_system
vs
Legacy CollaborationManager

apps/web
vs
storyboard-system/src/workspace

/packages/ui
vs
/storyboard-system/packages/ui
```

Do not expand both sides indefinitely.

Target owners are normally:

```text
apps/api
apps/web
repo-root packages/*
```

unless current code evidence proves otherwise.

---

# 7. UI Package Rule

The repository must end with one canonical package named:

```text
@frameforge/ui
```

Target:

```text
/packages/ui
```

`storyboard-system/packages/ui` is a migration source until parity/cutover is complete.

Do not create:

```text
ui-v2
ui-next
shared-ui-new
shadcn-package
```

---

# 8. Component Migration

Follow:

```text
storyboard-system/docs/FRAMEFORGE_COMPONENT_LIBRARY_CODEX_MASTER.md
```

Important invariants:

```text
shadcn is the visual/component baseline
do not change confirmed shadcn-style radius globally
do not distort Card proportions
professionalism is not achieved by compressing spacing
Selection and Inspector are independent
focus != selected
motion is functional and restrained
one icon system
```

Do not restore removed Compact/Professional mode.

Do not restore removed controls simply because Legacy code still contains them.

---

# 9. UI Layer Boundaries

```text
Primitive
  knows no FRAMEFORGE business

Pattern
  knows professional interaction patterns

Domain
  knows film/storyboard concepts

Feature
  owns queries, mutations, permissions and save flow
```

Shared UI must not own:

```text
Shot API calls
Production API calls
WebSocket connections
AI calls
business localStorage persistence
```

---

# 10. Generated Files

Do not edit generated files as primary source.

Legacy build can overwrite:

```text
storyboard-system/static/workspace-v73.js
storyboard-system/static/workspace-v73.css
storyboard-system/static/vendor/*
```

Before builds, inspect dirty generated outputs.

Only one agent may own a shared build/generation step at a time.

---

# 11. Backend Target

`apps/api` is the canonical target API.

Routers should own:

```text
HTTP
auth
permission
validation
status mapping
DTO mapping
```

Routers should not own:

```text
large business workflows
duplicated SQL
AI business rules
revision logic copies
```

Prefer:

```text
Router
→ Application Service / Command
→ Repository
→ SQLAlchemy Unit of Work
```

---

# 12. Persistence

Target:

```text
SQLAlchemy 2
Alembic
PostgreSQL
```

SQLite may remain for isolated development/tests where explicitly supported.

Do not maintain two independent production persistence semantics.

Repository interfaces are useful.

A second raw database implementation duplicating SQLAlchemy transaction/business behavior is not.

---

# 13. Database Safety

Never touch real production data without explicit user authorization.

Database migration work must use:

```text
copy / isolated DB
inventory
migration
verification
rollback rehearsal
```

Verify:

```text
row counts
PK/FK
orphans
revision
ordering
JSON
timestamps
asset references
```

---

# 14. AI Invariant

AI is disabled by default.

No provider configuration means:

```text
zero outbound AI network calls
```

AI output must follow:

```text
Provider
→ Structured Result
→ Proposal
→ Human Review
→ Normal Command
→ Revision/Audit
```

Never allow a provider to mutate authoritative project/shot data directly.

Do not expose hidden reasoning or store chain-of-thought.

Store only necessary structured results, provenance, usage and errors.

---

# 15. Presence Invariant

Presence is ephemeral.

Do not persist:

```text
cursor
viewport
heartbeat
online state
temporary editing state
```

into normal PostgreSQL business tables.

Target production architecture:

```text
apps/web WebSocket client
→ apps/api
→ Redis TTL/pubsub
```

In-memory Presence is acceptable for development/tests only.

---

# 16. React Migration

Final Web owner is:

```text
apps/web
```

`storyboard-system/src/workspace` is transitional.

Do not treat a newly created React file as migrated until it is:

```text
imported
mounted
connected to real state
connected to real API
covered by tests
```

Do not keep adding final product functionality only to the transitional workspace.

---

# 17. State Ownership

One state, one authority.

Preferred model:

```text
server state      → TanStack Query
workspace UI      → Zustand/local React state
selection         → selection state
inspector         → inspector state
presence          → presence client/store
form draft        → form/local state
```

Avoid authoritative duplication between:

```text
window.state
DOM dataset
React state
Zustand
localStorage
```

---

# 18. Save Semantics

Preserve:

```text
dirty
saving
acknowledged
failed
conflict
```

Display “saved” only after server acknowledgement.

Preserve real `409` revision-conflict semantics.

Never solve synchronization with:

```text
location.reload()
setTimeout()
silent error swallowing
```

---

# 19. Legacy Freeze

Legacy may receive:

```text
P0 bug fixes
security fixes
migration adapters
compatibility fixes
```

Do not implement major new product capabilities primarily into:

```text
storyboard-system/server.py
storyboard-system/static/app.js
```

when the canonical VNext location exists.

---

# 20. Deletion Rule

Never delete because a file “looks old”.

Before deletion verify:

```text
imports
dynamic imports
HTML references
build inputs
package scripts
global symbols
DOM selectors
CSS selectors
tests
deployment manifests
docs/runbooks
```

Delete only after replacement is integrated and no consumer remains.

---

# 21. Product Scope Safety

Migration is not permission to expand product scope.

Do not introduce unrelated:

```text
chat
meeting
CRM
billing
membership
generic task management
new approval bureaucracy
generic AI chat
```

Preserve current film/storyboard workflows.

---

# 22. Deployment Boundary

Current default:

```text
NO PRODUCTION DEPLOYMENT
```

Allowed unless otherwise instructed:

```text
local implementation
isolated tests
builds
Git commit
Git push
migration rehearsal on synthetic/copied data
```

Do not perform production DB migration, TrueNAS deployment or domain cutover without explicit authorization.

---

# 23. Subagent Policy

The main agent is the integrator and architecture owner.

Use subagents only when work is:

```text
independently scoped
parallelizable
independently testable
```

Do not spawn a subagent for a trivial grep, one-line edit or simple rename.

Default maximum concurrent implementation subagents:

```text
3
```

Fewer is preferred when scopes overlap.

---

# 24. Subagent Context Budget

Never send every subagent the entire chat history or full architecture documents.

A subagent task should contain only:

```text
GOAL
CURRENT HEAD
EXACT FILE SCOPE
RELEVANT INVARIANTS
RELEVANT DOC PATH + HEADING
TEST COMMANDS
FORBIDDEN SCOPE
EXPECTED RESULT
```

Example:

```text
GOAL:
Port Button/Input/Popover primitives to root packages/ui.

FILES:
packages/ui/**
storyboard-system/packages/ui/src/index.tsx (read-only reference)

READ:
FRAMEFORGE_COMPONENT_LIBRARY_CODEX_MASTER.md §11–20, §33–39

DO NOT:
modify apps/api
modify generated workspace bundle
delete legacy package

VERIFY:
root workspace build
targeted TypeScript tests

RETURN:
files changed
tests
remaining parity gaps
```

---

# 25. Subagent Roles

Prefer three roles.

## Mapper

Read-only.

Use for:

```text
consumer inventory
owner mapping
route mapping
dependency mapping
test mapping
```

## Implementer

One exclusive code slice.

## Verifier

Read-only or test-only.

Use after implementation for:

```text
diff review
contract verification
runtime ownership verification
QA
```

Do not ask multiple agents to independently scan the full repository.

---

# 26. Subagent Output Budget

Subagent reports should normally stay below roughly:

```text
1200 tokens
```

Return only:

```text
Findings
Files changed
Tests run
Failures/blockers
Remaining risk
Integration recommendation
```

Do not produce long narratives or repeat source files.

Do not request or output private chain-of-thought.

---

# 27. Main Agent Responsibilities

The main agent owns:

```text
architecture decisions
cross-track conflicts
shared lockfile changes
global generated artifacts
documentation truth
integration tests
Git commits
Git push
```

Subagents should not independently rewrite global status docs.

---

# 28. Shared-File Concurrency

Only one active agent may modify each shared area at a time.

Especially:

```text
package-lock files
root package.json
packages/ui
global architecture docs
Alembic revisions
generated bundles
```

Assign exclusive ownership before parallel work.

---

# 29. Git in Subagents

Default:

```text
subagents do not commit
subagents do not push
```

They modify their assigned scope and report back.

The main agent:

```text
reviews diff
runs integration tests
updates docs
commits
pushes
```

Only delegate commit ownership when working in an explicitly isolated worktree and the main agent requested it.

---

# 30. Testing Strategy

Use the narrowest meaningful test first.

Order:

```text
targeted unit
targeted integration
build/typecheck
browser/runtime QA
full regression
```

Do not run the full suite after every tiny edit.

Do not skip the full relevant suite before a milestone commit.

---

# 31. Current Regression Families

Legacy subtree may require:

```text
python -m unittest discover -s storyboard-system/tests
```

or the documented equivalent from inside `storyboard-system`.

VNext backend:

```text
pytest tests/backend
```

Frontend:

```text
npm run build
```

plus targeted browser tests.

Always verify actual repository scripts before assuming commands.

---

# 32. UI QA

For UI changes, source inspection is not enough.

Verify rendered behavior for relevant widths, including approximately:

```text
1440
1024
768
375
320 where supported
```

Check:

```text
overflow
focus
selection
overlay
z-index
keyboard
pointer hit target
responsive layout
reduced motion
```

Ignore external browser-automation overlays that are not part of the application DOM.

---

# 33. Worklog Discipline

Use:

```text
storyboard-system/docs/ACTIVE_WORKSTREAMS.md
```

as the compact current coordination ledger.

Do not turn it into an endless historical transcript.

Record only:

```text
track
owner
scope
state
gate
blocker
commit
```

Long historical detail belongs in existing archival worklogs only when necessary.

---

# 34. Documentation Truth

`ARCHITECTURE.md` records current reality.

`ARCHITECTURE_MIGRATION.md` records migration contracts, cutover gates and target state.

`LIFECYCLE_ARCHITECTURE_PLAN.md` records lifecycle phase gates.

`FRAMEFORGE_COMPONENT_LIBRARY_CODEX_MASTER.md` governs UI/component migration.

Do not copy the same long status narrative into all four files.

---

# 35. Milestone Completion

A migration slice is complete only when:

```text
implementation exists
real consumer uses it
tests pass
old authoritative owner exits
docs reflect reality
```

Otherwise label it accurately.

---

# 36. Commit Policy

Prefer cohesive commits such as:

```text
refactor(ui): converge frameforge ui package ownership
refactor(api): consolidate fastapi runtime ownership
refactor(ai): unify proposal pipeline under apps api
feat(presence): add redis-backed realtime presence
refactor(web): cut storyboard workspace over to apps web
docs(architecture): reconcile canonical migration owners
```

Do not bundle unrelated cleanup into migration commits.

---

# 37. After Every Successful Push

Do not stop automatically.

Re-read:

```text
git status
ACTIVE_WORKSTREAMS.md
current canonical owner matrix
```

Then continue with the highest-priority unblocked migration slice until the requested milestone or stop condition is reached.

---

# 38. Stop Conditions

Stop and report when:

```text
external credentials are required
production authorization is required
irreversible user-data decision is required
remote Git authorization blocks push
two valid product behaviors conflict and code cannot determine intent
```

Do not stop merely because:

```text
a scaffold exists
a test passed
a new directory exists
one component was migrated
```

---

# 39. Current Highest-Priority Migration

Unless newer repository evidence changes the situation, prioritize:

```text
1. documentation truth reconciliation
2. canonical owner matrix
3. root packages/ui convergence
4. FastAPI/persistence owner convergence
5. apps/web real React cutover
6. AI owner convergence
7. Redis Presence + Web client
8. real PostgreSQL integration rehearsal
9. Legacy retirement
10. full regression
```