import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ckb-escrow/sdk", "@ckb-escrow/ccc-adapter", "@ckb-escrow/app"],
};

export default nextConfig;
