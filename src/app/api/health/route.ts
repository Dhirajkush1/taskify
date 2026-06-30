import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/health
 * Health check endpoint for Docker HEALTHCHECK, Kubernetes liveness probes,
 * load balancers, and uptime monitors.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "clutch-ai",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      environment: process.env.NODE_ENV || "production",
    },
    { status: 200 }
  );
}
