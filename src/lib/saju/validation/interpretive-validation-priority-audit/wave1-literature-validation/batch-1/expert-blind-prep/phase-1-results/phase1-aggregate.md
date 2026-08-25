# Phase 1 Aggregate — Pilot ↔ Phase 1 Expert Observations

엔진 코드·STR-010/011 verdict·freezeStatus는 이 문서로 바꾸지 않는다.  
expected를 만들지 않는다. majority를 정답으로 해석하지 않는다.  
전문가 observation을 literature verdict로 승격하지 않는다.  
VERIFIED / freeze 금지. Wave 2로 진행하지 않는다.  
E1~E4 raw·기존 comparison 파일을 수정하지 않는다.

**목적:** Pilot 결과와 Phase 1 결과를 **연결**해  
반복 검증된 사항 / 새로 확인된 사항 / 미해결 사항을 분리한다.

**근거:**
- Pilot: `pilot-5-cases/aggregate/wave1-batch-1-expert-pilot-aggregate.md`, `…-pilot-closure.md`
- Phase 1: `phase1-case-comparison.md`, `phase1-method-comparison.md`
- Design: `phase-1-case-design/wave1-batch-1-phase1-case-design.md`
- Raw: `phase-1-results/raw/P1-E1`…`P1-E4-raw.md`

**Literature 층 (변경 없음):** STR-010 PARTIALLY-SUPPORTED · STR-011 CONTESTED.

---

## 0. Corpus & 비교 규칙

| Layer | Experts | Cases |
|---|---|---|
| Pilot | E1–E4 (`pilot-5-cases/raw/`) | w1b1-blind-01…05 |
| Phase 1 | E1–E4 (`phase-1-results/raw/P1-E*`) | w1b1-p1-01…08 |

- 케이스 ID는 **세트 간 동일하지 않음** (Pilot 01 ≠ Phase 1 01). 연결은 **축·구조 유형**으로만.
- Case 02 E3 = **DQ-1** → agreement 계산에서 **제외**.
- Case 03 E3 = **DQ-2** → 최종 방향은 기록 가능, **득령/점수 근거는 오염**.
- 다수결 ≠ 정답.

---

## 1. Pilot → Phase 1에서 반복 확인된 agreement

| Pilot observation | Phase 1 재현 | 비고 |
|---|---|---|
| 비겁+인성 → 강화(+) 방향 **4/4** | 방법론 **4/4** | 방향 묶음 허용; 작용·강도는 분리 |
| 식상+재+관 → 약화(−) 거시 **4/4** | 방법론 **4/4** | 기전(설/소모/극)은 분리 유지 |
| 월령·통근·위치 > 단순 개수만으로 최종 등급 | 월령·통근 **4/4 중시**; 개수 합산은 여전히 open | Pilot의 “위치 중시”는 반복; “개수 거부”는 전원 동일 문구는 아님 |
| Control 감쇄 뚜렷 → weak | **p1-01** 4/4 신약/극신약 | 구조 유형 재현 (명식 다름) |
| Control 생조 뚜렷 → strong | **p1-02** E1·E2·E4 신강/태강 (E3 DQ 제외) | 구조 유형 재현 |
| 시주 미상 → weak 방향 + uncertainty | **p1-08** 4/4 신약/극신약 + 시주 조건부 | Pilot Case 05형 **정상 조건부** 재확인 |

Pilot closure가 Phase 1에 넘긴 질문 중 **방향 스크리닝**은 Phase 1에서도 같은 방향으로 반복됐다.  
이는 literature VERIFIED가 아니다.

---

## 2. Phase 1 8 case — 방향 agreement

방향 태그(집계용; 정답 아님): `weak` = 신약 계열 · `strong` = 신강 계열 · `boundary` = 중화 경계 명시.

| Case | Design axis | Direction | Count rule | Note |
|---|---|---|---|---|
| 01 | control 감쇄 | weak | **4/4** | 극약 vs 신약 라벨만 차이 |
| 02 | control 생조 | strong | **3/3** (E3 제외) | E3 = DQ-1 |
| 03 | Pilot 04형 교차 | strong lean | **4/4** 방향 | E3 득령 근거 = DQ-2 오염; E2·E4 중화↔신강 경계 |
| 04 | 재 강·인 적음 | weak lean | **4/4** | 전원 신약~중화신약; 완전 신강 없음 |
| 05 | 재+인 동시 | strong lean | **4/4** | 극신강↔중화신강 강도만 |
| 06 | 편/정·자리vs개수 | **open** | — | **실질 disagreement** (§3) |
| 07 | 월령 vs 투출 | weak | **4/4** | 근 유무·극약 여부만 |
| 08 | 시 미상 | weak + conditional | **4/4** | 정도 확정은 시주 보류 공통 |

**방향 agreement (실질):** 01·02†·03·04·05·07·08.  
†02는 E3 제외 후 3/3.

---

## 3. Case 06 — 실질 disagreement

| Expert | 판정 (원문) | 무게 중심 |
|---|---|---|
| E1 | 중화 ~ 약신강 | 子록·亥 통근이 재관식 견제를 버팀 |
| E2 | 신강 | 子+亥 질이 木火土 설모극보다 우세 |
| E3 | 신약 | 子=絶 가정 + 충형·통근 약 (학파 가정; 일간 癸는 올바름) |
| E4 | 신약~중화신약 | 록·亥 질 vs 탈기 **개수** 충돌을 명시 |

**관찰:** 득령·비겁 **자리의 질** vs 재관식 **개수·충형** 가중 — Phase 1의 **주요 open disagreement**.  
Pilot Case 04(교차 라벨 갈림)와 **동일 명식은 아님**. 유형상 “월령/근의 질 vs 반대 세력 총량” 긴장은 Pilot 04·closure 질문과 **연결 가능**하나, 다수결 정답화·엔진 맞춤 금지.

---

## 4–6. Data-quality (판정 불일치와 분리)

### 4. Case 02 E3 — DQ-1 (확정)

- 제시 일간 **甲**을 **庚**으로 오독 → agreement에서 **제외**.
- E3 「신약」은 해석적 disagreement로 쓰지 않음.

### 5. Case 03 E3 — DQ-2 (확정)

- 제시 월지 **丑**을 **寅**으로 득령 채점 → **점수·득령 근거 오염**.
- 최종 방향 「신강」은 E1·E2·E4와 겹쳐 **방향 기록은 가능**.

### 6. 기타 경미 DQ

| ID | 내용 | Agreement 영향 |
|---|---|---|
| DQ-3 | E1 Case 02 차트 일지 표기 오류; 본문은 子·甲 올바름 | 판정 축 유효 |
| DQ-4 | E1 Case 05 차트 년지 표기 오류; 본문에 子 언급 | 판정 축 대체로 유효 |
| DQ-5 | E3 만세력 의문 메모 (제시 원국 적용 명시) | 오독 아님 |

---

## 7. 방법론 4/4 agreement (Phase 1)

1. 비겁 → 기본 강화(+)  
2. 인성 → 기본 강화/조력(+)  
3. 식상 → 1차 약화/설기(−)  
4. 재성 → 약화(−)  
5. 관성 → 1차 약화/극제(−)  
6. 비겁+인성 방향 묶음 허용 (작용·강도 분리)  
7. 식상+재성+관성 방향 묶음 허용 (기전·강도 분리)  
8. 월령 중요  
9. 통근·득지 중요  
10. 시간 미상 = 조건부·한계 처리  

→ Pilot C1·C2·C5와 **반복 agreement**.

---

## 8. 단순 개수·동일가중 — open disagreement

| Expert | Phase 1 stance |
|---|---|
| E1 | 단순 글자 수 < 합충회국 우선 |
| E2 | 생조−극설 **글자 수 감산 거부**; 개수 직접 점수화 반대 |
| E3 | 십신별 **차별 가중 점수제** (개인 제안) |
| E4 | 1차 **개수** 비교 허용 + 2차 자리 질 필수 |

Pilot U5(E1 원칙 미표명)는 Phase 1에서 E1이 더 명확해졌으나, **4인 단일 규칙으로 닫히지 않음**.  
엔진 동일 가중 확정·금지 규칙화 = **하지 않음**.

---

## 9. Strength에 조후·격용 혼합 — open disagreement

| Expert | Stance |
|---|---|
| E2 | 격·용·희 **명시 배제** |
| E4 | 세력에서 **격국 배제** (종격은 조건부 참고) |
| E3 | 5축에 **조후** 포함; 합충에 **희신·용신** 용어; 격·억부 후보 기술 |
| E1 | 학파란 조후·종격 참고; 세력 점수축 편입 문장 미기재 |

Pilot 범위 밖이었던 층이 Phase 1에서 **방법론 open**으로 표면화.  
Strength 엔진에 조후/용신 축을 넣는 결정 ≠ 본 aggregate 권한.

---

## 10. 재성 — 약화 방향과 작용 기제

| | 상태 |
|---|---|
| **방향** | Pilot·Phase 1 모두 **약화(−) 4/4** (반복 agreement) |
| **기제** | 여전히 분리: 소모(E2·E3) / 극루·재극인(E1) / 통제비용형 소모(E4). Pilot U4 **미해소** |
| Case | p1-04(재 강) → 4/4 weak lean; p1-05(재+인) → 4/4 strong lean — 기제 합의 없이도 방향 관찰은 가능 |

---

## 11. 편/정 — 방향과 강도 분리

| | Pilot | Phase 1 |
|---|---|---|
| 명시 “1차 방향 동일” | E3·E4 | E2·E4 명시; E1·E3 표/가중으로 동일 방향+강도차 시사 |
| 공백 | E1·E2 Phase A 미기재 (U6) | Pilot 대비 **축소** (E2 채움) |
| Case 06 | — | 편/정 축 설계였으나 실제 분기는 **자리vs개수**가 더 큼 |

**관찰:** “방향 유지 · 강도/역할 차이”는 partial → 거의 반복 합의에 가까움. 전면 동일 강도  Negation은 전원 명시.

---

## 12. 월령·통근·위치 가중 — 공통점과 차이

**공통 (4/4):** 월령 중요 · 통근/득지 중요 · 자리 질이 글자 이름만보다 중요.

**차이 (개인 제안; 규칙 아님):**
- E1: 월령 ≈30–40%, 절대 아님; 합충회국 우선  
- E2: 월령 선두이나 단독 절대값 거부; 통근 없으면 천간 숫자 불인정  
- E3: 12운성 득령/득지 **점수축** (±1.0 / ±0.7)  
- E4: **월 > 일 ≥ 지지 > 천**; 록·제왕·천간3자 예외  

Case 06·03·04에서 이 가중 차이가 **라벨 경계**로 드러남.

---

## 13. 시간 미상 처리 원칙

| | 내용 |
|---|---|
| Pilot 05 | 4/4 weak + 시주 uncertainty = **정상 조건부** (closure) |
| Phase 1 08 | 4/4 신약/극신약(삼주) + 시주 완화/유보 |
| 방법 | E3: 단일값 금지·시지 범위; E2: 방향 확신·정도 보류; E1·E4: 후보별 조건부·유보 |

**반복 확인:** 시주 미상은 테스트 실패가 아니라 **프로토콜 대상**.  
단일 “정답 등급” 강제 금지.

---

## Pilot unresolved → Phase 1 상태

| Pilot ID | Topic | Phase 1 status |
|---|---|---|
| U2 | Case 04 라벨 disagreement | p1-03은 **방향 strong 4/4**(라벨 갈림 미재현); **p1-06**이 새 open disagreement로 부각 |
| U3 | 시주 uncertainty | **반복 확인** (p1-08); 프로토콜 다양성은 유지 |
| U4 | 재성 기제 | 방향 반복 · **기제 open 유지** |
| U5 | 동일 가중/개수 | **open 유지** (입장 더 선명) |
| U6 | 편/정 | **부분 해소** (E2 명시); 강도 서열은 여전히 개인차 |
| U7 | Literature ≠ Expert | **유지** — 본 문서도 병합·VERIFIED 안 함 |

---

# REPEATED AGREEMENT

1. 비겁·인성 → 강화(+); 식상·재·관 → 약화(−) 거시 방향 (Pilot·Phase 1 방법론 4/4).  
2. 양대 방향 묶음 허용, 동일 작용·동일 강도는 아님.  
3. 월령·통근·자리 질 중시.  
4. Control형 감쇄 → weak, 생조 → strong (세트별 명식은 다름).  
5. 시주 미상 → weak 방향 + 조건부/유보 (Pilot 05 · Phase 1 08).  
6. 재성 **방향**은 약화 — 기제는 미합의.

---

# NEW PHASE-1 OBSERVATIONS

1. **p1-06** = Phase 1 핵심 **실질 disagreement** (질 vs 개수·충형).  
2. **DQ-1 / DQ-2** — agreement와 분리하는 운영 필요성 확인.  
3. Pilot 04형으로 넣은 **p1-03**은 라벨 open 재현 대신 **신강 쪽 방향 합의** (+ E3 득령 오염).  
4. **p1-04** 재다·인소 → 4/4 weak lean; **p1-05** 재+인 → 4/4 strong lean.  
5. 단순 개수: E2 거부 vs E4 1차 허용 vs E3 점수제 — Pilot보다 **대립 지도가 선명**.  
6. Strength∋조후·희용(**E3**) vs 격용 배제(**E2·E4**) — 새 open.  
7. 편/정 “방향 불변” 명시는 Pilot 공백(E2)이 Phase 1에서 채워짐.

---

# OPEN / UNRESOLVED

1. **p1-06** Strength 방향 (중화~신강 vs 신약~중화신약).  
2. 단순 개수·동일가중으로 최종 등급을 낼지.  
3. Strength 판단에 조후·격·용신 축을 넣을지.  
4. 재성 기제(소모 / 재극인 / 통제비용) 통일.  
5. 월령·록왕·통근의 **상대 가중 수치** (개인 제안만 존재).  
6. 시주 미상: 범위 점수 vs 방향만·정도 보류 — 프로토콜 단일화 여부.  
7. Literature PARTIAL/CONTESTED ↔ Expert 방향 agreement — **별층 유지**, VERIFIED 금지.  
8. STR-010/011 freeze · 엔진 점수/가중 변경 — **금지·미실시**.

---

# DATA-QUALITY ISSUES

| ID | Severity | Case / Expert | Action for analysis |
|---|---|---|---|
| DQ-1 | 확정 | p1-02 / E3 일간 甲→庚 | agreement **제외** |
| DQ-2 | 확정 | p1-03 / E3 월지 丑→寅 득령 | 방향 OK · **근거 오염** |
| DQ-3 | 경미 | p1-02 / E1 차트 일지 | 판정 유효 |
| DQ-4 | 경미 | p1-05 / E1 차트 년지 | 판정 대체로 유효 |
| DQ-5 | 메모 | E3 만세력 의문 | 오독 아님 |

---

## 하지 않은 것

- raw 수정 · comparison 파일 수정  
- STR-010/011 VERIFIED / freeze / literature verdict 변경  
- expected · 엔진 규칙·점수·가중치  
- 다수결 = 정답 · Wave 2
