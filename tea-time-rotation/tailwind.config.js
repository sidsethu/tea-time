/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1D4ED8',
        secondary: '#F97316',
        accent: '#10B981',
        'brand-yellow': '#FBBF24',
        'brand-beige': '#F5F5DC',
      },
    },
  },
  plugins: [],
}
