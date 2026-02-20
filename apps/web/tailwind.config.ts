import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        accent: {
          blue: "#3b82f6",
          purple: "#8b5cf6",
        },
        neon: {
          green: "#22c55e",
          red: "#ef4444",
          yellow: "#eab308",
        },
      },
      animation: {
        "climb": "climb 0.6s ease-out forwards",
        "pulse-neon": "pulseNeon 2s ease-in-out infinite",
        "crash": "crash 0.5s ease-in forwards",
        "fade-in": "fadeIn 0.3s ease-out forwards",
        "slide-up": "slideUp 0.4s ease-out forwards",
        "shake": "shake 0.5s ease-in-out",
        "flash-red": "flashRed 0.6s ease-out forwards",
        "glow-pulse": "glowPulse 1.5s ease-in-out infinite",
        "rocket-climb": "rocketClimb 0.8s ease-out forwards",
        "explode": "explode 0.6s ease-out forwards",
        "particle-ring": "particleRing 0.8s ease-out forwards",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "leg-pop": "legPop 0.4s ease-out forwards",
      },
      keyframes: {
        climb: {
          "0%": { transform: "scaleY(0)", opacity: "0" },
          "100%": { transform: "scaleY(1)", opacity: "1" },
        },
        pulseNeon: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        crash: {
          "0%": { transform: "translateY(0) scale(1)", opacity: "1" },
          "100%": { transform: "translateY(40px) scale(0.8)", opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        flashRed: {
          "0%": { opacity: "0.8" },
          "100%": { opacity: "0" },
        },
        glowPulse: {
          "0%, 100%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.3)" },
        },
        rocketClimb: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "50%": { transform: "translateY(-2px)", opacity: "1" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        explode: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(2.5)", opacity: "0.6" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
        particleRing: {
          "0%": { transform: "scale(0.5)", opacity: "0.8", borderWidth: "3px" },
          "100%": { transform: "scale(3)", opacity: "0", borderWidth: "0px" },
        },
        fadeInUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        legPop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
