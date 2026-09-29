# FRAMEFORGE Product Parity Matrix

This document tracks the recovery of existing FRAMEFORGE product capabilities in the VNext architecture against the `5e86a0b` Product Golden Baseline.

## 1. Project Hub & Workspace Navigation
| Capability | Existing Legacy State | VNext Target State | Current V-Web Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| Project Cover Image & Wash | Present | Present | 🔴 MISSING | Needs 96x56 cover, gradient wash, monogram fallback |
| Project Hub Context | Present | Present | 🔴 MISSING | Project hub view before entering tools |
| Workspace IA: Narration | Present | Present | 🔴 MISSING | Needs full timing and sync view |
| Workspace IA: Moodboard | Present | Present | 🔴 MISSING | Needs image upload and board logic |
| Workspace IA: Lighting | Present | Present | 🔴 MISSING | WebGL Lighting and top-down view |
| Review & Compare | Present | Present | 🔴 MISSING | Comments, versions, Word-style diff |
| Document Subsystem | Present | Present | 🔴 MISSING | Advanced PDF (9-grid, etc.), Word, Print |

## 2. Shot Workspace Advanced Capabilities
| Capability | Existing Legacy State | VNext Target State | Current V-Web Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| Read-first Table (No forced forms) | Present | Present | 🟢 IMPLEMENTED | Restored density |
| Inline Double-click Editing | Present | Present | 🔴 MISSING | Frequent edits should be inline, deep edits in inspector |
| Row Single Click (Selection) | Select | Select | 🟢 IMPLEMENTED | Decoupled from Inspector open |
| Row Double Click (Inspector) | N/A | Open Inspector | 🟢 IMPLEMENTED | Decoupled from selection |
| Column Manager (Resize/Reorder) | Present | Present | 🔴 MISSING | High density professional tools missing |
| Filtering & Sorting | Present | Present | 🟡 PARTIAL | Basic search exists |
| Import Subsystem | Present | Present | 🔴 MISSING | 5-stage import (file, map, preview, import, done) |
| Field Lifecycle | Present | Present | 🔴 MISSING | Active/Archived/Purged states |
| Advanced Timeline | Present | Present | 🔴 MISSING | Resizable splitters, playback, lanes, previous/next |
| Trash Semantics | Present | Present | 🔴 MISSING | 30-day Trash, Restore, Purge vs simple delete |

## 3. Server State & Collaboration
| Capability | Existing Legacy State | VNext Target State | Current V-Web Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| Strict No-Op Revision | Present | Present | 🟢 IMPLEMENTED | ShotService extracts and enforces |
| 409 Conflict Rehearsal | Partial | Strict | 🟢 CUTOVER_READY | E2E QA passes |
| Ephemeral Presence | Active | Redis PubSub | 🟡 INTEGRATED_NOT_CUT_OVER | V-Web WebSocket UI merged |
| Real-time Sync | Active | Websocket/SSE | 🔴 MISSING | Next phase |

*Legend:*
- 🔴 `MISSING`: Dropped in VNext, needs recovery from 5e86a0b
- 🟡 `PARTIAL`: Partially implemented or buggy
- 🟢 `IMPLEMENTED`: Built in V-Web
- 🟢 `CUTOVER_READY`: Proved parity with legacy
- 🟢 `CUT_OVER`: Replaced legacy completely
