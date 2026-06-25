/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#060913",
        glassBg: "rgba(13, 20, 38, 0.65)",
        glassBorder: "rgba(255, 255, 255, 0.08)",
        neonBlue: "#00f2fe",
        neonGreen: "#39ff14",
        neonRed: "#ff416c",
        cyanAccent: "#00b4d8",
        "secondary-color": "#00b4d8",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 12px rgba(0, 242, 254, 0.25)",
        neonGreen: "0 0 12px rgba(57, 255, 20, 0.25)",
        neonRed: "0 0 12px rgba(255, 65, 108, 0.25)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      }
    },
  },
  plugins: [],
}
