# NeedResolution Rule Audit

엔진 판단 코드는 이 문서로 바꾸지 않는다.
NeedCandidate / Strength / Climate 규칙을 다시 감사하지 않는다.
NeedResolution Freeze Boundary는 만들지 않는다.

**NeedResolution 현재 상태:** 관계 분류 + 최종 결정 차단 구조 목록화. 최종 Needed Element 없음.

근거: `needResolution.ts`, `types.ts`, `needResolution.test.ts`, `validation/report.ts`.
새 최종 결정 규칙을 만들지 않았다.

질문은 “현재 후보 관계를 어떤 상태로 분류하고, 어떤 이유로 최종 결정을 막는가”이다.

---

## A. 조사한 경로

- `src/lib/saju/elements/needResolution.ts`
- `src/lib/saju/types.ts` (`NeedResolution` 및 관련)
- `src/lib/saju/__tests__/needResolution.test.ts`
- `src/lib/saju/validation/report.ts` (`needResolution`, `finalDecisionBlocked`)
- `NeedCandidateSet` → `resolveNeedCandidates` / `buildNeedResolution`

`need-audit/`는 참고만 했다. Need Candidate Audit을 반복하지 않았다.

---

## B. ruleType 요약

| class | 수 | 의미 |
|---|---|---|
| FACT | 31 | 집합 계산, 필드 복사, 빈 policyGaps, 점수 필드 부재 |
| ENGINE-POLICY | 11 | status를 winner로 올리지 않음, 6종 blocker, deferred 비해석 |
| INTERPRETIVE | 4 | pattern에서 status 라벨 (indeterminate / single-axis / convergent / competing) |
| OPEN | 3 | climateCounterSignals 전달 슬롯, NeedPolicyGap 타입 잔여, suppressed 시 singleAxis와 climateOnly |

코드에 있다는 이유만으로 INTERPRETIVE를 검증 완료로 분류하지 않는다.
집합 구조는 FACT, 그 라벨의 사용자 의미는 별층.

---

## C. relationPattern (active 집합만)

`isActive` = `status === "candidate"`. suppressed는 패턴에 안 들어간다.

| pattern | 조건 |
|---|---|
| no-candidates | Strength active 없음, Climate active 없음 |
| strength-only | Strength active 있음, Climate active 없음 |
| climate-only | Strength active 없음, Climate active 있음 |
| exact-overlap | 양쪽 있고 오행 집합이 같음 |
| partial-overlap | 교집합이 있고 집합이 다름 |
| disjoint | 양쪽 있고 교집합 없음 |

axis status / certainty는 패턴을 바꾸지 않는다.

---

## D. status (최종 결정 아님)

| pattern | status |
|---|---|
| no-candidates | indeterminate |
| strength-only | single-axis |
| climate-only | single-axis |
| exact-overlap | convergent |
| partial-overlap | convergent |
| disjoint | competing |

- convergent ≠ winner
- single-axis ≠ 해당 축 승리
- competing ≠ 오류
- indeterminate ≠ 필요한 오행 없음

---

## E. 필드별 실제 동작

**supportedElements**  
`status === "convergent"`일 때만. shared 오행 + 그 오행의 Strength/Climate active 원본을 `supports[]`에 보존.  
exact-overlap / partial-overlap. score / rank / priority / final로 쓰지 않음.  
report는 `supportedElements[0]`을 winner로 읽지 않음.

**deferredElements**  
partial-overlap에서 공통이 아닌 후보. 예: Strength 木·水, Climate 水 → supported 水, deferred 木.  
2순위 / 보조 / 희신 아님.

**singleAxisElements**  
strength-only → Strength active. climate-only → Climate active. 그 외 빈 배열.  
supported와 분리. provisional winner 아님.

**competingElementsByAxis**  
disjoint일 때 strength / climate로 축 분리. 한 배열로 합쳐 점수 비교하지 않음.

**suppressedSharedElements**  
Strength suppressed와 Climate active의 교집합 오행. activeShared / supported에 안 들어감.  
climateOnly에서는 빠짐. counterSignals로 기록.  
suppressed ≠ bad / 금기 / 기신.  
만세력 fixture 없음. 주입 단위 테스트만 (`res-case-11`).

**counterSignals**  
1) Strength suppressed shared  
2) `needSet.climateCounterSignals` 복사 (현재 항상 빈 배열)  
Climate Audit과 모순 없음.

**axis status**  
`strengthNeedStatus` / `climateNeedStatus` 복사.  
strength: ready | unresolved. climate: ready | axis-unresolved | unresolved.  
패턴과 독립.

**decisionBlockedBy** (코드에 있는 6개만)

| blocker | ruleType | 조건 |
|---|---|---|
| strength-axis-unresolved | ENGINE-POLICY | Strength Need status unresolved |
| climate-axis-unresolved | ENGINE-POLICY | Climate axis-unresolved 또는 unresolved |
| no-active-climate-need | ENGINE-POLICY | Climate ready 이고 Climate active 0 |
| deferred-strength-only-element | ENGINE-POLICY | partial-overlap 이고 Strength-only 남음 |
| competing-axes | ENGINE-POLICY | disjoint |
| strength-three-way-unranked | ENGINE-POLICY | strength-only 이고 식상+재+관 |

**policyGaps**  
`policyGapsOf()`는 항상 빈 배열. 현재 빈 배열이 정상.  
타입에만 `mixed-strength-resolution` / `unresolved-strength-direction` 잔여. emit 없음.  
`moisture-excess-need-unresolved`는 타입에도 코드에도 없음.

**certainty**  
`{ strength, climate }` 별도 복사. pattern/status를 바꾸지 않음. partial ≠ unresolved.

**elementStates**  
presence / alreadyPresent 메타. 후보 제거·가산·winner·rank에 안 씀. 불일치 시 reason 문자열만.

**original candidates**  
shallow copy. reason / source 보존.

---

## F. 최종 결정 시도

`needResolution.ts` / `NeedResolution` 타입에서  
winner, neededElement, finalElement, score, rank, priority, yongsin, heesin 없음.

`supportedElements[0]`을 암묵적 final로 소비하는 코드 없음.  
report는 `finalDecisionBlocked = decisionBlockedBy.length > 0`만 표시.

---

## G. 사용자 노출 경계

NeedResolution은 내부 관계/차단 계층이다.

직접 만들면 안 되는 표현:

- 두 축이 水를 선택했습니다
- 따라서 水가 최종입니다
- 공통 오행이므로 용신입니다
- Strength보다 Climate가 우선입니다
- competing이므로 사주가 나쁩니다
- no-candidates이므로 필요한 오행이 없습니다

---

## H. 하지 않은 것

- NeedResolution 엔진 수정
- Freeze Boundary
- Needed Element / 용신 / 희신 / 점수
- 제품 API export
