import { NextResponse } from "next/server";
import { loadChannelVideos } from "@/lib/server/youtubeFeed";

export async function GET() {
  const videos = await loadChannelVideos();
  return NextResponse.json({ videos });
}
