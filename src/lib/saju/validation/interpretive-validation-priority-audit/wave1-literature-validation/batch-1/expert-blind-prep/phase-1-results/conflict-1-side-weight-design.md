# Conflict 1 — Side 내부 동일취급 설계 검토

**목적:** support/pressure 양대 방향은 유지하되, 검증되지 않은 **동일 가중 가정**이 판정 로직에 암묵 반영되지 않도록, source type을 보존하는 **최소 구조**를 설계한다.  
**금지 준수:** 코드·테스트·STR verdict/freeze 미변경. 새 점수·가중치·threshold·편/정 고정 차등·재성 감쇄량 미도입.

**근거:** `post-validation-rule-audit.md` C-A · `phase1-closure.md` ES-1–4 / NV-1 · STR-010/011/012 · `strength.ts` / `strengthSummary.ts` / `types.ts`

---

## 1. Current behavior

### 1.1 support / pressure 생성

| 단계 | 위치 | 동작 |
|---|---|---|
| 멤버십 | `elements/strength.ts` | `SUPPORT_SHI_SHEN` = 비견·겁재·편인·정인 → `supportEvidence.items` |
| 멤버십 | 동일 | `PRESSURE_SHI_SHEN` = 식신·상관·편재·정재·편관·정관 → `pressureEvidence.items` |
| 규칙 | STR-010 / STR-011 | 방향 묶음 정의 (`strength-rule-inventory.json`) |
| 항목 필드 | `StrengthRelationItem` | **`shiShen`은 아직 보존** (비견 vs 정인, 식신 vs 정재 등 구분 가능) |

### 1.2 구분이 사라지는 지점 (핵심)

| 구분 | 살아 있는 층 | 사라지는 층 |
|---|---|---|
| 비겁 vs 인성 | `supportEvidence.items[].shiShen` · `strongSideEvidence[].shiShen` | `hasRooted(supportItems)` → **단일** `rootedSupport: boolean` |
| 식상 vs 재 vs 관 | `pressureEvidence.items[].shiShen` · `weakSideEvidence[].shiShen` | `hasRooted(pressureItems)` → **단일** `rootedPressure: boolean` |
| 편 vs 정 | 십신 이름에 존재 | STR-012 + 판정 로직에서 **가중/분기 없음** (의도적) |

소실 함수 (`strengthSummary.ts`):

```
hasRooted(items)          // presence만 봄 — shiShen 무시
decideDirection(...)      // rootedSupport / rootedPressure boolean만 사용
mixedPatternOf(...)       // 동일
mixedConflictLevelOf(...) // 동일
conflictsOf(...)          // 동일
```

즉 **증거 목록에는 십신이 남아 있으나, 방향 결정 API는 side-내 유형을 읽지 않는다.**

### 1.3 boolean → 최종 판정 흐름

```
collectStrengthEvidence
  → supportEvidence / pressureEvidence (shiShen 유지)
buildStrengthSummary
  → strongSideEvidence / weakSideEvidence (shiShen 복사, 목록용)
  → decideDirection(phase, rootQuality, rootedSupport?, rootedPressure?)
  → directionCandidate: leaning-strong | leaning-weak | mixed | null
needCandidates (downstream)
  → directionCandidate만 보고 peer/resource 또는 output/wealth/official Need 후보 생성
     ※ Strength 쪽 source type이 아니라 Need 오행 매핑
```

### 1.4 타입·API·테스트 의존

| 소비자 | 의존 |
|---|---|
| `buildNeedCandidateSet` | `directionCandidate` + `certainty` (source subtype 미사용) |
| `review/strengthReport.ts` | evidence items의 `shiShen` 표시용 |
| `strengthSummary.test.ts` | direction·side evidence·forbidden score |
| `strengthEvidence.test.ts` | support/pressure membership·slot |
| `needCandidates.test.ts` | directionCandidate 결과 |

**점수/weight 필드 없음** — 동일취급은 “숫자 가중”이 아니라 **boolean OR 균등 기여**다.

---

## 2. Problem

1. **Expert-supported:** 비겁·인성 강화 / 식상·재·관 약화 **방향** + 묶음 허용.  
2. **NOT validated (closure):** 동일 가중 · 단순 개수 합산 · 편/정 고정 차등 · 재성 세부 감쇄량.  
3. **엔진:** side 멤버를 `rootedSupport`/`rootedPressure` 하나로 접어 **동일 기여**로 방향을 닫음.  
4. **결과:** 검증된 것은 “방향 라벨”, 검증 안 된 것은 “side 내 균등 강도”인데, 후자가 전자의 구현에 **암묵 포함**.  
5. Literature: STR-011 **CONTESTED** (일괄 pressure HIGH-RISK)와 정합하는 긴장.

문제는 “묶음을 쓴다”가 아니라 **묶음 이후 유형 정보가 판정 입력에서 삭제된다**는 점이다.

---

## 3. Proposed minimal structure

### 3.1 유지

- STR-010 / STR-011 **양대 side** (support / pressure)
- 기존 `decideDirection` 입력·출력 시그니처 **당분간 불변** → `directionCandidate` 호환
- score / weight / threshold / 편·정 δ / 재성 감쇄량 **추가 금지**

### 3.2 추가 (증거·메타만 — 계산 미사용)

**Source kind (방향군 하위, 편/정 아님):**

| Side | sourceKind | 매핑 (십신 → kind만; 강도 없음) |
|---|---|---|
| support | `peer` | 비견, 겁재 |
| support | `resource` | 편인, 정인 |
| pressure | `output` | 식신, 상관 |
| pressure | `wealth` | 편재, 정재 |
| pressure | `officer` | 편관, 정관 |

**보존 객체 예시 (설계; 미구현):**

```ts
// 개념만 — 새 가중 필드 없음
type StrengthSourcePresence = {
  peer: { rootedVisible: boolean; unrootedVisible: boolean };
  resource: { rootedVisible: boolean; unrootedVisible: boolean };
  output: { rootedVisible: boolean; unrootedVisible: boolean };
  wealth: { rootedVisible: boolean; unrootedVisible: boolean };
  officer: { rootedVisible: boolean; unrootedVisible: boolean };
};
```

또는 summary에:

```ts
sourceBreakdown: StrengthSourcePresence  // diagnostic / future gate
// decideDirection에는 아직 전달하지 않음
```

**원칙:**  
- `sourceBreakdown`은 **관찰·감사·향후 분기용**  
- `directionCandidate` 산출식은 **1차 패스에서 변경하지 않음** (동일가중 제거 = “가정 노출”, 아직 “새 가정 채택” 아님)

### 3.3 동일가중 가정 제거의 의미 (이번 설계 범위)

| 단계 | 내용 |
|---|---|
| Now (설계) | 유형 정보를 판정 직전까지 **소실시키지 않는 API 표면** 정의 |
| Not now | sourceKind별 weight, threshold, direction 재계산 |
| Later (별도 검증 후) | 예: “rooted peer만으로 strong 개방” 등 **가설별** 실험 — 본 문서에서 확정 금지 |

“동일가중 제거” ≠ “차등가중 도입”.  
제거 = **균등 boolean을 유일한 진실로 취급하지 않도록 유형을 노출**.

---

## 4. Compatibility impact

| 영역 | 영향 |
|---|---|
| `directionCandidate` | 1차 구현이 breakdown만 additive면 **불변** |
| Need / Resolution | `directionCandidate` 의존 → **동작 유지** |
| Review UI | `shiShen` 이미 있음; breakdown은 선택 표시 |
| 기존 테스트 | additive 필드면 assertion 대부분 유지; 스냅샷/정확 객체 동치 테스트만 확장 필요 |
| STR-010/011 verdict | 변경 불필요 (방향 묶음 유지) |
| STR-012 | 편/정 비가중 유지 — sourceKind는 **오행 관계군**이지 정/편 δ 아님 |

**호환:** 가능 (additive meta + decideDirection 동결 시).

---

## 5. Unresolved

1. Breakdown을 **언제** `decideDirection`에 넣을지 (지금은 넣지 않음).  
2. Hidden branch relation을 sourceKind에 넣을지 (현재 방향은 visible stem 중심).  
3. Case 06형에서 peer(월지 록)·officer/wealth 동시 시 breakdown 해석.  
4. Need가 이미 peer/resource/output…을 쓰지만 Strength와 **연결되지 않음** — 정렬은 후속.  
5. Literature CONTESTED(STR-011) 해소 여부 — 본 설계만으로 verdict 변경 금지.

---

## 6. Implementation recommendation (실행 시; 이번 턴 미실행)

### 최소 변경 파일 (권고 목록만)

| 파일 | 변경 성격 |
|---|---|
| `src/lib/saju/types.ts` | `SupportSourceKind` / `PressureSourceKind` / `StrengthSourceBreakdown` 타입 추가; `StrengthSummary`에 optional/additive 필드 |
| `src/lib/saju/elements/strength.ts` | (선택) item에 `sourceKind` 태그만 부여 — 멤버십 로직 불변 |
| `src/lib/saju/elements/strengthSummary.ts` | items에서 breakdown 집계; **`decideDirection` 시그니처·본문 1차 동결** |
| `src/lib/saju/review/strengthReport.ts` | (선택) breakdown 노출 |
| 테스트 | additive 필드 허용 확인; direction fixture **기대값 변경 금지**가 1차 목표 |

### 하지 말 것 (구현 시에도)

- `decideDirection`에 weight/count/threshold 도입  
- 편/정 고정 점수  
- STR-010/011을 “차등가중 규칙”으로 재작성  
- Need 후보 생성 로직을 Strength breakdown에 즉시 묶기  

### 권고 순서

1. **Types + breakdown 집계만** (direction 불변) → Conflict 1의 “암묵 동일가중”을 **관측 가능하게** 만듦.  
2. Audit/trace에 sourceKind 출현 기록.  
3. 별도 validation 가설이 열릴 때만 decideDirection 분기 실험 (본 Conflict 해소 ≠ 자동 구현).

---

## 7. 한 줄 요약

| | |
|---|---|
| **동일취급 발생 위치** | `strengthSummary.ts`의 `hasRooted` → `rootedSupport`/`rootedPressure` → `decideDirection` (shiShen 무시) |
| **제안** | side 유지 + `peer/resource` · `output/wealth/officer` breakdown 보존, **비계산** |
| **호환** | decideDirection 동결 시 기존 direction/Need 호환 가능 |
