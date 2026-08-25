# Climate Rule Audit

엔진 판단 코드는 이 문서로 바꾸지 않는다.
원재료 정확성과 조후 해석 타당성을 분리한다.

**Climate 현재 상태:** 코드·테스트는 통과. 사실층 일부 + 보수 정책 다수 + 해석층 미검증.

완전 검증 완료가 아니다.
adjusted temperature/moisture와 Climate Need를 검증 완료로 표시하지 않는다.

---

## A. 조사한 경로

- `src/lib/saju/data/baseClimate.ts`
- `src/lib/saju/elements/climate.ts` (`collectClimateEvidence`)
- `src/lib/saju/elements/adjustedClimate.ts` (`buildAdjustedClimateSummary`, `qualityOf`, `adjustPolar`)
- `src/lib/saju/elements/materials.ts`, `slots.ts`
- `src/lib/saju/elements/needCandidates.ts` Climate 분기
- `src/lib/saju/elements/needResolution.ts` `climateCounterSignals` 전달
- `src/lib/saju/types.ts` Climate / NeedCandidateSet
- `src/lib/saju/validation/report.ts` climateEvidence / adjustedClimate / needCandidates
- `src/lib/saju/__tests__/climateEvidence.test.ts`
- `src/lib/saju/__tests__/adjustedClimate.test.ts`
- `src/lib/saju/__tests__/needCandidates.test.ts` Climate 부분

실제 코드에 없는 규칙은 inventory에 넣지 않았다. `climate-moisture-already-moist`는 없음.

---

## B. validationClass 요약

| class | 수 | 의미 |
|---|---|---|
| FACT | 7 | 월지 복사, presence 재사용, 점수 필드 부재, 빈 counterSignal 전달 |
| FOUNDATIONAL | 2 | 丙丁=火, 壬癸=水 |
| ENGINE-POLICY | 28 | 월지 중복 제거, 한 단계 이동, substantial→unresolved, moist Need 없음 등 |
| INTERPRETIVE | 20 | 12월지 조후 표, quality 라벨, 한난/조습 방향, cold→火 Need 등 |

애매한 항목은 INTERPRETIVE.

---

## C. baseClimate 12월지 (코드 실제 값)

| 월지 | temperature | moisture | 클러스터 |
|---|---|---|---|
| 寅 | balanced | moist | 봄 |
| 卯 | balanced | moist | 봄 |
| 辰 | balanced | moist | 봄 (토월) |
| 巳 | warm | dry | 여름 |
| 午 | warm | dry | 여름 |
| 未 | warm | dry | 여름 (토월) |
| 申 | balanced | dry | 가을 |
| 酉 | balanced | dry | 가을 |
| 戌 | balanced | dry | 가을 (토월) |
| 亥 | cold | moist | 겨울 |
| 子 | cold | moist | 겨울 |
| 丑 | cold | moist | 겨울 (토월) |

이 표가 **코드에 존재한다.** 이 표가 **명리적으로 검증된 것은 아니다.** CLI-002.

현재 표에 `warm+moist`와 moisture `balanced` 월지는 없다.

寅을 balanced로 둔 것은 HIGH-RISK 해석이다.

---

## D. 辰未戌丑

네 토를 같은 Climate로 접지 않는 구조는 **토 전용 모듈이 아니라 계절 클러스터 lookup**이다.

| 월지 | 실제 값 | 묶인 계절 |
|---|---|---|
| 辰 | balanced + moist | 寅卯 |
| 未 | warm + dry | 巳午 |
| 戌 | balanced + dry | 申酉 |
| 丑 | cold + moist | 亥子 |

- lookup 구조: `BASE_CLIMATE[branch]`
- 조후 해석: 토월을 인접 계절과 같게 본 값 (INTERPRETIVE)
- Earth를 Climate factor로 쓰지 않음: CLI-013 ENGINE-POLICY

`earthContext`는 코드에 없다. 만들지 않았다.

---

## E. ClimateEvidence 수집

`collectElementMaterials`의 년/월/일/(시) 재료를 훑고 火/水만 남긴다.

| 층 | 火 | 水 |
|---|---|---|
| stem | 丙丁 | 壬癸 |
| branch | 巳午 | 亥子 |
| hiddenStem | 그 천간이 丙丁/壬癸 | 동일 |

월지: `slot===month && layer!==stem`이면 skip. 월간만 남김. 월지 본기와 월지 지장간은 factor가 아니다.

木金土는 factor가 되지 않는다. 오행 lookup FACT가 아니라 Climate 범위 ENGINE-POLICY.

시간 미상이면 hour 재료가 처음부터 없다. 후보 시주/정오/평균 없음.

각 factor의 `presence`는 차트 전체 `analyzeElementPresence(火|水)` 복사다.

---

## F. Fire / Water quality

`qualityOf`는 factor 목록의 **존재 여부**다. 개수는 단계를 늘리지 않는다.

| 라벨 | 실제 조건 |
|---|---|
| absent | 해당 오행 factor 0 |
| clear | 투출 천간(丙丁/壬癸) **그리고** 대표지지(巳午/亥子)가 factors 안에 있음 |
| substantial | 투출 천간 **그리고** (hiddenStem factor 또는 presence가 rooted-visible/hidden-only) |
| shallow | 투출 천간만 |
| hidden | hiddenStem이 있고 투출 천간 없음 |
| branch-only | 지지 火/水만 (hiddenRoot 없음) |
| fallback | 그 외 items>0 → hidden |

quality 산정과 “얼마나 온도/습도를 바꾸는가”는 다른 규칙이다.

---

## G. temperature transition (실제)

입력은 **baseClimate.temperature**와 fire/water **quality 한 값**이다.

**balanced**

- 항상 `resolved / balanced`
- Fire·Water가 둘 다 clear|substantial이면 conflict `both-fire-and-water-clear-or-substantial`만 추가. value는 유지.

**cold** (mit=Fire, reinf=Water)

| 조건 | 결과 |
|---|---|
| mit·reinf 둘 다 clear\|substantial | unresolved, null, `substantial-mitigation-and-reinforcement` |
| mit substantial | unresolved, null, `substantial-fire-mitigation-needs-review` |
| mit clear | resolved **balanced** (warm으로 넘기지 않음) |
| mit weak (absent/hidden/shallow/branch-only) | resolved **cold** |

**warm** (mit=Water, reinf=Fire): 대칭. clear Water → balanced. substantial Water mit → unresolved.

한 단계 이동은 ENGINE-POLICY (CLI-032).
cold→Fire Need는 이 transition이 아니라 CLI-041.

certainty(partial)는 transition을 바꾸지 않는다. CLI-039는 노트만.

---

## H. moisture transition (실제)

**현재 표에는 moisture balanced 월지가 없다.** 코드 분기는 있으나 표 기준으로 dead.

**moist** (mit=Fire, reinf=Water): cold와 **같은** `adjustPolar`.

**dry** (mit=Water, reinf=Fire): warm과 같음.

temperatureRole과 moistureRole은 **별도 함수**다. 보정은 축마다 독립 호출이다.

Fire/Water moistureRole:

- dry: 水 mit, 火 reinf
- moist: 火 mit, 水 reinf
- balanced: contextual

---

## I. mitigation / reinforcement

| base | 火 | 水 |
|---|---|---|
| cold | temperature mit | temperature reinf |
| warm | temperature reinf | temperature mit |
| T balanced | contextual | contextual |
| moist | moisture mit | moisture reinf |
| dry | moisture reinf | moisture mit |

이 방향 자체는 INTERPRETIVE (CLI-018, CLI-019, CLI-036, CLI-037).
substantial이면 unresolved로 두는 것, clear면 한 단계 balanced는 ENGINE-POLICY.

`mitigationFactors` / `reinforcementFactors`는 role 필터 목록이다. 길이를 다시 넣지 않는다.

---

## J. conflict

코드에 있는 문자열만:

- `substantial-mitigation-and-reinforcement` — 해당 축 value=null
- `substantial-fire-mitigation-needs-review` / `substantial-water-mitigation-needs-review` — unresolved, conflict 배열에는 안 넣음
- `both-fire-and-water-clear-or-substantial` — **노트만**, balanced 유지
- `hour-unknown-may-change-climate-factors` — unresolvedReasons 노트, 축 미변경

score/rank에 쓰이지 않는다.

---

## K. moist Need 정책 (현재 구현 = 재설계하지 않음)

Need 생성은 `addClimate` 세 갈래뿐이다: cold→火, warm→水, dry→水.

| 조합 | 실제 코드 |
|---|---|
| cold + moist | 火는 temperature cold일 때만. moisture moist로 火/土 추가 없음. CASE 1은 adjusted balanced라 火 Need도 없음 |
| balanced + moist | Climate Need 없음. status는 축이 resolved면 ready |
| warm + moist | **월지 표에 없음.** counterSignal 생성 코드도 없음 |

분류: moist에서 후보를 안 만드는 것은 ENGINE-POLICY (CLI-044). cold→火, warm→水는 INTERPRETIVE.

---

## L. Climate Need vs 상태 판정

분리:

1. AdjustedClimate가 cold/warm/dry/balanced/unresolved인가
2. 그 상태에 火 또는 水 후보를 붙이는가

2번은 FACT가 아니다.

Strength와 Climate 후보는 합치지 않는다. Climate 후보는 항상 `status=candidate`. Climate suppressed 없음.

---

## M. climateCounterSignal

현재 `climateCounterSignals: []` 고정.

- `climate-moisture-already-moist` **없음**
- 후보 삭제 아님 (생성 자체가 없음)
- score/priority 아님
- NeedResolution은 빈 배열을 그대로 전달

설계안의 warm+moist counterSignal은 **미구현**. 보고만 한다.

---

## N. 시간 미상

- hour factor 없음
- `omittedSlots: ["hour"]`
- `certainty: partial`
- 가짜 시주 없음
- partial ≠ 자동 unresolved
- substantial quality이면 경고 reason만 추가

cold/warm/moist/dry를 시간 미상이라는 이유로 임의 결정하지 않는다.

---

## O. Evidence 중복

허용되는 중복 표시:

- 같은 火가 stem / branch / hiddenStem factor 여러 줄
- 같은 presence가 모든 火 factor에 복사
- 같은 火가 temperatureRole mit이면서 moistureRole mit

효과 경로:

- `qualityOf`는 boolean 1회 → fireQuality 하나
- `adjustPolar`는 축당 quality 1회

**이중 효과:** cold+moist에서 Fire **clear** 하나면 한난과 조습을 **둘 다** balanced로 옮긴다 (CASE 1). 점수는 아니지만 같은 火가 두 축에 적용된다. CLI-054.

월지 skip(CLI-014)과 presence(CLI-017)가 겹치면, 월지에만 있는 根이 factor는 아닌데 substantial 조건의 `rooted` boolean에는 남을 수 있다.

---

## P. 숨은 score / 최종판단

Climate 경로에 score, weight, rank, priority, winner, neededElement, finalElement, yongsin, heesin 없음.

reason 개수는 병합 기록이다. factor 개수는 quality를 올리지 않는다.

---

## Q. High-risk interpretive rules

`climate-open-questions.md`와 inventory INTERPRETIVE 항목.

가장 위험한 묶음:

1. 12월지 baseClimate 값, 특히 寅=balanced, 辰丑未戌 클러스터
2. clear → 한 단계 balanced, substantial → unresolved
3. Fire가 moist를 말리는 정도 = 한난 완화와 동일 함수
4. cold → 火 Need, warm/dry → 水 Need
