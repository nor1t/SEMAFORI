/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['Noto Serif', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: { 950:'#040810', 900:'#060a14', 800:'#0a0e1a', 700:'#111827', 600:'#1a2035', 500:'#243049', 400:'#334155' },
        paper: { 50:'#faf9f5', 100:'#f5f2ea', 200:'#ebe5d8', 300:'#ddd5c4' },
        tblue: { 50:'#eff6ff', 100:'#dbeafe', 200:'#bfdbfe', 300:'#93c5fd', 400:'#60a5fa', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', 800:'#1e3a5f', 900:'#0f2540', 950:'#091a30' },
      },
      animation: {
        'pulse-slow':'pulse-slow 3s ease-in-out infinite',
        'float':'float 6s ease-in-out infinite',
        'slide-up':'slide-up 0.6s ease-out',
        'slide-right':'slide-right 0.4s ease-out',
        'fade-in':'fade-in 0.5s ease-out',
        'marquee':'marquee 30s linear infinite',
        'ripple':'ripple 2s ease-out infinite',
        'dash':'dash 2s linear infinite',
      },
      keyframes: {
        'pulse-slow':{ '0%,100%':{opacity:'1'},'50%':{opacity:'0.5'} },
        'float':{ '0%,100%':{transform:'translateY(0)'},'50%':{transform:'translateY(-10px)'} },
        'slide-up':{ '0%':{opacity:'0',transform:'translateY(20px)'},'100%':{opacity:'1',transform:'translateY(0)'} },
        'slide-right':{ '0%':{opacity:'0',transform:'translateX(-20px)'},'100%':{opacity:'1',transform:'translateX(0)'} },
        'fade-in':{ '0%':{opacity:'0'},'100%':{opacity:'1'} },
        'marquee':{ '0%':{transform:'translateX(0)'},'100%':{transform:'translateX(-50%)'} },
        'ripple':{ '0%':{transform:'scale(1)',opacity:'0.6'},'100%':{transform:'scale(2.5)',opacity:'0'} },
        'dash':{ 'to':{strokeDashoffset:'-20'} },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
