import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrialTree — GU Oncology Trial Map',
  description:
    'Real-time clinical decision-tree mapping for Genitourinary cancer trials across Southern California.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
