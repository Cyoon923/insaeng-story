import type { Branch, Element, SeasonName, SeasonPhase } from "@/lib/saju/types";

export const BRANCH_SEASON: Record<Branch, SeasonName> = {
  寅: "봄",
  卯: "봄",
  巳: "여름",
  午: "여름",
  申: "가을",
  酉: "가을",
  亥: "겨울",
  子: "겨울",
  辰: "환절",
  未: "환절",
  戌: "환절",
  丑: "환절",
};

export const SEASON_PHASE: Record<SeasonName, Record<Element, SeasonPhase>> = {
  봄: { 木: "왕", 火: "상", 水: "휴", 金: "수", 土: "사" },
  여름: { 火: "왕", 土: "상", 木: "휴", 水: "수", 金: "사" },
  가을: { 金: "왕", 水: "상", 土: "휴", 火: "수", 木: "사" },
  겨울: { 水: "왕", 木: "상", 金: "휴", 土: "수", 火: "사" },
  환절: { 土: "왕", 金: "상", 火: "휴", 木: "수", 水: "사" },
};
