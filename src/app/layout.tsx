/**
 * layout.tsx
 * Root layout for the application. Loads the type system as CSS variables via next/font
 * (self-hosted, no external font-loading waterfall) and applies the base porcelain/
 * graphite page background and text color.
 */
import type { Metadata } from 'next';
import '@fontsource/space-grotesk/300.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'VisionInspect — AI Visual Quality Inspection',
  description:
    'A reviewer uploads an inspection image; the model proposes a defect hypothesis with ' +
    'stated evidence and confidence; a human reviewer confirms or corrects it before any ' +
    'final inspection status is recorded.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-porcelain text-graphite font-body antialiased">{children}</body>
    </html>
  );
}
