# Conflict 2 — 시간 미상 Strength certainty audit

**목적:** `hour === unknown`인데도 `certainty=partial` + `leaning-*` + `clear-direction`이 공존하는 흐름을 분석한다.  
**범위:** 정보 손실·위험 지점만. 정책 확정·구현·Need 수정·무조건 mixed 규칙·점수/threshold·verdict/freeze 변경 **금지**.

**근거:** `post-validation-rule-audit.md` C-B · `phase1-closure.md` ES-5 · `strength.ts` / `strengthSummary.ts` / `needCandidates.ts` / `needResolution.ts` · STR-007/050/051/066/067/070 · tests (`strengthSummary` CASE 1–2, `needCandidates`, `validationReport`)

**Expert observation (closure):** 시간 미상 → 조건부/유보 필요. **≠** 무조건 방향 판정 불가.

---

## 1. 시간 미상이 표시되는 곳

| 층 | 위치 | 표시 |
|---|---|---|
| 입력 | `FourPillars.hour = "unknown"`, `hourCertainty` | 시주 없음 |
| Evidence | `collectStrengthEvidence` | `hourUnknown: true`; hour stem 미수집; root hits에서 `slot !== "hour"` 필터; `omittedSlots: ["hour"]` |
| Summary | `buildStrengthSummary` | `certainty: "partial"`; `omittedSlots` 전달 |
| Review/Report | validation report 등 | pillars hour unknown · strengthSummary.certainty partial |
| 테스트 | CASE 1/2 unknown → leaning + partial + clear-direction **기대** | 현재 동작을 고정 |

가짜 시주 후보는 **만들지 않음** (STR-007) — SAFE.

---

## 2. `certainty=partial` 조건

```ts
// strengthSummary.ts
certainty: evidence.hourUnknown ? "partial" : "complete"
```

- **조건:** `hourUnknown === true`이면 **항상** partial (방향과 무관).
- STR-067: certainty = 입력 완전성, 방향이 아님.
- Climate도 유사하게 hour unknown → partial (별층).

**분류: SAFE** — 입력 누락 표기는 명확.

---

## 3. partial인데 `clear-direction`이 되는 경로

```
decideDirection(...) → leaning-strong | leaning-weak
resolutionOf(direction) →
  leaning-*  ⇒  "clear-direction"   // certainty 미참조
```

`resolutionOf` / `decideDirection`은 **`hourUnknown`·`certainty`를 입력으로 받지 않는다.**

따라서:

| 필드 | hour unknown + STR-050/051 충족 시 |
|---|---|
| certainty | partial |
| directionCandidate | leaning-strong / leaning-weak |
| resolution | **clear-direction** |

의미 충돌: partial(불완전) + clear-direction(방향 닫힘)이 **동시 참**.

**분류: RISK** — API 소비자가 `clear-direction`만 보면 시주 한계를 놓침.

---

## 4. `leaning-strong` / `leaning-weak` 생성 조건

`decideDirection` (요약):

| 결과 | 조건 (visible stem presence + season + root) |
|---|---|
| leaning-strong | 왕 && root clear && rootedSupport && !rootedPressure |
| leaning-weak | (사\|수) && root absent && rootedPressure && !rootedSupport |
| mixed / null | 그 외 boolean 조합 |

hour unknown일 때:
- hour stem/pressure/support **부재**만으로 위 조건이 **더 쉽게** 성립할 수 있음 (시주의 반대 신호가 없음).
- 예: 테스트 CASE 1 unknown → leaning-strong; CASE 2 → leaning-weak; probe p1-08 → leaning-weak.

STR-066: `hour-unknown-sensitive`는 **`direction === null`일 때만** `unresolvedStrengthReasons`에 추가.  
leaning-*가 나면 hour-unknown 민감 플래그는 **안 붙음**.

freeze-boundary 문구(“방향을 약/강으로 만들지 않음”)와 **코드(STR-050/051 적용) 불일치**.

**분류:**
- 삼주로 방향 **후보**를 내는 것 자체 → expert와 모순 아님 → 잠재 **SAFE** (조건부 전제 시)
- 시주 뒤집힘 민감을 leaning 경로에서 **표시하지 않음** → **RISK**
- freeze 문서 vs 코드 → **POLICY-GAP**

---

## 5. NeedCandidate 소비 경로

```ts
// needCandidates.ts
if (strength.directionCandidate === "leaning-weak") {
  strengthNeedStatus = "ready";  // certainty 무시
  // candidates with certainty: strength.certainty (partial 복사)
} else if (strength.directionCandidate === "leaning-strong") {
  strengthNeedStatus = "ready";
  collectLeaningStrongNeedCandidates(..., strength.certainty);
}
// mixed | null → strengthNeedStatus stays "unresolved" (STR-071)
```

| 전달 | 동작 |
|---|---|
| `directionCandidate` | Need 축 **개폐** 결정 |
| `certainty` | 후보 필드에 **복사만**; status를 candidate→보류로 바꾸지 않음 |
| `resolution` / `omittedSlots` | Need **미사용** |
| `hour-unknown-sensitive` | leaning 시 미생성 → Need **미전달** |

`needResolution.ts`:
- `strengthNeedStatus === "ready"`이면 strength 축 차단 사유 없음.
- `certainty: { strength, climate }` 별도 복사 (RES-040).
- **RES-041: partial이 pattern/status를 바꾸지 않음** (`partial ≠ unresolved`).

**Need까지 영향: 있음.**  
hour unknown + leaning-* → Strength Need **ready** + 후보 생성 + resolution 패턴 계산까지 진행.  
partial은 “완전성 메타”로만 남고, **시주 누락으로 인한 방향 유보를 강제하지 않음**.

**분류: RISK** (Need가 clear leaning을 확정 입력처럼 소비).

---

## 6. 시주가 결과를 뒤집을 가능성 — 현재 구조의 표현력

| 필요한 표현 | 현재 |
|---|---|
| 시주 생략됨 | `omittedSlots`, `certainty=partial` — 있음 |
| 방향이 시주에 민감할 수 있음 | leaning 경로에서 **명시 플래그 없음** |
| 시주 후보별 방향 범위 | **없음** (후보 생성 금지 정책과 충돌하지 않되, 범위 메타도 없음) |
| clear-direction ≠ 시주 확정 후 불변 | 필드 이름상 **표현 실패** |
| Expert식 “방향 힌트 + 정도/확정 유보” | certainty와 resolution이 **분리되어 있으나 소비층이 resolution/direction만 중시** |

정보 손실 요약:  
**“삼주 기준 방향 후보”와 “시주 확정 후 불변 방향”이 같은 `leaning-*` + `clear-direction`으로 붕괴.**

**분류: POLICY-GAP** (+ RISK at Need).

---

## 7. 문제 목록 분류

| ID | 문제 | 분류 |
|---|---|---|
| P1 | 가짜 시주 미생성 · hour 슬롯 생략 | **SAFE** |
| P2 | hour unknown → certainty=partial 항상 | **SAFE** |
| P3 | decideDirection이 hour/certainty 무시 | **RISK** (설계상 분리이나 결합 메타 부재) |
| P4 | leaning-* ⇒ resolution=`clear-direction` (partial과 공존) | **RISK** |
| P5 | leaning 시 `hour-unknown-sensitive` 미부착 (STR-066은 null만) | **RISK** |
| P6 | freeze-boundary “약/강 금지” vs STR-050/051 적용 | **POLICY-GAP** |
| P7 | Need: leaning이면 status=`ready` (partial 무시) | **RISK** |
| P8 | NeedResolution: partial ≠ unresolved (RES-041) | **POLICY-GAP** (의도적 정책이나 hour 민감과 미연결) |
| P9 | 시주 뒤집힘 가능성/범위 미표현 | **POLICY-GAP** |
| P10 | 테스트가 unknown+leaning+clear-direction을 고정 | **SAFE** for regression / **RISK** if read as 명리 확정 |

Expert와 정합하는 읽기:  
삼주 방향 **힌트**는 허용 가능(SAFE 쪽).  
문제는 힌트를 **clear + Need ready**로 올리는 과정에서 **조건부 정보가 소실**되는 것(RISK/POLICY-GAP).

---

## 8. 최소 설계 대안 (미구현)

정책을 지금 고르지 말고, **정보 보존**만 열 수 있는 대안:

### A. Diagnostic flag (최소)
- `hourUnknown && directionCandidate in {leaning-strong, leaning-weak}` 일 때  
  예: `directionSensitivity: "hour-unknown-provisional"` 또는 unresolvedStrengthReasons에 별 코드  
- `decideDirection` / Need **로직 불변** (1차)  
- 소비층이 clear-direction만 보지 않도록 문서화

### B. Resolution 어휘 분리 (중)
- hour unknown + leaning → `resolution: "provisional-direction"` (또는 동등)  
- `clear-direction`은 hour confirmed일 때만  
- Need는 별도 결정 전까지 **현행 유지** 가능 (또 다른 POLICY-GAP)

### C. Need 게이트 (중·후속)
- `strengthNeedStatus`: leaning이어도 certainty=partial이면 `ready`가 아닌 `axis-provisional` 등  
- **Need 수정이므로 본 Conflict 감사 범위 밖·구현 금지 상태**

### D. 금지안
- 시간 미상 → 무조건 `mixed` / null  
- 시주 12개 자동 스윕으로 “정답” 확정  
- 새 점수·threshold

**권고 순서 (구현 시):** A → (검증 후) B; C는 Need audit와 함께.

---

## 9. 변경 필요 후보 파일 (구현 시; 이번 턴 없음)

| 파일 | 후보 역할 |
|---|---|
| `elements/strengthSummary.ts` | provisional / hour-sensitive 메타 부착 (decideDirection 본문 동결 가능) |
| `types.ts` | resolution 확장 또는 sensitivity 필드 |
| `elements/needCandidates.ts` | (후속) partial+leaning 시 status 정책 — **현재 금지** |
| `elements/needResolution.ts` | (후속) provisional 축 처리 — **현재 금지** |
| `validation/strength-audit/strength-freeze-boundary.md` | 문서↔코드 정렬 (정책 확정 후) |
| `strength-rule-inventory.json` STR-066/067 | 민감 플래그 범위 명확화 |
| `strengthSummary.test.ts` / `needCandidates.test.ts` | 메타·회귀 (expected 방향값 임의 변경 금지 원칙 유지)

---

## 10. 한 줄 결론

| | |
|---|---|
| **위험 지점** | leaning-* → `clear-direction` + Need `ready`가 hour-unknown 민감을 **삼킴** (STR-066은 null 전용) |
| **Need 영향** | **있음** — partial은 복사만, 축은 ready로 열림 |
| **최소 대안** | 판정식 불변 + hour-unknown-provisional **진단 메타** (A) |
| **하지 말 것** | 무조건 mixed · 점수 · Need 즉각 개편 · freeze/verdict 변경 |
