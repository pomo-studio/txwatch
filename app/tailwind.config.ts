import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './assets/**/*.css',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas:  '#F9F9F9',
        ink:     '#1A1A1A',
        amber:   { 500: '#F59E0B', 100: '#FEF3C7' },
        rose:    { 600: '#E11D48', 100: '#FFE4E6' },
        emerald: { 600: '#059669', 100: '#D1FAE5' },
      },
      letterSpacing: {
        widest2: '0.2em',
      },
    },
  },
} satisfies Config
