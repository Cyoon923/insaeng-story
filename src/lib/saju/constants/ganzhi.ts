import { BRANCHES, STEMS, type Branch, type Stem } from "@/lib/saju/types";

export const STEM_KO: Record<Stem, string> = {
  甲: "갑",
  乙: "을",
  丙: "병",
  丁: "정",
  戊: "무",
  己: "기",
  庚: "경",
  辛: "신",
  壬: "임",
  癸: "계",
};

export const BRANCH_KO: Record<Branch, string> = {
  子: "자",
  丑: "축",
  寅: "인",
  卯: "묘",
  辰: "진",
  巳: "사",
  午: "오",
  未: "미",
  申: "신",
  酉: "유",
  戌: "술",
  亥: "해",
};

export const GANZHI60: ReadonlyArray<{ stem: Stem; branch: Branch }> = Array.from({ length: 60 }, (_, index) => ({
  stem: STEMS[index % 10],
  branch: BRANCHES[index % 12],
}));

/**
 * 오기월법: 연간에 따른 인월(입춘월) 천간.
 * 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲
 */
export const YIN_MONTH_STEM_BY_YEAR_STEM: Record<Stem, Stem> = {
  甲: "丙",
  己: "丙",
  乙: "戊",
  庚: "戊",
  丙: "庚",
  辛: "庚",
  丁: "壬",
  壬: "壬",
  戊: "甲",
  癸: "甲",
};

/**
 * 오자시법: 일간에 따른 자시 천간.
 * 甲己→甲, 乙庚→丙, 丙辛→戊, 丁壬→庚, 戊癸→壬
 */
export const ZI_HOUR_STEM_BY_DAY_STEM: Record<Stem, Stem> = {
  甲: "甲",
  己: "甲",
  乙: "丙",
  庚: "丙",
  丙: "戊",
  辛: "戊",
  丁: "庚",
  壬: "庚",
  戊: "壬",
  癸: "壬",
};

export const MONTH_BRANCHES_FROM_YIN: readonly Branch[] = [
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

export function stemIndex(stem: Stem): number {
  return STEMS.indexOf(stem);
}

export function branchIndex(branch: Branch): number {
  return BRANCHES.indexOf(branch);
}

export function stemByIndex(index: number): Stem {
  return STEMS[((index % 10) + 10) % 10];
}

export function branchByIndex(index: number): Branch {
  return BRANCHES[((index % 12) + 12) % 12];
}

export function ganzhiByIndex(index: number): { stem: Stem; branch: Branch } {
  const normalized = ((index % 60) + 60) % 60;
  return GANZHI60[normalized];
}

export function pillarLabel(stem: Stem, branch: Branch): string {
  return `${STEM_KO[stem]}${BRANCH_KO[branch]}`;
}
