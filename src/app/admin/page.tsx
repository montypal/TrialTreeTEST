import { AdminClient } from './AdminClient';

// Interactive desktop view: pan/zoom/filter the full tree. Wrap this route with
// your auth/SSO middleware before production (see README "Security hardening").
export default function AdminPage() {
  return <AdminClient />;
}
