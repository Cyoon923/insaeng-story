# NeedResolution Freeze Boundary

엔진 판단 코드는 이 문서로 바꾸지 않는다.
FROZEN-POLICY = 명리학적 검증 완료가 아니다.

**NeedResolution 종료 상태:** 관계 분류/차단 구조 감사 완료 + 보수 정책 경계 확정 + status 의미 라벨 검증 대기.

**NeedResolution 검증 완료라고 쓰지 않는다.**
최종 Needed Element 설계로 넘어가지 않는다.

NeedResolution status / supportedElements를 사용자 최종 오행 / 용신 / 희신으로 표시하지 않는다.

근거: `resolution-rule-inventory.json`, `resolution-rule-audit.md`, `resolution-case-trace.json`, `resolution-open-questions.md`.
새 Resolution 규칙은 만들지 않았다.

---

## 세 주장을 섞지 말 것

| 코드에서 참인 것 | 아직 검증되지 않은 것 |
|---|---|
| 양쪽 active에 水가 **있다** | 두 축이 水를 **선택했다** |
| status = convergent | **정답에 가깝다 / winner** |
| single-axis에 Climate 水가 **있다** | Climate가 **이겼다** |
| decisionBlockedBy가 **비어 있다** | 자동으로 **final 가능** |
| policyGaps = `[]` | 모든 명리 정책이 **완성됐다** |

집합 계산 ≠ status 의미 라벨 ≠ Needed Element.

---

## A. Frozen Facts (VERIFIED-FACT)

FACT 31개를 다시 확인했다. 명리 해석과 무관하게 코드에서 직접 확인 가능한 것만 올렸다. FACT 라벨만으로 자동 승격하지 않았다.

| ID | 내용 |
|---|---|
| RES-001 | `buildNeedResolution`이 세 요약을 받아 `resolveNeedCandidates` 호출 |
| RES-002 | `resolveNeedCandidates(needSet, strength, climate)` |
| RES-003 | `isActive` = status === candidate |
| RES-004 | 오행 Set 계산. 점수 아님 |
| RES-005 | relationPattern은 active 집합만. suppressed / axis / certainty 제외 |
| RES-006 | 양쪽 active 없음 → no-candidates |
| RES-007 | Strength만 → strength-only |
| RES-008 | Climate만 → climate-only |
| RES-009 | 집합 같음 → exact-overlap |
| RES-010 | 교집합 있고 집합 다름 → partial-overlap |
| RES-011 | 교집합 없음 → disjoint |
| RES-017 | convergent일 때만 supportedElements 채움 |
| RES-018 | supports[]에 원본 source/reason 보존 |
| RES-020 | convergent가 아니면 supported `[]` |
| RES-021 | partial-overlap에서 deferred = 비공통 후보 |
| RES-023 | only 패턴에서 singleAxis = 그 축 active |
| RES-024 | competing일 때 축별 배열 분리 |
| RES-025 | suppressedShared = Strength suppressed ∩ Climate active |
| RES-027 | counterSignals는 suppressed shared + climate 슬롯 복사 |
| RES-029 | axis status는 NeedCandidateSet 복사 |
| RES-030 | axis status와 relationPattern은 독립 |
| RES-037 | policyGapsOf()는 항상 `[]` |
| RES-039 | moisture-excess-need-unresolved 코드 없음 |
| RES-040 | certainty `{strength, climate}` 별도 복사 |
| RES-041 | partial이 pattern/status를 바꾸지 않음. partial ≠ unresolved |
| RES-042 | elementStates는 presence 메타 |
| RES-044 | original candidates shallow copy. reason/source 보존 |
| RES-045 | winner / neededElement / score / rank / yongsin / heesin **없음** |
| RES-046 | report는 객체 복사. `supportedElements[0]`을 winner로 안 읽음 |
| RES-047 | reasons는 진단 문자열 |
| RES-048 | strengthOnly / climateOnly 필드는 항상 계산 |

이 31개가 맞다고 해서 convergent가 용신이거나, no-candidates가 “필요 없음”인 것이 아니다.

---

## B. Frozen Conservative Policies (FROZEN-POLICY)

의도적으로 고정 가능한 **엔진 정책**. 명리 절대 정답이 아니다. 과도한 최종 결론을 막는다.

- status를 winner / neededElement로 올리지 않음. (RES-016)
- supported라도 score / rank / priority / final로 쓰지 않음. (RES-019)
- deferred를 2순위 / 희신으로 쓰지 않음. (RES-022)
- climateOnly에서 suppressed-shared 오행을 뺌. (RES-026)
- strength-axis-unresolved: Strength Need unresolved면 최종을 막음. (RES-031)
- climate-axis-unresolved: Climate 축 unresolved면 최종을 막음. (RES-032)
- no-active-climate-need: Climate ready인데 active 0이면 최종을 막음. (RES-033)
- deferred-strength-only-element: partial-overlap에 Strength-only가 남으면 최종을 막음. (RES-034)
- competing-axes: disjoint를 해결하지 않고 막음. (RES-035)
- strength-three-way-unranked: 식상+재+관 셋을 고르지 않음. (RES-036)
- presence 불일치는 reason만. 후보를 지우거나 가산하지 않음. (RES-043)

blocker는 **최종 결정 금지 사유를 기록하는 내부 정책**이다.
blocker 개수 = 점수 / 위험도 / 신뢰도 % 아님.
`decisionBlockedBy`가 비었다고 자동 final 가능이 아니다.

no-candidates를 “필요한 오행이 없다”로 번역하지 않는다. 그 금지는 정책이다. 집합 계산(RES-006)은 사실이다.

---

## C. Interpretive Labels Not Yet Validated (REQUIRES-INTERPRETIVE-VALIDATION)

집합 계산(RES-006~011)과 **그 집합에 붙인 의미 라벨**을 분리한다.

| ID | 집합 사실 (이미 VERIFIED-FACT) | 라벨 |
|---|---|---|
| RES-012 | 양쪽 active 없음 | → indeterminate |
| RES-013 | 한 축만 active | → single-axis |
| RES-014 | 교집합 있음 (exact 또는 partial) | → convergent |
| RES-015 | 양쪽 있고 교집합 없음 | → disjoint → competing |

외부/제품 의미 검증 전 자동 동결하지 않는다.

convergent를 “두 축이 동의했다” 또는 “정답에 가까움”으로 번역하지 않는다.

---

## D. OPEN

새 규칙으로 OPEN을 메우지 않는다.

| ID | 내용 |
|---|---|
| RES-028 | `climateCounterSignals`는 항상 `[]`를 복사. 생성 로직 없음. `climate-moisture-already-moist` **not implemented** |
| RES-038 | `NeedPolicyGap` 타입에 `mixed-strength-resolution` / `unresolved-strength-direction` 잔여. emit 없음. legacy type |
| RES-049 | climate-only + suppressed shared: `singleAxisElements`에는 Climate 후보, `climateOnlyElements`는 비어 있을 수 있음. 구현은 명확, 제품 의미 미정 |

---

## E. relationPattern Freeze 경계

active 집합 계산 구조는 동결 가능 (RES-005~011).

pattern을 다음으로 쓰지 않는다.

- 최종 우선순위
- 정확도
- 신뢰도 점수
- 용신 결정

---

## F. 필드 경계

### supportedElements

동결 가능: shared 오행 존재, Strength/Climate 원본 supports 보존.

동결 불가: 공통이므로 더 중요, 두 축이 선택했다, final candidate, 용신.

### deferredElements

동결 가능: 공통 집합 밖 후보가 남아 있음.

금지: 2순위, 희신, 덜 중요한 오행, 나중에 제거할 후보.

### singleAxisElements

동결 가능: only 패턴 후보를 supported와 구분 저장.

금지: provisional winner, 해당 축이 더 중요, 한 축만으로 최종 가능.

### competingElementsByAxis

동결 가능: 축 충돌을 한 배열로 합치지 않음.

금지: 어느 축이 이겨야 함, Strength/Climate 우선, competing = 나쁜 사주, competing = 오류.

### suppressedShared / counterSignals

실제: Strength suppressed ∩ Climate active. supported 아님. active convergence 아님. counterSignal 기록.

금기/기신/나쁜 오행 아님. 만세력 관측 사례 없음. 주입 테스트만.

Climate counterSignal은 항상 `[]`. 과거 moist counterSignal을 구현된 것처럼 적지 않음.

### axis status

strength: ready | unresolved. climate: ready | axis-unresolved | unresolved.

relationPattern/status와 **독립 메타**. 오류 아님. 후보 없음과 동일 아님. final 없음의 한 원인일 수 있음.

### policyGaps

항상 `[]`가 정상. “모든 명리 정책이 완성됐다”가 아님. 타입 잔여는 OPEN/legacy.

### certainty

complete / partial = 입력 Evidence 완성도.

금지: partial = 틀림. complete = 명리 검증 완료. complete = final 가능.

### elementStates

메타만. 삭제/가산/winner/score/rank에 안 씀. “absent니까 더 필요하다” 금지.

### original candidates

source/reason과 함께 보존. Resolution 요약 때문에 원본 Evidence가 사라지지 않음. 이 구조 동결.

---

## G. 사용자 노출 경계

NeedResolution은 **내부 관계/차단 계층**이다.

### SAFE INTERNAL FACTS

- relationPattern 계산에 사용된 집합
- shared 여부
- deferred 여부
- axisStatus
- certainty
- blocker 코드
- 원본 candidate / source / reason

### DIAGNOSTIC ONLY

- status
- supportedElements
- deferredElements
- competingElementsByAxis
- suppressedSharedElements
- counterSignals

### NOT VALIDATED AS FINAL USER CONCLUSION

- 두 축이 水를 선택했습니다
- Water가 가장 중요합니다
- 공통이므로 용신입니다
- Climate가 이겼습니다
- competing이라 좋지 않습니다
- no-candidates라 필요한 오행이 없습니다

---

## H. 최종 결정 코드 부재

NeedResolution 경로에 winner, neededElement, finalElement, score, rank, priority, yongsin, heesin **없음**.

`supportedElements[0]`을 final처럼 소비하는 코드 **없음**.

---

## I. 지금 동결 가능 / 아직 동결 불가

**동결 가능**

- 집합 관계 계산
- 후보 원본 보존
- 축 분리
- blocker 구조
- certainty / axis 상태
- 비점수
- 비final
- 경쟁 해결 안 함

**외부/추후 검증 필요**

- pattern → status 의미 라벨
- convergence가 실제 최종 결정에 어떤 의미인지
- single-axis를 언제 사용할 수 있는지
- competing 해결 정책
- supported / deferred 우선순위
- suppressedShared 의미
- Needed Element 결정

---

## NeedResolution 단계 종료 상태

NeedResolution 상태:

관계 분류/차단 구조 감사 완료  
+ 보수 정책 경계 확정  
+ status 의미 라벨 검증 대기

NeedResolution 검증 완료가 아니다.
최종 Needed Element 설계는 이 문서의 범위가 아니다.
