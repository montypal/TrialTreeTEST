import type { Metadata } from 'next';
import { ExploreShell } from '@/components/ExploreShell';

export const metadata: Metadata = {
  title: 'Explore Trials',
};

// Legacy URL. /admin was never a private area — it is where the tree first
// lived — so it stays as one more door into the same browse shell as the
// homepage, site navigation included, for anyone holding an old bookmark.
// The curator tools it used to link to have been retired.
export default function AdminPage() {
  return <ExploreShell disease={null} />;
}
