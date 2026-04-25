import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        abraxas: {
          50:  "#f0fafa",
          100: "#ccebee",
          200: "#99d4d9",
          300: "#4db5b8",
          400: "#2d9aa0",
          500: "#1a8490",
          600: "#1a7280",
          700: "#155f6b",
          800: "#0f4d57",
          900: "#0a3840"
        },
        "abraxas-accent": "#4db5b8"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
