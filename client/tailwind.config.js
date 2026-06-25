/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0f1117',
        card: '#131720',
        border: '#1e2333',
        accent: { DEFAULT: '#818cf8', hover: '#6366f1' },
        protein: '#4ade80',
        carbs: '#60a5fa',
        fat: '#f97316',
        cals: '#a78bfa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
