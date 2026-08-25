# STR-010/011 Post-Validation Rule Audit

**목적:** Pilot + Phase 1 expert validation 경계를 기준으로, 현재 STR 규칙·inventory·Strength 구현의 충돌 지점을 **조사만** 한다.  
코드·STR·가중치·VERIFIED·freeze를 변경하지 않는다. unresolved를 임의 해결하지 않는다.

**근거:**
- `phase-1-results/phase1-closure.md`
- `validation/strength-audit/strength-rule-inventory.json` (STR-010/011/012/007/066 등)
- `interpretive-validation-priority-audit/interpretive-rule-inventory.json`
- `wave1-literature-validation/final-audit` (STR-010 PARTIALLY-SUPPORTED · STR-011 CONTESTED)
- `elements/strength.ts`, `elements/strengthSummary.ts`
- Probe (읽기 전용 실행): p1-06 · p1-08 pillars → `buildStrengthSummary`

**분류:** ALIGNED | CONFLICT | UNRESOLVED IMPLEMENTATION | NOT IMPLEMENTED

---

## 요약

| # | 항목 | 분류 |
|---|---|---|
| 1 | 비겁·인성 강화 방향 | **ALIGNED** |
| 2 | 식상·재·관 약화 방향 | **ALIGNED** |
| 3 | 묶음 내 동일 가중 처리 | **CONFLICT** |
| 4 | 단순 글자 수 합산 | **ALIGNED** (미사용) |
| 5 | 월령·통근·투출 처리 | **ALIGNED** (방향 중시) / 수치는 NV |
| 6 | 재성 감쇄 메커니즘 | **NOT IMPLEMENTED** (유형 분리) · 방향은 pressure 묶음 |
| 7 | 편/정 고정 차등값 | **ALIGNED** (차등 없음 = STR-012) |
| 8 | 합충·조후·격·용 → Strength 점수 | **ALIGNED** (점수·혼합 없음) |
| 9 | 시간 미상 단일 Strength 확정 | **CONFLICT** |
| 10 | Case 06형 경계 처리 | **UNRESOLVED IMPLEMENTATION** |

**CONFLICT 개수: 2** (항목 3, 9)

---

## 1. 비겁·인성 강화 방향 — ALIGNED

| | |
|---|---|
| **규칙** | STR-010: 비견·겁재·편인·정인 → `support` (`strength-rule-inventory.json`, `interpretive-rule-inventory.json`) |
| **코드** | `strength.ts` `SUPPORT_SHI_SHEN`; `strengthSummary` → `strongSideEvidence` / rootedSupport |
| **Expert** | ES-1: 강화(+) 방향 4/4 (Pilot+Phase 1) |
| **Literature** | STR-010 **PARTIALLY-SUPPORTED** / MEDIUM |

방향 일치. (동일 강도·수치 가중은 본 항목 밖 → §3.)

---

## 2. 식상·재·관 약화 방향 — ALIGNED

| | |
|---|---|
| **규칙** | STR-011: 식신·상관·편재·정재·편관·정관 → `pressure` |
| **코드** | `PRESSURE_SHI_SHEN`; `weakSideEvidence` / rootedPressure |
| **Expert** | ES-2: 약화(−) 거시 4/4 |
| **Literature** | STR-011 **CONTESTED** / MEDIUM |

거시 방향은 expert와 일치. Literature CONTESTED는 **묶음·기제 해석** 리스크(아래 §3·§6)와 정합. 방향 ALIGNED와 CONTESTED 문헌 상태는 공존한다 (closure: 별층).

---

## 3. 비겁+인성 / 식상+재+관 동일 가중 — CONFLICT

### 현재 규칙/코드 위치
- STR-010/011: side 묶음만 정의; `evidenceIgnored: ["정/편 가중"]`
- STR-012 (FROZEN-POLICY): 「정/편은 relation-side만. 추가 가중 없음」
- `strength.ts`: support/pressure **세트 멤버십만** (유형별 weight 필드 없음)
- `strengthSummary.decideDirection`: `rootedSupport` / `rootedPressure` **boolean** — 비겁 vs 인성, 식상 vs 재 vs 관 **강도 미분 없음**

### 현재 동작
같은 side면 (rooted-visible 여부만 구분하고) peer=resource, output=wealth=official로 **같은 논리 기여**. 수치 score는 없으나 **동일 취급**.

### Expert observation과의 차이
- Closure ES-4 / NV-1: 방향 묶음 ≠ 실제 작용량·**동일 가중 미검증**
- Phase 1 method open: E2 개수 감산 거부 · E4 1차 개수+자리 · E3 차별 점수 — **엔진의 side-내 균등 boolean은 미검증 정책을 구현 중**

### Literature
- STR-010 PARTIALLY-SUPPORTED · STR-011 **CONTESTED** (일괄 pressure/support 해석 HIGH-RISK)
- STR-012는 ENGINE-POLICY freeze — 명리 VERIFIED 아님

**판정: CONFLICT** — expert가 “동일 가중 미검증”으로 닫은 경계를, 엔진이 side-내 균등 처리로 운용.

---

## 4. 단순 글자 수 합산 — ALIGNED (미사용)

| | |
|---|---|
| **코드** | score/weight/count-sum **없음** (`strengthAudit.structure.test` 등 금지 필드). `decideDirection`은 boolean OR/AND |
| **Expert** | NV-2: 단순 개수 합산으로 최종 등급 **NOT validated** |
| **Literature** | score 금지 정책과 일치 |

엔진이 단순 합산 점수를 쓰지 않음 → 금지 관행을 **구현하지 않음** = ALIGNED.  
(§3의 “균등 boolean” 충돌과 별개.)

---

## 5. 월령·통근·투출 — ALIGNED (중시) / 수치는 NOT validated

| 축 | 구현 |
|---|---|
| 월령 | `seasonalEvidence` / `labelStemSeasonPhase` → phase 왕·상·휴·수·사 (`STR-004` lookup + STR-022/024 해석) |
| 통근 | `analyzeStemRoots` → `rootQuality` clear/present/shallow/absent |
| 투출 | visible stem support/pressure + `presence` rooted/unrooted (`STR-006`/`STR-021`) |

| | |
|---|---|
| **Expert** | ES-3 월령·통근 중시 4/4; NV-5 수치 우선순위 단일 스케일 NOT validated |
| **Literature** | STR-022/024 PARTIAL; STR-030-* PARTIAL/CONTESTED |

**판정:** 축 존재·중시 = **ALIGNED**. 30–40%·월>일 수치표 = **NOT IMPLEMENTED** (의도적; NV-5).

---

## 6. 재성 감쇄 메커니즘 — NOT IMPLEMENTED (유형 분리)

| | |
|---|---|
| **동작** | 편재·정재 → `pressure`만. 소모/재극인/통제비용 **분기 없음**. 감점 점수 없음 |
| **Expert** | 방향 약화 합의 · 기제 단일화 NV-4 / open |
| **Literature** | STR-011 CONTESTED (일괄 pressure) |

**판정: NOT IMPLEMENTED** — 재성 전용 메커니즘 없음. 방향만 STR-011 묶음에 편입 (§2 ALIGNED와 병기).

---

## 7. 편/정 고정 차등값 — ALIGNED

| | |
|---|---|
| **규칙** | STR-012: 추가 가중 없음 · 동일 side |
| **코드** | 정관=편관, 식신=상관 등 **고정 −δ 없음** |
| **Expert** | 1차 방향 동일에 가까움; **고정 강도차 NV-3** |
| **Literature** | STR-012 FROZEN-POLICY (명리 정답 아님) |

고정 차등값을 **두지 않음** = NV-3와 충돌하지 않음 → **ALIGNED**.

---

## 8. 합충·조후·격국·용신 → Strength 점수 — ALIGNED

| | |
|---|---|
| **코드** | Strength에 score 없음. 합충·조후·격·용신 필드 없음 (`strength-freeze-boundary`: mixedPattern ≠ 용신) |
| **조후** | CLI-* 별층 (Climate); Strength `decideDirection` 입력 아님 |
| **Expert** | NV-7: Strength에 조후·격·용 편입 방식 NOT validated; E2·E4 배제 지향 |
| **Literature** | CLI와 STR 분리 유지 |

**판정: ALIGNED** — Strength 점수에 섞지 않음. (E3 개인 점수제와는 엔진이 다름 = 미채택, CONFLICT로 승격하지 않음.)

---

## 9. 시간 미상 단일 Strength 확정 — CONFLICT

### 현재 규칙/코드 위치
- STR-007: hour 생략 · `certainty=partial` · 가짜 시주 금지
- STR-066: `null && hourUnknown` → `hour-unknown-sensitive` (방향이 **이미 null일 때** 민감 표시)
- `strengthSummary.ts`: `certainty: hourUnknown ? "partial" : "complete"` 후에도 `decideDirection`이 조건 충족 시 **`leaning-weak` / `leaning-strong` + `resolution: clear-direction`** 가능
- Probe **p1-08** (辛丑 辛丑 乙酉 / hour unknown):  
  `directionCandidate: leaning-weak`, `resolution: clear-direction`, `certainty: partial`

### 현재 동작
시주 후보는 안 만들지만, 삼주 evidence만으로 **단일 directionCandidate를 clear-direction으로 닫을 수 있음**.

### Expert observation과의 차이
- Pilot 05 · Phase 1 08 · Closure ES-5: weak 방향 + **조건부/유보**; E3는 단일값 금지·범위
- Expert는 “방향 힌트 + 시주 한계”를 말함. 엔진은 `clear-direction`까지 부여 가능

### Literature / policy
- STR-007/066 FROZEN-POLICY. freeze-boundary 문구(“약/강으로 만들지 않음”)는 **코드가 항상 지키는 것은 아님** (조건 충족 시 leaning-* 생성)

**판정: CONFLICT** — 시간 미상에서도 단일 leaning + clear-direction 확정 가능 vs expert 조건부/유보 경계.

---

## 10. Case 06형 경계 — UNRESOLVED IMPLEMENTATION

### Probe (p1-06: 己亥 丙子 癸卯 戊午)
| 필드 | 값 |
|---|---|
| seasonalPhase | 왕 |
| rootQuality | clear |
| visible support stems | [] |
| visible pressure | 己편관·丙정재·戊정관 (모두 rooted-visible) |
| directionCandidate | **mixed** |
| mixedPattern | **strong-base-with-pressure** |
| conflicts | 왕·clear root + rooted pressure 동시 |

### Expert
- Open disagreement: E1·E2 중화~신강 ↔ E3·E4 신약~중화신약 (NV-8 정답 없음)

### 해석
엔진은 강/약 중 하나를 고르지 않고 **mixed**로 둠.  
다수결 정답과도, E1/E2 또는 E3/E4 단일 라벨과도 **1:1 매핑 정책 없음**.

**판정: UNRESOLVED IMPLEMENTATION** — 경계 구조를 mixed로 표시하나, expert open과의 대응 규칙·제품 의미 미정. (임의로 ALIGNED/CONFLICT 확정하지 않음.)

---

## CONFLICT 상세 롤업

### C-A. Side-내 동일 취급 (§3)
- **위치:** STR-010/011/012 + `strength.ts` sets + `decideDirection` booleans  
- **동작:** support/pressure 내부 유형 균등  
- **Expert:** 동일 가중 NOT validated · 묶음≠작용량  
- **Literature:** STR-011 CONTESTED · STR-010 PARTIAL  

### C-B. Hour-unknown clear-direction (§9)
- **위치:** STR-007/066 + `buildStrengthSummary` certainty/direction  
- **동작:** 예) p1-08 → leaning-weak + clear-direction + partial  
- **Expert:** 시 미상 = 조건부·정도 유보  
- **Literature/policy:** FROZEN-POLICY; 문서·코드 긴장 가능  

---

## 하지 않은 것

- 코드·STR·inventory verdict·freeze 수정  
- 새 공식·가중치·threshold  
- Case 06 / 동일가중 unresolved **해결**  
- VERIFIED 승격 · Wave 2
