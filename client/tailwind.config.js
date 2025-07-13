/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3A86FF',
        secondary: '#9B5DE5',
        background: '#121212',
        surface: '#1E1E1E',
        'text-primary': '#F1F1F1',
        'text-secondary': '#A1A1AA',
        border: '#2A2A2A',
        error: '#FF4D6D',
        success: '#06D6A0',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            boxShadow: '0 0 5px rgba(58, 134, 255, 0.5)',
          },
          '50%': {
            boxShadow: '0 0 20px rgba(58, 134, 255, 0.8)',
          },
        },
      },
    },
  },
  plugins: [],
} 