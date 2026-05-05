// Load environment from `env.download` at build/dev time
require('dotenv').config({ path: require('path').resolve(__dirname, 'env.download') });

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    reactStrictMode: true,
    experimental: {
        serverActions: { bodySizeLimit: "25mb" }
    }
};

module.exports = nextConfig;