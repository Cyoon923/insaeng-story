import {
  VIDEO_ITEMS,
  YOUTUBE_CHANNEL_ID,
  YOUTUBE_CHANNEL_URL,
  YOUTUBE_VIDEOS,
  toYouTubeVideo,
  type YouTubeVideo,
} from "@/lib/constants/youtube";

const FETCH_OPTIONS: RequestInit = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept-Language": "ko,en;q=0.8",
  },
  next: { revalidate: 600 },
};

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

function parseChannelVideoIds(html: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/https:\/\/i\.ytimg\.com\/vi\/([A-Za-z0-9_-]{11})\//g)) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

async function loadFromRss(): Promise<{ id: string; title: string }[]> {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`,
    FETCH_OPTIONS,
  );
  if (!response.ok) return [];
  return parseFeed(await response.text());
}

async function loadFromChannelPage(): Promise<{ id: string; title: string }[]> {
  const response = await fetch(YOUTUBE_CHANNEL_URL, FETCH_OPTIONS);
  if (!response.ok) return [];
  const ids = parseChannelVideoIds(await response.text());
  const knownTitles = new Map<string, string>(VIDEO_ITEMS.map((item) => [item.id, item.title]));
  return ids.map((id) => ({ id, title: knownTitles.get(id) ?? id }));
}

async function fillMissingTitles(items: { id: string; title: string }[]) {
  const known = new Set(VIDEO_ITEMS.map((item) => item.id));
  const missing = items.filter((item) => !known.has(item.id) && item.title === item.id).slice(0, 8);
  await Promise.all(
    missing.map(async (item) => {
      try {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${item.id}&format=json`,
          FETCH_OPTIONS,
        );
        if (!response.ok) return;
        const data = (await response.json()) as { title?: string };
        if (data.title) item.title = shortTitle(data.title);
      } catch {
        // keep id as title fallback
      }
    }),
  );
}

export async function loadChannelVideos(): Promise<YouTubeVideo[]> {
  try {
    let live = await loadFromRss();
    if (live.length === 0) live = await loadFromChannelPage();
    if (live.length === 0) return YOUTUBE_VIDEOS;

    await fillMissingTitles(live);

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
