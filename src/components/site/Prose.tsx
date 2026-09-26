import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Shared furniture for the text-heavy pages (About, Donate, Terms, and the two
// form pages). No @tailwindcss/typography in this project, so `Prose` styles
// its descendants with arbitrary variants instead of the `prose` class — the
// selectors are still written out in full, which is what the JIT needs.
//
// Server-safe: no hooks, no browser APIs. Pages can stay Server Components and
// keep exporting `metadata`.
// ---------------------------------------------------------------------------

const PROSE_CLASSES = [
  'text-[15px] leading-7 text-slate-600',
  '[&_p]:mt-4 [&_p:first-child]:mt-0',
  '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5',
  '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5',
  '[&_strong]:font-semibold [&_strong]:text-slate-900',
  '[&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900',
  '[&_a]:font-semibold [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-2',
  '[&_a:hover]:text-blue-800',
].join(' ');

/** Typographic wrapper. Keeps measure readable without a plugin. */
export function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${PROSE_CLASSES} ${className}`}>{children}</div>;
}

/**
 * The content column. The (site) layout deliberately leaves the horizontal
 * gutter to the page so full-bleed sections stay possible on the homepage;
 * every text page uses this instead, which is also where the notch padding
 * lives.
 */
export function PageShell({
  children,
  wide = false,
  className = '',
}: {
  children: ReactNode;
  /** Wider column for card grids (Donate, About); default suits running text. */
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        'mx-auto w-full px-5 py-10 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:py-14',
        wide ? 'max-w-4xl' : 'max-w-3xl',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

/** Page title block: small eyebrow, h1, and a lead paragraph. */
export function PageHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
}) {
  return (
    <header>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
      ) : null}
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        {title}
      </h1>
      {lead ? <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{lead}</p> : null}
    </header>
  );
}

/** A titled section with a stable heading rhythm and an anchor id. */
export function Section({
  id,
  title,
  badge,
  children,
}: {
  id?: string;
  title: string;
  /** Small tag beside the heading — used to stamp "Draft" on the Terms page. */
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-20 first:mt-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {badge ? (
          <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

type CalloutTone = 'info' | 'warning' | 'placeholder';

// Literal class strings per tone — never interpolated, so the JIT keeps them.
const CALLOUT_TONE: Record<CalloutTone, { box: string; heading: string; body: string }> = {
  info: {
    box: 'border-blue-200 bg-blue-50',
    heading: 'text-blue-900',
    body: 'text-blue-900',
  },
  warning: {
    box: 'border-amber-300 bg-amber-50',
    heading: 'text-amber-900',
    body: 'text-amber-900',
  },
  placeholder: {
    box: 'border-dashed border-slate-300 bg-slate-50',
    heading: 'text-slate-700',
    body: 'text-slate-500',
  },
};

/** Boxed note. `placeholder` is the house style for "we do not know this yet". */
export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: string;
  children: ReactNode;
}) {
  const styles = CALLOUT_TONE[tone];
  return (
    <div className={`rounded-xl border p-4 ${styles.box}`}>
      {title ? (
        <h3 className={`font-display text-sm font-bold ${styles.heading}`}>{title}</h3>
      ) : null}
      <div className={`text-sm leading-relaxed ${styles.body} ${title ? 'mt-1.5' : ''}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * Inline "we do not have this value yet" marker. Used wherever inventing a
 * plausible value would be worse than showing a gap — founder credentials,
 * legal identity, contact details.
 */
export function Pending({ label = 'To be provided' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
      <span aria-hidden>◻</span>
      {label}
    </span>
  );
}
