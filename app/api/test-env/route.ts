import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    url: process.env.UPSTASH_REDIS_REST_URL || "missing",
    token: process.env.UPSTASH_REDIS_REST_TOKEN ? "exists" : "missing",
  });
}