import { withPayload } from '@payloadcms/next/withPayload'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((ilaka) => {
        return {
          hostname: `ilaka${ilaka}.localhost`,
          protocol: 'http',
        }
      }),
      {
        protocol: 'https',
        hostname: '*.afnoevents.com',
      },
      {
        protocol: 'https',
        hostname: '*.syasyahsamaj.com',
      },
    ],
  },
  reactStrictMode: true,
  // A second dev instance (e2e on separate ports) uses its own build dir so
  // it never touches the running dev server's .next. Defaults to '.next'.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // The server runs the locally-shipped build via `next start`
  // (see LocalSyncDeployer.sh) — no standalone output needed.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default withPayload(nextConfig)
