import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/presentation/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        monad: {
          50: "#f3f0ff",
          100: "#e9e4ff",
          200: "#d5cbff",
          300: "#b7a4ff",
          400: "#9875ff",
          500: "#836EF9", // Official Monad Purple
          600: "#6e4ef4",
          700: "#5d3be0",
          800: "#4d30b9",
          900: "#412b95",
          950: "#130938",
        },
        duel: {
          bg: "#0B0E14",
          surface: "#141A24",
          card: "#1A2232",
          border: "#263248",
          gold: "#FFD700",
          cyan: "#00F0FF",
          red: "#FF3366",
          green: "#00E676",
        }
      },
      boxShadow: {
        'glow-monad': '0 0 20px -5px rgba(131, 110, 249, 0.5)',
        'glow-gold': '0 0 20px -5px rgba(255, 215, 0, 0.5)',
        'glow-cyan': '0 0 20px -5px rgba(0, 240, 255, 0.5)',
        'glow-red': '0 0 20px -5px rgba(255, 51, 102, 0.5)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-light': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
};

export default config;
