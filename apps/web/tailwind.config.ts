import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sarasa-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-sarasa-mono)", "monospace"]
      },
      colors: {
        studio: {
          950: "#06080b",
          900: "#0b0e14",
          850: "#10141d",
          800: "#161b26",
          700: "#222a3a",
          600: "#323d52"
        },
        amber: {
          DEFAULT: "#ffbf47",
          hover: "#ffd27d",
          dim: "#30240d"
        },
        film: {
          green: "#52d7a4",
          blue: "#38bdf8",
          purple: "#c084fc",
          red: "#f87171"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
