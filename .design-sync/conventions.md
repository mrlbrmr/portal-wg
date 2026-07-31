## WG Baterias UI — how to build with these components

This is the internal UI kit for the **WG Baterias** careers portal + ATS (Portuguese-BR product).
Five real, shipped React components: `AnimateIn`, `ConfirmModal`, `EmptyState`, `Skeleton`,
`ToastProvider` (plus the `useToast` hook). They are **already styled** — compose them via props
and children; never re-skin them.

### Setup / wrapping

- **Wrap the app tree in `<ToastProvider>`** if you use toasts. `useToast()` reads its context and
  **throws** ("useToast deve ser usado dentro de <ToastProvider>") when rendered outside it.
  The provider renders its own fixed bottom-right toast stack; you only call `notify`:

  ```tsx
  import { ToastProvider, useToast } from 'portal-vagas-wg-ui';

  function SaveButton() {
    const { notify } = useToast();               // notify(type, message)
    return <button onClick={() => notify('success', 'Candidatura enviada com sucesso!')}>Salvar</button>;
  }
  // type is 'success' | 'error' | 'info'

  <ToastProvider><SaveButton /></ToastProvider>
  ```

- Icons come from **`lucide-react`** and are bundled — pass a lucide icon component to
  `EmptyState`'s `icon` prop (it renders it inside a bubble): `<EmptyState icon={Inbox} …/>`.
- `ConfirmModal` is controlled + self-overlays (`fixed inset-0`, full-screen dim). Drive it with
  `isOpen`; it returns `null` when closed. `variant="danger"` → red confirm, `"warning"` → amber.
- `Skeleton` is a single pulsing block — size it with a `className` (width/height/rounding).
  `AnimateIn` wraps children and fades+rises them in on scroll (`delay` in ms to stagger a list).

### Styling idiom — read this before adding your own CSS

The brand look is **Tailwind utilities baked into the components** and compiled into the shipped
`styles.css`. The WG palette (from the repo's `tailwind.config.ts`) is the design language:

| Token (Tailwind name) | Hex | Use |
|---|---|---|
| `wg-green` | `#90CB46` | primary brand green (CTAs, accents) |
| `wg-green-bright` / `wg-green-vivid` | `#98DB55` / `#7FD400` | brighter green highlights |
| `wg-green-dark` | `#4F6930` | deep green (text/icon on light) |
| `wg-dark` / `wg-card` / `wg-card-2` | `#0C0D0C` / `#151515` / `#1C1D1D` | near-black surfaces |
| `wg-border` / `wg-gray` | `#2A2A2A` / `#B8B8B8` | borders / muted text |

Custom motion: `ease-spring` (`cubic-bezier(0.16,1,0.3,1)`), `animate-pulse`, `animate-in`.

**Important limitation:** the shipped `styles.css` is a **compiled subset** of Tailwind — only the
utilities these five components actually use. Arbitrary Tailwind classes you invent for your own
layout glue (e.g. `bg-wg-green`, `p-8`, `grid-cols-3`) will **not** resolve in a rendered design.
So for your own wrappers, style with **inline styles using the hex values above** (or plain CSS),
and lean on the library components for the styled UI. Green primary on near-black is the WG signature.

### Where the truth lives

Read the compiled `styles.css` and each component's `<Name>.d.ts` (its exact props) and
`<Name>.prompt.md` (usage) before composing. Example — an empty state with a brand-styled CTA:

```tsx
import { EmptyState } from 'portal-vagas-wg-ui';
import { SearchX } from 'lucide-react';

<EmptyState
  icon={SearchX}
  title="Nenhum resultado encontrado"
  description="Ajuste os filtros ou limpe a busca para ver todas as candidaturas."
  action={
    <button style={{ background: '#90CB46', color: '#0C0D0C', padding: '8px 16px', borderRadius: 12, fontWeight: 600 }}>
      Limpar filtros
    </button>
  }
/>
```
