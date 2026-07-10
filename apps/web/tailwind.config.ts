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
          50: "#e9f6ee",
          100: "#cdeed7",
          200: "#9ddcaf",
          300: "#5dc47f",
          400: "#2cae5b",
          500: "#1c9743",
          600: "#17a34a",
          700: "#138a3d",
          800: "#0f6c30",
          900: "#0b5425",
          950: "#062e14",
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
