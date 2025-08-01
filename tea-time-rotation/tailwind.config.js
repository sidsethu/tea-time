import { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium Tea-themed Color Palette
        primary: '#f5862d',
        'primary-50': '#fef7f0',
        'primary-100': '#fdeee1',
        'primary-200': '#fbd4b4',
        'primary-300': '#f9ba87',
        'primary-400': '#f7a05a',
        'primary-500': '#f5862d',
        'primary-600': '#e6751a',
        'primary-700': '#cc6617',
        'primary-800': '#b35714',
        'primary-900': '#994811',
        
        secondary: '#22c55e',
        'secondary-50': '#f0f9f3',
        'secondary-100': '#d9f2e3',
        'secondary-200': '#a7e0bd',
        'secondary-300': '#75ce97',
        'secondary-400': '#43bc71',
        'secondary-500': '#22c55e',
        'secondary-600': '#16a34a',
        'secondary-700': '#15803d',
        'secondary-800': '#166534',
        'secondary-900': '#14532d',
        
        accent: '#ef4444',
        'accent-50': '#fef3f2',
        'accent-100': '#fee2e2',
        'accent-200': '#fecaca',
        'accent-300': '#fca5a5',
        'accent-400': '#f87171',
        'accent-500': '#ef4444',
        'accent-600': '#dc2626',
        'accent-700': '#b91c1c',
        'accent-800': '#991b1b',
        'accent-900': '#7f1d1d',
        
        // Tea-inspired colors
        chai: '#f7b057',
        'chai-50': '#fef9f3',
        'chai-100': '#fef2e7',
        'chai-200': '#fde2c3',
        'chai-300': '#fbd19f',
        'chai-400': '#f9c17b',
        'chai-500': '#f7b057',
        'chai-600': '#e89f33',
        'chai-700': '#d98e0f',
        'chai-800': '#b5750c',
        'chai-900': '#915c09',
        
        matcha: '#84cc16',
        'matcha-50': '#f6fdf4',
        'matcha-100': '#ecfce5',
        'matcha-200': '#d9f7be',
        'matcha-300': '#c6f197',
        'matcha-400': '#a3e635',
        'matcha-500': '#84cc16',
        'matcha-600': '#65a30d',
        'matcha-700': '#4d7c0f',
        'matcha-800': '#365314',
        'matcha-900': '#1a2e05',
        
        // Updated surface colors
        'surface-50': '#fafafa',
        'surface-100': '#f5f5f5',
        'surface-200': '#e5e5e5',
        'surface-300': '#d4d4d4',
        'surface-400': '#a3a3a3',
        'surface-500': '#737373',
        'surface-600': '#525252',
        'surface-700': '#404040',
        'surface-800': '#262626',
        'surface-900': '#171717',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce-subtle 2s infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0px)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
} satisfies Config
