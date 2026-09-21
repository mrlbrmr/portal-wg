import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Fonte de corpo padrão — Inter
        sans:    ["var(--font-inter)", "system-ui", "sans-serif"],
        inter:   ["var(--font-inter)", "system-ui", "sans-serif"],
        // Fonte de título — Sora
        sora:    ["var(--font-sora)", "sans-serif"],
        heading: ["var(--font-sora)", "sans-serif"],
      },
      colors: {
        wg: {
          // Brand greens
          green:          "#90CB46",
          "green-bright": "#98DB55",
          "green-dark":   "#4F6930",
          "green-vivid":  "#7FD400",
          // Dark (public-facing) theme
          dark:        "#0C0D0C",
          card:        "#151515",
          "card-2":    "#1C1D1D",
          border:      "#2A2A2A",
          gray:        "#B8B8B8",
          // Light panel theme (internal RH panel)
          bg:              "#F6F8F3",
          sidebar:         "#EEF4E3",
          "border-light":  "#DCE8CC",
          "border-lighter":"#E7EEDD",
          ink:             "#1A2213",
          "ink-muted":     "#55614A",
          "ink-secondary": "#3E4A34",
          "hover-light":   "#E4EED6",
        },
        // ── Cores semânticas de estado (Design System do painel RH) ──────────
        // Uso: bg-success-bg text-success-fg border-success-border.
        // Nunca comunicam sozinhas: todo status leva texto (e ícone quando útil).
        // Pares fg/bg escolhidos para contraste AA (≥ 4.5:1) em texto de 11–13px.
        success: { DEFAULT: "#4F6930", bg: "#EAF4DC", fg: "#3E5A2A", border: "#CFE3B4" },
        info:    { DEFAULT: "#3C56A8", bg: "#E9EDFA", fg: "#344C96", border: "#C9D3F2" },
        warning: { DEFAULT: "#B4791C", bg: "#FCF1DD", fg: "#7F530C", border: "#F1D9A8" },
        danger:  { DEFAULT: "#B23A2B", bg: "#FBEAE7", fg: "#9C3225", border: "#F2C7BF" },
        neutral: { DEFAULT: "#6B7860", bg: "#F1F3EE", fg: "#4D5843", border: "#E1E6DA" },
      },
      // Escala tipográfica do painel: text-page-title, text-section-title, text-record-title,
      // text-body, text-meta, text-label.
      fontSize: {
        "page-title":    ["1.75rem",   { lineHeight: "2.25rem", fontWeight: "600", letterSpacing: "-0.015em" }],
        "section-title": ["1.125rem",  { lineHeight: "1.625rem", fontWeight: "600", letterSpacing: "-0.005em" }],
        "record-title":  ["0.9375rem", { lineHeight: "1.375rem", fontWeight: "600" }],
        "body":          ["0.875rem",  { lineHeight: "1.375rem" }],
        "meta":          ["0.8125rem", { lineHeight: "1.25rem" }],
        "label":         ["0.75rem",   { lineHeight: "1rem", fontWeight: "500" }],
      },
      borderRadius: {
        // Tokens do Design System: controles (botões, inputs, selects) e cards.
        control: "8px",
        card:    "12px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "float-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "panel-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up":       "fade-up 0.55s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":       "fade-in 0.45s ease-out both",
        "float-subtle":  "float-subtle 5s ease-in-out infinite",
        "panel-in":      "panel-in 0.24s cubic-bezier(0.16,1,0.3,1) backwards",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
