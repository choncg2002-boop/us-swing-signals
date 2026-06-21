/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#0A0A0F",
        charcoal: "#12121A",
        slate: "#1A1A24",
        graphite: "#2A2A35",
        neon: "#00FF88",
        crimson: "#FF3366",
        amber: "#FFB800",
        electric: "#00D4FF",
        silver: "#A0A0B0",
        muted: "#606070",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "neon-glow": "0 0 20px rgba(0, 255, 136, 0.3)",
        "crimson-glow": "0 0 20px rgba(255, 51, 102, 0.3)",
      },
    },
  },
  plugins: [],
};
