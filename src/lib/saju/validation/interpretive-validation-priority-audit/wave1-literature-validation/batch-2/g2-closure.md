# G2 SEASON-PHASE Closure — STR-022 / STR-024

엔진 코드·STR-022/024 verdict·freezeStatus는 이 문서로 바꾸지 않는다.  
VERIFIED 승격·literature verdict 변경·expected·점수·가중치·threshold·G3+/Wave 2를 하지 않는다.  
다수결을 정답으로 해석하지 않는다.  
전문가 observation을 literature verdict로 승격하지 않는다.  
Case 06 최종 라벨을 확정하지 않는다.  
E3 Phase C를 추정·보완하지 않는다.

**근거:**
- `wave1-batch-2-literature-validation.md`
- `expert-results/g2-method-comparison.md`
- `expert-results/g2-expert-comparison.md`
- `expert-results/g2-phase-c-case-comparison.md`
- `expert-results/raw/G2-E1-raw.md` … `G2-E4-raw.md`
- `expert-results/expert-response-status.md`

**Literature 층 (변경 없음):** STR-022 PARTIALLY-SUPPORTED · STR-024 PARTIALLY-SUPPORTED (confidence MEDIUM).

---

## 0. Closure 판정

| 항목 | 판정 |
|---|---|
| G2 expert validation **경계 종료 가능** | **예** |
| STR-022/024 **VERIFIED** | **금지 · 하지 않음** |
| Literature verdict 변경 | **하지 않음** |
| freezeStatus 변경 | **하지 않음** |
| 엔진·점수·가중 변경 | **하지 않음** |
| Case 06 정답화 | **금지** |
| E3 Phase C 추가 수집 | **하지 않음** (구조적 결측 유지) |
| G3+ / Wave 2 | **이번 문서에서 진행하지 않음** |

**G2 최종:** **CLOSE**

**이유:** 문헌(Batch 2) + 전문가 Phase A/B(4/4) + Phase C(E1·E2·E4)로 **말할 수 있는 범위 / 확정할 수 없는 정책**을 문서화했다. E3 Phase C missing·Case 06 unresolved·open disagreement는 “미해결 정답”이 아니라 **검증 경계의 일부**로 고정한다. 규칙 확정·VERIFIED가 아니다.

---

## 1. 전문가 4/4 공통 관찰 (Phase A/B)

정답·엔진 규칙·literature VERIFIED가 아니다.

| ID | Observation |
|---|---|
| ES-G2-1 | 월령·득시는 출발/최상급 축이나 **단독으로 최종 신강·신약을 닫지 않는다** |
| ES-G2-2 | **득시 ≠ 자동 신강** |
| ES-G2-3 | **休 ≠ 囚·死** 동일 약화 |
| ES-G2-4 | **실령 + 강통근/득세 → 최종 신강** 가능 |
| ES-G2-5 | **득령 + 강설모극 → 최종 신약** 가능 |
| ES-G2-6 | **계절 상태(旺相休囚死) ≠ 최종 Strength** — 분리 |
| ES-G2-7 | **합·충**이 월령·통근 실효에 영향 가능 |
| ES-G2-8 | **기계적 점수만으로 최종 확정**에 반대/강한 경계 |

---

## 2. Literature와 Expert가 함께 지지하는 범위

양쪽이 **같은 방향**으로 말한 범위만. 승격·채택 아님.

| 범위 | Literature (Batch 2) | Expert |
|---|---|---|
| 旺을 시절상 강한 축으로 봄 | STR-022 supporting (月令何者旺·盛德乘時曰旺) | 득시·旺을 중요 출발로 봄 (ES-G2-1) |
| 旺만으로 신강 확정 금지 | STR-022 limiting (得時死法) | ES-G2-2 · ES-G2-6 |
| 囚·死를 시절 약세 쪽으로 봄 | STR-024 supporting | 실령·약 계절에서 약 방향 출발 (Phase C 1·3 등) |
| 休 ≠ 囚/死 | STR-024 limiting (休 정의 분리; 엔진 휴 제외와 방향 일치) | ES-G2-3 |
| seasonal ≠ 최종 신강/약 | S3 通根활법·得時不旺/失時不弱 | ES-G2-4 · ES-G2-5 · Phase C Case 3·4 서사 |

**유지:** literature verdict PARTIALLY-SUPPORTED / MEDIUM. expertStillRequired 문서상 YES였으나, G2 **검증 라운드 자체는 CLOSE** — VERIFIED로의 전환은 아님.

---

## 3. Expert-only 관찰

문헌 Batch 2에 그대로 없거나, 전문가 층에서만 선명히 반복된 것. 규칙 승격 금지.

| ID | Observation | 비고 |
|---|---|---|
| EO-1 | 전복 **비대칭** (강한 월령을 가볍게 뒤집지 않음) — E2 명시 | 4/4 공통은 “가능”만; 비대칭은 E2 특이 |
| EO-2 | Seasonal Strength / Final Day-Master Strength **이중 변수** 보존 선호 — E2 | 설계 제안, 채택 아님 |
| EO-3 | 충돌 시 **합국·통근 실질 우위** — E1 | OD-1의 한 극 |
| EO-4 | **득령 실패 시 신강 단정 금지** 게이트 — E3 | Phase A/B만; Phase C missing |
| EO-5 | 통근을 **실질 최대 비중**으로 서술 — E4 | OD-3 |
| EO-6 | Phase C에서 **동일 원국에 旺相休囚死 라벨 불일치** (Case 1 死/囚, Case 3 休/死, Case 7 相/休) | E1·E4 vs E2; STR-004 표 검증 아님 |
| EO-7 | Case 3·4에서 **월령≠최종** 서사가 3인(E1·E2·E4) 정렬 | E3 Phase C 없음 |

---

## 4. Open disagreement (닫지 않음)

| ID | 쟁점 | 상태 |
|---|---|---|
| OD-1 | 충돌 시 최종 우위 (통근·합국 vs 월령 게이트 vs 총합) | **open** |
| OD-2 | 식·재·관 감쇄 순위 | **open** |
| OD-3 | 통근 vs 월령 “최대 비중” 표현 | **open** |
| OD-PC-라벨 | Phase C 월령 라벨(死/囚, 休/死, 相/休) | **open** (3인 비교; E3 missing) |

다수결로 해소하지 않는다.

---

## 5. Case 06 unresolved

| 항목 | 내용 |
|---|---|
| Case | 명식 6 — 己亥 丙子 癸卯 戊午 / 일간 癸 |
| 월령 | 3인(E1·E2·E4) **旺** 일치 |
| 최종 | E1 중화~약신강 / E2 신강 / E4 신약~중화신약 → **방향 open** |
| E3 | Phase C **missing** |
| 판정 | **결론 확정 금지.** 다수결 정답 금지. G2 closure의 unresolved 산출물로 고정 |

---

## 6. E3 Phase C missing

| 항목 | 상태 |
|---|---|
| Phase A/B | E3 **수집** (방법론 4/4에 포함) |
| Phase C 명식 7건 | **구조적 결측(missing)** |
| 추가 수집 | **하지 않음** (운영 결정) |
| 본 closure | E3 Phase C 추정·보완·타 전문가로 채움 **금지** |
| 영향 | 4인 Phase C 방향 합의 **불가**; 3인(E1·E2·E4) 비교만 `g2-phase-c-case-comparison.md`에 존재 |

---

## 7. 현재 엔진 규칙과 충돌·긴장 가능 항목

엔진을 바꾸지 않는다. **관찰만.**

| ID | 엔진 (현행) | 긴장/정렬 |
|---|---|---|
| ENG-1 | STR-022: `phase===왕` → strongSideEvidence only (leaning은 STR-050) | **정렬** — ES-G2-2·6 (왕≠자동 신강) |
| ENG-2 | STR-024: `수\|사` → weakSideEvidence; **휴 제외** | **정렬 방향** — ES-G2-3; 휴를 weak-side에 안 넣음 |
| ENG-3 | 수·사를 **동일** weakSideEvidence 품질로 기록 | **긴장 가능** — 전문가 休≪囚≪死 강도 차별; 수=사 동등 가중은 미검증 |
| ENG-4 | `substantialStrong/Weak` boolean + decideDirection | **긴장** — OD-1 충돌 우위·E2 비대칭 전복과 수치/게이트 정책 미합의 |
| ENG-5 | STR-026 상=help / STR-027 휴=무 seasonal side | G2 비대상이나 Phase C 휴·상 라벨 분쟁과 **인접**; 이번 미닫음 |
| ENG-6 | 점수·고정 가중 없음 (목록·boolean) | **정렬** — ES-G2-8 (점수단독 경계) |

---

## 8. G2에서 확정할 수 없는 정책 (NOT validated)

| ID | 항목 |
|---|---|
| NV-G2-1 | 월령/통근/투출의 **단일 수치 우선순위·가중표** |
| NV-G2-2 | 旺相休囚死 → **등간격·최종 Strength Score** 매핑 |
| NV-G2-3 | 충돌 시 **최종 닫는 공식** (OD-1 단일화) |
| NV-G2-4 | 식·재·관 **고정 감쇄 순위·점수** |
| NV-G2-5 | 수와 사의 **동등 weak-side 가중** 확정 |
| NV-G2-6 | STR-026/027(상·휴 side 정책) 이번 G2에서 닫기 |
| NV-G2-7 | Case 06 **최종 세력 정답 라벨** |
| NV-G2-8 | E3 Phase C 결측을 채운 **4인 Phase C 합의** |
| NV-G2-9 | STR-022/024 **VERIFIED** / freeze 변경 |

---

## 9. Phase C 방향 요약 (E1·E2·E4만 · 정답 아님)

| Case | 3인 공통 방향 | 비고 |
|---|---|---|
| 1 | 약 | 월령 라벨 死 vs 囚 |
| 2 | 강 | 강도만 |
| 3 | 강 (월령 불리→뒤집힘) | 휴 vs 死 |
| 4 | 약 (旺→득령무세) | 경계 강도 |
| 5 | 강 | 극신강 vs 신강 |
| 6 | **open** | §5 |
| 7 | 약 | 相 vs 休 |

---

## 10. 하지 않은 것

- VERIFIED / literature verdict / freeze / 엔진 수정
- 다수결 정답 · 고정 점수·가중 확정 · Case 06 확정
- E3 Phase C 보완 · 기존 comparison/method 재작성
- G3+ 진행

---

## 판정 한 줄

**CLOSE** — G2는 규칙 확정이 아니라 **검증 경계(말할 수 있음 / 없음) 고정**으로 종료한다. STR-022/024는 PARTIALLY-SUPPORTED 유지, VERIFIED 아님.
