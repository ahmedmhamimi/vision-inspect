/**
 * generate-figures.test.ts
 * Vitest runner wrapper to execute generate-paper-figures.ts.
 */
import { describe, expect, it } from 'vitest';
import { main as generateFigures } from '../../scripts/generate-paper-figures';
import { existsSync } from 'fs';

describe('Paper Figure Generator Suite', () => {
  it('generates all 5 publication SVG figure files and LaTeX guide on Desktop', () => {
    generateFigures();

    const desktopDir = 'C:\\Users\\Dell\\Desktop';
    expect(existsSync(`${desktopDir}\\fig1_system_architecture.svg`)).toBe(true);
    expect(existsSync(`${desktopDir}\\fig2_ece_calibration_diagram.svg`)).toBe(true);
    expect(existsSync(`${desktopDir}\\fig3_risk_coverage_curve.svg`)).toBe(true);
    expect(existsSync(`${desktopDir}\\fig4_uncertainty_breakdown_radar.svg`)).toBe(true);
    expect(existsSync(`${desktopDir}\\fig5_safety_policy_enforcement.svg`)).toBe(true);
    expect(existsSync(`${desktopDir}\\paper_figures_and_latex_snippets.md`)).toBe(true);
  });
});
