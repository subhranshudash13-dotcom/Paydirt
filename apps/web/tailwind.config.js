/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          300: "#fef08a",
          400: "#fde047",
          500: "#eab308",
          600: "#ca8a04",
          700: "#a16207",
        },
        cyber: {
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
        },
        acid: {
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
        },
        hotpink: {
          400: "#f472b6",
          500: "#ec4899",
        },
        ore: "#0c0e14",
        seam: "#151922",
        coal: "#1c222e",
        brutal: {
          bg: "#0c0e14",
          card: "#141822",
          surface: "#1b212f",
          border: "#2b3446",
          dark: "#080a0e",
        },
      },
      fontFamily: {
        sans: ["Space Grotesk", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        "brutal-sm": "2px 2px 0px 0px #000000",
        "brutal": "4px 4px 0px 0px #000000",
        "brutal-lg": "6px 6px 0px 0px #000000",
        "brutal-xl": "8px 8px 0px 0px #000000",
        "brutal-gold": "4px 4px 0px 0px #eab308",
        "brutal-cyber": "4px 4px 0px 0px #06b6d4",
        "brutal-acid": "4px 4px 0px 0px #22c55e",
        "brutal-white": "4px 4px 0px 0px rgba(255, 255, 255, 0.9)",
      },
    },
  },
  plugins: [],
};

