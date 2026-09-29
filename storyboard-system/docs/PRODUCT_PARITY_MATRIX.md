# FRAMEFORGE Product Parity Matrix

This document tracks the recovery of existing FRAMEFORGE product capabilities in the VNext architecture against the Golden Baseline (5e86a0b).

## 1. Project Hub & Workspace Navigation
| Capability | Existing Legacy State | VNext Target State | Current V-Web Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| Project Cover Fallback | Present | Present | 🟡 PARTIAL | Monogram fallback exists, but media hydration missing |
| Project Hub Context | N/A | N/A | 🔴 REMOVE / RECONCILE | Not a baseline capability, unauthorized product redesign |
| Workspace IA: Narration | Present | Present | 🔴 MISSING | Not in sidebar |
| Workspace IA: Moodboard | Present | Present | 🔴 MISSING | Not in sidebar |
| Workspace IA: Lighting | Present | Present | 🔴 MISSING | WebGL Lighting |
| Workspace IA: Review | Present | Present | 🔴 MISSING | Review & Comments |

## 2. Shot Workspace Advanced Capabilities
| Capability | Existing Legacy State | VNext Target State | Current V-Web Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| Read-first Table (No forced forms) | Present | Present | 🟢 IMPLEMENTED | Restored density |
| Inline Double-click Editing | Present | Present | 🟢 PRESENT | Frequent edits should be inline, deep edits in inspector |
| Row Single Click | Select | Select | 🟢 IMPLEMENTED | Decoupled from Inspector open |
| Row Double Click | N/A | Open Inspector | 🟢 IMPLEMENTED | Decoupled from selection |
| Column Manager (Resize/Reorder) | Present | Present | 🔴 MISSING | High density professional tools missing |
| Saved View / Column Layout | Present | Present | 🔴 MISSING | |
| Row Height | Present | Present | 🔴 MISSING | |
| Search | Present | Present | 🟡 PARTIAL | Basic search exists |
| Filtering & Sorting | Present | Present | 🔴 MISSING | |
| Grouping | Present | Present | 🔴 MISSING | |
| Bulk Actions | Present | Present | 🔴 MISSING | API exists, UI missing |
| Context Menu | Present | Present | 🔴 MISSING | Essential for professional workflows |
| Shot Reorder | Present | Present | 🔴 MISSING | |
| Undo / Redo | Present | Present | 🔴 MISSING | |
| Save Status | Present | Present | 🟡 PARTIAL | Needs robust dirty draft handling |
| Production Steps | Present | Present | 🔴 MISSING | |
| Custom Fields | Present | Present | 🔴 MISSING | |
| Comments | Present | Present | 🔴 MISSING | |
| Versions | Present | Present | 🔴 MISSING | |
| Share | Present | Present | 🔴 MISSING | |
| Project Trash | Present | Present | 🟢 IMPLEMENTED | Full soft delete, modal restore, and purge |

## 3. Server State & Collaboration
| Capability | Existing Legacy State | VNext Target State | Current V-Web Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| Strict No-Op Revision | Present | Present | 🟢 IMPLEMENTED | ShotService extracts and enforces |
| Shot Command Parity | Present | Present | 🟡 PARTIAL | Still coupled to HTTP, needs architecture separation |
| 409 Conflict Rehearsal | Partial | Strict | 🟢 CUTOVER_READY | E2E QA passes |
| Ephemeral Presence | Active | Redis PubSub | 🔴 BLOCKED | Needs WS auth + Redis multi-worker |
| Real-time Sync | Active | Websocket/SSE | 🔴 BLOCKED | Needs WS auth + Redis multi-worker |

*Legend:*
- 🔴 MISSING: Dropped in VNext, needs recovery
- 🟡 PARTIAL: Partially implemented or buggy
- 🟢 IMPLEMENTED: Built in V-Web
- 🟢 CUTOVER_READY: Proved parity with legacy
- 🟢 CUT_OVER: Replaced legacy completely
