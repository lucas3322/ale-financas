/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"] },
      colors: {
        brand: {
          50: "#F7EEFE", 100: "#EEDCFD", 200: "#DDB9FB", 300: "#C68BF6", 400: "#AA55EC",
          500: "#9425DE", 600: "#820AD1", 700: "#6B08AC", 800: "#55098A", 900: "#3D0764", 950: "#25033F",
        },
        ink: { DEFAULT: "#1B1530", soft: "#5B5470", faint: "#9A94AD" },
      },
      boxShadow: { card: "0 1px 2px rgba(37,3,63,.04), 0 4px 16px rgba(37,3,63,.06)" },
    },
  },
  plugins: [],
};
