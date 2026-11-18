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
  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      // Node 18 (PersonalVPS) lacks browser globals File/FileReader.
      // @smithy/util-stream (chunk 3754) evaluates `MakeTypeAssertion(File)`
      // at module load — before Next.js lazy-loads the middleware chunk where
      // the polyfill otherwise lives — so the ReferenceError fires at route
      // module load, not request handling. Inject the polyfill at the top of
      // every server chunk so it runs before any module in that chunk.
      // ponytail: ceiling = Node 18 on PersonalVPS; upgrade path = drop this
      // once the server runs Node 20+ (native File/FileReader).
      config.plugins.push(
        new webpack.BannerPlugin({
          raw: true,
          banner:
            'if(typeof globalThis.File==="undefined"){globalThis.File=class File extends (globalThis.Blob||function(){}){constructor(bits,options){super(bits,options);this.name=options?.name??"";this.lastModified=options?.lastModified??Date.now();this.lastModifiedDate=new Date(this.lastModified);this.webkitRelativePath=""}}}if(typeof globalThis.FileReader==="undefined"){globalThis.FileReader=class FileReader{constructor(){this.readyState=0;this.result=null;this.error=null;this.onloadstart=null;this.onprogress=null;this.onload=null;this.onerror=null;this.onabort=null;this.onloadend=null}readAsArrayBuffer(b){this.readyState=1;b.arrayBuffer().then(r=>{this.result=r;this.readyState=2;this.onloadend&&this.onloadend(null)}).catch(e=>{this.error=e;this.readyState=2;this.onerror&&this.onerror(null);this.onloadend&&this.onloadend(null)})}readAsText(b){this.readyState=1;b.text().then(r=>{this.result=r;this.readyState=2;this.onloadend&&this.onloadend(null)}).catch(e=>{this.error=e;this.readyState=2;this.onerror&&this.onerror(null);this.onloadend&&this.onloadend(null)})}abort(){this.readyState=0}}};',
        })
      )
    }
    return config
  },
}

export default withPayload(nextConfig)
