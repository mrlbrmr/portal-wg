import { AnimateIn } from "portal-vagas-wg-ui";

// AnimateIn reveals its children (fade + slide up) once they scroll into view.
// In a static card the children are already in view, so they render revealed.
export function Card() {
  return (
    <AnimateIn className="w-72 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">Bloco revelado</p>
      <p className="mt-1 text-sm text-gray-500">
        O conteúdo aparece com transição suave assim que entra na viewport.
      </p>
    </AnimateIn>
  );
}

export function Staggered() {
  return (
    <div className="w-72 space-y-3">
      {["Primeiro", "Segundo", "Terceiro"].map((label, i) => (
        <AnimateIn
          key={label}
          delay={i * 120}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800"
        >
          {label} item
        </AnimateIn>
      ))}
    </div>
  );
}
