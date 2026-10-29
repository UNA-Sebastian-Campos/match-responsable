/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          bg: '#eef1ee',
          surface: '#ffffff',
          ink: '#1c231d',
          accent: '#2f5a3f',
          'accent-tint': '#e6efe6',
          line: '#d8ded4',
          'line-soft': '#e7ebe2',
          'warn-tint': '#fbeee0',
          'warn-line': '#c98a3d',
          'warn-ink': '#7a5220',
          'err-tint': '#fbeaea',
          'err-line': '#b6503f',
          'err-ink': '#7c3527',
        }
      }
    },
  },
  plugins: [],
}
