import {
  VIDEO_ITEMS,
  YOUTUBE_CHANNEL_ID,
  YOUTUBE_VIDEOS,
  toYouTubeVideo,
  type YouTubeVideo,
} from "@/lib/constants/youtube";

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function shortTitle(raw: string) {
  return decodeXml(raw)
    .replace(/^🎵\s*/, "")
    .split(" - ")[0]
    .split(" (")[0]
    .trim();
}

function parseFeed(xml: string): { id: string; title: string }[] {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  const videos: { id: string; title: string }[] = [];
  for (const match of entries) {
    const body = match[1] ?? "";
    const id = body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
    const title = body.match(/<title>([^<]+)<\/title>/)?.[1]?.trim();
    if (id && title) videos.push({ id, title: shortTitle(title) });
  }
  return videos;
}

export async function loadChannelVideos(): Promise<YouTubeVideo[]> {
  try {
    const response = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`,
      { next: { revalidate: 1800 } },
    );
    if (!response.ok) return YOUTUBE_VIDEOS;
    const live = parseFeed(await response.text());
    if (live.length === 0) return YOUTUBE_VIDEOS;

    const knownTitles = new Map<string, string>(VIDEO_ITEMS.map((item) => [item.id, item.title]));
    const seen = new Set<string>();
    const merged: YouTubeVideo[] = [];

    for (const item of live) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(toYouTubeVideo(item.id, knownTitles.get(item.id) ?? item.title));
    }
    for (const item of VIDEO_ITEMS) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(toYouTubeVideo(item.id, item.title));
    }
    return merged;
  } catch {
    return YOUTUBE_VIDEOS;
  }
}
