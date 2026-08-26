import type { Element } from "@/lib/saju/types";

/** 오행 상생(生). 점수·강약 없음. */
export const ELEMENT_GENERATES: Readonly<Record<Element, Element>> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

export function elementGenerates(from: Element, to: Element): boolean {
  return ELEMENT_GENERATES[from] === to;
}

export function generatedElement(from: Element): Element {
  return ELEMENT_GENERATES[from];
}
