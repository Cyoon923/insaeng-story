# G4 MONTH-CLIMATE Closure — CLI-002 / CLI-003a–d / CLI-004

엔진 코드·CLI-* literature verdict·freezeStatus·`baseClimate.ts`는 이 문서로 바꾸지 않는다.  
VERIFIED 승격·점수·가중치·threshold·expected·월지별 최종 climate 정답화·G5를 하지 않는다.  
다수결을 정답으로 해석하지 않는다.  
전문가 observation을 literature verdict로 승격하지 않는다.  
E3 답변을 추정·보완하지 않는다.  
문헌 + 전문가를 합쳐 하나의 정답을 만들지 않는다 — **검증 경계만 닫는다.**

**근거:**
- `wave1-batch-4-literature-validation.md`
- `wave1-batch-4-literature-inventory.json`
- `expert-results/g4-expert-comparison.md`
- `expert-results/raw/G4-E1-raw.md`
- `expert-results/raw/G4-E2-raw.md`
- `expert-results/raw/G4-E4-raw.md`
- `expert-blind-prep/operator-expert-panel.md`

**Literature 층 (변경 없음):**
| rule | literature verdict | confidence |
|---|---|---|
| CLI-002 | CONTESTED | MEDIUM |
| CLI-003a | CONTESTED | MEDIUM |
| CLI-003b | PARTIALLY-SUPPORTED | MEDIUM |
| CLI-003c | CONTESTED | MEDIUM |
| CLI-003d | PARTIALLY-SUPPORTED | MEDIUM |
| CLI-004 | CONTESTED | MEDIUM |

---

## 0. Closure 판정

| 항목 | 판정 |
|---|---|
| G4 expert validation **경계 종료 가능** | **예** |
| CLI-002 / 003* / 004 **VERIFIED** | **금지 · 하지 않음** |
| Literature verdict 변경 | **하지 않음** |
| freezeStatus 변경 | **하지 않음** |
| 엔진·`BASE_CLIMATE`·점수·가중 변경 | **하지 않음** |
| 월지별 최종 climate 고정값 정답화 | **금지** |
| 寅卯辰 / 토월 동일값 정답화 | **금지** |
| 일간 반영 방식·전향 공식 확정 | **금지** |
| E3 추가 수집·백필 | **하지 않음** (unavailable 고정) |
| G5 / Wave 2 | **이번 문서에서 진행하지 않음** |

**G4 최종:** **CLOSE**

**의미:** 문헌(Batch 4) + 전문가 Phase A/B/case(E1·E2·E4)로 **말할 수 있는 범위 / 말할 수 없는 범위 / 미검증 policy**가 문서화되었다.  
**CLOSE = 검증 경계가 닫혔다.** 규칙 확정·VERIFIED·월지 climate lookup 완료 선언이 **아니다**.

**KEEP OPEN이 아닌 이유:** 추가 수집(E3) 없이 패널이 확정되었고, open disagreement·policy unresolved는 “미해결 정답 대기”가 아니라 **경계의 일부로 고정**할 수 있다.

---

## 1. 말할 수 있음 (speakable boundary)

정답·엔진 채택·VERIFIED가 아니다. 문헌·전문가 층에서 **같은 방향으로 경계가 확인된** 범위만.

| ID | 말할 수 있는 내용 |
|---|---|
| S1 | **월지/계절(月令)**은 조후(한난·조습)의 **baseline·출발점**이다. |
| S2 | **월지만으로** 원국 전체의 **최종 한난·조습을 확정할 수 없다.** |
| S3 | **한난**과 **조습**은 **별도 축**이다 (동시에 다루 수 있으나 동일 판정이 아님). |
| S4 | **중간·온화·전환** 한난 상태가 **존재할 수 있다** (寒/熱 이분만으로 닫히지 않음). |
| S5 | **寅卯辰**을 조후상 **완전 동일 값/묶음으로 취급할 수 없다.** |
| S6 | **辰未戌丑**을 인접 계절(寅卯 / 巳午 / 申酉 / 亥子)과 **기계적으로 동일 Climate로 취급할 수 없다.** |
| S7 | **왕쇠(시절·세력)**와 **조후(한난·조습)**는 **별도 축**이다. |

**Literature 정렬 (승격 아님):** Batch 4도 월령 출발 ≠ 12칸 고정 쌍 표, 사계 클러스터 단순화 충돌, 토월≠인접 계절을 말해 CLI-002/003a/003c/004 CONTESTED · CLI-003b/003d PARTIALLY-SUPPORTED를 유지. Expert S1–S7과 **방향이 맞닿는** 범위만 위 표에 포함.

---

## 2. 말할 수 없음 (not validated / not speakable as settled)

이번 G4로 **확정·VERIFIED·정답화하지 않는** 것.

| ID | 말할 수 없음 |
|---|---|
| N1 | 월지별 **최종 climate 고정값** (12칸 `temperature`×`moisture` 쌍) **VERIFIED** |
| N2 | **寅卯辰 = 단일 동일 Climate 값** |
| N3 | **辰未戌丑 = 인접 계절과 동일 Climate 값** |
| N4 | **일간**을 climate 판정에 넣는 **확정 방식** |
| N5 | 전국·합충 등이 baseline을 **전향·역전시키는 공식** |
| N6 | **중간·전환월 범위**의 확정 목록 (예: 卯辰만 / 申酉 포함 여부) |
| N7 | 한난·조습 **고정 점수 / threshold** |
| N8 | Case 03·04·08 등 case별 **최종 한난·조습 정답 라벨** |

---

## 3. Policy unresolved (엔진/CLI 미결정)

검증 라운드는 CLOSE이나, 아래는 **정책·설계로 미결**. 이번 문서에서 고르거나 구현하지 않는다.

| ID | Policy |
|---|---|
| P1 | **일간**이 climate 판정에 **개입하는 범위** (기후 자체 vs 일간별 필요도만) |
| P2 | **Month Climate Baseline → Chart Climate Final** 전환 규칙 |
| P3 | **중간/전환월** 범위·라벨 정책 |
| P4 | 전국·합충·투간 등에 의한 **한난/조습 수정** 정책 |
| P5 | CLI-002 / 003* / 004를 어떤 수준의 **baseline lookup**으로 제한할지 (최종 chart climate와 분리할지) |

Open disagreement (닫지 않음 · 다수결 금지):

| ID | 쟁점 | 상태 |
|---|---|---|
| OD-1 | 일간을 조후 **판정 본체**에 넣을지 (E1/E4 예 vs E2 조건부) | **open** (P1) |
| OD-2 | 전국이 baseline을 **전향**하는 정도 (특히 Case 04) | **open** (P2 · P4 · N5) |
| OD-3 | 중간·온화 월 **범위** (춘만 vs 추 포함) | **open** (P3 · N6) |
| OD-G4-03 | Case 03 — 子의 완화 vs 위축 vs 한열교차 | **open** (N8 · P4) |
| OD-G4-04 | Case 04 — 습냉 전향 vs 온화 유지 | **open** (OD-2) |
| OD-G4-08 | Case 08 — 燥熱 vs 暖凉 vs 서늘+조 | **open** (N8) |

---

## 4. DQ / evidence boundary

| ID | 경계 |
|---|---|
| DQ-1 | **E3 = unavailable.** 패널 제외. 추가 수집·추정·보완·closure 미완료 처리 **금지**. |
| DQ-2 | E1/E2/E4는 raw에서 **AI 자기보고**. 인간 명리 전문가 패널 검증으로 **과대표현 금지**. |
| DQ-3 | **Literature evidence**와 **expert observation**은 **별도 층** 유지. 합쳐 verdict·VERIFIED 만들지 않음. |
| DQ-4 | comparison에 기록된 기타 DQ 유지: E4 Case 07 **甲酉 비표준 갑자** 경고; E2 엔진 변수명 제안; E1 조후용신 언어 혼입 — **정답화에 쓰지 않음**. |

---

## 5. Case에서 경계로 고정한 관찰 (정답 아님)

| Case | 경계로 남긴 것 |
|---|---|
| 01 | 초봄 여한 + 金의 서늘화 — 조습 정도만 표현 차이 |
| 02 | 偏熱·偏燥 + 辰 완충 — 방향 합의에 가까움 (규칙 아님) |
| 03 | 未=조열 토월은 공유; 子 처리 **프레임 open** |
| 04 | 辰=습토·비동일 봄은 공유; **전국 전향 정도 open** |
| 05 | 寒濕 월령 × 火 충돌 구조 합의; **우세 판정 유보** |
| 06 | 丑=한습 토월 + 火 완화 — 해동 강도만 차이 |
| 07 | 凉燥·삼유 강화 — 합의에 가까움; E4 표기 DQ만 별도 |
| 08 | **燥**는 공유; **한난 방향 open** |

---

## 6. 엔진 긴장 (observation only · 변경 없음)

| 긴장 | 비고 |
|---|---|
| `BASE_CLIMATE`: 월지 → **고정 T+M 쌍** 12칸 | Expert·문헌: baseline ≠ final (S1·S2·N1) |
| CLI-003a: 寅卯辰 = balanced+moist **동일** | Expert·문헌: 조후상 세분 거부 (S5) |
| CLI-003b–d: 사계 클러스터 **동일값** | 未·戌·丑 토월 고유성 (S6); 003b/003d는 문헌 PARTIAL만 |
| CLI-004: 토월 = **인접 계절 공유** | Expert·문헌: 기계적 동일 취급 거부 (S6) |
| lookup **일간 독립** | OD-1 / P1 unresolved; CLOSE로 수정하지 않음 |

---

## 7. 다음 단계 (이번 문서 밖)

G4 CLOSE 이후 **가능한** 후속(실행은 별도 지시 시에만):

1. Policy 메모만: P1–P5를 설계 선택지로 정리 (코드·`baseClimate` 변경 없이).
2. Downstream(G6 adjusted climate 등) 해석 시 CLI-002를 **baseline lookup**으로만 읽을지 문서화 (P5) — G6 판정은 별도.
3. **G5** 등 다음 BOTH 그룹은 **별도 착수** — 본 CLOSE가 G5를 시작하지 않음.
4. 인간 전문가 재수집이 필요하면 **새 라운드**로만 (E3 백필·AI raw 대체 금지 원칙 유지 권고).

**하지 않음 (금지 재확인):** 엔진 수정 · CLI/STR/freezeStatus · VERIFIED · 점수/가중 · climate 고정값·묶음 정답화 · G5 진행.
