import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        porcelain: '#FFF7FB',
        'porcelain-dim': '#FDF0F5',

        graphite: '#3F4A55',
        'graphite-soft': '#6D7C8A',

        steel: '#D8E2EA',
        'steel-dark': '#C3CFD8',

        teal: {
          DEFAULT: '#F7B2C4',
          dark: '#E89DB2',
          light: '#FBD0DB',
        },

        severity: {
          low: '#7AA67D',
          'low-bg': '#EEF7EF',

          medium: '#C9A248',
          'medium-bg': '#FBF2C4',

          high: '#D96B87',
          'high-bg': '#FCE7EE',
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
      },

      boxShadow: {
        tag: '0 8px 24px rgba(109, 124, 138, 0.08)',
        stamp: '0 0 0 1px rgba(247, 178, 196, 0.35)',
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
