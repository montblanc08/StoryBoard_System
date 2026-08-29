/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@frameforge/types',
    '@frameforge/timecode',
    '@frameforge/ui',
    '@frameforge/contracts'
  ]
};

export default nextConfig;
