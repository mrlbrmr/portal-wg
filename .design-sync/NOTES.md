# design-sync notes — WG Baterias UI

Project: **WG Baterias UI** — https://claude.ai/design/p/827b421f-7faf-4fa2-8c5d-cb93af030fa4
Shape: `package` (but this is a Next.js app, not a published library — see below). 5 components.

## This repo is NOT a normal package — custom scaffolding

There is no shipped `dist/` or design-token CSS. The DS is a handful of primitives under
`src/components/ui/`, styled with Tailwind utilities. Two committed helper files make the
converter work:

- **`.design-sync/ds-ui-entry.ts`** — the bundle entry. Re-exports the 5 primitives via the
  `@/*` → `src/*` tsconfig alias, so it's location-independent. Passed as `--entry`.
- **`.design-sync/gen-css.mjs`** — compiles the Tailwind stylesheet used as `cfg.cssEntry`
  (`.ds-sync/ds-tailwind.css`). **RE-RUN THIS BEFORE EVERY BUILD** and always after editing any
  `.design-sync/previews/*.tsx` (new utility classes used there won't be in the CSS otherwise).

## Exact re-sync recipe (from repo root)

```sh
# 1. re-stage converter scripts (see base SKILL.md step 7 cp line) into .ds-sync/
# 2. regenerate the Tailwind CSS
node .design-sync/gen-css.mjs
# 3. fetch remote anchor -> .design-sync/.cache/remote-sync.json  (skip if remote empty)
# 4. driver run
DS_CHROMIUM_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" \
  node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules node_modules \
  --entry .design-sync/ds-ui-entry.ts --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
```

- **Render check / playwright:** no `~/.cache/ms-playwright` chromium is installed. The validate &
  capture scripts honor `DS_CHROMIUM_PATH` → point it at the system Chrome
  (`C:\Program Files\Google\Chrome\Application\chrome.exe`). Avoids the ~200 MB chromium download.
  Works fine for these previews.
- `--node-modules` = repo root `node_modules` (npm project, react resolves there).

## Known render warns (triaged, expect on re-sync)

- `[GRID_OVERFLOW]` on **EmptyState** → resolved with `overrides.EmptyState.cardMode: "column"`.
  If it reappears the override was dropped.
- `tokens: 1 missing (below threshold)` — non-blocking, expected (a `var(--radius)` reference from
  the `rounded-lg` utilities; the app doesn't define `--radius` in the shipped subset).

## Styling model (also in conventions.md, but for the next agent)

The shipped `styles.css` / `_ds_bundle.css` is a **compiled SUBSET** of Tailwind — only utilities the
5 components + their previews use. Only two `wg-*` utilities actually ship (`border-l-wg-green`,
`text-wg-green-dark`). Do NOT enumerate other `wg-*` classes in conventions as usable — validated
against the compiled CSS each run. Brand palette (design language, from `tailwind.config.ts`):
`wg-green #90CB46` primary, `wg-green-dark #4F6930`, near-black `wg-dark #0C0D0C` surfaces.

## Re-sync risks (what can silently go stale)

- **Adding a new util class to a component or preview and forgetting `gen-css.mjs`** → the class
  won't be in the shipped CSS and the card renders unstyled. Always regenerate CSS before build.
- **conventions.md styling table** names hex tokens + the 2 shipped `wg-*` utilities. If the
  component set grows and uses more `wg-*` utilities, re-validate the table against the fresh
  `_ds_bundle.css` (base SKILL.md conventions-validation pass).
- If new UI primitives are added under `src/components/ui/`, they must be added to BOTH
  `ds-ui-entry.ts` (the export) and `cfg.componentSrcMap` / `dtsPropsFor` — discovery is pinned
  to the explicit map, not auto-scan.
- The 2026-07-30 first sync built everything locally but **never uploaded** (remote was empty when
  this 2026-07-31 run started). Upload is now complete (33 files). Grades in `.cache/` are gitignored.
