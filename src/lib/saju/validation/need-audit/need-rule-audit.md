# Need Candidate Rule Audit

엔진 판단 코드는 이 문서로 바꾸지 않는다.
NeedResolution 판단 규칙은 이번 단계에서 감사하지 않는다.
Need Freeze Boundary는 만들지 않는다.

**NeedCandidate 현재 상태:** 생성 규칙 목록화 완료. 해석 검증 완료가 아니다.

어떤 후보도 최종 Needed Element / 용신 / 희신이 아니다.

근거: `needCandidates.ts`, `types.ts`, `needCandidates.test.ts`, 기존 검증 명식 trace.
새 명리 규칙을 만들지 않았다.

---

## A. 조사한 경로

- `src/lib/saju/elements/needCandidates.ts`
- `src/lib/saju/types.ts` (`NeedCandidate`, `NeedCandidateSet`)
- `src/lib/saju/index.ts` export (`buildNeedCandidateSet`, `collectLeaningStrongNeedCandidates`, `suppressedForLeaningStrong`)
- `src/lib/saju/__tests__/needCandidates.test.ts`
- `src/lib/saju/__tests__/needSuppression.fixtures.json`
- 소비 필드만: `StrengthSummary.directionCandidate`, `StrengthSummary.certainty`
- 소비 필드만: `AdjustedClimateSummary.temperature/moisture status·value`, `certainty`
- 후속 소비자만: `needResolution.ts`가 `NeedCandidateSet`을 받는다는 사실

실제 코드에 없는 규칙은 inventory에 넣지 않았다. `climate-moisture-already-moist`는 없음.

---

## B. ruleType 요약

| class | 수 | 의미 |
|---|---|---|
| FACT | 21 | 필드, 입력 배선, 빈 counterSignal 전달, 점수 필드 부재 |
| ENGINE-POLICY | 24 | mixed/null 후보 억제, 축 비병합, moist 미생성, partial 비가드 |
| INTERPRETIVE | 7 | 신강/신약 오행 매핑, 억제 조건, cold→火 / warm→水 / dry→水 |
| OPEN | 2 | counterSignal 미구현, climate-moisture-already-moist 없음 |

코드에 있다는 이유만으로 INTERPRETIVE를 검증 완료로 분류하지 않는다.

---

## C. NeedCandidate 실제 필드

타입에 있는 것만:

| 필드 | 역할 |
|---|---|
| element | 오행 글자 |
| source | `strength` \| `climate` |
| reasons | 문자열 목록. 점수 아님 |
| direction | `peer` \| `resource` \| `output` \| `wealth` \| `official` \| `climate` |
| existingPresence | presence 4종 복사 |
| alreadyPresent | presence !== absent |
| certainty | Strength 또는 Climate certainty 복사 |
| status | `candidate` \| `suppressed` |
| evidenceRefs | 추적 문자열 |

없음: `score`, `rank`, `weight`, `priority`, `winner`, `finalElement`, `neededElement`, `yongsin`, `heesin`, `axis`(필드명).

`NeedCandidateSet` 추가 필드: `strengthNeedCandidates`, `climateNeedCandidates`, `climateCounterSignals`, `strengthNeedStatus`, `climateNeedStatus`.

---

## D. Strength Need 생성 구조

사용하는 Strength 필드: `directionCandidate`, `certainty`만.

읽지 않음: `mixedPattern`, `mixedConflictLevel`, `unresolvedStrengthReasons`, 왕/통근/득세 evidence.

| directionCandidate | 후보 | strengthNeedStatus |
|---|---|---|
| leaning-strong | 식상·재성·관성 3행 (일간 오행 맵) | ready |
| leaning-weak | 비겁(일간 오행) + 인성 | ready |
| mixed | `[]` | unresolved |
| null | `[]` | unresolved |

leaning-strong 木 예 (need-case-2): 火 output, 土 wealth, 金 official.

leaning-weak 木 예 (need-case-3): 木 peer, 水 resource.

mixedPattern으로 conditional 후보를 만들지 않는다 (need-case-1,7).

unresolvedStrengthReasons는 후보 생성에 재주입되지 않는다 (need-case-6,8).

leaning-strong 억제: `rooted-visible`이고 월령 왕/상이면 그 행만 `suppressed` + `already-established-relation`. 배열에서 삭제하지 않음. leaning-weak는 억제하지 않음.

전체 차트가 mixed이면 `buildNeedCandidateSet`는 leaning-strong 함수를 호출하지 않는다. 독립 export `collectLeaningStrongNeedCandidates`는 게이트를 우회한다 (need-case-11). 제품 경로 후보는 `buildNeedCandidateSet`.

---

## E. Climate Need 생성 구조

사용하는 Climate 필드: `temperature.status/value`, `moisture.status/value`, `certainty`.

읽지 않음: `baseClimate`, `fireQuality`, `waterQuality`, `conflicts`, `unresolvedReasons`.

| 조건 | 후보 |
|---|---|
| resolved cold | 火, reason `climate-temperature-cold` |
| resolved warm | 水, reason `climate-temperature-warm` |
| resolved dry | 水, reason `climate-moisture-dry` |
| moist | 새 火/土 없음. `climate-moisture-moist` 없음 |
| balanced | 그 축 Need 없음 |
| unresolved 축 | 그 축 Need 없음 |

temperature와 moisture가 둘 다 水를 요구하면 (warm+dry): **후보 1건**, reason **2개**, evidenceRef **2개**. 행 중복 없음 (need-case-4).

`climateCounterSignals`는 항상 `[]`. 후보 생성/삭제에 영향 없음.

Climate 후보는 항상 `status=candidate`. Climate suppressed 없음.

`climateNeedStatus`는 T/M unresolved 개수만. 후보가 없어도 ready 가능 (need-case-1).

---

## F. 중복 / 서로 다른 후보

축 **안** (Climate only): 같은 오행은 한 행으로 합치고 reason을 붙인다.

축 **사이**: 합치지 않는다. source를 유지한다.

- Strength 水 + Climate 水 → 배열 두 곳에 각각 1행 (need-case-3,5). 같으므로 최종 오행이 아님.
- Strength 木 + Climate 水 → 둘 다 유지. 제거/순위/점수 없음 (need-case-5).

NeedResolution이 나중에 겹침/대립을 분류하는 부분은 이번 규칙이 아니다.

---

## G. 후보 없음

NeedCandidate 계층 기준:

| 형태 | 의미 (이 계층) | 아님 |
|---|---|---|
| Strength `[]` + status unresolved | mixed/null 게이트의 정상 빈 배열 | 엔진 오류 |
| Climate `[]` + status ready | 축은 resolved이나 cold/warm/dry가 아님 | Climate unresolved |
| Climate `[]` + status unresolved/axis-unresolved | 축 값을 고르지 못해 Need를 안 염 | 오류 |
| 둘 다 `[]` | 두 축이 각각 후보를 안 연 상태 | 용신 없음 확정 |

최종 의미는 결정하지 않는다.

---

## H. certainty / 시간 미상

Need 파일은 hour를 읽지 않는다. certainty는 상위 요약에서 복사만 한다.

partial이어도 leaning-strong/weak 또는 resolved cold/warm/dry이면 후보가 생긴다. reason 문자열은 partial 때문에 바뀌지 않는다. 후보를 억제하지 않는다.

이것을 “시간 미상이어도 정확하다”고 번역하지 않는다. 3주 기준일 수 있다.

---

## I. 가장 위험한 규칙

| 규칙 | ruleType |
|---|---|
| leaning-strong → 식상/재/관 | INTERPRETIVE |
| leaning-weak → 비겁/인성 | INTERPRETIVE |
| RV+왕/상 → already-established-relation | INTERPRETIVE |
| cold → 火 | INTERPRETIVE |
| warm → 水 | INTERPRETIVE |
| dry → 水 | INTERPRETIVE |
| mixed/null → Strength 후보 억제 | ENGINE-POLICY |
| partial에서도 후보 생성 | ENGINE-POLICY |
| 같은 오행을 축 사이에 별도 유지 | ENGINE-POLICY |

---

## J. 사용자 노출 경계

NeedCandidate를 다음처럼 번역하면 안 된다.

- “당신에게 필요한 오행은 X”
- “용신은 X”
- “희신은 X”
- “가장 중요한 오행은 X”

NeedCandidate는 **내부 후보 계층**이다.

SAFE INTERNAL: source, hour가 상위 요약에서 omitted인지, 점수 필드가 없다는 사실.

DIAGNOSTIC ONLY: 후보 목록, reasons, status, climateNeedStatus, strengthNeedStatus.

NOT FINAL USER CONCLUSION: 모든 element 후보, Climate 火/水, Strength 식상/재/관/비겁/인성.

---

## K. 제품 API

`src/lib/saju/index.ts`는 기존처럼 `buildNeedCandidateSet` 등을 수출한다.
이번 단계의 `need-audit/` 산출물은 제품 API에 넣지 않았다.

---

## L. 하지 않은 것

- Need 엔진 수정
- Need Freeze Boundary
- NeedResolution Audit
- Needed Element / 용신 / 희신 / 점수 / 순위 / winner
- Strength / Climate 재감사 또는 수정
- 절입 v1/v2 수정
