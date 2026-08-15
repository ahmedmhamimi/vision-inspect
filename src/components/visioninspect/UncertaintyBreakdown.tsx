/**
 * UncertaintyBreakdown.tsx
 * Enterprise-grade mathematical calibration & uncertainty metrics panel.
 * Displays the 4 Black-Box Uncertainty Estimation signals (U_prediction, U_image,
 * U_semantic, U_evidence, and composite U_composite) using clean engineering
 * typography and precision progress meters — strictly WITHOUT tacky AI icons,
 * robot graphics, or decorative sparkles.
 */
'use client';

import type { UncertaintyMetrics } from '@/lib/visioninspect/schema';

interface UncertaintyBreakdownProps {
  metrics?: UncertaintyMetrics;
}

function getCompositeBadge(u_composite: number) {
  if (u_composite <= 0.25) {
    return {
      label: 'Calibrated High Confidence',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  }
  if (u_composite <= 0.5) {
    return {
      label: 'Moderate Epistemic Variance',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      dotClass: 'bg-amber-500',
    };
  }
  return {
    label: 'Elevated Disagreement — Priority Review',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
  };
}

export function UncertaintyBreakdown({ metrics }: UncertaintyBreakdownProps) {
  if (!metrics) return null;

  const {
    u_prediction,
    u_image,
    u_semantic,
    u_evidence,
    u_composite,
    blur_score,
    exposure_score,
    resolution_score,
  } = metrics;

  const status = getCompositeBadge(u_composite);

  return (
    <div className="rounded-2xl border border-steel-dark/40 bg-white/90 p-5 sm:p-6 shadow-sm backdrop-blur-md transition-all duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel/50 pb-4">
        <div>
          <h3 className="font-display text-base font-semibold text-graphite tracking-tight">
            Uncertainty & Calibration Metrics
          </h3>
          <p className="font-mono text-xs text-graphite-soft mt-0.5">
            Black-box estimation layer • 4-factor composite analysis
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs font-semibold border ${status.badgeClass}`}
        >
          <span className={`h-2 w-2 rounded-full ${status.dotClass}`} />
          {status.label}
        </div>
      </div>

      {/* Composite Score Meter */}
      <div className="mt-5 rounded-xl border border-steel/60 bg-porcelain-dim/40 p-4">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold text-graphite uppercase tracking-wider">
            Composite Uncertainty (U_composite)
          </span>
          <span className="font-bold text-graphite">
            {(u_composite * 100).toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-steel/30">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              u_composite <= 0.25
                ? 'bg-emerald-500'
                : u_composite <= 0.5
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
            style={{ width: `${Math.max(5, Math.min(100, u_composite * 100))}%` }}
          />
        </div>
      </div>

      {/* 4 Signals Grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 1. Prediction Uncertainty */}
        <div className="rounded-xl border border-steel/40 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-graphite">1. Self-Consistency (U_pred)</span>
            <span className="font-bold text-graphite font-mono">
              {(u_prediction * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 font-body text-xs text-graphite-soft">
            Label disagreement rate across sampling iterations.
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-steel/20">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${Math.max(3, u_prediction * 100)}%` }}
            />
          </div>
        </div>

        {/* 2. Image Quality CV */}
        <div className="rounded-xl border border-steel/40 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-graphite">2. Image Quality (U_img)</span>
            <span className="font-bold text-graphite font-mono">
              {(u_image * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 font-body text-xs text-graphite-soft">
            Classical CV score (blur, saturation & pixel density).
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-steel/20">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${Math.max(3, u_image * 100)}%` }}
            />
          </div>
          {(blur_score !== undefined || exposure_score !== undefined) && (
            <div className="mt-2 flex gap-2 font-mono text-[10px] text-graphite-soft">
              {blur_score !== undefined && <span>Blur: {(blur_score * 100).toFixed(0)}%</span>}
              {exposure_score !== undefined && <span>Exp: {(exposure_score * 100).toFixed(0)}%</span>}
              {resolution_score !== undefined && <span>Res: {(resolution_score * 100).toFixed(0)}%</span>}
            </div>
          )}
        </div>

        {/* 3. Semantic Rationale Clustering */}
        <div className="rounded-xl border border-steel/40 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-graphite">3. Rationale Divergence (U_sem)</span>
            <span className="font-bold text-graphite font-mono">
              {(u_semantic * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 font-body text-xs text-graphite-soft">
            Divergence in free-text reasoning rationale spans.
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-steel/20">
            <div
              className="h-full bg-cyan-600 transition-all duration-300"
              style={{ width: `${Math.max(3, u_semantic * 100)}%` }}
            />
          </div>
        </div>

        {/* 4. Evidence Consistency */}
        <div className="rounded-xl border border-steel/40 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-graphite">4. Verifier Mismatch (U_evid)</span>
            <span className="font-bold text-graphite font-mono">
              {(u_evidence * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 font-body text-xs text-graphite-soft">
            Verifier cross-examination & region grounding alignment.
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-steel/20">
            <div
              className="h-full bg-slate-600 transition-all duration-300"
              style={{ width: `${Math.max(3, u_evidence * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
