import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    SILICONFLOW_API_KEY: !!process.env.SILICONFLOW_API_KEY,
    DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  });
}
