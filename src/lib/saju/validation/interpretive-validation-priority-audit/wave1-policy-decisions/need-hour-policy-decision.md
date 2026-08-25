# CL-NEED-HOUR 정책 결정 준비

**Cluster:** CL-NEED-HOUR  
**Items:** D01, D02, D03, E04  
**목적:** Wave 2 진입 전, 시간 미상일 때 Need가 어디까지 진행될 수 있는지 **정책 선택지를 정리**한다.  
**범위:** 이미 확보한 evidence + 현재 구현만. 추가 설문·Wave 1 재검증·코드 적용·VERIFIED·Wave 2 착수 없음.

**근거 출처 (읽기 전용):**
- `wave1-literature-validation/wave1-policy-unresolved-registry.md` (+ `.json`)
- G1 `post-validation-conflict-closure.md`, `conflict-2-unknown-time-audit.md`
- `strengthSummary.ts` (`directionSensitivityOf`, `resolutionOf`, certainty)
- `needCandidates.ts`, `needResolution.ts`
- Need / Need-resolution audit·open questions, `strength-freeze-boundary.md`

---

## Cluster 한줄 요약

| ID | 한줄 |
|---|---|
| **D01** | hour unknown + leaning-*에서 Need가 `ready`로 열리는가 |
| **D02** | `directionSensitivity=hour-unknown-provisional`인데 후보를 그대로 노출하는가 |
| **D03** | freeze 문구(“약/강 만들지 않음”) vs STR-050/051 leaning 코드 간 POLICY-GAP |
| **E04** | 사용자 출력에서 시간 미상 결과를 확정 / 잠정 / 보류 중 무엇으로 표시하는가 |

공통 사실: Wave 1은 **시주 미상 = 불완전·잠정 가능**까지 speakable. Need 게이트·용어·UX는 **정책 미결**이며 Wave 2를 막는다.

---

## Q1. hour unknown + leaning-*일 때 `strengthNeedStatus=ready`를 허용할 것인가

### 현재 구현

- `needCandidates.ts`: `directionCandidate`가 `leaning-weak` / `leaning-strong`이면 **`strengthNeedStatus = "ready"`**.
- `hourUnknown`, `certainty`, `directionSensitivity`, `resolution`을 **보지 않음**.
- `needResolution.ts`: `strengthNeedStatus === "unresolved"`만 Strength Need 축을 차단. **`partial` ≠ unresolved** (RES-041 / NEED-053 계열).
- 결과: 시간 미상 + leaning → Strength Need **진행 가능(ready)**.

### 현재 evidence boundary

- **말할 수 있음:** 시주 미상은 불완전; Strength 방향 leaning은 잠정 가능(G1 / C2).
- **말할 수 없음 / 미결:** leaning이 Need `ready`를 정당화하는지; freeze “방향을 약/강으로 만들지 않음”(STR-007 계열 문구)과 leaning·Need ready의 관계.
- Post-validation **C2-A**: `directionSensitivity`는 **진단 메타**; 당시 Need 동작은 **변경하지 않음** → 정보 손실은 줄였으나 D01 게이트는 열림 상태로 남음.
- `conflict-2-unknown-time-audit`: RISK — leaning → clear-direction + Need ready가 **시주 민감도를 삼킬** 수 있음. STR-066은 `direction===null` 쪽에 가깝게 동작.

### 선택지

| | 내용 |
|---|---|
| **A** | **허용 유지** — hour unknown + leaning → `ready` (현행) |
| **B** | **비허용** — hour unknown + leaning → `ready` 금지 (`unresolved` 또는 전용 hold/provisional status) |
| **C** | **조건부** — leaning은 유지하되 Need는 `ready`가 아닌 별도 상태(예: `provisional-ready`)만 허용; Resolution은 Strength Need 축을 기본 차단 |

### 장단점

| | 장점 | 단점 |
|---|---|---|
| **A** | 구현·테스트 최소 변경; NEED-053/RES-041과 일치; C2-A “Need 유지”와 연속 | Wave 2 게이트 미해소; audit RISK 잔존; D03 freeze 문구와 긴장 |
| **B** | CL-NEED-HOUR 핵심 게이트 명확; provisional Strength와 Need 확정 분리 | Need 경로 축소; “잠정 방향” UX와 제품 기대 재정렬 필요 |
| **C** | 정보(방향)와 행동(Need 확정) 분리 가능 | 새 status/계약 → 타입·Resolution·UI 연쇄; 용어 설계 비용 |

### Downstream 영향

- **A:** Wave 2가 Need/Resolution을 “시간 미상에도 확정 가능” 전제로 설계할 위험.
- **B/C:** `needCandidates` → `needResolution` → 상담/가사 메시지 파이프가 Strength Need를 덜 또는 다르게 소비. E04 UX와 반드시 묶여야 함.

---

## Q2. `directionSensitivity=hour-unknown-provisional`이면 Need 후보를 그대로 노출할 것인가

### 현재 구현

- `strengthSummary.ts`: `hourUnknown && (leaning-weak|leaning-strong)` → `directionSensitivity = "hour-unknown-provisional"`.
- Need 계층은 **`directionSensitivity`를 읽지 않음**.
- 노출 = leaning이면 후보 생성 + `ready` (Q1-A와 동일 경로).

### 현재 evidence boundary

- **말할 수 있음:** provisional 메타로 Strength 쪽 정보 손실은 완화됨(C2-A / registry).
- **말할 수 없음:** provisional 메타가 Need **노출 억제**를 의미하는지. D02 = “메타만 있고 게이트 없음”.
- 전문가 경계: 시주 미상 불완전 ≠ “Need 후보 UI/파이프 금지”를 직접 검증하지 않음.

### 선택지

| | 내용 |
|---|---|
| **A** | **그대로 노출** — provisional이어도 후보·ready 경로 동일 (현행) |
| **B** | **비노출 / 게이트** — `hour-unknown-provisional`이면 Strength Need 후보 미생성 또는 Resolution에서 축 차단 |
| **C** | **노출하되 표시만 분기** — 후보는 보이되 “잠정” 배지/카피만; `ready`는 Q1과 별도 결정 |

### 장단점

| | 장점 | 단점 |
|---|---|---|
| **A** | C2-A와 일치; 엔지니어링 단순 | D02 미결 = Wave 2 차단 사유 유지; 사용자가 확정 Need로 오해 |
| **B** | sensitivity가 실제 게이트가 됨; Q1-B와 정합 | “잠정 방향은 있는데 Need는 없다” 제품 설명 필요 |
| **C** | 정보 보존 + 오해 완화 | `ready`를 유지하면 Resolution이 여전히 진행 → E04/Q1과 불일치 가능 |

### Downstream 영향

- **B:** UI·리포트·가사 Need 주입이 Strength 축을 스킵하거나 hold.
- **C:** 표시 레이어만 바꾸면 엔진 계약은 그대로 → **정책상 “노출” 정의(엔진 vs UX)를 문서에 명시**해야 Wave 2가 헷갈리지 않음.

---

## Q3. `partial` + `clear-direction`이라는 resolution 용어를 유지할 것인가

### 현재 구현

- `certainty`: `hourUnknown`이면 항상 **`partial`** (방향과 무관, STR-067 계열).
- `resolutionOf(leaning-*)` → **`clear-direction`** (시주 유무 무관).
- 조합 예: hour unknown + leaning → **`certainty=partial` + `resolution=clear-direction` + `directionSensitivity=hour-unknown-provisional`**.
- Need는 `partial`/`clear-direction`을 게이트에 쓰지 않음.

### 현재 evidence boundary

- **말할 수 있음:** certainty = 입력 완전성; resolution 라벨은 엔진 내부 계약; partial이 Need를 막지 않는 것이 **현행 의도**(NEED-053, RES-041).
- **말할 수 없음 / 긴장:** `clear-direction`이 사용자·운영자에게 “방향 확정”으로 읽힘 vs provisional sensitivity; D03 freeze “약/강 만들지 않음” vs leaning + clear-direction.
- Wave 1은 이 용어 쌍의 **제품 의미**를 확정하지 않음.

### 선택지

| | 내용 |
|---|---|
| **A** | **유지** — `partial` + leaning 시 `clear-direction` 유지; provisional은 `directionSensitivity`에만 |
| **B** | **분리** — hour unknown + leaning 시 resolution을 `clear-direction`이 아닌 값으로 변경(예: `provisional-direction` / `leaning-provisional`); `partial`은 유지 |
| **C** | **이중 계약** — 엔진 enum은 유지하되, **speakable/UX 매핑 테이블**에서만 “잠정 방향”으로 번역; 코드 enum 변경 없음 |

### 장단점

| | 장점 | 단점 |
|---|---|---|
| **A** | 테스트·타입 안정; C2-A 최소 침습 | 이름과 직관 불일치; D03 문서 긴장 지속 |
| **B** | 내부 용어가 정책 의도와 정렬; Q1/Q2 게이트와 연동 쉬움 | enum·테스트·문서 광범위; “resolution” 의미 재교육 |
| **C** | 엔진 안정 + 오해 완화; Wave 2 전 빠른 문서 합의 가능 | 매핑 누락 시 다시 확정처럼 노출; 이중 진실 위험 |

### Downstream 영향

- **B:** `strengthSummary` resolution 소비처·감사 문서·테스트 fixture.
- **C:** 카피/리포트/운영 가이드만; 엔진은 Q1/Q2에서 게이트하지 않으면 Need는 여전히 ready.

---

## Q4. 사용자 출력에서 시간 미상 결과를 확정 / 잠정 / 보류 중 무엇으로 표시할 것인가

### 현재 구현

- Strength: leaning + `directionSensitivity=hour-unknown-provisional` + `certainty=partial` + `resolution=clear-direction`.
- Need: leaning이면 **ready** — 출력 파이프가 “확정 Need”처럼 소비하기 쉬움.
- **제품 UX 단일 라벨(확정/잠정/보류)은 엔진에 고정되어 있지 않음** (E04 = 미결).

### 현재 evidence boundary

- **말할 수 있음:** 시주 미상 = 불완전; Strength leaning = **잠정 가능**(G1 speakable).
- **말할 수 없음:** Need·최종 멘트까지 “확정”인지; “보류”가 direction null에만 해당하는지 leaning에도 해당하는지.
- Registry: 사용자 표시 정책이 Wave 2 차단 사유 중 하나(E04).

### 선택지

| | 내용 |
|---|---|
| **A** | **확정** — 시간 미상이어도 leaning·Need를 확정 톤으로 표시 (현행에 가깝게 읽힐 위험) |
| **B** | **잠정** — Strength 방향·Need 후보 모두 “시간 미상 잠정”으로 표시; 입력 보완 시 재평가 가능 안내 |
| **C** | **보류** — Strength leaning은 내부만 / 또는 Need·최종 해석은 표시 보류; “시주를 알면…” CTA |

### 장단점

| | 장점 | 단점 |
|---|---|---|
| **A** | 카피 단순 | Wave 1 evidence·provisional 메타와 충돌; 오해·신뢰 리스크 |
| **B** | evidence(“잠정 가능”)와 정합; Q2-C/Q1-C와 조합 용이 | “잠정인데 왜 Need가 나왔나” 설명 필요 → Q1/Q2와 패키지 필수 |
| **C** | 가장 보수적; freeze 문구와 친화 | 정보 과소; leaning 진단 가치 버림 |

### Downstream 영향

- 상담/인생곡/리포트 카피, MY·결과 화면, “태어난 시간을 몰라요” 플로우 CTA.
- Q1–Q3과 **한 패키지**로 고정하지 않으면 Wave 2가 레이어마다 다른 말을 씀.

---

## 추천 정책안 (코드 미적용 · 합의용 1안)

**패키지명: Provisional Strength, Gated Need**

| 질문 | 추천 | 요지 |
|---|---|---|
| **Q1** | **B** (필요 시 C로 이행) | hour unknown + leaning → **`strengthNeedStatus=ready` 비허용**. 단기: `unresolved`(또는 hold). 중기: 전용 `provisional` status(C) 검토. |
| **Q2** | **B** | `directionSensitivity=hour-unknown-provisional`이면 Strength Need 후보 **비노출 또는 Resolution에서 Strength Need 축 차단**. 메타가 실제 게이트. |
| **Q3** | **C → (합의 후) B** | 당장 enum 대수술 없이 **speakable 매핑(C)**: hour-unknown-provisional = “잠정 방향”, `clear-direction`을 사용자에게 “확정”으로 번역하지 않음. 게이트 적용 후 resolution 라벨을 `provisional-direction` 등으로 **정리(B)**는 후속 정리 작업. |
| **Q4** | **B** | 사용자 출력 **잠정**. 보류(C)는 `directionCandidate=null` 또는 Need 게이트 걸린 Strength 축에 한함. 확정(A) 금지. |

**이 안이 Wave 1 evidence와 맞는 이유**
- Strength leaning + provisional 메타 유지 → C2-A / “잠정 가능” 보존.
- Need ready 차단 → conflict-2 RISK·D01/D02·Wave 2 게이트 해소 방향.
- freeze “약/강으로 만들지 않음”과의 긴장은 **Need/UX에서 보수**, Strength 진단 leaning은 유지로 **역할 분리**(D03을 “Strength 진단 vs Need 확정”으로 재해석 가능; STR 점수/VERIFIED는 손대지 않음).

**명시적 비목표 (이 결정으로도 하지 않음)**
- VERIFIED 승격, threshold/점수 추가, Wave 1 재검증, Wave 2 착수, 전문가 추가 설문.

---

## 추천 적용 시 변경될 파일 (예상 · 미적용)

정책만 문서화한 현재 단계에서는 **변경 없음**. 위 추천안을 **이후** 적용할 때 예상 터치 포인트:

| 영역 | 파일 (예상) |
|---|---|
| Need 게이트 | `src/lib/saju/need/needCandidates.ts` (또는 동등 경로의 Need 후보 생성) |
| Need Resolution | `src/lib/saju/need/needResolution.ts` (Strength 축 차단 조건) |
| 타입 | `src/lib/saju/types.ts` (`strengthNeedStatus` 확장 시) |
| Strength (Q3-B만) | `src/lib/saju/elements/strengthSummary.ts` — resolution 라벨 변경 시 |
| 테스트 | `src/lib/saju/__tests__/strengthSummary.test.ts`, Need 관련 테스트 |
| 정책·감사 문서 | 본 파일 확정본; `wave1-policy-unresolved-registry.md`/`.json` (CL-NEED-HOUR 해소 기록); 필요 시 freeze-boundary·conflict-2 교차 참조 |
| UX/카피 (Q4) | 결과·상담·인생곡에서 Strength/Need를 그리는 화면·카피 모듈 (해당 시점에 경로 확정) |

**의도적으로 건드리지 않을 것 (추천안 적용 시에도):** STR-050/051 leaning 판정식 자체, 문헌 VERIFIED, Wave 2 신규 밖 클러스터.

---

## 결정 상태

| 항목 | 상태 |
|---|---|
| 선택지 정리 | 완료 (본 문서) |
| 코드/엔진 적용 | **하지 않음** |
| 레지스트리 CL-NEED-HOUR 해소 표시 | **하지 않음** (인간 합의·적용 후) |
| Wave 2 | **미착수** |
