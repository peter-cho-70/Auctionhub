import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** 상위 폴더에 다른 lockfile이 있을 때 추적 루트 고정 */
  outputFileTracingRoot: path.join(__dirname),
  /**
   * pdf-parse / pdfjs 계열은 번들링 시 dev(webpack)에서 깨질 수 있어
   * 서버 런타임에서는 external로 로드합니다.
   */
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
