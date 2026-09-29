# FRAMEFORGE Screen Parity Matrix

This document tracks the recovery of existing FRAMEFORGE screens in the VNext architecture against the `5e86a0b` Product Golden Baseline.

## Web UI Pages (apps/web)

| Route / Screen | VNext Route | Status | Notes |
| :--- | :--- | :--- | :--- |
| `/login` | `/login` | 🟢 CUTOVER_READY | Responsive, strict neutral theme, visual QA passing |
| `/projects` | `/productions` | 🟡 PARTIAL | Unified TopBar, but missing Project Cover/Wash IA from legacy |
| `/projects/[id]` | `/production/[id]` | 🔴 MISSING | Should be Project Hub (context overview), currently missing |
| `/projects/[id]/shots` | `/production/[id]/shots` | 🟡 INTEGRATED_NOT_CUT_OVER | Decoupled click. Missing Column Manager, Trash, inline editing |
| `/projects/[id]/timeline` | `/production/[id]/timeline`| 🔴 MISSING | Present but lacks Viewer, splitters, lanes, playback |
| `/projects/[id]/storyboard`| `/production/[id]/storyboard`| 🟡 PARTIAL | Present but basic |
| `/projects/[id]/deliverables`| `/production/[id]/deliverables`| 🔴 MISSING | PDF/Word/Print subsystem missing (mock UI only) |
| `/projects/[id]/import` | `/production/[id]/import`| 🔴 MISSING | 5-stage import pipeline missing |
| `/projects/[id]/narration` | `/production/[id]/narration` | 🔴 MISSING | Core legacy feature: timing, split, read speed |
| `/projects/[id]/moodboard` | `/production/[id]/moodboard` | 🔴 MISSING | Core legacy feature |
| `/projects/[id]/lighting` | `/production/[id]/lighting` | 🔴 MISSING | Core legacy feature: WebGL, 2D/3D toggle |
| `/projects/[id]/review` | `/production/[id]/review` | 🔴 MISSING | Core legacy feature: Comments, Word-diff, history |

*Legend:*
- 🔴 `MISSING`: Dropped in VNext, needs recovery from 5e86a0b
- 🟡 `PARTIAL`: Partially implemented or buggy
- 🟡 `IMPLEMENTED_NOT_INTEGRATED`: UI exists, mock data
- 🟡 `INTEGRATED_NOT_CUT_OVER`: UI exists, real API, functional parity close
- 🟢 `CUTOVER_READY`: Parity proven, QA passes
- 🟢 `CUT_OVER`: Authoritative runtime
