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
        bg: "#080812",
        card: "hsl(260 18% 7%)",
        brand: {
          pink: "#ff1a8c",
          "pink-glow": "#ff55b8",
          purple: "#9200e1",
          "purple-1": "#b75fff",
          "purple-2": "#cb8aff",
          gold: "#ffb800",
          green: "#22c55e",
          amber: "#f59e0b",
          blue: "#4a90e2",
        },
        accent: {
          blue: "#4a90e2",
          purple: "#b75fff",
        },
        neon: {
          green: "#22c55e",
          red: "#ef4444",
          yellow: "#eab308",
        },
        "muted-foreground": "hsl(260 10% 50%)",
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
        "market-card-in": "marketCardIn 0.4s ease both",
        "multiplier-pulse": "multiplierPulse 0.4s ease",
        "glow-pulse-pink": "glowPulsePink 2s ease-in-out infinite",
        "slide-in-right": "slideInRight 0.4s ease-out forwards",
        "market-card-enter": "marketCardEnter 0.35s ease both",
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
        marketCardIn: {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        multiplierPulse: {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.06)", filter: "brightness(1.3)" },
          "100%": { transform: "scale(1)" },
        },
        glowPulsePink: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255, 26, 140, 0.3)" },
          "50%": { boxShadow: "0 0 50px rgba(255, 26, 140, 0.7), 0 0 80px rgba(146, 0, 225, 0.3)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(40px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        marketCardEnter: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
