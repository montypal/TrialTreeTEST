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
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-sora)', 'var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.12)',
        lift: '0 8px 16px -6px rgba(15,23,42,0.10), 0 24px 48px -20px rgba(37,99,235,0.28)',
      },
      keyframes: {
        flash: {
          '0%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.0)' },
          '15%': { boxShadow: '0 0 0 9999px rgba(34,197,94,0.12)' },
          '100%': { boxShadow: '0 0 0 9999px rgba(34,197,94,0.0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(3%, -4%) scale(1.06)' },
          '66%': { transform: 'translate(-3%, 3%) scale(0.96)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        flash: 'flash 1.1s ease-out',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 18s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
