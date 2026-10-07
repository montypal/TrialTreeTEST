import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});

// The template lets every page set a short title ("About", "Donate") and still
// read as part of the site in a browser tab or a search result. `default`
// covers the routes that don't export their own metadata.
export const metadata: Metadata = {
  title: {
    default: 'TrialTree — GU Oncology Trial Map',
    template: '%s — TrialTree',
  },
  description:
    'Genitourinary cancer clinical trials at Southern California cancer centers, curated by hand and organized as a decision tree by cancer, disease state and line of therapy.',
};

// Mobile viewport. viewportFit 'cover' lets full-bleed shells reach the screen
// edges on notched phones; edge-pinned UI pads itself with env(safe-area-inset-*).
// Pinch-zoom is deliberately left enabled (no maximumScale / userScalable).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6f7f9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
