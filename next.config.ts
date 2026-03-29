import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/quick-diagnosis',
        destination: '/encounter/new',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
