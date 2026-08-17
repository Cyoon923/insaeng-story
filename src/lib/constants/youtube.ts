export interface YouTubeVideo {
  id: string;
  title: string;
  duration: string;
  views: string;
  thumbnail: string;
}

export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@Asha-Music-8";
export const YOUTUBE_CHANNEL_NAME = "인생곡 창작소";

const VIDEO_ITEMS = [
  { id: "BN8ynUPhwrE", title: "보고싶다 울엄마" },
  { id: "gAzYto-9RaM", title: "부처님의 자비" },
  { id: "GOmwOHmZ-4w", title: "포니 네가 있으면 좋아" },
  { id: "Q_DzSJQU6KA", title: "살아낸 하루" },
  { id: "4paL0lkU6Lo", title: "내 속도로" },
  { id: "cKoT_wCiDcs", title: "내 불씨야" },
  { id: "Xfhvbd-6XoI", title: "네가 온 그날부터" },
  { id: "94lEF9saIz4", title: "다시 웃는 캔디" },
  { id: "zLgacL5bngk", title: "그러려니 웃어버리는 트롯 팝" },
  { id: "xzijfOd_UN8", title: "거기 있으면 안 되잖아" },
  { id: "vILp9lMvNPk", title: "내 인생은 꽃길이다" },
  { id: "o7hhR3wP_6I", title: "아직도 네가 산다" },
  { id: "UYvX7k84hu4", title: "멈춰버린 일상 속에서도" },
  { id: "GQiPmravOhw", title: "공부할 때·일할 때 듣는 연주곡" },
  { id: "Uo_6v5oLo_U", title: "너라는 비" },
  { id: "GRzVS90gpzo", title: "10분간의 평온함" },
  { id: "gs5qvtR0oaE", title: "사과 시러 우주 조아" },
  { id: "JSfMZEedZWo", title: "로그아웃 증후군" },
  { id: "7lUVzUfqzqk", title: "고양이 이별" },
  { id: "a68VXAj5DTQ", title: "첫사랑 생각에 잠 못 이룰때" },
  { id: "WUopef4d4oc", title: "희노애락을 다 느끼고 싶을때" },
  { id: "46LKeAiA0wg", title: "보란 듯 복수하고 싶을 때" },
  { id: "lDP5Gx8dIGI", title: "여름앓이" },
  { id: "BaJvNTIU_fk", title: "미치도록 보고싶을때" },
  { id: "qqfV0CNnPaw", title: "닿지 못한 용서" },
  { id: "17w3ypCWNUE", title: "그날의 우리" },
  { id: "DKgEmo3jM_I", title: "새벽 3시의 불면증" },
  { id: "lRItuLpuOrU", title: "오늘의 나는 어제와 달라" },
] as const;

export const YOUTUBE_VIDEOS: YouTubeVideo[] = VIDEO_ITEMS.map((video) => ({
  id: video.id,
  title: video.title,
  duration: "",
  views: "인생곡 창작소",
  thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
}));
