'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { RIBBON_STRIPE } from '@/lib/cancerColors';

// ---------------------------------------------------------------------------
// Site-wide primary navigation.
//
// Fixed at h-14 (56px) on every breakpoint: the full-screen routes (/explore,
// /kiosk/*) size their canvas against this header, so it must not grow or
// shrink with the viewport. Everything inside is sized to fit that budget.
// ---------------------------------------------------------------------------

type NavLink = { href: string; label: string };

const NAV: NavLink[] = [
  { href: '/explore', label: 'Explore Trials' },
  { href: '/find', label: 'Find a Trial' },
  { href: '/about', label: 'About' },
  { href: '/submit', label: 'Trial Submission' },
  { href: '/suggestions', label: 'Suggestions' },
  { href: '/donate', label: 'Donate' },
];

const PANEL_ID = 'site-nav-panel';

/** A section counts as current when you're on it or on one of its children. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  // A completed navigation closes the panel. On a phone the panel covers the
  // page the visitor just asked for, so leaving it open reads as a broken tap.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the panel and hands focus back to the button that opened it;
  // without the hand-back, keyboard users land at the top of the document and
  // have to tab through the whole header again.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {/* The three awareness-ribbon colors as a hairline — the one piece of
          brand color in the header, so the nav itself can stay neutral. */}
      <div className={`absolute inset-x-0 top-0 h-[3px] ${RIBBON_STRIPE}`} aria-hidden />

      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md py-1.5 pr-1 text-slate-900"
          aria-label="TrialTree home"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            className="text-blue-600"
            aria-hidden
          >
            <path d="M12 4v4M12 8l-6 5M12 8l6 5M6 13v3M18 13v3" />
            <circle cx="12" cy="4" r="2" fill="currentColor" stroke="none" />
            <circle cx="6" cy="13" r="1.7" fill="currentColor" stroke="none" />
            <circle cx="18" cy="13" r="1.7" fill="currentColor" stroke="none" />
            <circle cx="6" cy="17.5" r="1.5" fill="#8b5cf6" stroke="none" />
            <circle cx="18" cy="17.5" r="1.5" fill="#f97316" stroke="none" />
          </svg>
          <span className="font-display text-[17px] font-extrabold tracking-tight">TrialTree</span>
        </Link>

        {/* shrink-0 + nowrap: in a fixed 56px bar a label that wrapped would be
            clipped, and six labels only just fit at 768px. */}
        <nav aria-label="Primary" className="hidden shrink-0 md:flex md:items-center md:gap-0.5">
          {NAV.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'relative whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors lg:px-3 lg:text-sm',
                  active ? 'text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  link.href === '/donate' ? 'ml-1.5 ring-1 ring-inset ring-slate-300' : '',
                ].join(' ')}
              >
                {link.label}
                {/* The current page is marked by an underline as well as a
                    darker label — color alone would not be enough. */}
                <span
                  aria-hidden
                  className={[
                    'absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full',
                    active ? 'bg-slate-900' : 'bg-transparent',
                  ].join(' ')}
                />
              </Link>
            );
          })}
        </nav>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={PANEL_ID}
          aria-label={open ? 'Close main menu' : 'Open main menu'}
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            aria-hidden
          >
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* The panel stays in the DOM so `aria-controls` always resolves. Closing
          it is a display toggle rather than an unmount — and it carries an
          explicit `hidden`/`block` class instead of relying on the `hidden`
          attribute alone, which a stray display utility could out-specify. */}
      <div
        id={PANEL_ID}
        hidden={!open}
        className={[
          'absolute inset-x-0 top-14 border-b border-slate-200 bg-white shadow-lg md:hidden',
          open ? 'block' : 'hidden',
        ].join(' ')}
      >
        <nav aria-label="Primary, mobile">
          <ul className="mx-auto max-w-6xl px-4 pb-3 pt-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            {NAV.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={[
                      'flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-[15px] font-semibold transition-colors',
                      active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {/* Same rule as the desktop nav: a shape, not just a hue. */}
                    <span
                      aria-hidden
                      className={[
                        'h-5 w-1 rounded-full',
                        active ? 'bg-slate-900' : 'bg-transparent',
                      ].join(' ')}
                    />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
