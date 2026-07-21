/**
 * layout.tsx
 * Root layout for the application. Loads the type system as CSS variables via next/font
 * (self-hosted, no external font-loading waterfall) and applies the base porcelain/
 * graphite page background and text color.
 */
import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VisionInspect — AI Visual Quality Inspection',
  description:
    'A reviewer uploads an inspection image; the model proposes a defect hypothesis with ' +
    'stated evidence and confidence; a human reviewer confirms or corrects it before any ' +
    'final inspection status is recorded.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-porcelain text-graphite font-body antialiased">{children}</body>
    </html>
  );
}
