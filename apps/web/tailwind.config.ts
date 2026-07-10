import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: "#eef6ed",
          100: "#d8ebd5",
          200: "#b2d8ad",
          300: "#8cc585",
          400: "#6cb863",
          500: "#57a04f",
          600: "#509849",
          700: "#3f7539",
          800: "#2f542a",
          900: "#234020",
          950: "#122312",
        },
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
