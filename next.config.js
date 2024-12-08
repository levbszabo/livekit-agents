const createNextPluginPreval = require("next-plugin-preval/config");
const withNextPluginPreval = createNextPluginPreval();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  basePath: '/playground',
  assetPrefix: '/playground',
  images: {
    domains: ['brdge-ai.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'brdge-ai.com',
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
            value: "frame-ancestors 'self' https://brdge-ai.com"
          },
        ],
      },
    ];
  },
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
};

module.exports = withNextPluginPreval(nextConfig);
