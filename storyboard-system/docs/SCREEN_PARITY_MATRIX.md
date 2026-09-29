# FRAMEFORGE Screen Parity Matrix

This document tracks the recovery of existing FRAMEFORGE screens in the VNext architecture.

## Web UI Pages (apps/web)

| Route / Screen | VNext Route | Status | Notes |
| :--- | :--- | :--- | :--- |
| `/login` | `/login` | 🟢 CUTOVER_READY | Responsive, strict neutral theme, visual QA passing |
| `/projects` | `/productions` | 🟡 PARTIAL | Unified TopBar, but missing Cover/Identity IA from legacy |
| `/projects/[id]` | `/production/[id]` | 🔴 MISSING | Should be Project Hub, currently redirects or absent |
| `/projects/[id]/shots` | `/production/[id]/shots` | 🟢 INTEGRATED_NOT_CUT_OVER | Dense read-first table, decouple single/double click implemented. Needs inline edit & column tools |
| `/projects/[id]/timeline` | `/production/[id]/timeline`| 🟡 PARTIAL | Present but basic |
| `/projects/[id]/storyboard`| `/production/[id]/storyboard`| 🟡 PARTIAL | Present but basic |
| `/projects/[id]/deliverables`| `/production/[id]/deliverables`| 🟡 PARTIAL | PDF/Export mock UI present, backend export exists but not fully wired with options |
| `/projects/[id]/narration` | `N/A` | 🔴 MISSING | Core legacy feature |
| `/projects/[id]/moodboard` | `N/A` | 🔴 MISSING | Core legacy feature |
| `/projects/[id]/planning` | `N/A` | 🔴 MISSING | Core legacy feature |

*Legend:*
- 🔴 `MISSING`: Dropped in VNext, needs recovery
- 🟡 `PARTIAL`: Partially implemented or buggy
- 🟢 `IMPLEMENTED_NOT_INTEGRATED`: UI exists, mock data
- 🟢 `INTEGRATED_NOT_CUT_OVER`: UI exists, real API, functional parity close
- 🟢 `CUTOVER_READY`: Parity proven, QA passes
- 🟢 `CUT_OVER`: Authoritative runtime
