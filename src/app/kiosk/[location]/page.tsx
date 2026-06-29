import { notFound } from 'next/navigation';
import { isValidLocationSlug } from '@/lib/locations';
import { KioskClient } from './KioskClient';

// Kiosk route: /kiosk/city-of-hope, /kiosk/ucla, ...
// No nav, no footer, no chrome — just the tree, a header, and a QR code.
export default function KioskPage({ params }: { params: { location: string } }) {
  if (!isValidLocationSlug(params.location)) notFound();
  return <KioskClient locationSlug={params.location} />;
}
