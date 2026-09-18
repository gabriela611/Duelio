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
        // iOS Financial App Design System
        background: "#F6F6F5",
        surface: {
          DEFAULT: "#FFFFFF",
          secondary: "#F1F1F1",
          tertiary: "#EBEBEB",
        },
        text: {
          primary: "#0B0B0B",
          secondary: "#858585",
          tertiary: "#ADADAD",
        },
        border: {
          DEFAULT: "rgba(0, 0, 0, 0.06)",
          light: "rgba(0, 0, 0, 0.04)",
        },
        accent: "#EF00F5",
        positive: "#14CF1C",
        negative: "#FF3B30",

        // Monad brand colors (minimal usage)
        monad: {
          50: "#f3f0ff",
          100: "#e9e4ff",
          200: "#d5cbff",
          300: "#b7a4ff",
          400: "#9875ff",
          500: "#836EF9",
          600: "#6e4ef4",
          700: "#5d3be0",
          800: "#4d30b9",
          900: "#412b95",
        },
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.025)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'elevated': '0 4px 16px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.03)',
        '2xs': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'xs': '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        'DEFAULT': '8px',
        'sm': '10px',
        'md': '12px',
        'lg': '14px',
        'xl': '16px',
        '2xl': '18px',
        '3xl': '20px',
        '4xl': '24px',
        '5xl': '30px',
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'SF Pro Display',
          'SF Pro Text',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      transitionTimingFunction: {
        'ios': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
