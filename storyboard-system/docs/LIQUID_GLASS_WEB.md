# Liquid Glass web adaptation — R34

Apple's official implementations are SwiftUI, UIKit and AppKit, not a web UI
component package. This application remains a browser application; this is an
Apple-inspired adaptation, not an Apple-provided or certified component library.

References:
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://github.com/dpawlikowski/liquid-glass/tree/0e98505ee4964e63faf2c269ba49c3a18c635355

The MIT-licensed base material CSS is adapted and locally hosted in
`static/vendor/liquid-glass.css`, with the complete upstream license alongside.
Only the base material, neutral edge highlights and backdrop blur are reused.
There is no network dependency at runtime. Unused refraction sprites, whole-view
distortion, saturation-heavy chromatic edges and opacity pulsing are omitted.
This version does not claim native optical refraction or native morphing.

Glass applies to navigation, segmented controls, floating menus and canvas/text
toolbars. Reading surfaces, tables and the drawing canvas remain opaque. Both
themes use neutral RGB surface tokens; blue identifies actions and selection.
System reduced-transparency, forced-colors and the existing reduced-effects
setting disable glass. No SF Symbols or proprietary Apple fonts are bundled.

All standard input types have matching color, focus and disabled states. Existing
Material components remain registered for compatibility; they are not described
as Apple components. Screen-only styling leaves export/print typography intact.

Validation: `node tests/apple_workspace_qa.cjs` and
`node tests/workspace_r33_browser_qa.cjs`. These are functional/computed-style
tests, not visual acceptance or a complete accessibility certification.
