# FRAMEFORGE — Repository Constitution & Agent Rules

This file is the repository-level execution constitution for FRAMEFORGE.

It defines architectural invariants, migration rules, safety boundaries, execution discipline, verification requirements, and agent operating behavior.

It is intentionally **stable**.

Dynamic migration status, task ordering, blockers, individual milestones, and historical progress belong in the dedicated tracking documents, not in this file.

---

# 0. Instruction Precedence

When instructions conflict, apply them in this order:

1. Explicit instructions from the active user conversation.
2. The nearest applicable `AGENTS.md`.
3. This repository root `AGENTS.md`.
4. Canonical architecture and migration documents.
5. Existing implementation patterns.
6. Agent assumptions.

Inside:

```text
storyboard-system/
```

the file:

```text
storyboard-system/AGENTS.md
```

governs Legacy-specific implementation details.

A nested `AGENTS.md` may refine rules for its subtree, but must not silently violate repository-level safety, architecture, persistence, AI, Presence, or production invariants.

When repository evidence and documentation disagree, do not blindly trust either side.

Determine actual runtime ownership first, then repair documentation so that documentation reflects reality.

---

# 1. Canonical Target Architecture

FRAMEFORGE converges from the current hybrid Legacy architecture toward exactly one canonical runtime architecture:

```text
apps/web
    Canonical Web UI
    Next.js 15
    React 19

apps/api
    Canonical backend API
    FastAPI
    async SQLAlchemy 2

packages/*
    Canonical shared packages

packages/ui
    @frameforge/ui

packages/types
    @frameforge/types

packages/contracts
    @frameforge/contracts

packages/timecode
    @frameforge/timecode

PostgreSQL
    Persistent application database

Alembic
    Production schema migration owner

Redis
    Ephemeral Presence backend
    TTL / pubsub / realtime coordination
```

The directory:

```text
storyboard-system/
```

remains an active Legacy and migration source until every runtime responsibility it owns has been explicitly cut over.

Legacy presence does not justify creating a second canonical implementation.

## Core rule

```text
One capability
→ one authoritative runtime owner
→ one canonical migration destination
```

Do not introduce parallel architectures.

Do not introduce a second long-lived implementation because migration appears easier that way.

Temporary adapters are allowed only when they have:

```text
source owner
target owner
migration purpose
removal condition
```

---

# 2. Stable Constitution vs Dynamic Repository State

This file contains stable rules.

Dynamic project state must live elsewhere.

Canonical dynamic sources are:

```text
storyboard-system/docs/ACTIVE_WORKSTREAMS.md
storyboard-system/docs/CANONICAL_OWNER_MATRIX.md
storyboard-system/docs/API_ROUTE_PARITY_MATRIX.md
storyboard-system/docs/UI_PRIMITIVE_PARITY.md
storyboard-system/docs/worklogs/VNEXT_PROGRESS.md
```

Do not copy large progress narratives into this file.

Do not hardcode temporary sprint priorities here.

Before deciding what migration work comes next, inspect:

```text
ACTIVE_WORKSTREAMS.md
CANONICAL_OWNER_MATRIX.md
```

Repository evidence may supersede stale task ordering.

---

# 3. Documentation Authority

Each architecture document has one purpose.

## `ARCHITECTURE.md`

Records:

```text
current runtime reality
current owners
current data flow
current boundaries
current dependencies
```

It must not describe aspirational architecture as if it already exists.

---

## `ARCHITECTURE_MIGRATION.md`

Records:

```text
target architecture
migration contracts
ownership transition
cutover gates
rollback requirements
retirement conditions
```

---

## `LIFECYCLE_ARCHITECTURE_PLAN.md`

Records:

```text
lifecycle phases
phase gates
cross-phase dependencies
entry criteria
exit criteria
```

---

## `FRAMEFORGE_COMPONENT_LIBRARY_CODEX_MASTER.md`

Governs:

```text
UI architecture
component migration
primitive boundaries
visual language
interaction conventions
motion
responsive behavior
component ownership
```

---

Do not maintain the same long status narrative in multiple documents.

A fact should have one canonical documentation owner.

Other documents may link to it.

---

# 4. Migration State Model

A file, directory, test, component, API route, migration, or service existing does **not** prove migration completion.

Every migrated capability must be classified accurately.

Allowed states:

```text
VERIFIED
IMPLEMENTED_NOT_INTEGRATED
INTEGRATED_NOT_CUT_OVER
CUTOVER_READY
CUT_OVER
LEGACY_RETIRED
BLOCKED
BLOCKED_VISUAL
```

Definitions:

## `VERIFIED`

Current ownership and runtime behavior were confirmed through repository inspection, tests, or execution evidence.

## `IMPLEMENTED_NOT_INTEGRATED`

Target implementation exists, but no real application consumer depends on it.

## `INTEGRATED_NOT_CUT_OVER`

A real consumer uses the target implementation, but Legacy remains authoritative for some runtime path.

## `CUTOVER_READY`

Parity is demonstrated and the target can become authoritative.

Rollback behavior has been understood or rehearsed where relevant.

## `CUT_OVER`

The target implementation is the authoritative runtime owner.

## `LEGACY_RETIRED`

The former owner has no runtime consumers and has been removed or reduced to a deliberately inert compatibility artifact.

## `BLOCKED`

A required upstream dependency, decision, credential, environment, or implementation is missing.

## `BLOCKED_VISUAL`

A UI slice cannot become VERIFIED / CUTOVER_READY / CUT_OVER from source inspection alone without real rendered browser evidence. Visual acceptance is blocked until a visual QA run completes successfully.

Never promote migration state because:

```text
a directory exists
a scaffold compiles
a test file exists
an endpoint exists
a component renders in isolation
an adapter exists
a TODO says migration is complete
```

---

# 5. Single Owner Invariant

Before implementing or migrating a capability, determine its authoritative owners.

At minimum identify:

```text
DOM / Render owner
State owner
Event owner
Request owner
Mutation owner
Persistence owner
```

Where relevant also identify:

```text
Validation owner
Permission owner
Revision owner
Audit owner
Realtime owner
Cache owner
Schema owner
```

One runtime responsibility must not have multiple authoritative owners.

Temporary mirrored behavior is allowed only during controlled migration and must have a clear cutover gate.

Do not create dual-write or dual-authority behavior without explicit migration justification.

---

# 6. Start-of-Task Protocol

Before modifying code, establish repository state.

Minimum inspection:

```bash
git status
git branch --show-current
git rev-parse HEAD
git log --oneline -n 8
```

Then inspect:

```text
ACTIVE_WORKSTREAMS.md
CANONICAL_OWNER_MATRIX.md
```

when relevant to the requested task.

Before editing a specific subsystem, use narrow inspection first:

```bash
rg
git diff
git log -- <path>
git blame <path>
```

when useful.

Do not begin with indiscriminate full-repository reading.

Do not assume the working tree is clean.

Do not overwrite existing dirty work.

Do not discard unrelated user changes.

---

# 7. Context Budget & Repository Reading Discipline

Repository context is a limited execution resource.

Use it deliberately.

## Prefer

```text
symbol search
narrow rg queries
specific file ranges
git diff
git history for relevant files
existing tests
call-site tracing
import tracing
runtime entry points
```

over:

```text
reading every file
dumping entire directories
re-reading unchanged files
loading giant generated files
reading archived logs without cause
```

Before opening a large file, determine what information is needed from it.

When possible:

```text
search first
read surrounding context second
read whole file only when structure requires it
```

Do not repeatedly reread unchanged large files during the same workstream.

Use `git diff` as the primary representation of recent work whenever sufficient.

Generated artifacts, vendor bundles, lockfiles, snapshots, minified assets, and build output should not consume context unless directly relevant.

---

# 8. Sub-Agent / Parallel Agent Protocol

Use sub-agents only when they reduce context pressure or isolate a genuinely separable investigation.

Good delegation targets include:

```text
independent code audit
test failure investigation
route inventory
component inventory
migration parity comparison
dependency tracing
documentation consistency audit
visual QA evidence review
```

Avoid delegating work that requires constant shared state with the primary implementation.

Every delegated task should define:

```text
scope
allowed files
question to answer
expected output
whether edits are permitted
verification requirement
```

Sub-agents should return concise evidence and conclusions rather than dumping entire files.

Do not ask multiple sub-agents to independently scan the entire repository for the same problem.

Do not allow multiple agents to edit the same files concurrently unless ownership is explicitly coordinated.

The primary agent remains responsible for:

```text
final architecture decisions
conflict resolution
integration
tests
documentation truth
commit quality
```

Delegation never transfers responsibility for repository correctness.

---

# 9. Dirty Work Protection

Existing uncommitted work is user work unless clearly proven otherwise.

Never automatically:

```text
git reset --hard
git checkout .
git restore .
git clean -fd
git stash
delete unknown files
rewrite unrelated files
```

to obtain a clean tree.

If an existing change overlaps the required task:

1. inspect it,
2. preserve its intent,
3. integrate safely.

Do not silently revert previous valid work to make the current task easier.

---

# 10. Scope Discipline

Make the smallest coherent change that advances the requested migration milestone.

Do not bundle:

```text
unrelated cleanup
style rewrites
opportunistic refactors
dependency churn
directory renaming
formatting of unrelated files
```

into a migration change.

A migration commit should be reviewable as one logical architectural step.

Avoid speculative abstractions.

Do not implement future systems merely because they may eventually be useful.

---

# 11. Legacy Freeze

The Legacy subtree:

```text
storyboard-system/
```

is frozen for ordinary feature development.

Allowed Legacy changes are limited to:

```text
critical bug fixes
security patches
migration adapters
cutover instrumentation
tests required to prove parity
temporary compatibility changes required for migration
```

New product features should not increase Legacy ownership unless explicitly requested.

Do not delete a Legacy file because:

```text
its name looks old
a replacement file exists
search results appear empty
a new component was created
```

Before deletion inspect:

```text
imports
dynamic imports
template references
script loading
manifest references
runtime loaders
server-side rendering references
tests
build configuration
deployment scripts
string-based lookups
```

A Legacy owner may be removed only after its consumer count reaches zero.

---

# 12. UI Architecture Boundaries

FRAMEFORGE UI follows four conceptual layers.

## Primitive

Canonical location:

```text
@frameforge/ui
```

Primitives know zero FRAMEFORGE business logic.

They must not contain:

```text
shot semantics
storyboard semantics
project permissions
FRAMEFORGE product copy
API requests
feature-specific Zustand state
domain-specific mutation behavior
```

Baseline:

```text
shadcn
Radix
accessible interaction
neutral visual system
```

---

## Pattern

Patterns compose primitives into reusable interaction structures such as:

```text
dialogs
inspectors
split panes
command surfaces
property panels
toolbars
menus
shell layouts
```

Patterns should remain reusable across multiple FRAMEFORGE features.

---

## Domain

Domain components understand concepts such as:

```text
shot
scene
reel
take
timecode
storyboard
production method
revision
asset
```

but should not own route-level application orchestration.

---

## Feature

Feature code inside:

```text
apps/web
```

owns:

```text
queries
mutations
permissions
route integration
feature orchestration
server-state consumption
business state
```

---

# 13. UI Design System Invariants

The canonical visual baseline is the existing FRAMEFORGE design direction built on shadcn/Radix.

Do not reinterpret professional UI as maximum density.

Do not compress spacing merely to make the application look more "professional."

Preserve deliberate:

```text
card proportions
corner-radius language
spacing rhythm
hierarchy
content breathing room
```

Do not casually alter established shadcn geometry when migrating components.

Use a restrained neutral palette unless product-specific semantics require otherwise.

A scope should normally have one obvious primary action.

Tables should optimize for reading before decoration.

Avoid permanent visual borders where grouping, spacing, hover, selection, or surface elevation communicates structure more clearly.

---

# 14. Motion and Interaction

FRAMEFORGE may use subtle motion to communicate state and structure.

Motion should support:

```text
hierarchy
continuity
focus
selection
loading
panel transitions
state changes
direct manipulation
```

Motion must not exist purely as decoration that slows workflow.

Prefer short, interruptible transitions.

Dynamic icons may communicate:

```text
state
direction
loading
completion
expansion
collapse
sync
presence
```

but must preserve recognizable icon semantics.

Respect reduced-motion preferences.

Do not allow animation to become a second state owner.

Business state determines animation, not the reverse.

---

# 15. Web State Ownership

Avoid duplicate client state owners.

Default ownership:

```text
Server state
→ query layer / server-state hooks

Workspace UI state
→ one canonical Zustand workspace store

Selection
→ workspace store

Inspector target
→ workspace store

Local form draft
→ local component/form state
```

Selection and inspector targets may differ semantically but should remain coordinated through the workspace state architecture.

Do not duplicate server entities into long-lived Zustand state unless explicitly required.

Do not maintain the same authoritative value simultaneously in:

```text
React local state
Zustand
URL params
query cache
Legacy global state
```

without a clearly defined source of truth.

---

# 16. Backend Router Boundary

FastAPI routers own HTTP concerns.

Routers may own:

```text
request parsing
authentication
authorization checks
schema validation
dependency injection
status-code mapping
response serialization
```

Routers must not own:

```text
business workflows
raw SQL
multi-step mutation orchestration
revision management
audit generation
cross-aggregate domain behavior
```

Business logic belongs in dedicated application services or command handlers.

---

# 17. Command & Application Service Boundary

Business mutations must flow through a canonical command or application-service layer.

Mutation handling must consistently apply relevant:

```text
authorization
validation
revision checking
revision increment
conflict detection
audit recording
transaction handling
domain invariants
```

Do not bypass the command/service layer from:

```text
AI proposals
REST endpoints
background tasks
WebSocket handlers
admin utilities
migration adapters
```

when they perform the same business mutation.

---

# 18. Persistence Ownership

PostgreSQL is the persistent database target.

SQLAlchemy 2 async patterns are canonical for target application persistence.

Alembic owns production schema history.

Production startup must never depend on:

```python
Base.metadata.create_all(...)
```

`create_all` is restricted to explicit:

```text
development fixtures
isolated tests
temporary test databases
```

Schema evolution must be represented through migration history.

Avoid application startup behavior that silently repairs production schemas.

---

# 19. Configuration Safety

Production configuration is fail-closed.

When:

```text
ENVIRONMENT=production
```

required secrets and credentials must be explicitly configured.

Never:

```text
hardcode production passwords
commit private keys
fall back to development credentials
silently invent secrets
use insecure production defaults
```

Missing production-critical configuration should fail fast with an actionable error.

---

# 20. AI Architecture Invariant

Outbound AI calls are disabled by default.

No provider request should occur merely because AI code exists.

Outbound provider access requires explicit configuration.

Canonical mutation flow:

```text
Provider
→ Proposal
→ Human Review
→ Standard Command
→ Audit
```

AI must not become an alternative persistence or mutation pathway.

An accepted AI proposal must execute through the same canonical business mutation mechanism used by human actions.

AI-generated actions must respect:

```text
permissions
validation
revision semantics
conflict handling
audit logging
```

Do not grant AI code direct write access to persistence merely for convenience.

---

# 21. Presence Architecture Invariant

Presence is strictly ephemeral.

Examples:

```text
cursor position
viewport
active user
selected cell for collaboration
editing indicator
temporary cell lock
heartbeat
typing state
```

Canonical target:

```text
Redis
TTL
pub/sub or equivalent ephemeral realtime mechanism
```

Presence must not be stored in persistent PostgreSQL application tables.

Presence loss after restart is acceptable by design.

Durable collaborative edits are not Presence and must use canonical persistent mutation flows.

---

# 22. Save & Conflict Semantics

Preserve explicit save state:

```text
dirty
saving
acknowledged
failed
conflict
```

A client mutation is not considered saved when dispatched.

It becomes saved only after authoritative server acknowledgement.

For revision-sensitive mutations:

```text
client revision
→ mutation
→ server validation
→ success acknowledgement

or

→ 409 Conflict
```

Do not optimistically convert an unacknowledged mutation into durable saved state.

Do not hide failed saves behind transient UI.

---

# 23. API Migration Rules

API migration requires more than matching path names.

For each migrated route verify relevant:

```text
HTTP method
path
authentication
authorization
request schema
response schema
status codes
error semantics
revision behavior
audit behavior
persistence behavior
consumer
```

The canonical source for route migration status is:

```text
API_ROUTE_PARITY_MATRIX.md
```

Do not mark an API route cut over until a real consumer uses the canonical target route.

---

# 24. UI Primitive Migration Rules

A primitive is not migrated merely because a replacement exists in `packages/ui`.

Verify:

```text
real import consumer
rendered behavior
interaction parity
keyboard behavior
focus behavior
responsive behavior
visual consistency
legacy consumer removal
```

Track primitive migration through:

```text
UI_PRIMITIVE_PARITY.md
```

Do not leave identical authoritative primitives in both Legacy and canonical UI layers after cutover.

---

# 25. UI QA

For UI changes, source inspection is insufficient.

Rendered behavior must be verified.

Relevant widths should normally include approximately:

```text
1440
1024
768
375
320 where supported
```

Check applicable:

```text
overflow
wrapping
focus
selection
hover
disabled state
overlay
popover positioning
dialog positioning
z-index
keyboard interaction
pointer interaction
hit targets
scroll behavior
sticky positioning
responsive layout
reduced motion
loading state
empty state
error state
```

Ignore browser automation overlays or test harness decorations that are not part of the application DOM.

A successful TypeScript build does not prove visual correctness.

A correct DOM does not prove visual correctness.

---

# 26. Visual Migration Evidence

When modifying significant UI surfaces, compare the rendered result against:

```text
existing FRAMEFORGE visual language
component library rules
responsive requirements
interaction requirements
```

Do not accept a migration merely because the component is technically functional.

Check for:

```text
misalignment
incorrect spacing
unexpected blue outlines
layering defects
stale skeuomorphic styling
inconsistent control heights
broken icon clipping
missing image assets
unresponsive controls
layout collision
sidebar occlusion
excessive empty space
```

where applicable to the touched surface.

Visual regressions introduced during architectural migration are migration regressions.

---

# 27. Testing Order

Use progressively broader verification.

Default order:

```text
1. targeted unit tests
2. targeted integration tests
3. affected package tests
4. typecheck
5. build
6. relevant UI/runtime verification
7. broader regression suite
```

Do not immediately run the most expensive repository-wide suite when a targeted test can reveal the current defect faster.

After targeted tests pass, expand verification according to the blast radius.

Never report success solely because a test that does not exercise the real consumer passed.

---

# 28. Evidence Before Status Promotion

Migration status must be based on evidence.

Examples:

```text
consumer import
runtime route registration
integration test
browser verification
database migration rehearsal
request trace
removed Legacy consumer
successful build
successful targeted regression
```

Do not infer integration from naming similarity.

Do not infer cutover from directory structure.

Do not infer retirement from an unused-looking file.

---

# 29. Worklog Discipline

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

Keep entries compact.

Long historical detail belongs in archival worklogs such as:

```text
storyboard-system/docs/worklogs/
```

only when the history remains useful.

---

# 30. Documentation Update Rule

When implementation changes architectural reality, update its canonical documentation owner in the same migration slice when practical.

Do not leave:

```text
code says target
docs say legacy
matrix says complete
runtime still uses old owner
```

after claiming milestone completion.

Documentation should describe observed truth, not desired future truth.

---

# 31. Commit Discipline

Prefer focused, descriptive conventional commits.

Examples:

```text
refactor(ui): converge frameforge ui package ownership

refactor(api): consolidate fastapi runtime ownership

refactor(ai): unify proposal pipeline under apps api

feat(presence): add redis-backed realtime presence

refactor(web): cut storyboard workspace over to apps web

docs(architecture): reconcile canonical migration owners
```

Do not bundle unrelated cleanup into migration commits.

One commit should represent one understandable architectural step whenever possible.

Before committing inspect:

```bash
git status
git diff
git diff --staged
```

Do not accidentally commit:

```text
secrets
local environment files
temporary logs
generated debugging files
unrelated user changes
```

---

# 32. Push Discipline

For requested migration work, successful milestones should normally be committed and pushed.

Before push, verify the required tests for the slice.

After push, confirm that the intended commit is the pushed commit.

A push is not a migration completion criterion by itself.

Do not claim repository success if local HEAD and remote state are known to differ.

# 33. Functional Golden Baseline Rule

FRAMEFORGE_PRODUCT_BASELINE = 5e86a0bb11a20ecd631d9c2af66260a73d7c92e7

Treat this commit as the Product Behavior Golden Reference, not as the architecture target and not as a branch to reset to.

For every VNext capability:
compare current `apps/web` + `apps/api` against the behavior present at FRAMEFORGE_PRODUCT_BASELINE.

Do not silently omit a capability that exists at the baseline.
Later explicit user decisions and documented removals override the baseline.

CURRENT master remains the implementation target.

If remote authentication blocks the push, preserve the local commit and report the exact blocker.

---

# 33. After Every Successful Push

Do not automatically stop after a successful push when the user requested a continuing migration task.

Re-read:

```text
git status
ACTIVE_WORKSTREAMS.md
CANONICAL_OWNER_MATRIX.md
```

Then determine the highest-priority unblocked slice.

Continue until:

```text
the requested milestone is reached
a valid stop condition occurs
or repository evidence shows that continuing would violate scope
```

A successful commit is a checkpoint, not automatically the end of the task.

---

# 34. Milestone Completion

A migration slice is complete only when all applicable conditions are true:

```text
implementation exists
real consumer uses it
tests pass
runtime behavior is verified
old authoritative owner exits
documentation reflects reality
```

If any required condition is absent, use the correct migration state.

Do not call:

```text
IMPLEMENTED_NOT_INTEGRATED
```

complete.

Do not call:

```text
INTEGRATED_NOT_CUT_OVER
```

cut over.

Do not call:

```text
CUT_OVER
```

legacy retired.

---

# 35. Stop Conditions

Stop implementation and report when continuing requires:

```text
external credentials
production authorization
irreversible user-data decisions
remote Git authorization that cannot be resolved locally
a destructive production operation
two valid product behaviors that conflict and repository evidence cannot resolve
```

Also stop before performing an action explicitly forbidden by this constitution.

Do not stop merely because:

```text
a scaffold exists
a test passed
a directory was created
one component migrated
one endpoint was implemented
one commit was pushed
context is becoming inconvenient
the remaining work is large
```

When work remains and no legitimate blocker exists, continue.

---

# 36. No Production Deployment

Unless explicitly authorized by the user:

```text
local implementation only
local tests only
local builds only
synthetic migration rehearsal only
```

Never mutate:

```text
production application runtime
production database
production Redis
production secrets
production reverse proxy
production DNS
production cloud infrastructure
```

as part of ordinary repository migration work.

A deployment script may be inspected or repaired locally without executing it against production.

---

# 37. No False Completion

Never report a capability as finished based only on code presence.

Avoid statements such as:

```text
migration complete
fully migrated
fully React
PostgreSQL complete
Presence complete
AI complete
Legacy removed
```

unless repository and runtime evidence support the statement.

Prefer exact status language.

Example:

```text
The target implementation exists and passes its unit tests, but the current workspace still consumes the Legacy owner. State: IMPLEMENTED_NOT_INTEGRATED.
```

Accuracy is more important than optimistic status.

---

# 38. No Architecture by Naming

Do not infer canonical ownership because a path has a desirable name.

Examples:

```text
apps/web exists
≠ React cutover

apps/api exists
≠ FastAPI ownership

packages/ui exists
≠ UI primitive convergence

alembic/ exists
≠ PostgreSQL migration complete

redis dependency exists
≠ Presence migrated

ai/provider.py exists
≠ AI pipeline integrated
```

Follow consumers and runtime entry points.

---

# 39. Dependency Introduction

Before adding a dependency, determine whether an existing repository dependency already provides the capability.

New dependencies should have a concrete owner and purpose.

Avoid introducing competing libraries for the same architectural role.

Particularly avoid parallel choices for:

```text
state management
server-state management
component primitives
validation
HTTP clients
ORM
migration tooling
realtime transport
date/timecode logic
```

unless explicitly justified.

---

# 40. Contract Ownership

Shared cross-runtime contracts belong in canonical shared packages.

Prefer:

```text
@frameforge/types
@frameforge/contracts
@frameforge/timecode
```

for truly shared concerns.

Do not move business orchestration into shared packages simply to avoid imports.

Shared packages should reduce duplication without becoming hidden global application layers.

---

# 41. Generated Code and Compatibility Layers

Generated code must be clearly identifiable.

Do not manually maintain two generated and handwritten sources for the same contract.

Compatibility layers must be intentionally temporary.

Every compatibility adapter should answer:

```text
Why does it exist?
Which old owner does it bridge?
Which canonical owner replaces it?
What allows it to be deleted?
```

Adapters must not quietly become permanent architecture.

---

# 42. Error Handling

Do not hide architectural failures behind generic fallbacks.

Migration code should fail explicitly when an invariant is violated.

Examples:

```text
missing required configuration
revision conflict
invalid ownership state
unsupported legacy path
database migration mismatch
unavailable required service
```

Fallback behavior is acceptable only when it is an intentional product behavior.

---

# 43. Security Boundaries

Preserve authorization at the canonical mutation boundary.

Do not rely only on:

```text
hidden UI buttons
disabled controls
client-side route guards
client validation
```

for permissions.

Backend authorization remains authoritative.

Never log secrets or credentials while debugging migration behavior.

---

# 44. Performance During Migration

Do not preserve pathological Legacy performance merely for implementation parity.

Behavioral parity and architectural parity are distinct.

However, performance optimization must not silently change product behavior.

When touching large UI surfaces, avoid introducing:

```text
duplicate network requests
unbounded rerenders
duplicated subscriptions
event-listener leaks
polling where realtime already exists
unbounded Presence history
large global Zustand objects for server entities
```

Performance regressions are valid migration blockers when they materially damage the real workflow.

---

# 45. Accessibility

Canonical UI components should preserve or improve accessibility.

Check applicable:

```text
semantic controls
keyboard navigation
focus visibility
aria relationships
dialog focus trapping
menu navigation
form labeling
disabled semantics
contrast
reduced motion
```

Do not regress accessibility while replacing Legacy controls.

---

# 46. Responsive Behavior

Desktop layout must not be implemented by assuming unlimited width.

Relevant UI must behave intentionally at:

```text
1440
1024
768
375
320 when supported
```

Responsive behavior may simplify layout but must not create a second feature implementation.

Avoid duplicated mobile and desktop state owners.

---

# 47. Current Priority Resolution

Current migration priority is **not permanently encoded in this constitution**.

Resolve current priority in this order:

```text
1. explicit user instruction
2. ACTIVE_WORKSTREAMS.md
3. blockers and dependency graph
4. CANONICAL_OWNER_MATRIX.md
5. architecture migration gates
6. repository/runtime evidence
```

If those sources contain no usable ordering, the following may be used only as a fallback dependency sequence:

```text
documentation truth reconciliation
→ canonical ownership reconciliation
→ shared UI ownership
→ API / persistence ownership
→ real apps/web consumer cutover
→ AI ownership convergence
→ Redis Presence integration
→ PostgreSQL integration rehearsal
→ Legacy retirement
→ full regression
```

This fallback sequence is not dynamic project status and must not override newer repository evidence.

---

# 48. Migration Dependency Rule

Prefer migration work that removes architectural ambiguity or unlocks downstream slices.

For example:

```text
owner clarification
before
large implementation duplication

contract stabilization
before
multiple consumers migrate

API mutation semantics
before
AI is allowed to invoke mutation

Redis Presence backend
before
claiming realtime Presence cutover
```

Do not prioritize visible surface migration when a missing underlying ownership contract will cause rework.

---

# 49. Efficient Long-Running Task Loop

For long migrations, operate as a repeated bounded loop:

```text
Inspect
→ Select one coherent slice
→ Establish ownership
→ Implement
→ Run targeted verification
→ Integrate real consumer
→ Run broader verification
→ Update canonical docs/matrix
→ Commit
→ Push
→ Re-read current state
→ Select next slice
```

Do not accumulate many unverified architectural changes before testing.

Do not postpone all documentation reconciliation until the end of a long migration.

Checkpoint often enough that each successful slice remains understandable and recoverable.

---

# 50. Investigation Before Refactor

When encountering confusing code:

```text
trace consumer
trace event
trace state
trace request
trace mutation
trace persistence
```

before rewriting it.

A strange implementation may still be the current authoritative owner.

Do not refactor around an assumption that later proves false.

---

# 51. Validation of Removal

Deletion requires stronger evidence than creation.

Before removing an old owner:

```text
search static imports
search dynamic imports
search strings
search templates
search manifests
search tests
search deployment scripts
search runtime registrations
verify real consumer migrated
```

After deletion:

```text
run affected tests
run build/typecheck
verify runtime path
search again for stale references
```

Only then advance toward:

```text
LEGACY_RETIRED
```

---

# 52. Product Behavior Preservation

Migration should preserve intended product behavior unless the user explicitly requests behavioral redesign.

Architecture migration is not permission to invent new features.

Do not reintroduce removed functionality.

Do not preserve deprecated functionality merely because Legacy still contains it.

Use current product behavior and canonical documentation to determine parity requirements.

When intent is ambiguous, inspect recent repository history before assuming older Legacy behavior is desired.

---

# 53. FRAMEFORGE-Specific UI Constraint

FRAMEFORGE's professional character must come from:

```text
hierarchy
precision
predictability
motion discipline
clear ownership
good typography
strong spacing
production-oriented workflow
```

not from indiscriminate density.

Preserve the intended shadcn-derived geometry and card proportions.

Do not reduce usability merely to display more controls.

Do not reintroduce previously removed modes, controls, or workflow concepts without repository evidence or explicit user instruction.

---

# 54. Review and Audit Workflow

Where the current product intentionally retains formal review semantics such as:

```text
approve
reject
submit feedback
audit trail
```

preserve those semantics during migration.

Do not simplify an intentional audited workflow merely because a generic component library offers a simpler pattern.

Visual modernization and workflow semantics are separate concerns.

---

# 55. Realtime Ownership

Realtime transport must not become a second business mutation system.

Use realtime channels for applicable:

```text
Presence
notifications
ephemeral coordination
authoritative server event propagation
```

Persistent state changes must still pass through canonical command/service semantics.

A WebSocket handler must not silently bypass normal:

```text
permission
revision
audit
transaction
```

rules.

---

# 56. PostgreSQL Integration Rehearsal

Before PostgreSQL cutover can be considered ready, verify relevant:

```text
Alembic upgrade path
fresh database bootstrap
existing schema upgrade
transaction behavior
constraints
conflict semantics
test fixture behavior
rollback strategy where applicable
configuration failure behavior
```

Do not use `create_all` as evidence that production migration works.

---

# 57. Presence Integration Verification

Presence migration requires end-to-end verification.

At minimum prove applicable:

```text
client connects
identity is represented correctly
heartbeat refreshes TTL
expired Presence disappears
disconnect cleanup behaves acceptably
multiple clients receive updates
persistent database remains unaffected
reconnect restores ephemeral state
```

A Redis client dependency alone is not Presence integration.

---

# 58. AI Integration Verification

AI migration requires proving the complete governed path:

```text
provider configured explicitly
provider request occurs only when enabled
proposal returned
proposal rendered/reviewed
human accepts or rejects
accepted proposal becomes standard command
permissions apply
revision applies
audit entry is produced
```

Provider connectivity alone is not AI integration.

---

# 59. Web Cutover Verification

`apps/web` is not considered cut over until real application entry points use it authoritatively.

Verify applicable:

```text
route entry
workspace boot
real data loading
mutations
selection
inspector
save state
errors
permissions
responsive layout
production-equivalent build
```

A standalone demo page is not a Web cutover.

---

# 60. Final Report Format

At a meaningful checkpoint or legitimate stop condition, report concisely:

```text
Completed
Verified
Migration state
Tests
Commits
Push status
Remaining blocker
Next unblocked slice
```

Do not produce a huge transcript of every command executed.

Report architectural outcomes and evidence.

If nothing blocks continued execution and the user requested a long-running migration, continue instead of producing a premature final report.

---

# 61. Definition of Repository Success

The migration is successful when FRAMEFORGE has one coherent canonical runtime:

```text
apps/web
apps/api
packages/*
PostgreSQL
Redis Presence
governed AI proposal pipeline
```

and Legacy no longer owns active product behavior.

Success is not measured by the number of newly created files.

Success is measured by:

```text
clear ownership
real consumer cutover
behavioral correctness
migration evidence
maintainable boundaries
verified runtime behavior
removal of obsolete authority
documentation truth
```

---

# 62. Core Agent Principle

When uncertain, prefer:

```text
evidence over assumption
integration over scaffolding
one owner over parallel owners
runtime truth over naming
small coherent slices over broad rewrites
real consumer verification over isolated tests
documentation truth over optimistic status
continuation over premature completion
```

The objective is not to make the repository appear migrated.

The objective is to make FRAMEFORGE **actually converge**.