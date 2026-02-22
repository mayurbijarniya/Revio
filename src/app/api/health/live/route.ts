import { env } from "@/lib/env";

export async function GET() {
  return Response.json({
    success: true,
    status: "live",
    mode: env.BACKGROUND_MODE,
    timestamp: new Date().toISOString(),
  });
}
