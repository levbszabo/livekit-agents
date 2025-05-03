const createNextPluginPreval = require("next-plugin-preval/config");
const withNextPluginPreval = createNextPluginPreval();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Only set basePath and assetPrefix in production
  ...(process.env.NODE_ENV === 'production' ? {
    basePath: '/playground',
    assetPrefix: '/playground',
  } : {}),
  images: {
    domains: ['dotbridge.io', 'localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dotbridge.io',
        pathname: '/api/brdges/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/api/brdges/**',
      },
    ],
  },
  poweredByHeader: false,
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'development'
              ? "frame-ancestors 'self' http://localhost:3000 http://localhost:3001"
              : "frame-ancestors 'self' https://dotbridge.io"
          },
        ],
      },
    ];
  },
  // Only apply rewrites in production
  ...(process.env.NODE_ENV === 'production' ? {
    async rewrites() {
      return {
        beforeFiles: [
          {
            source: '/playground/:path*',
            destination: '/:path*',
          },
        ],
      };
    },
  } : {}),
};

module.exports = withNextPluginPreval(nextConfig);
