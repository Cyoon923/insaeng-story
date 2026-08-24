import type { MonthBranch, SolarTermName } from "@/lib/saju/types";

export type SolarTermInfo = {
  name: SolarTermName;
  longitude: number;
  isJie: boolean;
  monthBranch?: MonthBranch;
};

/**
 * 태양 황경 기준 24절기. 월주는 12절(jie)만 사용한다.
 * 인월=입춘(315°), 묘월=경칩(345°), …
 */
export const SOLAR_TERMS: readonly SolarTermInfo[] = [
  { name: "입춘", longitude: 315, isJie: true, monthBranch: "寅" },
  { name: "우수", longitude: 330, isJie: false },
  { name: "경칩", longitude: 345, isJie: true, monthBranch: "卯" },
  { name: "춘분", longitude: 0, isJie: false },
  { name: "청명", longitude: 15, isJie: true, monthBranch: "辰" },
  { name: "곡우", longitude: 30, isJie: false },
  { name: "입하", longitude: 45, isJie: true, monthBranch: "巳" },
  { name: "소만", longitude: 60, isJie: false },
  { name: "망종", longitude: 75, isJie: true, monthBranch: "午" },
  { name: "하지", longitude: 90, isJie: false },
  { name: "소서", longitude: 105, isJie: true, monthBranch: "未" },
  { name: "대서", longitude: 120, isJie: false },
  { name: "입추", longitude: 135, isJie: true, monthBranch: "申" },
  { name: "처서", longitude: 150, isJie: false },
  { name: "백로", longitude: 165, isJie: true, monthBranch: "酉" },
  { name: "추분", longitude: 180, isJie: false },
  { name: "한로", longitude: 195, isJie: true, monthBranch: "戌" },
  { name: "상강", longitude: 210, isJie: false },
  { name: "입동", longitude: 225, isJie: true, monthBranch: "亥" },
  { name: "소설", longitude: 240, isJie: false },
  { name: "대설", longitude: 255, isJie: true, monthBranch: "子" },
  { name: "동지", longitude: 270, isJie: false },
  { name: "소한", longitude: 285, isJie: true, monthBranch: "丑" },
  { name: "대한", longitude: 300, isJie: false },
];

export const JIE_TERMS = SOLAR_TERMS.filter((term) => term.isJie);

export const MONTH_BRANCH_ORDER: readonly MonthBranch[] = [
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
  "子",
  "丑",
];
