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
      colors: {
        wg: {
          green:       "#90CB46",
          "green-bright": "#98DB55",
          "green-dark":   "#4F6930",
          dark:        "#0C0D0C",
          card:        "#151515",
          "card-2":    "#1C1D1D",
          border:      "#2A2A2A",
          gray:        "#B8B8B8",
        },
      },
      borderRadius: {
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
      },
      animation: {
        "fade-up":       "fade-up 0.55s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":       "fade-in 0.45s ease-out both",
        "float-subtle":  "float-subtle 5s ease-in-out infinite",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
