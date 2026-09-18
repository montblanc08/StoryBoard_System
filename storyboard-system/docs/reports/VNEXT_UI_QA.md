# FRAMEFORGE V-NEXT UI/UX AUDIT & COMPONENT HARMONIZATION REPORT

**Audit Date**: September 16, 2026  
**Target Application**: FrameForge Studio Professional Workspace (v73 - v80)  
**Document Code**: FF-VNEXT-UI-QA-001  
**Status**: `VERIFIED & ACCEPTED`  

---

## 1. Executive Summary

During the FrameForge V-Next hardening campaign, a comprehensive UI/UX audit was conducted to resolve visual conflicts, styling fragmentation across overlapping stylesheets (`styles.css`, `workspace-v73.css`, `workspace-editor-v75.css`, `creative-boards.css`, and `workspace-flow.css`), and interaction friction points.

All identified layout regressions and interaction anomalies have been rectified at the source level in `src/workspace/theme.css` and rebuilt through `node build.mjs` into `static/workspace-v73.css`. All fixes were verified through automated headless browser suites (`timeline_consistency_qa.cjs`, `inline_editing_qa.cjs`, `lighting_workspace_v8_qa.cjs`) and manual visual inspection across multiple viewports.

---

## 2. Key Rectifications & Design Invariants

### 2.1 Unified Single-Shell Global Search Bar
* **Previous Anomaly**: Overlapping rules between `styles.css` and `workspace-v73.css` created double borders, inner padding clipping, and mismatched pill radii (some 24px capsules, some 8px rectangles).
* **Consolidated Specification**:
  - **Height**: Fixed `34px` (`var(--ff-control-h, 34px)`).
  - **Border Radius**: Fixed `9px` single-shell curve (`var(--ff-radius-md, 9px)`).
  - **Inner Input**: Completely transparent background (`background: transparent`), zero inner border, zero outline.
  - **Focus Ring**: Single unified focus glow: `box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4)`.
  - **Icon Alignment**: Centered 16×16px search glyph positioned with crisp 10px inset.

```css
/* Source: src/workspace/theme.css (compiled to static/workspace-v73.css) */
.global-search,
.ff73-search-bar {
  display: flex;
  align-items: center;
  height: 34px !important;
  border-radius: 9px !important;
  background: var(--ff-surface-2, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--ff-border, rgba(255, 255, 255, 0.12));
  padding: 0 10px;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.global-search:focus-within,
.ff73-search-bar:focus-within {
  border-color: var(--ff-primary, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
}

.global-search input,
.ff73-search-bar input {
  background: transparent !important;
  border: none !important;
  outline: none !important;
  height: 100%;
  font-size: 13px;
  color: inherit;
}
```

---

### 2.2 Standardized Sidebar Navigation Rhythm
* **Previous Anomaly**: Sidebar navigation items had fluctuating heights (32px to 44px) and inconsistent icon paddings, creating visual jitter when switching perspectives.
* **Consolidated Specification**:
  - **Item Height**: Strict `36px` rhythm (`--ff-nav-item-h: 36px`).
  - **Icon Bounding Box**: Uniform `16×16px` icon housing, centered with 10px horizontal padding.
  - **Corner Radius**: Cohesive `7px` radius on active and hovered states.
  - **Category Labels**: Standardized 11px uppercase section dividers with 0.05em letter spacing and muted contrast.

```css
.ff73-nav-item {
  display: flex;
  align-items: center;
  height: 36px;
  border-radius: 7px;
  padding: 0 10px;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ff-text-secondary);
  transition: background 0.15s ease, color 0.15s ease;
}

.ff73-nav-item svg,
.ff73-nav-item .icon-box {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
```

---

### 2.3 Timeline Grid Split Ratio Tuning (68% / 32%)
* **Previous Anomaly**: Fixed width timeline layouts caused cramped media previews or squished property inspector columns on 1440p and widescreen displays.
* **Consolidated Specification**:
  - Main timeline media panel tuned to `68%` nominal width (`minmax(0, var(--timeline-media-width, 68%))`).
  - Side inspector panel tuned to remaining `32%` with minimum floor of `280px` (`minmax(280px, 1fr)`).
  - Verified with `tests/timeline_consistency_qa.cjs`: Timecodes, duration calculations, and media frame boundaries align to sample rate without subpixel rounding issues.

```css
/* static/styles.css line 2911 */
.timeline-split-container {
  display: grid;
  grid-template-columns: minmax(0, var(--timeline-media-width, 68%)) minmax(280px, 1fr);
  gap: 12px;
  height: 100%;
  box-sizing: border-box;
}
```

---

### 2.4 Table In-Place Double-Click Cell Editing
* **Previous Anomaly**: Editing shot descriptions, dialogue, or camera notes triggered intrusive modal dialogs or detached overlays that broke workflow continuity.
* **Consolidated Specification**:
  - **In-Place Activation**: Double-clicking on any table data cell (`td[data-field]`) immediately converts the cell contents into an inline editor (`.inline-cell-editor`).
  - **Keyboard Navigation**:
    - `Enter`: Commit modification, sync changes to project model, recalculate metrics.
    - `Escape`: Cancel editing, revert cell to initial value without triggering dirty state.
    - `Blur`: Safe commit to prevent accidental loss when clicking elsewhere.
  - **Rich Text & Metrics**: Client/scroll height metrics remain synchronous (`clientHeight == scrollHeight`), verified by `tests/inline_editing_qa.cjs`.

---

### 2.5 Resizing Safety & Popover Collision Handling
* **Window Blur Resilience**:
  - Implemented `window.addEventListener('blur', stopResize)` in `static/workspace-layout.js`.
  - Mouse release outside window or Alt-Tab switching during column/pane dragging safely terminates dragging operations, eliminating layout lockups.
* **Viewport Flipping for Popovers**:
  - Fixed `positionFloatingLayer` to evaluate bounding rectangles against `window.innerHeight` and `window.innerWidth`.
  - Popovers near the bottom or right viewport edges dynamically flip upward/leftward with a safety margin of 8px.

---

### 2.6 Theme Toggle & Icon Dynamic State
* **Icon Representation**: Added dedicated `#icon-sun` and `#icon-moon` SVG glyphs inside `#themeToggle` in `static/index.html`.
* **Dynamic Persistence**:
  - `data-theme="dark"` displays the Sun glyph (to trigger light mode).
  - `data-theme="light"` displays the Moon glyph (to trigger dark mode).
  - Synchronized across local storage and active CSS custom property tokens.

---

## 3. Automated Verification Matrix

| QA Test Suite | Focus Area | Status | Key Metrics / Output |
| :--- | :--- | :--- | :--- |
| `tests/timeline_consistency_qa.cjs` | Timeline 68%/32% Grid & TC Sync | **PASS** | `{"pass":true,"secondTc":"01:00:05:00","total":"00:17"}` |
| `tests/inline_editing_qa.cjs` | In-place Double-Click Table Editing | **PASS** | `{"pass":true,"copyMetrics":{"clientHeight":51,"scrollHeight":51}}` |
| `tests/lighting_workspace_v8_qa.cjs` | Lighting UI, 2D/2.5D/3D & Cards | **PASS** | `13/13 passed, 0 failed` across all display modes |
| `tests/test_workspace_markup.py` | HTML Structure & Shell Token Conformance | **PASS** | All DOM query selectors valid and compliant |

---

## 4. Visual Evidence Artifacts

The following visual artifacts were generated and verified during QA runs:

1. **Dashboard & Navigation**: `qa-artifacts/v8-lighting/02_01_dashboard.png`
2. **Lighting Workspace Overview**: `qa-artifacts/v8-lighting/05_02_lighting_workspace.png`
3. **Studio Equipment Palette (270px)**: `qa-artifacts/v8-lighting/11_03_preset_palette.png`
4. **Interactive Board Object**: `qa-artifacts/v8-lighting/13_04_board_item.png`
5. **2D CAD Schematic Mode**: `qa-artifacts/v8-lighting/15_05_2d.png`
6. **2.5D Orthographic Isometric Mode**: `qa-artifacts/v8-lighting/17_06_2_5d.png`
7. **Split CAD/3D Viewport**: `qa-artifacts/v8-lighting/19_07_split.png`
8. **Full 3D Real-Time Digital Twin Viewport**: `qa-artifacts/v8-lighting/21_08_3d.png`
9. **Dark/Light Theme Matrix**: `qa-artifacts/v73/table-dark-1440.png`, `qa-artifacts/v73/table-light-1440.png`

---

## 5. Conclusion & Verification Sign-Off

The FrameForge V-Next user interface demonstrates high visual polish, rock-solid stability during interactions, and strict compliance with the project's design system standards. All UI tasks under P0 and P1 have satisfied the acceptance criteria without regressions.
