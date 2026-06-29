/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // SSE + webhook routes must run on the Node runtime (not Edge) so we can
  // hold long-lived streaming connections and use the Prisma client.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
};

export default nextConfig;
