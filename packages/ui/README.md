# FrameForge shared UI

`@frameforge/ui` is the single target UI source for `apps/web`. The bottom layer uses shadcn/ui's Radix `new-york` component conventions, Tailwind semantic colors, CVA variants and Lucide icons. The previous FrameForge V4.7 warm-neutral palette and Satoshi/Sarasa typography are mapped in `src/theme.css`; V-Web does not define another palette.

- `src/components/`: shared Button, Input, TextArea, Card and Badge source. Keep shadcn's standard variants and radius/padding proportions.
- `src/primitives.tsx`: existing package API; Button/Input/TextArea now re-export the shared components. IconButton adds an accessible tooltip. Field and controlled Select use the same semantic theme while preserving the current caller contract.
- `src/lib/utils.ts`: shared `cn` helper.
- `src/index.ts`: public API and existing product strings. V-Web imports from this package, not a parallel `components/ui` directory.

Both `apps/web/components.json` and this workspace's `components.json` are recognized by the official CLI. The package exports point TypeScript and the CLI to `src/components` while runtime imports use the compiled `dist`. Before adding a component, inspect `npx shadcn@latest add <name> -c apps/web --dry-run`, then verify that the target path is this package's source and review the diff. Run the package and V-Web builds after changes. The Legacy `storyboard-system/packages/ui` stays in place until its remaining consumers are migrated and tested.
