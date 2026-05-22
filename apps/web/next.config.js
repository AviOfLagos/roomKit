/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: 'http://localhost:3000/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
