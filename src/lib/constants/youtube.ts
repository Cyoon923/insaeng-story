export interface YouTubeVideo {
  id: string;
  title: string;
  duration: string;
  views: string;
  thumbnail: string;
}

export const YOUTUBE_VIDEOS: YouTubeVideo[] = [
  {
    id: "1",
    title: "어머니의 삶을 노래로 담다",
    duration: "4:35",
    views: "조회수 12.5만",
    thumbnail: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=240&fit=crop",
  },
  {
    id: "2",
    title: "아버지께 전하는 마음",
    duration: "3:52",
    views: "조회수 8.2만",
    thumbnail: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400&h=240&fit=crop",
  },
  {
    id: "3",
    title: "우리 가족의 이야기",
    duration: "5:10",
    views: "조회수 6.7만",
    thumbnail: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&h=240&fit=crop",
  },
  {
    id: "4",
    title: "반려견과의 추억",
    duration: "4:08",
    views: "조회수 5.1만",
    thumbnail: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=240&fit=crop",
  },
];

export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com";
