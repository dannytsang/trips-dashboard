/** @type {import('next').NextConfig} */
const nextConfig = {
  // TEMP: enable production browser source maps so React's hydration error
  // stack traces point to actual JSX source rather than minified symbols.
  // This is the only way to see the *exact* component + line that mismatches
  // in a production build. Remove once #418 is resolved.
  productionBrowserSourceMaps: true,
  // Also generate source maps for the server bundle (devtools and Node)
  experimental: {
    serverSourceMaps: true,
  },
};

export default nextConfig;
