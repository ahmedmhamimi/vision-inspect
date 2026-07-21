/**
 * tailwind.config.ts
 * Design token system for VisionInspect.
 *
 * Visual direction: a physical quality-control inspection tag, not a generic SaaS dashboard.
 * Colors are named for what they represent in that world (porcelain bench, graphite ink,
 * steel hairline, calibration teal) rather than generic "primary/secondary" labels, so the
 * intent stays legible in the code itself.
 *
 * The severity trio (moss/ochre/rust) is a *functional data encoding*, not a brand palette —
 * it must stay visually distinct at a glance since severity drives real routing decisions.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        porcelain: '#F2F3F1',
        'porcelain-dim': '#E7E9E5',
        graphite: '#1A1D1B',
        'graphite-soft': '#4A4F4B',
        steel: '#D8DBD6',
        'steel-dark': '#B7BBB4',
        teal: {
          DEFAULT: '#1E5F5A',
          dark: '#153E3B',
          light: '#2C8880',
        },
        severity: {
          low: '#5B7553',
          'low-bg': '#EAF0E7',
          medium: '#B8873A',
          'medium-bg': '#F7EEDD',
          high: '#A13D2E',
          'high-bg': '#F6E4E0',
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
        tag: '3px',
      },
      boxShadow: {
        tag: '0 1px 2px rgba(26, 29, 27, 0.08), 0 1px 0 rgba(26, 29, 27, 0.04)',
        stamp: '0 0 0 1px rgba(30, 95, 90, 0.25)',
      },
      backgroundImage: {
        perforation:
          'repeating-linear-gradient(to bottom, transparent 0, transparent 6px, #B7BBB4 6px, #B7BBB4 8px)',
      },
    },
  },
  plugins: [],
};

export default config;
