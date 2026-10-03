/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0F3040',
        slate: '#464858',
        clay: '#A56F63',
        peach: '#D99B7F',
        paper: '#FAF6F3',
        line: '#E8DFD9',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['"DM Serif Display"', 'Georgia', 'serif'] },
      boxShadow: { soft: '0 8px 30px rgba(15,48,64,0.10)' },
    },
  },
  plugins: [],
};
