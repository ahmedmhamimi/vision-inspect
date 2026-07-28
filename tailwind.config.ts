import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        porcelain: '#F8FAFC',
        'porcelain-dim': '#F1F5F9',

        graphite: '#0F172A',
        'graphite-soft': '#475569',

        steel: '#E2E8F0',
        'steel-dark': '#CBD5E1',

        teal: {
          DEFAULT: '#2563EB',
          dark: '#1D4ED8',
          light: '#3B82F6',
        },

        severity: {
          low: '#15803D',
          'low-bg': '#DCFCE7',

          medium: '#B45309',
          'medium-bg': '#FEF3C7',

          high: '#BE123C',
          'high-bg': '#FFE4E6',
        },
      },

      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        'fluid-hero': 'clamp(2rem, 1.4rem + 2.5vw, 3.5rem)',
        'fluid-lg': 'clamp(1.25rem, 1.05rem + 0.8vw, 1.75rem)',
      },

      borderRadius: {
        tag: '16px',
        card: '20px',
      },

      boxShadow: {
        tag: '0 10px 30px -10px rgba(15, 23, 42, 0.06), 0 4px 6px -2px rgba(15, 23, 42, 0.03)',
        card: '0 20px 40px -15px rgba(15, 23, 42, 0.08)',
        stamp: '0 0 0 1px rgba(37, 99, 235, 0.25)',
        glow: '0 0 25px -5px rgba(37, 99, 235, 0.3)',
      },

      backgroundImage: {
        perforation:
          'repeating-linear-gradient(to bottom, transparent 0, transparent 6px, #CBD5E1 6px, #CBD5E1 8px)',
      },
    },
  },
  plugins: [],
};

export default config;
