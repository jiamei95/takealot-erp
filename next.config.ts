import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.dev.coze.site', '*.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['better-sqlite3'],
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),
};

export default nextConfig;
