/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
      // Don’t fail the production build on ESLint errors
      ignoreDuringBuilds: true,
    },
    // If you also want to bypass TS type errors during build:
    typescript: {
      // WARNING: this lets builds pass with TS errors.
      ignoreBuildErrors: true,
    },
  };

export default nextConfig;
