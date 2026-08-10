import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        porcelain: '#F4F8FD',
        'porcelain-dim': '#E9F1FB',

        graphite: '#3F4A55',
        'graphite-soft': '#6D7C8A',

        steel: '#D8E2EA',
        'steel-dark': '#C3CFD8',

        teal: {
          DEFAULT: '#2563EB',
          dark: '#1D4ED8',
          light: '#60A5FA',
        },

        severity: {
          low: '#7AA67D',
          'low-bg': '#EEF7EF',

          medium: '#C9A248',
          'medium-bg': '#FBF2C4',

          high: '#DC2626',
          'high-bg': '#FDECEC',
        },
      },

      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        'fluid-hero': 'clamp(1.75rem, 1.2rem + 2.2vw, 3rem)',
        'fluid-lg': 'clamp(1.25rem, 1.05rem + 0.8vw, 1.75rem)',
      },

      borderRadius: {
        tag: '16px',
        card: '20px',
      },

      boxShadow: {
        tag: '0 8px 24px rgba(109, 124, 138, 0.08)',
        stamp: '0 0 0 1px rgba(37, 99, 235, 0.35)',
        card: '0 20px 45px rgba(63, 74, 85, 0.14)',
      },

      backgroundImage: {
        perforation:
        'repeating-linear-gradient(to bottom, transparent 0, transparent 6px, #D8E2EA 6px, #D8E2EA 8px)',
      },
    },
  },
  plugins: [],
};

export default config;
