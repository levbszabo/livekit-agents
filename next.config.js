const createNextPluginPreval = require("next-plugin-preval/config");
const withNextPluginPreval = createNextPluginPreval();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  basePath: '/playground',
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
