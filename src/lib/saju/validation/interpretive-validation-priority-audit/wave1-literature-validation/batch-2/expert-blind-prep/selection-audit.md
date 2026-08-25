# Wave 1 Batch 2 — STR-022/024 Expert Blind — Selection Audit

엔진 코드·STR-022/024·literature verdict·freezeStatus를 바꾸지 않는다.
전문가 답·expected를 만들지 않는다.
G3 이후를 진행하지 않는다.

선행: `../wave1-batch-2-literature-validation.md`

---

## 1. 선정 원칙

사용 (raw / FACT lookup만):

- 네 기둥 간지
- 월지 → 일간 오행의 왕상휴수사 (`seasonPhaseOf` / STR-004 표)
- 일간 통근 hit (지지 지장간 role: 정기·중기·여기)
- 천간 십신 raw mapping (`shiShenOf`)

사용 금지 (선정에 미사용):

- `directionCandidate` / leaning-* / mixed / substantial*
- StrengthSummary side lists / Need* / Climate*
- literature verdict / engine expected strength
- 신규 생년월일·신규 명식

풀: `axisReview.fixtures.json` + `conflictType.fixtures.json` (기존 validation fixture만).

참고: Batch 1 Pilot의 `doNotReuseDesignFixtures`는 **정확도 Pilot**용이다.  
이번 G2는 월령·통근 **구조 검증**이 목적이라 동일 풀을 허용한다. 생년월일은 fixture에 문서화된 경우만 쓰고, 없으면 **원국만** 제시한다(신규 생성 금지).

---

## 2. 후보 검토

| id | phase (lookup) | 통근(요약) | 비고 |
|---|---|---|---|
| s2 | 왕 | 년·월 寅 정기 | 得時+강보조 → 약보조 슬롯에 부적합 |
| s4 / s6 / s12 / s14 | 왕 | 다중·강 | 同上 |
| s13 | 왕 | 월 寅 정기 1 | 得時+보조 제한 후보 |
| c2 | 사 | 辰·丑 정기 등 다중 + 정인 | 失時+강통근 |
| c1 | 사 | 년 寅 정기 | c2가 더 강통근 |
| s3 | 사 | 없음 | 사·무근 |
| s15 | 휴 | 없음 | 휴·무근 |
| s10 | 휴 | 년 巳 정기 | 휴+통근 |
| s1 | 수 | 일·시 午 중기 + 비견 | 수+통근 충돌 |
| s9 | 수 | 없음 | 수·무근 |
| s7 | 수 | 월 辰 여기 | 경계이나 s1/s9로 커버 |
| s8 / s11 | 상 | — | STR-022/024 비중심(STR-026) → 제외 |

검토한 candidate 수: **20** (axis 16 + conflict typeC/I 4).  
최종 선정: **7**.

---

## 3. 최종 선정 7건

| blindId | sourceId | 커버 슬롯 |
|---|---|---|
| w1b2-sp-01 | s15-gyeong-hae-hyu | 休 · 무통근 |
| w1b2-sp-02 | s13-eul-in-jeonggi-geop | 得時 + 약한 보조 |
| w1b2-sp-03 | s3-gap-yu-unrooted | 死 · 무통근 (休 대비) |
| w1b2-sp-04 | s1-gimo-bingja-muo | 囚 + 통근/득세 충돌 |
| w1b2-sp-05 | c2-gi-sa-jeonggi-support | 失時(死) + 강한 통근/득세 |
| w1b2-sp-06 | s10-byeong-chuk-hyu | 休 + 통근 |
| w1b2-sp-07 | s9-gap-sul-mugun | 囚 · 무통근 (休/死 대비) |

제시 순서는 슬롯이 드러나지 않도록 위 순서를 유지한다(휴→득시→사→수+통근→사+강통근→휴+통근→수무근).

---

## 4. 제외 요약

| id | 이유 |
|---|---|
| s2, s12, s14, s4, s6 | 得時이나 보조가 약하지 않음 |
| c1 | c2와 동일 슬롯·통근 약함 |
| s7, s16, i1, i2 | 슬롯 중복 또는 비표적 |
| s8, s11 | 相 전용(STR-026) |
| case-unresolved-* | buildCaseTrace 합성·fixture 풀 외 |

---

## 5. 하지 않은 것

- 엔진 Strength 조회 후 방향 맞춤 선정
- 신규 생년월일/명식
- 전문가 답·expected·verdict·freeze 변경
- G3+ 진행
