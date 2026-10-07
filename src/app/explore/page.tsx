import type { Metadata } from 'next';
import { ExploreShell, diseaseParam } from '@/components/ExploreShell';

export const metadata: Metadata = {
  // Bare: the root layout's title template appends "— TrialTree".
  title: 'Explore Trials',
  description:
    'Step through the curated GU oncology trial tree — by cancer, disease state, histology and line of therapy — and see which Southern California centers are recruiting.',
};

// An alias of the homepage. The browse experience used to live only here, and
// printed QR codes and shared links still point at /explore?disease=…, so the
// address keeps rendering the same shell rather than redirecting away from it.
export default function ExplorePage({ searchParams }: { searchParams: { disease?: string | string[] } }) {
  return <ExploreShell disease={diseaseParam(searchParams.disease)} />;
}
