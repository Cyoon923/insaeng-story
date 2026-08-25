# NeedResolution Open Questions

답을 새로 정하지 않는다.
엔진을 이 문서로 바꾸지 않는다.
Freeze Boundary / Needed Element 설계로 넘어가지 않는다.

---

## HIGH-RISK RESOLUTION RULES

집합 구조는 FACT일 수 있다. 아래는 사용자 의미로 번역하면 위험한 지점이다.

1. **partial-overlap → convergent** (RES-014)
   - 공통 오행이 있다고 해서 합의/최종이 아니다.
   - deferred Strength-only가 남아 blocker가 붙는다.

2. **exact-overlap → convergent** (RES-014)
   - 같은 오행이 두 축에 있다는 집합 사실일 뿐.
   - winner 없음. 기존 만세력 fixture 없이 주입 테스트만.

3. **climate-only / strength-only → single-axis** (RES-013)
   - 한 축만 후보가 있다는 분류.
   - 그 축이 이겼다는 뜻이 아니다.

4. **disjoint → competing** (RES-015)
   - 축이 다른 오행을 가리킨다는 분류.
   - 사주가 나쁘다는 뜻이 아니다. 우선순위 없음.

5. **supported vs deferred** (RES-017, RES-021)
   - supported = 양쪽 active에 있는 오행.
   - deferred = 한쪽에만 있는 오행.
   - 희신 / 2순위가 아니다.

6. **suppressed shared** (RES-025, RES-027)
   - Strength suppressed ∩ Climate active.
   - 금기 / 기신 / bad element가 아니다.
   - 만세력 fixture 없음.

7. **blocker가 최종을 막는 방식** (RES-031~036)
   - 패턴을 뒤집지 않고 결정만 막는다.
   - blocker 있음 = 엔진 오류가 아님.

8. **no-candidates → indeterminate** (RES-012)
   - 양쪽 active가 비었다는 분류.
   - 필요한 오행이 없다는 뜻이 아니다.

---

## OPEN

- **RES-028:** `climateCounterSignals`는 항상 빈 배열을 복사한다. 생성 로직 없음. Climate Audit과 같음.
- **RES-038:** `NeedPolicyGap` 타입에 `mixed-strength-resolution`, `unresolved-strength-direction`이 남아 있으나 emit 없음.
- **RES-049:** climate-only + suppressed shared이면 `singleAxisElements`에는 Climate 후보가 있고 `climateOnlyElements`는 비어 있을 수 있다. 구현은 명확, 제품 의미는 미정.
- exact-overlap / suppressedShared는 주입 단위 테스트만. 새 명식을 만들지 않았다.

---

## 하지 말 것

- 이 질문으로 NeedResolution을 지금 고치지 말 것
- winner / Needed Element / 용신 / 희신을 만들지 말 것
- Freeze Boundary를 이번 단계에서 쓰지 말 것
- policyGaps를 다시 채우지 말 것
