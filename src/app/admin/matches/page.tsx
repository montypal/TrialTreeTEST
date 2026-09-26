import { MatchesClient } from './MatchesClient';

// Human verification queue for proposed ClinicalTrials.gov links. The matcher
// in src/lib/ctgov/match.ts only ever suggests; Trial.nctId is written here,
// by a person, or not at all. Wrap this route with your auth/SSO middleware
// before production (see README "Security hardening").
export default function MatchesPage() {
  return <MatchesClient />;
}
