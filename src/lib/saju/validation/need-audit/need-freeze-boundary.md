# Need Candidate Freeze Boundary

엔진 판단 코드는 이 문서로 바꾸지 않는다.
FROZEN-POLICY = 명리학적 검증 완료가 아니다.

**NeedCandidate 종료 상태:** 생성 규칙 감사 완료 + 보수 정책 경계 확정 + 핵심 Need 해석 검증 대기.

**Need 검증 완료라고 쓰지 않는다.**
NeedResolution Audit은 시작하지 않는다.

NeedCandidate 오행을 사용자 최종 Needed Element / 용신 / 희신으로 표시하지 않는다.

근거: `need-rule-inventory.json`, `need-rule-audit.md`, `need-case-trace.json`, `need-open-questions.md`.
새 Need 규칙은 만들지 않았다.

---

## 세 주장을 섞지 말 것

| 코드에서 참인 것 | 아직 검증되지 않은 것 |
|---|---|
| leaning-strong이면 식상/재/관 **행이 생긴다** | 신강이므로 설기·재·관이 **필요하다** |
| resolved cold이면 火 **후보가 생긴다** | 한이면 火가 **필요하다** |
| Strength 水와 Climate 水가 **둘 다 있다** | 같으므로 **최종 오행은 水** |
| certainty=partial인데 후보가 **있다** | 시간 미상에도 Need가 **정확하다** |

Strength 진단 ≠ Strength Need 오행 선택 ≠ Needed Element / 용신 / 희신.  
AdjustedClimate 진단 ≠ Climate Need 오행 선택 ≠ Needed Element.

---

## A. Frozen Facts (VERIFIED-FACT)

FACT 21개를 다시 확인했다. 명리 해석과 무관하게 코드에서 직접 확인 가능한 것만 올렸다. FACT 라벨만으로 자동 승격하지 않았다.

| ID | 내용 | 사용자 최종 결론 |
|---|---|---|
| NEED-001 | Strength/Climate 후보를 별도 배열로 반환 | 두 목록이 있다는 사실. 최종 오행 아님 |
| NEED-002 | NeedCandidate 실제 필드 9개 | 내부 구조. axis 필드명 없음 |
| NEED-003 | score / rank / weight / priority / winner / neededElement / yongsin / heesin **없음** | 없음 = 최종 선택이 없음 |
| NEED-004 | `buildStrengthSummary` + `buildAdjustedClimateSummary` 호출 | 입력 배선 |
| NEED-005 | Strength에서 `directionCandidate`, `certainty`만 읽음 | |
| NEED-007 | Climate에서 T/M status·value, certainty만 읽음 | 읽은 값의 명리 의미는 별층 |
| NEED-008 | baseClimate / quality / conflicts 등 미사용 | |
| NEED-018 | `collectLeaningStrongNeedCandidates`는 게이트 없음. 제품 경로는 `buildNeedCandidateSet` | 독립 함수 ≠ 제품 후보 |
| NEED-031 | Need 파일은 hour를 읽지 않음 | 시주 보정 없음 |
| NEED-032 | `existingPresence` = `analyzeElementPresence` 복사 | presence 표시 ≠ 필요 오행 |
| NEED-033 | `alreadyPresent` = presence !== absent | 이미 있다 ≠ 불필요 |
| NEED-041 | NeedResolution은 후속 소비자. 이번 단계 미감사 | 생성 규칙 아님 |
| NEED-043 | Strength evidenceRefs 문자열 3개 | 점수 아님 |
| NEED-044 | Climate evidenceRefs 문자열 | 점수 아님 |
| NEED-045 | Climate 후보 `direction`은 항상 `climate` | 십신 방향 아님 |
| NEED-048 | `seasonPhaseOf`는 억제 조건에만 사용 | 왕상으로 오행을 고르지 않음 |
| NEED-049 | 초깃값 `[]` + `strengthNeedStatus=unresolved` | 초기화 사실 |
| NEED-050 | Climate 분기는 Strength 목록을 읽지 않음 | |
| NEED-051 | Strength 분기는 Climate 축을 읽지 않음 | |
| NEED-052 | Climate add 분기는 resolved cold/warm/dry 3개뿐 | 분기 존재 ≠ 그 매핑이 타당 |
| NEED-054 | `climateCounterSignals`는 생성 루프에서 안 읽고 return 시 `[]` | 빈 슬롯 사실. 생성 미구현은 NEED-027 |

이 21개가 맞다고 해서 식상/재/관이 필요하거나, 火/水 Need가 검증된 것이 아니다.

---

## B. Frozen Conservative Policies (FROZEN-POLICY)

의도적으로 고정 가능한 **엔진 정책**. 명리 절대 정답이 아니다.

- mixed Strength → Strength 후보 `[]`, status unresolved. (NEED-012)
- null Strength → Strength 후보 `[]`, status unresolved. (NEED-013)
- `mixedPattern`으로 조건부 후보를 만들지 않음. (NEED-006, NEED-014)
- `unresolvedStrengthReasons`를 후보 생성에 재사용하지 않음. (NEED-006, NEED-013)
- Strength Need status는 leaning-strong/weak일 때만 ready. (NEED-047)
- leaning-weak는 RV+왕/상으로 억제하지 않음. (NEED-017)
- suppressed Strength 후보는 삭제하지 않고 배열에 남김. (NEED-016) *억제 조건 자체는 NEED-015.*
- Climate Need는 Adjusted 축만. baseClimate로 후보를 만들지 않음. (NEED-040)
- moist만으로 火/土 후보 없음. (NEED-023)
- balanced 축은 그 축 Climate Need를 열지 않음. 공백 ≠ unresolved. (NEED-024, NEED-034)
- unresolved Climate 축은 그 축 후보를 억지로 열지 않음. (NEED-025)
- Climate 土 / 木 / 金 Need 없음. (NEED-039, NEED-046)
- Climate 같은 오행은 한 행, reason을 붙임. reason 개수 ≠ 점수. (NEED-026)
- Climate 후보는 항상 `candidate`. (NEED-028)
- `climateNeedStatus`는 T/M unresolved 개수만. (NEED-019)
- Strength/Climate 같은 오행을 이 계층에서 합치지 않음. 최종 오행으로 승격하지 않음. (NEED-035)
- 서로 다른 오행은 둘 다 유지. 우선순위/점수/한쪽 제거 없음. (NEED-036)
- Strength만 없음 / Climate만 없음 / 둘 다 없음은 정상 빈 배열일 수 있음. 오류가 아님. (NEED-037, NEED-038)
- certainty는 복사만. 생성 가드가 아님. (NEED-029, NEED-030, NEED-053)

FROZEN-POLICY는 “임의 결론을 내지 않는다”를 고정한다. 용신 정답이 아니다.

---

## C. Interpretive Rules Not Yet Validated (REQUIRES-INTERPRETIVE-VALIDATION)

INTERPRETIVE 7개. 코드·테스트 통과 ≠ 명리 검증. 자동 동결하지 않음.

| ID | 내용 |
|---|---|
| NEED-009 | 일간 오행 → 인성/식상/재/관 맵 |
| NEED-010 | leaning-strong → 식상 / 재 / 관 |
| NEED-011 | leaning-weak → 비겁 / 인성 |
| NEED-015 | RV + 왕/상 → `already-established-relation` |
| NEED-020 | resolved cold → 火 |
| NEED-021 | resolved warm → 水 |
| NEED-022 | resolved dry → 水 |

사용자에게 “당신에게 火가 필요합니다”로 번역하지 않는다.

---

## D. OPEN

구현 또는 정책 결정이 없다. 새 규칙으로 OPEN을 메우지 않는다.

| ID | 내용 |
|---|---|
| NEED-027 | `climateCounterSignals`는 항상 `[]`. 생성 로직 없음 |
| NEED-042 | `climate-moisture-already-moist` **not implemented** |

후보 생성/삭제에 영향 없음. 과거 설계를 구현된 것처럼 적지 않는다.

---

## E. Strength Need freeze 상태

| 입력 | 동작 | freezeStatus |
|---|---|---|
| leaning-strong → 식상/재/관 | 후보 생성 | REQUIRES-INTERPRETIVE-VALIDATION |
| leaning-weak → 비겁/인성 | 후보 생성 | REQUIRES-INTERPRETIVE-VALIDATION |
| mixed → `[]` | 후보 미생성 | FROZEN-POLICY |
| null → `[]` | 후보 미생성 | FROZEN-POLICY |
| mixedPattern 재사용 금지 | | FROZEN-POLICY |
| 십신 맵 자체 | | REQUIRES-INTERPRETIVE-VALIDATION |

---

## F. Climate Need freeze 상태

| 입력 | 동작 | freezeStatus |
|---|---|---|
| resolved cold → 火 | 후보 생성 | REQUIRES-INTERPRETIVE-VALIDATION |
| resolved warm → 水 | 후보 생성 | REQUIRES-INTERPRETIVE-VALIDATION |
| resolved dry → 水 | 후보 생성 | REQUIRES-INTERPRETIVE-VALIDATION |
| moist → 火/土 없음 | 미생성 | FROZEN-POLICY |
| balanced / unresolved 축 미개방 | | FROZEN-POLICY |
| Adjusted만 사용 | | FROZEN-POLICY |
| counterSignal | 항상 `[]`, 미구현 | OPEN |

---

## G. partial certainty 경계

코드/정책: partial이어도 후보가 생길 수 있다. reason은 바뀌지 않는다. 억제하지 않는다. (NEED-029, NEED-030, NEED-053 → FROZEN-POLICY)

해석: partial 후보가 사용자에게 충분히 정확하다 = **검증되지 않음.**

시간 미상 결과를 “시간이 없어도 정확한 Need”로 번역하지 않는다. 3주 기준일 수 있다.

---

## H. 동일 오행 후보 경계

Climate 내부: warm + dry → 水 **1건** + reasons **2개**. (NEED-026 FROZEN-POLICY)

Strength와 Climate 사이: 같은 水라도 **별도 축 후보 유지.** source 유지. reason을 축 간에 합치지 않음. (NEED-035 FROZEN-POLICY)

같다는 이유만으로 `confirmed` / `priority` / `winner` / `final` / `neededElement`로 승격하지 않는다.

---

## I. 서로 다른 후보 경계

예: Strength → 木, Climate → 水.

NeedCandidate 단계: **둘 다 유지.** (NEED-036 FROZEN-POLICY)

금지: 우선순위, 점수 비교, 한쪽 제거, 최종 Needed Element.

NeedResolution의 후속 판단과 섞지 않는다.

---

## J. 후보 없음 경계

| 경우 | 이 계층 | 번역 금지 |
|---|---|---|
| Strength만 `[]` | mixed/null 게이트의 정상 빈 배열 + unresolved | 오류, 용신 없음 |
| Climate만 `[]` | ready(축 resolved·비한난조) 또는 unresolved | 균형이 완벽하다 |
| 둘 다 `[]` | 각 축이 후보를 안 연 상태 | 필요한 오행이 없다 |

빈 배열은 정상적인 엔진 결과일 수 있다. 최종 의미를 결정하지 않는다.

---

## K. 사용자 노출 금지

NeedCandidate는 **내부 후보 계층**이다.

직접 쓰면 안 되는 표현:

- 필요한 오행은 X
- 당신에게 X가 필요합니다
- 용신은 X
- 희신은 X
- 가장 중요한 오행은 X
- X가 1순위입니다
- X가 최종 선택입니다

SAFE INTERNAL: source, 점수 필드 없음, hour를 Need가 보정하지 않음.

DIAGNOSTIC ONLY: 후보 목록, reasons, status, strengthNeedStatus, climateNeedStatus.

NOT FINAL USER CONCLUSION: 모든 element 후보.

---

## L. 지금 동결 가능 / 아직 동결 불가

**지금 동결 가능**

- 코드 사실 (필드, 배선, 점수 없음)
- 보수적 후보 미생성/유지 정책 (mixed/null, moist, balanced, unresolved 축)
- 축 분리 (같은 오행도 승격하지 않음, 다른 오행 둘 다 유지)
- 비점수 구조
- 비최종결론 구조

**아직 동결 불가**

- Strength → 오행 후보 해석 (식상/재/관, 비겁/인성, 십신 맵, 억제 조건)
- Climate → 오행 후보 해석 (cold→火, warm→水, dry→水)
- partial 결과의 해석적 신뢰성
- 후보 간 우선순위
- 최종 Needed Element
- 용신 / 희신
- 점수 / 랭킹

---

## M. High-risk 해석 (삭제·수정 금지)

전문가/문헌 검증 대상. 제품 단정 금지.

- leaning-strong → 식상/재/관
- leaning-weak → 비겁/인성
- 십신 오행 맵
- RV+왕/상 억제
- cold → 火
- warm → 水
- dry → 水

상세: `need-open-questions.md`.

---

## NeedCandidate 단계 종료 상태

NeedCandidate 상태:

생성 규칙 감사 완료  
+ 보수 정책 경계 확정  
+ 핵심 Need 해석 검증 대기

Need 검증 완료가 아니다.
NeedResolution Audit은 이 문서의 범위가 아니다.
