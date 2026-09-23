"use client";

import { useEffect, useRef } from "react";

/**
 * Seletor de cor que só salva ao CONFIRMAR a cor (evento nativo "change"), e não a
 * cada movimento do seletor — o onChange do React dispara em todo "input".
 */
export function ColorInput({
  id,
  value,
  disabled,
  onCommit,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  onCommit: (color: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChange = () => el.value.toLowerCase() !== value.toLowerCase() && commitRef.current(el.value);
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [value]);
  return (
    <input
      ref={ref}
      id={id}
      type="color"
      defaultValue={value}
      key={value}
      disabled={disabled}
      className="h-8 w-10 cursor-pointer rounded-control border border-wg-border-light bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}
