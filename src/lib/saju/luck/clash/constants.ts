/**
 * Generic 지지 충 root attenuation 확정 수치 (TBD-01c · §1.6.8.0).
 *
 * A안 δ=4. natal 충과 Luck 충이 **같은 상수**를 쓴다(§1.6.8.9.5) — 다만 이는
 * 수치 계층의 단일 상수라는 뜻이지 "Luck 충의 명리적 강도가 natal과 같다"는
 * 주장이 아니다. source 가중·위치 가중·severity 수치화는 모두 없다.
 *
 * 감쇠 단위는 `(element × natal 지지슬롯)` 1건이며, 활성 relation 수·source와
 * 무관하게 1회만 적용된다(§1.6.8.9.4).
 */
export const CLASH_ATTENUATION_DELTA = 4;
