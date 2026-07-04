/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  // Hide the floating dev indicator (it overlaps the mobile bottom nav).
  devIndicators: false,
  // Allow the Next dev server to accept requests proxied through an ngrok
  // tunnel (RSC/HMR cross-origin checks in Next 15.2+).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.io"],
  // Same-origin proxy so the browser only ever talks to the frontend origin
  // (the ngrok URL). Next forwards /api/v1/* to the local FastAPI backend, which
  // in turn talks to the local LLM — neither needs to be exposed publicly.
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";
    return [{ source: "/api/v1/:path*", destination: `${backend}/api/v1/:path*` }];
  },
};

export default nextConfig;
