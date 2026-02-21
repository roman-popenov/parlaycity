/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@parlaycity/shared"],
  experimental: {
    serverComponentsExternalPackages: ["@ai-sdk/anthropic"],
  },
  webpack: (config) => {
    // Resolve .js imports in transpiled workspace packages (TS sources with .js extensions)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
