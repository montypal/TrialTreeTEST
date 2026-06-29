import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // High-contrast kiosk palette (works on TVs and E-Ink).
        ink: '#0a0e14',
        canvas: '#0d1320',
        prostate: '#3b82f6',
        bladder: '#f59e0b',
        renal: '#10b981',
        recruiting: '#22c55e',
        waitlisted: '#eab308',
        closed: '#6b7280',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        flash: {
          '0%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.0)' },
          '15%': { boxShadow: '0 0 0 9999px rgba(34,197,94,0.12)' },
          '100%': { boxShadow: '0 0 0 9999px rgba(34,197,94,0.0)' },
        },
      },
      animation: {
        flash: 'flash 1.1s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
