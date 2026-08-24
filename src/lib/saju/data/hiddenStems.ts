import type { Branch, HiddenStemPart } from "@/lib/saju/types";

/**
 * 12지지 지장간. 여기·중기·정기만 두고 일수·점수 가중치는 넣지 않는다.
 * 자·묘·유는 정기만, 오는 중기+정기, 나머지는 여기+중기+정기.
 */
export const HIDDEN_STEMS: Record<Branch, readonly HiddenStemPart[]> = {
  子: [{ stem: "癸", role: "정기" }],
  丑: [
    { stem: "癸", role: "여기" },
    { stem: "辛", role: "중기" },
    { stem: "己", role: "정기" },
  ],
  寅: [
    { stem: "戊", role: "여기" },
    { stem: "丙", role: "중기" },
    { stem: "甲", role: "정기" },
  ],
  卯: [{ stem: "乙", role: "정기" }],
  辰: [
    { stem: "乙", role: "여기" },
    { stem: "癸", role: "중기" },
    { stem: "戊", role: "정기" },
  ],
  巳: [
    { stem: "戊", role: "여기" },
    { stem: "庚", role: "중기" },
    { stem: "丙", role: "정기" },
  ],
  午: [
    { stem: "己", role: "중기" },
    { stem: "丁", role: "정기" },
  ],
  未: [
    { stem: "丁", role: "여기" },
    { stem: "乙", role: "중기" },
    { stem: "己", role: "정기" },
  ],
  申: [
    { stem: "戊", role: "여기" },
    { stem: "壬", role: "중기" },
    { stem: "庚", role: "정기" },
  ],
  酉: [{ stem: "辛", role: "정기" }],
  戌: [
    { stem: "辛", role: "여기" },
    { stem: "丁", role: "중기" },
    { stem: "戊", role: "정기" },
  ],
  亥: [
    { stem: "甲", role: "중기" },
    { stem: "壬", role: "정기" },
  ],
};

export function hiddenStemsOf(branch: Branch): readonly HiddenStemPart[] {
  return HIDDEN_STEMS[branch];
}
