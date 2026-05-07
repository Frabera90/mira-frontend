/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        terra:  '#4f46e5',
        cream:  '#f8fafc',
        olive:  '#059669',
        maro:   '#64748b',
        caffe:  '#0f172a',
      },
    },
  },
  plugins: [],
}
