// Compiles the Tailwind stylesheet used as cfg.cssEntry for the design-sync
// bundle. This repo has no shipped design-token CSS — styling is Tailwind
// utilities resolved from tailwind.config.ts. We compile exactly the utilities
// used by the ui/ components AND the authored preview .tsx files, so preview
// cards (and any design built with the bundle) render styled.
//
// RE-RUN this before every build, and ALWAYS after editing files under
// .design-sync/previews/ (new utilities used there won't exist in the CSS
// otherwise). Output lands in .ds-sync/ (gitignored, regenerated per run).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const cli = 'node_modules/tailwindcss/lib/cli.js';
if (!existsSync(cli)) {
  console.error('tailwindcss not found — run the repo install first (npm ci / npm install)');
  process.exit(1);
}
mkdirSync('.ds-sync', { recursive: true });
execFileSync(process.execPath, [
  cli,
  '-c', 'tailwind.config.ts',
  '-i', '.ds-sync/tw-input.css',
  '-o', '.ds-sync/ds-tailwind.css',
  '--content', './src/components/ui/**/*.{ts,tsx},./.design-sync/previews/**/*.{ts,tsx}',
  '--minify',
], { stdio: 'inherit' });
console.error('wrote .ds-sync/ds-tailwind.css');
