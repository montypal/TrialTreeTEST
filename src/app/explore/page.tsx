import type { Metadata } from 'next';
import { AdminClient } from '@/app/admin/AdminClient';
import { SiteHeader } from '@/components/site/SiteHeader';

export const metadata: Metadata = {
  // Bare: the root layout's title template appends "— TrialTree".
  title: 'Explore Trials',
  description:
    'Step through the curated GU oncology trial tree — by cancer, disease state, histology and line of therapy — and see which Southern California centers are recruiting.',
};

// The public home of the interactive tree.
//
// This is the same client the /admin URL has always rendered; /admin is not a
// private area and never was, so the browse experience now has a public address
// and /admin keeps working unchanged for anyone holding an old link.
//
// The shell is a two-row flex column and nothing else: the site header is a
// fixed 56px, and the canvas takes a `flex-1 min-h-0` row so it resolves to
// exactly the height that is left. That matters more here than on an ordinary
// page — the tree plans how many columns and how many cards a level gets from
// the height it measures, so an over-tall shell would silently cost a row.
// This route is deliberately outside the (site) route group: a full-screen
// canvas has nowhere to put a footer.
//
// The canvas row carries a transform for one reason: the trial panel and the
// filter drawer are `position: fixed`, and fixed resolves against the viewport
// unless an ancestor has a transform. Against the viewport they started at
// y=0, underneath the header — on a phone that hid the panel's Close button
// entirely. The transform makes this row their containing block, so they fill
// the space below the header. It also makes the row its own stacking context,
// which keeps everything inside it (the entry chooser included) beneath the
// header's mobile menu.
export default function ExplorePage({ searchParams }: { searchParams: { disease?: string | string[] } }) {
  const raw = searchParams.disease;
  const disease = typeof raw === 'string' && raw.trim() ? raw.trim() : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden supports-[height:100dvh]:h-dvh">
      <SiteHeader />
      <div className="min-h-0 flex-1 [transform:translateZ(0)]">
        {/* Keyed on the deep link: the client seeds its state from it once, so
            following a link to a different cancer must remount it. */}
        <AdminClient key={disease ?? 'all'} embedded initialDisease={disease} />
      </div>
    </div>
  );
}
