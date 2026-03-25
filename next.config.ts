import type { NextConfig } from "next";
import path from 'path'

const nextConfig: NextConfig = {
  // Turbopack 對中文路徑有 bug (Next.js 16)，改用 webpack
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
