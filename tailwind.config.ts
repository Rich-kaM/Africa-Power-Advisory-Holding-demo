import type { Config } from "tailwindcss"

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
