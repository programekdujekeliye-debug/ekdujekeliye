import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const prodApiBase = (process.env.NEXT_PUBLIC_API_URL || 'https://api.ekdujekeliye.in').replace(/\/+$/, '');
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:5001/api/:path*'
          : `${prodApiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
