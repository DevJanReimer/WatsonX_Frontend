import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        abarxas: {
          50:  "#f2f6fb",
          100: "#e1ebf5",
          200: "#c0d4e8",
          300: "#8fb1d2",
          400: "#5786b7",
          500: "#2f639b",
          600: "#214d7e",
          700: "#1b3e66",
          800: "#172f4f",
          900: "#11243d"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
