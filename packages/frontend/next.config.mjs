import nextEnv from "@next/env";
import { resolve } from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(resolve(process.cwd(), "../.."));

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ["@baseplay/shared"],
  reactStrictMode: true
};

export default nextConfig;
