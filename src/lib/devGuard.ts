// Shared gate for the dev/test-only endpoints (/api/dev/*) and the admin Dev
// panel. Auto-on in local development; on a deployed (production) instance it
// stays OFF unless you explicitly set ENABLE_DEV_SIMULATE=true. These endpoints
// bypass webhook auth, so never leave the flag on for a real deployment.
export function devToolsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_SIMULATE === 'true';
}
