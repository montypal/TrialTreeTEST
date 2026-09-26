import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';

// Chrome for the marketing and organizational pages. The full-screen app
// routes (/explore, /admin, /kiosk/*) live outside this group because they
// manage their own viewport and render the header themselves where it helps.
//
// <main> is capped but has no horizontal padding: the gutter belongs to each
// page (PageShell supplies it for the text pages) so the homepage can still run
// full-bleed sections inside the column.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* First focusable element on the page, per the usual keyboard escape
          hatch past the nav. Visible only once focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-blue-700 focus:shadow-lg"
      >
        Skip to main content
      </a>

      <SiteHeader />

      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
