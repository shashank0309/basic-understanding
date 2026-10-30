import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "var(--brand)", dark: "var(--brand-dark)", light: "var(--brand-light)" },
      },
    },
  },
  plugins: [],
} satisfies Config;
