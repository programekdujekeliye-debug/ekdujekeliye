import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:5001/api/:path*'
          : 'https://ekdujekeliye-s9fx.onrender.com/api/:path*',
      },
    ];
  },
};

export default nextConfig;
