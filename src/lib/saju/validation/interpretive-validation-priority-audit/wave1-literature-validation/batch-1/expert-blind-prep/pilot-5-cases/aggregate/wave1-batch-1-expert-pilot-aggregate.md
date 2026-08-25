# STR-010 / STR-011 Expert Pilot — 4인 Aggregate

엔진 코드·STR-010/011 verdict·freezeStatus는 이 문서로 바꾸지 않는다.  
expected를 만들지 않는다. majority를 정답으로 해석하지 않는다.  
VERIFIED / 확정 표현을 쓰지 않는다. Wave 2로 진행하지 않는다.

**목적:** E1~E4 Blind Pilot raw를 **원문 기반**으로 비교 집계한다.  
**문헌 결과와 Expert Pilot 결과는 분리**한다.

---

## A. Corpus

| Expert ID | raw path | note |
|---|---|---|
| E1 | `raw/E1-raw.md` | 기존 `PENDING-second-paste-raw.md`와 **동일 원문**. E1로 확정·파일명만 정리. 답변 본문 미변경. |
| E2 | `raw/E2-raw.md` | 미수정 |
| E3 | `raw/E3-raw.md` | 미수정 |
| E4 | `raw/E4-raw.md` | 미수정 (4/4 전문) |

집계는 observation / agreement / disagreement만 기록한다.

---

## B. Literature vs Expert Pilot (분리)

| 층 | STR-010 | STR-011 | 비고 |
|---|---|---|---|
| Literature (Batch 1 + hardening) | PARTIALLY-SUPPORTED / MEDIUM | CONTESTED / MEDIUM | 이 문서에서 **변경 없음** |
| Expert Pilot (본 aggregate) | 아래 observation | 아래 observation | literature verdict를 덮어쓰지 않음 |

Expert Pilot은 literature를 닫거나 VERIFIED-FACT로 승격하지 않는다.

---

## C. 개념 비교표 (원문 기반)

### C1. 비겁+인성 → 강화(+) 방향

| ID | raw observation | 방향 동의 |
|---|---|---|
| E1 | 「생조 세력… 비견·겁재·정인·편인 → …플러스(+)」 | YES |
| E2 | 판단 프레임 「생조군(비겁+인성)」 | YES (프레임) |
| E3 | 「비겁 + 인성 = 일간 생조측」, Phase B + | YES |
| E4 | A-7 「가능… 둘 다 조력」; 묶음 B | YES |

**agreement:** 4/4 방향 동의 (강화/생조).  
**disagreement:** 없음 (방향). 단 E3·E4는 메커니즘(동기 vs 생) 분리를 병기.

### C2. 식상+재성+관성 → 약화(−) 방향

| ID | raw observation | 방향 동의 |
|---|---|---|
| E1 | 「소모·극제… 식신·상관·정재·편재·정관·편관 → …마이너스(−)」 | YES |
| E2 | 「탈기군(식상+재+관)」 | YES (프레임) |
| E3 | 「극설소모측」로 묶음 가능, 계산은 분리 | YES (방향) / 계산 분리 |
| E4 | A-6 「거시적으로 가능… 셋 다 세력 감소」; 財는 조건부 | YES (방향) / 財 분리 |

**agreement:** 4/4 거시 약화 방향.  
**disagreement (기제):** E3·E4는 식상=설 / 재=소모·파인 / 관=극제로 분리. E4는 인성 없으면 재 ≈ 중립. E1·E2는 탈기/감소 묶음으로 더 단순하게 사용.

### C3. 동일 가중 / 단순 개수 합산

| ID | raw observation |
|---|---|
| E1 | Case 01에서 「수적으로 압도」 언급. 동시에 득령·득지 서술. 동일 가중 **명시적 허용/거부 없음** |
| E2 | 「기계적 개수 합산」만으로는 놓침; 월지·일지 가중 > 천간 |
| E3 | 「십신 개수 자체가 세력은 아님」; 고정점수(+2/−2) 반대 |
| E4 | B-3 「묶음 총량만으로 최종 등급… 불가」; 위치·통근·월령 가중 |

**agreement:** E2·E3·E4 (3/4) — 단순 동일 가중/개수 합산만으로 최종 등급 **불가**.  
**insufficient / unclear:** E1 (1/4) — 개수 언어 사용하나 원칙 미표명.  
**다수결 ≠ 정답.** observation만.

### C4. 편/정 차이

| ID | raw observation |
|---|---|
| E1 | 미언급 |
| E2 | 미언급 (십신 환산에 정/편 라벨은 사용) |
| E3 | 「정·편의 차이는 일간 세력의 1차 방향을 바꾸지 않는다」 |
| E4 | 정재·편재 「방향 차이 없고 강도 차이만 미미」; 칠살>정관; 편인=생+도식 |

**agreement:** 명시 응답자(E3·E4)는 **1차 방향은 정/편 동일**.  
**disagreement:** 강도·역할(칠살 vs 정관, 편인 도식)에서 E4가 더 세분. E1·E2는 Phase A 미기재 → not comparable on this axis.

### C5. 월령·통근·위치·투출 중요도

| ID | raw observation |
|---|---|
| E1 | 득령·득지·투간을 근거에 사용 |
| E2 | (1) 월지·일지 소속 (2) 천간 < 지지 뿌리 (3) 천간 복수 식상 감점 큼 |
| E3 | 「십신은 방향… 월령·통근·위치·생극이 작용량」 |
| E4 | 득령 최대 가중; 통근·투출·합충 체크리스트 |

**agreement:** 4/4 — 월령·통근·위치/투출을 단순 십신 개수보다 중요하게 봄 (표현 강도는 상이).

---

## D. Pilot 01~05 Strength 집계

방향 코드 (집계용 태그만; 정답 아님):  
`weak` = 신약 계열 · `strong` = 신강 계열 · `neutral` = 중화 계열.  
등급 문자열은 raw 원문 유지.

### D1. Case 01 — 壬寅 癸丑 庚辰 壬午

| ID | raw Strength |
|---|---|
| E1 | 신약 ~ 중화약 |
| E2 | 신약 |
| E3 | 신약 (극신약 아님) |
| E4 | 신약 — 편약 |

**direction:** 4/4 `weak`  
**grade disagreement:** 중화약 경계(E1) vs 편약(E4) vs 단순 신약(E2·E3) — 방향은 수렴, 세등급은 갈림.

### D2. Case 02 — 己卯 丙子 戊午 戊午

| ID | raw Strength |
|---|---|
| E1 | 태강 ~ 극왕 (극신강) |
| E2 | 태강~극왕 |
| E3 | 신강 |
| E4 | 신강 — 편강 |

**direction:** 4/4 `strong`  
**grade disagreement:** 극왕/태강(E1·E2) vs 편강(E4) vs 신강(E3). 실령·子午沖 감점 반영 여부에서 강도 차이.

### D3. Case 03 — 庚子 庚辰 丁丑 丙午

| ID | raw Strength |
|---|---|
| E1 | 신약 |
| E2 | 신약(뚜렷) |
| E3 | 신약 |
| E4 | 신약 — 편약 |

**direction:** 4/4 `weak`  
**grade:** 대체로 수렴; E2가 “뚜렷” 강조.

### D4. Case 04 — 乙酉 甲申 丙辰 甲午 — **별도 disagreement**

| ID | raw Strength | direction tag |
|---|---|---|
| E1 | 중화 ~ 중화신강 | neutral → strong lean |
| E2 | 애매; 개인적으로 중화~신약 쪽 무게 (중화신강도 성립 가능) | neutral → weak lean (+ explicit split) |
| E3 | 신약 (중화에 더 가까운 신약) | weak (near neutral) |
| E4 | 중화 (기울면 편약) | neutral → weak lean |

**observation:**  
- 전원 교차 구조(인성 투출·午 근 vs 申월 실령·재성)를 인정.  
- **최종 라벨 disagreement:** 중화신강 쪽(E1) ↔ 신약/중화~신약(E2·E3·E4).  
- E2는 판단자 갈림을 raw에서 명시.  
**majority를 정답으로 쓰지 않음.** Case 04는 Pilot observation상 **open disagreement**.

### D5. Case 05 — 戊辰 辛酉 乙亥 / 시주 미상 — **별도 uncertainty**

| ID | raw Strength | 시주·시간 미상 명시 |
|---|---|---|
| E1 | 극신약 (시주 비겁/인성 미보강 시) | YES — 시주 조건 |
| E2 | 극신약에 가까운 신약; 시주 보강 없으면 극신약 가능 | YES |
| E3 | 신약(잠정); 시주 미상으로 등급 보류 여지 큼; 야간 일주 변동 시 재판정 | YES |
| E4 | 신약 — 차약 / 시주별 중화~차약; 자시환일 시 일주 재구성 | YES |

**direction (삼주 기준):** 4/4 `weak`  
**uncertainty:** 4/4가 시주 미상 또는 시주 조건·일주 경계 불확실성을 **명시**.  
**grade disagreement:** 극신약(E1·E2) vs 신약 잠정(E3) vs 차약+변동범위(E4).

---

## E. 조건부 / 유보

| 주제 | 누가 | raw 요지 (요약 태그만; 원문은 raw 파일) |
|---|---|---|
| Case 04 애매/갈림 | E2·E3·E4 | 교차 구조; E2 명시적 개인 견해 분기 |
| Case 05 시주 | E1~E4 | 전원 조건부 또는 잠정 |
| Case 05 야간 일주 | E3·E4 (+ E1 안내 전제와 정합) | 일주 변동 시 별 명식 |
| 묶음≠동일강도 | E2·E3·E4 | 스크리닝 vs 최종 분리 |
| 재성 조건부 | E4 (E3는 소모 기제 분리) | 파인/인성 유무 |

---

## F. STR-010 / STR-011 — Pilot으로 말할 수 있는 / 없는 범위

### 말할 수 있는 범위 (Pilot observation)

1. 비겁·인성을 세력 **강화(+)** 쪽으로 두는 방향 — 본 4인 raw에서 **방향 agreement 4/4**.  
2. 식상·재·관을 세력 **약화(−)** 쪽으로 두는 거시 방향 — **방향 agreement 4/4** (재성 기제는 예외·조건부 논의 있음).  
3. 월령·통근·위치·투출이 단순 십신 개수보다 중요하다는 **방법론 agreement**.  
4. Case 01·02·03은 **방향 수준**에서 4인 수렴 (01·03 weak, 02 strong).  
5. Case 05는 **weak 방향 + 시주 uncertainty**가 공통.

### 아직 말할 수 없는 범위

1. STR-010/011을 literature에서 SUPPORTED·VERIFIED로 올릴지 — **본 Pilot이 결정하지 않음**. literature 상태 유지.  
2. 엔진 `support`/`pressure` 동일 가중·개수 합산이 타당한지 — 3인 이상 거부/한계, E1 불명 → **규칙 확정 아님**.  
3. 편/정 동일 취급의 전면 합의 — E1·E2 Phase A 공백.  
4. Case 04 최종 Strength 라벨 — **open disagreement**.  
5. Case 05 최종 등급(극약 vs 차약 등) — uncertainty로만 기록.  
6. 격국·용신·Needed Element — Pilot 범위 밖.

---

## G. Unresolved

| id | issue |
|---|---|
| W1B1-EP-U1 | E1 provenance 파일명 — **resolved** (`raw/E1-raw.md`; 구 PENDING과 동일 본문) |
| W1B1-EP-U2 | Case 04 Strength 라벨 open disagreement |
| W1B1-EP-U3 | Case 05 시주 미상·야간 일주 uncertainty |
| W1B1-EP-U4 | 재성 약화 기제(소모 vs 파인조건부 vs 탈기 일괄) disagreement |
| W1B1-EP-U5 | 동일 가중/개수 합산 — E1 원칙 미표명 |
| W1B1-EP-U6 | 편/정 — E1·E2 명시 답 부족 |
| W1B1-EP-U7 | Literature CONTESTED/PARTIAL과 Expert 방향 agreement의 관계 — 별층 유지, 병합 금지 |

---

## H. 하지 않은 것

- E1~E4 raw 수정  
- STR-010/011 verdict / freezeStatus 변경  
- expected 생성  
- 엔진·점수·가중치·새 명리 규칙  
- Wave 2  
- majority = 정답 해석
