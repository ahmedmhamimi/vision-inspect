/**
 * next.config.mjs
 * Next.js runtime configuration for VisionInspect.
 *
 * - Sets the server body-size limit for Route Handlers to accommodate image uploads
 *   while still enforcing an explicit, documented ceiling (see lib/visioninspect/validation.ts
 *   for the second, application-level check that runs before any provider call).
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
