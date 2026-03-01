import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "var(--bg-primary)",
        "bg-card": "var(--bg-card)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-sidebar": "var(--bg-sidebar)",
        "accent-indigo": "var(--accent-indigo)",
        "accent-indigo-hover": "var(--accent-indigo-hover)",
        "accent-amber": "var(--accent-amber)",
        "accent-emerald": "var(--accent-emerald)",
        "accent-red": "var(--accent-red)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
      },
      borderColor: {
        subtle: "var(--border-subtle)",
        "subtle-hover": "var(--border-hover)",
      },
      fontFamily: {
        syne: ["Syne", "sans-serif"],
        jetbrains: ["JetBrains Mono", "monospace"],
        inter: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
