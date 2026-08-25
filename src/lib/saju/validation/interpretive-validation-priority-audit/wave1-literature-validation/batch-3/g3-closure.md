# G3 ROOT-DEPTH Closure — STR-030-clear / present / shallow

엔진 코드·STR-030-* literature verdict·freezeStatus는 이 문서로 바꾸지 않는다.  
VERIFIED 승격·점수·가중치·threshold·expected·Case 02/04 정답화·G4를 하지 않는다.  
다수결을 정답으로 해석하지 않는다.  
전문가 observation을 literature verdict로 승격하지 않는다.  
E3 답변을 추정·보완하지 않는다.

**근거:**
- `wave1-batch-3-literature-validation.md`
- `wave1-batch-3-literature-inventory.json`
- `expert-results/g3-expert-comparison.md`
- `expert-results/g3-phase-c-case-comparison.md`
- `expert-results/raw/G3-E1-raw.md`
- `expert-results/raw/G3-E2-raw.md`
- `expert-results/raw/G3-E4-raw.md`
- `expert-blind-prep/operator-expert-panel.md`

**Literature 층 (변경 없음):**
| rule | literature verdict | confidence |
|---|---|---|
| STR-030-clear | PARTIALLY-SUPPORTED | MEDIUM |
| STR-030-present | CONTESTED | MEDIUM |
| STR-030-shallow | CONTESTED | MEDIUM |

---

## 0. Closure 판정

| 항목 | 판정 |
|---|---|
| G3 expert validation **경계 종료 가능** | **예** |
| STR-030-* **VERIFIED** | **금지 · 하지 않음** |
| Literature verdict 변경 | **하지 않음** |
| freezeStatus 변경 | **하지 않음** |
| 엔진·점수·가중 변경 | **하지 않음** |
| Case 02 충 감쇄 정답화 | **금지** |
| Case 04 Strength 정답화 | **금지** |
| E3 추가 수집·백필 | **하지 않음** (unavailable 고정) |
| G4 / Wave 2 | **이번 문서에서 진행하지 않음** |

**G3 최종:** **CLOSE**

**의미:** 문헌(Batch 3) + 전문가 Phase A/B/C(E1·E2·E4)로 **말할 수 있는 범위 / 말할 수 없는 범위 / 미검증 policy**가 문서화되었다.  
**CLOSE = 검증 경계가 닫혔다.** 규칙 확정·VERIFIED·clear/present/shallow 완료 선언이 **아니다**.

**KEEP OPEN이 아닌 이유:** 추가 수집(E3) 없이 패널이 확정되었고, open disagreement·policy unresolved는 “미해결 정답 대기”가 아니라 **경계의 일부로 고정**할 수 있다.

---

## 1. 말할 수 있음 (speakable boundary)

정답·엔진 채택·VERIFIED가 아니다. 문헌·전문가 층에서 **같은 방향으로 경계가 확인된** 범위만.

| ID | 말할 수 있는 내용 |
|---|---|
| S1 | **통근 존재**와 **통근 깊이/유효강도**는 별개다. |
| S2 | **본기·중기·여기 role만으로** 최종 root strength(유효 근력)를 **완전히 결정할 수 없다**. |
| S3 | **본기**라고 해서 **항상** 최종적으로 가장 강하게 작용한다고 **단정할 수 없다**. |
| S4 | **중기 > 여기**를 **고정·절대 규칙**으로 **확정할 수 없다** (경향·조건·지지 유형 쟁점 남음). |
| S5 | **월지 근**과 **년·일·시 근**을 **동일 취급하기 어렵다**. |
| S6 | **투간**과 **통근**은 **별개**이며, 세력 기반은 통근 쪽이 더 근본적으로 서술된다. |
| S7 | **clear / present / shallow**는 고전 **전통 표준 3등급으로 검증된 것**이 아니라, 엔진·실무용 **추상화(또는 혼합)**로 취급해야 한다. |

**Literature 정렬 (승격 아님):** Batch 3도 沈의 根之重輕·월지/타지지 구분·투간≠通根·3단 Strength 라벨 부재를 말해 STR-030-clear PARTIALLY / present·shallow CONTESTED를 유지. Expert S1–S7과 **방향이 맞닿는** 범위만 위 표에 포함.

---

## 2. 말할 수 없음 (not validated / not speakable as settled)

이번 G3로 **확정·VERIFIED·정답화하지 않는** 것.

| ID | 말할 수 없음 |
|---|---|
| N1 | clear > present > shallow를 **고정 Strength 가중치**로 VERIFIED |
| N2 | 본기/중기/여기에 **고정 점수** 부여 |
| N3 | **중기 > 여기** 절대 규칙 |
| N4 | 충을 받으면 root를 **몇 %** 감쇄하는지 |
| N5 | 월지 root와 타 지지 root의 **고정 배율** |
| N6 | 十二長生·墓庫·餘氣를 **어떤 공식으로** 결합할지 |
| N7 | **Case 04 Strength 정답** |
| N8 | **Case 02 충 감쇄 정답** |

---

## 3. Policy unresolved (엔진/STR 미결정)

검증 라운드는 CLOSE이나, 아래는 **정책·설계로 미결**. 이번 문서에서 고르거나 구현하지 않는다.

| ID | Policy |
|---|---|
| P1 | **structural root depth**와 **effective root strength**를 엔진에서 **분리할지** |
| P2 | STR-030 clear/present/shallow 의미를 **구조적 layer(role)로 제한할지** |
| P3 | STR-031 / 033 / 050이 현재 `rootQuality`를 Strength 기여로 쓰는 방식 |
| P4 | **월지 vs 타 지지** 위치 가중 |
| P5 | **합·충**에 따른 root 유효성 |
| P6 | **十二長生·墓庫** 등 추가축 결합 |
| P7 | **중기/여기 ordering** 정책 (절대 서열 vs 지지 유형별 vs 비정기 묶음) |

Open disagreement (닫지 않음 · 다수결 금지):

| ID | 쟁점 | 상태 |
|---|---|---|
| OD-1 | 중기 vs 여기 일관 서열 방향 | **open** (정책 P7) |
| OD-G3-02 | Case 02 충 후 유효 감쇄 정도 | **open** (N4 · P5) |
| OD-G3-04 | Case 04 Strength 방향 | **open** (N7; root 존재와 혼동 금지) |
| OD-G3-03/08 | Strength 강도·중화 폭 | **open** (root 방향과 분리) |

---

## 4. DQ / evidence boundary

| ID | 경계 |
|---|---|
| DQ-1 | **E3 = unavailable.** 추가 수집·추정·보완·closure 미완료 처리 **금지**. |
| DQ-2 | E1/E2/E4는 raw에서 **AI 자기보고**. 인간 명리 전문가 패널 검증으로 **과대표현 금지**. |
| DQ-3 | **Literature evidence**와 **expert observation**은 **별도 층** 유지. 합쳐 verdict·VERIFIED 만들지 않음. |
| DQ-4 | E4의 이전 라운드 囚/死 오기 자인은 **교차 라운드 용어 DQ**로만 기록; G3 root-depth 정답화에 쓰지 않음. |

---

## 5. Phase C에서 경계로 고정한 관찰 (정답 아님)

| Case | 경계로 남긴 것 |
|---|---|
| 01 | 여기 근·유효 약 — 인정 문턱만 표현 차이 |
| 02 | 구조적 본기 강근 vs **충 유효 감쇄** — 정답화 금지 |
| 03 | 중기 ≠ 자동 중간 유효 — P1/P2/P7과 연결 |
| 04 | Root 본기 존재 합의 vs **Strength 방향 불일치** — Strength 정답화 금지 |
| 06 | **layer ≠ effective** · 년지 vs 월지 — P1/P4 |
| 07 | 복수 본기 최상 — 상한 사례(규칙 아님) |
| 08 | 월지 본기 단근 강 · Strength 중화 폭만 차이 |

---

## 6. 엔진 긴장 (observation only · 변경 없음)

| 긴장 | 비고 |
|---|---|
| STR-030: role → clear/present/shallow **단일 라벨** | Expert: structural ≠ effective (S1·S2·Case 06) |
| STR-030: 전 지지 **동일 취급** | Expert·문헌: 월지 ≠ 타 지지 (S5) |
| STR-030: 투간 **미사용** | Expert·문헌: 투간≠통근 분리와는 맞닿음; Strength 기여는 별 문제 |
| STR-031/033/050: rootQuality → Strength | P3 unresolved; 이번 CLOSE로 수정하지 않음 |

---

## 7. 다음 단계 (이번 문서 밖)

G3 CLOSE 이후 **가능한** 후속(실행은 별도 지시 시에만):

1. Policy 메모만: P1–P7을 설계 선택지로 정리 (코드 변경 없이).
2. Downstream 해석 시 STR-030 라벨을 **구조 layer**로만 읽을지 문서화 (P2).
3. **G4** 등 다음 BOTH 그룹은 **별도 착수** — 본 CLOSE가 G4를 시작하지 않음.
4. 인간 전문가 재수집이 필요하면 **새 라운드**로만 (E3 백필·AI raw 대체 금지 원칙 유지 권고).

**하지 않음 (금지 재확인):** 엔진 수정 · STR/freezeStatus · VERIFIED · 점수/가중 · Case 02/04 정답 · G4 진행.
