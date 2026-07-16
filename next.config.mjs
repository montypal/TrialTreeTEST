/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't fail the production build on lint warnings/errors (type errors still
  // fail the build). Keeps deploys robust when linting can't run locally.
  eslint: { ignoreDuringBuilds: true },
  // SSE + webhook routes must run on the Node runtime (not Edge) so we can
  // hold long-lived streaming connections and use the Prisma client.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
};

export default nextConfig;
