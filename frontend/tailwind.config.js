/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#1e1b4b",
        violet: "#6d28d9",
        brand: {
          green: "#059669",
          red: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};
