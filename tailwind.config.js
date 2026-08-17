/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        prose: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#15161a',
        paper: '#f7f5f2',
        rule: '#e2ddd5',
        steel: '#5a5f68',
        brand: { DEFAULT: '#e6262a', deep: '#a8141a' },
      },
    },
  },
  plugins: [],
};
