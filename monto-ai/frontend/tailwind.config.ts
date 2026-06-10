import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4F46E5",
          50: "#EEEEFF",
          100: "#D5D4FF",
          200: "#ACABFF",
          300: "#8280FF",
          400: "#6966F0",
          500: "#4F46E5",
          600: "#3D35C7",
          700: "#2C27A0",
          800: "#1C1A70",
          900: "#0D0C40",
        },
        secondary: {
          DEFAULT: "#7C3AED",
          50: "#F5F0FF",
          100: "#EDE0FF",
          200: "#D4BBFF",
          300: "#BB94FF",
          400: "#A06EFF",
          500: "#7C3AED",
          600: "#6429CC",
          700: "#4D1DA8",
          800: "#351280",
          900: "#1E0A55",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-ring": "pulseRing 1.5s ease-out infinite",
        "float": "float 3s ease-in-out infinite",
        "blink": "blink 4s ease-in-out infinite",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "70%": { transform: "scale(1.1)", opacity: "0" },
          "100%": { transform: "scale(0.95)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        blink: {
          "0%, 90%, 100%": { transform: "scaleY(1)" },
          "95%": { transform: "scaleY(0.1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
