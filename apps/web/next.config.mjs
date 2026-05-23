/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const gateway = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';
    return [
      {
        source: '/v1/:path*',
        destination: `${gateway}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
