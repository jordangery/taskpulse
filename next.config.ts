import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // 鎖定 file tracing root 在這個專案，避免 Next 偵測到上層 lockfile 後誤判 workspace root
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig
