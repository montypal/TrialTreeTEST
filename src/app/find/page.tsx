import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { FindClient } from './FindClient';

export const metadata: Metadata = {
  title: 'Find a Trial',
  description:
    'Describe a de-identified clinical scenario and see potentially relevant genitourinary oncology trials at Southern California centers, ranked with the reasoning.',
};

// Public "Find a trial" page: describe a de-identified scenario, get AI-ranked
// potential matches from the live catalog.
//
// It sits outside the (site) route group only because FindClient renders its
// own <main>, and the group layout renders one too — two <main> landmarks is
// invalid. So the page supplies the same header and footer itself: it is a
// primary nav destination, and a visitor landing here needs the navigation,
// the Terms link and the medical disclaimer like on every other page.
export default function FindPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">
        <FindClient />
      </div>
      <SiteFooter />
    </div>
  );
}
