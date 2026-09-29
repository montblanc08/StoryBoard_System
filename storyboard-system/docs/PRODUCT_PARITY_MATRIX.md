# FRAMEFORGE Product Parity Matrix

This document tracks the recovery of existing FRAMEFORGE product capabilities in the VNext architecture.

## 1. Project Hub & Workspace Navigation
| Capability | Existing Legacy State | VNext Target State | Current V-Web Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| Project Cover Image | Present | Present | 🔴 MISSING | Needs to move away from generic list |
| Visual Identity & Typography | Present | Present | 🟡 PARTIAL | Login and layout moved to neutral palette |
| Workspace IA: Narration | Present | Present | 🔴 MISSING | Not in sidebar |
| Workspace IA: Moodboard | Present | Present | 🔴 MISSING | Not in sidebar |
| Workspace IA: Scene Planning | Present | Present | 🔴 MISSING | Not in sidebar |

## 2. Shot Workspace Advanced Capabilities
| Capability | Existing Legacy State | VNext Target State | Current V-Web Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| Read-first Table (No forced forms) | Present | Present | 🟢 IMPLEMENTED | Restored density |
| Inline Double-click Editing | Present | Present | 🔴 MISSING | Frequent edits should be inline, deep edits in inspector |
| Row Single Click | Select | Select | 🟢 IMPLEMENTED | Decoupled from Inspector open |
| Row Double Click | N/A | Open Inspector | 🟢 IMPLEMENTED | Decoupled from selection |
| Column Manager (Resize/Reorder) | Present | Present | 🔴 MISSING | High density professional tools missing |
| Filtering & Sorting | Present | Present | 🟡 PARTIAL | Basic search exists |
| Grouping | Present | Present | 🔴 MISSING | Needs implementation |
| Bulk Actions | Present | Present | 🔴 MISSING | API exists, UI missing |
| Context Menu | Present | Present | 🔴 MISSING | Essential for professional workflows |

## 3. Server State & Collaboration
| Capability | Existing Legacy State | VNext Target State | Current V-Web Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| Strict No-Op Revision | Present | Present | 🟢 IMPLEMENTED | ShotService extracts and enforces |
| 409 Conflict Rehearsal | Partial | Strict | 🟢 CUTOVER_READY | E2E QA passes |
| Ephemeral Presence | Active | Redis PubSub | 🔴 MISSING | Next phase |
| Real-time Sync | Active | Websocket/SSE | 🔴 MISSING | Next phase |

*Legend:*
- 🔴 `MISSING`: Dropped in VNext, needs recovery
- 🟡 `PARTIAL`: Partially implemented or buggy
- 🟢 `IMPLEMENTED`: Built in V-Web
- 🟢 `CUTOVER_READY`: Proved parity with legacy
- 🟢 `CUT_OVER`: Replaced legacy completely
