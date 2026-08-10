import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@wos/ui', '@wos/shared', '@wos/db'],
}

export default nextConfig
