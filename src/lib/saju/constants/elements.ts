import type { Branch, Element, Stem } from "@/lib/saju/types";

export const ELEMENT_KO: Record<Element, string> = {
  木: "목",
  火: "화",
  土: "토",
  金: "금",
  水: "수",
};

export const STEM_ELEMENT: Record<Stem, Element> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

export const BRANCH_ELEMENT: Record<Branch, Element> = {
  寅: "木",
  卯: "木",
  巳: "火",
  午: "火",
  辰: "土",
  戌: "土",
  丑: "土",
  未: "土",
  申: "金",
  酉: "金",
  亥: "水",
  子: "水",
};

export function stemElement(stem: Stem): Element {
  return STEM_ELEMENT[stem];
}

export function branchElement(branch: Branch): Element {
  return BRANCH_ELEMENT[branch];
}
