import type { Metadata } from 'next';
import { ExploreShell, diseaseParam } from '@/components/ExploreShell';

export const metadata: Metadata = {
  title: { absolute: 'TrialTree — GU cancer clinical trials in Southern California' },
  description:
    'Browse prostate, bladder, kidney and other genitourinary cancer clinical trials at Southern California cancer centers, organized by disease state and line of therapy and curated by hand from each center’s own trial list.',
};

// The homepage is the cancer chooser itself. A visitor came to look at trials,
// so the first screen asks which cancer and shows the choices straight away
// rather than a landing page they have to scroll past first.
//
// ?disease=<root label> still deep-links into one tree, exactly as /explore
// does; both render the same shell.
export default function HomePage({ searchParams }: { searchParams: { disease?: string | string[] } }) {
  return <ExploreShell disease={diseaseParam(searchParams.disease)} />;
}
