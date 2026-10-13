// cn(): a escala tipográfica do Design System é TAMANHO, não cor, para o tailwind-merge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cn } from "./utils";

test("token tipográfico convive com cor text-*", () => {
  assert.equal(cn("text-meta font-medium", "text-warning-fg"), "text-meta font-medium text-warning-fg");
  assert.equal(cn("text-wg-ink-muted", "text-label"), "text-wg-ink-muted text-label");
  assert.equal(cn("text-body", "text-wg-ink-muted/80"), "text-body text-wg-ink-muted/80");
});

test("token tipográfico conflita com outro tamanho: o último vence", () => {
  assert.equal(cn("text-sm", "text-meta"), "text-meta");
  assert.equal(cn("text-record-title", "text-[12px]"), "text-[12px]");
  assert.equal(cn("text-section-title", "text-page-title"), "text-page-title");
});

test("cores continuam se substituindo entre si", () => {
  assert.equal(cn("text-body text-wg-ink", "text-danger-fg"), "text-body text-danger-fg");
});
