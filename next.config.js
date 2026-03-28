import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

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
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((ilaka) => {
        return {
          hostname: `ilaka${ilaka}.syasyahsamaj.com`,
          protocol: 'https',
        }
      }),
    ],
  },
  reactStrictMode: true,
  redirects,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/((?!admin|api))tenant-domains/:path*',
        destination: '/tenant-domains/:tenant/:path*',
        has: [
          {
            type: 'host',
            value: '(?<tenant>.*)',
          },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig)
