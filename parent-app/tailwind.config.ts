import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        monto: {
          purple: "#7C3AED",
          indigo: "#4F46E5",
          blue: "#2563EB",
          green: "#059669",
          red: "#DC2626",
          amber: "#D97706",
          dark: "#0F0F1A",
          card: "#1A1A2E",
          border: "#2D2D4A",
        },
      },
      animation: {
        "pulse-ring": "pulseRing 1.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite",
        "call-ring": "callRing 0.8s ease-in-out infinite",
      },
      keyframes: {
        pulseRing: {
          "0%":   { transform: "scale(0.95)", opacity: "0.8" },
          "50%":  { transform: "scale(1.1)",  opacity: "0.4" },
          "100%": { transform: "scale(0.95)", opacity: "0.8" },
        },
        callRing: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%":      { transform: "rotate(10deg)" },
          "75%":      { transform: "rotate(-10deg)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
