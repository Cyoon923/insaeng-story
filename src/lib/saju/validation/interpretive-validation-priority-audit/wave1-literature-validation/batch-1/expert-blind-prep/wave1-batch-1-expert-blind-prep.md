# Wave 1 Batch 1 — Expert Blind Validation Preparation

엔진 판단 코드는 이 문서로 바꾸지 않는다.
STR-010 / STR-011 규칙, freezeStatus, literature verdict를 바꾸지 않는다.
AI가 전문가 답변·expected를 만들지 않는다.
실제 Pilot 실행·comparison 실행은 하지 않는다.

**목적:** STR-010·STR-011을 엔진 결과와 문헌 verdict를 가린 채 전문가에게 물을 수 있는 블라인드 프로토콜만 준비한다.

선행:
- `wave1-batch-1-literature-validation.md`
- `wave1-batch-1-evidence-hardening.md`
- `src/lib/saju/validation/pilot/` (재사용)

문헌 상태(참고·전문가에게 비공개):

| rule | literature verdict | confidence | expert required |
|---|---|---|---|
| STR-010 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| STR-011 | CONTESTED | MEDIUM | YES |

---

## A. Validation purpose

1. 일간 **세력** 판단에서 십신이 어떤 방향의 영향을 준다고 보는가
2. 그 영향끼리 **같은 Strength side**로 묶을 수 있는가
3. 조건·예외·정편·幫/助·泄/傷 차이를 전문가가 어떻게 두는가

이번 검증은 Needed Element / 용신 / 희신 / NeedCandidate / NeedResolution을 묻지 않는다.

---

## B. Target rules (엔진 정의 기준)

| rule | 엔진 내용 | 이번 블라인드에서 묻는 것 |
|---|---|---|
| STR-010 | 비견·겁재·편인·정인 → support | 비겁·인성이 세력에 미치는 방향과 묶음 가능 여부 |
| STR-011 | 식신·상관·편재·정재·편관·정관 → pressure | 식상·재·관이 세력에 미치는 방향과 묶음 가능 여부 |

**RN-EB-001:** 준비 지시문의 「STR-010 관련 / STR-011 관련」 예시 목록이 엔진 rule ID와 뒤바뀌어 있었다. 본 문서는 **엔진 inventory 정의**에 맞춰 질문을 배치한다. 지시문이 원한 질문 내용은 모두 포함한다.

---

## C. 기존 Pilot 구조 재사용

새 검증 시스템을 만들지 않는다. 다음을 재사용한다.

| Pilot 자산 | 이번 사용 |
|---|---|
| `expert-review-form.md` | 블라인드 원칙(엔진 미공개, 자유 표현) |
| `expert-mapping-guide.md` | Phase A 원문 보존 → 사람 mapping |
| `pilot-comparison-template.json` | 이후 comparison의 matchStatus |
| `cases.json` emptyExpertRaw / emptyExpertReview | 필드 비움 패턴 |
| `validation/types.ts` PilotExpertRaw, PilotExpertMapping, ComparisonMatchStatus | enum·층 이름 |

추가하는 것: STR-010/011 전용 질문·십신 세력 효과 schema만. Pilot 5건 전체를 재실행하지 않는다.

---

## D. 개념 분리 (질문·채점 모두)

| 코드 | 개념 | 이번 대상 |
|---|---|---|
| A | 일간 세력 / 강약 | **예** |
| B | 십신 기능(생·설·극·耗 등) 중 세력에 직접 필요한 부분 | **예** |
| C | 격국 | **아니오** (유도·역추론 금지) |
| D | 용신 / 희신 | **아니오** |

전문가 안내문에 명시:

> 이 질문지는 격국 성패나 용신·희신을 묻지 않습니다.  
> 일간의 세력(강·약·혼재·판단 보류)에 각 십신이 어떤 영향을 준다고 보시는지에만 답해 주세요.

격국/용신으로 Strength 묶음을 역추론하지 않는다.

---

## E. Blind protocol

### E1. Leakage prevention — 전문가에게 숨김

- STR-010 / STR-011 rule id·원문
- `support` / `pressure` / leaning-strong / leaning-weak / mixed
- 엔진 StrengthSummary·NeedCandidate·NeedResolution
- literature verdict / evidence confidence / supporting·conflicting evidence
- 엔진 grouping 문구: 「식상·재·관 = 한쪽」「비겁·인성 = 한쪽」

### E2. 전문가에게 보여도 되는 것

- (추상 라운드) 질문지만. 명식 없음
- (명식 라운드, 추후) Pilot과 동일: 생년월일·시간·양/음력·필요 시 사주 원국. caseId만. 실명·상담 내용 금지

### E3. 절차 순서

1. Phase A Open Response (선택지 없음)
2. Phase A 원문을 `expertRaw` 계열에 그대로 저장
3. Phase B Structured Response — **사람**이 원문을 보고 채움. 엔진·AI 자동 채움 금지
4. (나중) literature·engine과 comparison. **이번 단계에서는 실행하지 않음**

### E4. 정답 자동 변환 금지

이후 비교에서도:

- 다수결 = 정답 금지
- 경력 최장 = 정답 금지
- 특정 학파 = 정답 금지

학파·체계 차이는 provenance에 보존한다.

---

## F. Expert instructions (배포용 요지)

1. 자신의 명리 체계·용어로 답한다. 제시된 선택지를 몰라도 된다.
2. 세력 판단만 답한다. 격국·용신·희신 결론으로 대체하지 않는다.
3. 확실하지 않으면 “조건에 따라”, “세력만으로는 분류하기 어렵다”고 적어도 된다. 한 답을 강요하지 않는다.
4. 다른 전문가 답·문헌 결론·소프트웨어 결과를 보지 않는다.

---

## G. Phase A — Open Response questions

엔진 용어·묶음 예시를 넣지 않는다. 유도 문장 금지.

### Scope check (공통)

| id | question |
|---|---|
| Q-SCOPE-01 | 일간의 세력(강·약·혼재·판단 보류 등)을 볼 때, 다른 천간·지지의 십신을 어떻게 반영하십니까? 격국이나 용신 판단과 구분해서 설명해 주세요. |

### STR-011 관련 (식상·재·관 — 엔진 pressure 쪽)

| id | question |
|---|---|
| Q-011-01 | 식신·상관이 일간 세력에 어떤 영향을 준다고 보십니까? |
| Q-011-02 | 정재·편재가 일간 세력에 어떤 영향을 준다고 보십니까? |
| Q-011-03 | 정관·편관이 일간 세력에 어떤 영향을 준다고 보십니까? |
| Q-011-04 | 위의 식상·재·관 가운데, 세력 판단에서 **같은 방향**으로 묶을 수 있는 것이 있습니까? 있다면 어떻게, 없다면 왜 다른지 적어 주세요. |
| Q-011-05 | 같은 방향으로 묶는다면 **어떤 조건**에서 가능하다고 보십니까? 조건이 없다면 그렇게 적어 주세요. |

### STR-010 관련 (비겁·인성 — 엔진 support 쪽)

| id | question |
|---|---|
| Q-010-01 | 비견·겁재가 일간 세력에 어떤 영향을 준다고 보십니까? |
| Q-010-02 | 정인·편인이 일간 세력에 어떤 영향을 준다고 보십니까? |
| Q-010-03 | 비겁과 인성을 세력 판단에서 **같은 방향**으로 묶을 수 있습니까? 이유와 예외가 있으면 적어 주세요. |
| Q-010-04 | 편인을 정인과 세력 방향에서 같게 볼 수 있는 경우와, 다르게 봐야 하는 경우가 있습니까? |
| Q-010-05 | 비겁의 도움(幫 등)과 인성의 생(生 등)을 세력의 **같은 방향**으로 둘 수 있습니까? 같은 방향과 같은 강도는 구분해야 한다고 보십니까? |

Open-response question 수: **11** (Q-SCOPE-01 + Q-011-01…05 + Q-010-01…05)

---

## H. Phase B — Structured Response schema

Phase A 원문 **이후**, 사람이 채운다. 전문가에게 먼저 enum을 강요하지 않아도 된다. Pilot의 mapping 단계와 같다.

### H1. 십신별 세력 효과

필드 `effect` 허용값 (신규, Strength 십신 효과 전용):

| value | 의미 |
|---|---|
| strengthens | 세력을 돕는 쪽으로 본다 |
| weakens | 세력을 약화하는 쪽으로 본다 |
| conditional | 조건에 따라 다름 |
| neutral | 세력에 직접 영향이 거의 없다 |
| not-directly-classifiable | 세력축으로 분류하기 어렵다 |
| depends-on-context | 명식·월령 등 맥락에 달림 |

대상 십신 키 (한국어 라벨 유지):

`비견`, `겁재`, `정인`, `편인`, `식신`, `상관`, `정재`, `편재`, `정관`, `편관`

→ structured field: `shiShenEffects[]` 항목당 `{ shiShen, effect, conditionNote }`  
십신 10개 × (effect + conditionNote) 구조.

### H2. 묶음 판단

| field | 허용값 |
|---|---|
| `groupPeerResource` (비겁·인성) | can-group-as-same-side / can-group-conditionally / cannot-group / depends-on-context / not-comparable |
| `groupOutputWealthOfficial` (식상·재·관) | 동일 enum |
| `zhengPianSameForStrength` | always-same / sometimes-same / never-same / depends-on-context / not-comparable |
| `bangVsShengSameDirection` | same-direction / different-direction / conditional / not-comparable |
| `sameDirectionMeansSameIntensity` | yes / no / conditional / not-comparable |
| `answeredForStrengthOnly` | true / false / unclear |

### H3. Pilot 재사용 필드

| field | 출처 |
|---|---|
| reviewerId | ExpertReview |
| reviewDate | ExpertReview |
| reviewConfidence | high / medium / low |
| expertStrengthRaw | PilotExpertRaw 계열 확장 |
| mapping.mappedBy | PilotExpertMapping |
| mapping.mappingNotes | PilotExpertMapping |

Structured-response **핵심 field 수 (집계용):** 16  
(= shiShenEffects 컨테이너 1 + 십신 effect 슬롯 10 + group 필드 5; provenance는 별도 §J)

집계를 단순화하면 Phase B top-level fields:

1. `shiShenEffects`
2. `groupPeerResource`
3. `groupOutputWealthOfficial`
4. `zhengPianSameForStrength`
5. `bangVsShengSameDirection`
6. `sameDirectionMeansSameIntensity`
7. `answeredForStrengthOnly`
8. `strengthAssessmentRaw`
9. `mappingNotes`
10. `reviewConfidence`

→ 보고용 **structured-response field 수: 10** (top-level). 십신별 effect는 `shiShenEffects` 내부 10슬롯.

---

## I. Case 필요 여부

**추상 질문만으로 부족하다.**  
조건·정편·幫/助 분리는 명식 맥락에서 전문가 답이 갈릴 가능성이 크다 (문헌 hardening의 unresolved와 동일).

이번 단계: **실제 명식·expected를 만들지 않는다.**  
다음 실행 단계에서 쓸 **case 설계 기준**만 둔다.

### Case 설계 기준 (입력 조건만. 엔진 direction으로 고르지 않음)

| category id | 목적 |
|---|---|
| C-PEER | 비겁 영향이 상대적으로 분리되어 보이기 쉬운 입력 |
| C-RESOURCE | 인성 영향이 상대적으로 분리되어 보이기 쉬운 입력 |
| C-OUTPUT | 식상 영향이 상대적으로 분리되어 보이기 쉬운 입력 |
| C-WEALTH | 재성 영향이 상대적으로 분리되어 보이기 쉬운 입력 |
| C-OFFICIAL | 관살 영향이 상대적으로 분리되어 보이기 쉬운 입력 |
| C-ZHENG-PIAN | 정/편 대비를 관찰하기 쉬운 입력 |

제안 category 수: **6**

금지:

- 엔진 leaning / support·pressure 결과를 보고 명식을 고르거나 제작
- 특정 전문가 답을 맞추기 위한 인위 명식
- 설계용 fixture (`axisReview`, `conflictType` 등)를 블라인드 case로 재사용 (Pilot `doNotReuseDesignFixtures`와 동일)

수집 후 분포만 기록한다. 할당량을 채우려고 조작하지 않는다 (blind-validation-plan과 동일).

---

## J. Expert provenance schema

익명. 실명·연락처·상담 내용 저장 금지.

| field | 필수 | 설명 |
|---|---|---|
| expertId | 예 | 익명 코드 (예: E-A, E-B) |
| yearsOfPractice | 권장 | 경력 연수 또는 구간 |
| primarySchoolOrSystem | 권장 | 주된 학파/체계 (자유 기술) |
| trainingBackground | 선택 | 학습 배경 (자유 기술) |
| strengthJudgmentFramework | 권장 | 사용하는 강약 판단 체계 설명 |
| responseDate | 예 | 답변 날짜 |
| questionSetVersion | 예 | 예: `w1b1-shiShen-strength-v1` |
| caseSetVersion | 조건 | 명식 라운드일 때만 |

Pilot `reviewerId` = `expertId`에 대응.

---

## K. Literature / engine masking

| 자료 | 전문가 배포 묶음 | 이후 comparison 묶음 |
|---|---|---|
| 질문지·원국(해당 시) | 포함 | 포함 |
| literature verdict·evidence | **제외** | 포함 가능 |
| engine grouping·direction | **제외** | 포함 가능 |
| 본 prep 문서의 §문헌 상태 표 | **제외** | 운영자만 |

운영자용 체크리스트: 배포 ZIP/인쇄물에 `PARTIALLY-SUPPORTED`, `CONTESTED`, `support`, `pressure`, `STR-010`, `STR-011` 문자열이 없는지 검색한다.

---

## L. Later comparison plan (실행 금지 — 설계만)

1. Phase A raw 보존
2. 사람 Phase B mapping
3. 엔진 결과·문헌 verdict는 **별 파일**에서만 연다
4. layer 예: `shiShen-strength-effect`, `group-peer-resource`, `group-output-wealth-official`
5. status: Pilot과 동일 — match / partial-match / difference / expert-unresolved / engine-unresolved / not-comparable
6. 학파 차이는 `difference`와 `not-comparable`로 남기고 정답화하지 않음
7. 다수결·경력가중 자동 규칙 없음

이번 단계에서 comparison items를 채우지 않는다.

---

## M. Unresolved (전문가 실행 전에도 유지)

| id | issue |
|---|---|
| W1B1-U1 | 세력 vs 격국/용신 미수렴 — 질문으로 분리만 함 |
| W1B1-U2 | 편인 生氣 vs 倒食 — Q-010-04로 물을 예정 |
| W1B1-U3 | 幫 vs 助 / 泄 vs 傷 — Q-010-05, Q-011-04로 물을 예정 |
| W1B1-U4 | 정/편 Strength 동일 취급 — Q-010-04, structured `zhengPianSameForStrength` |
| W1B1-U5 | 沈 黨眾 범위 — 전문가 자유 서술 + 추후 문헌 재대조 |
| W1B1-EB-01 | 추상 답과 명식 답이 어긋날 수 있음 — case 라운드 필요 |
| W1B1-EB-02 | 학파별 용어 차이로 mapping `not-comparable` 다수 가능 |

---

## N. 이번 단계 산출물 상태

| 항목 | 수 |
|---|---|
| expert answer | **0** |
| expert expected | **0** |
| Pilot 5건 실행 | **하지 않음** |
| comparison 실행 | **하지 않음** |

---

## O. 하지 않은 것

- 엔진 / STR-010·011 / literature verdict / freezeStatus 변경
- VERIFIED-FACT, 새 명리 규칙, 점수
- Needed Element / 용신 / 희신
- AI 전문가 답·expected
- Batch 2
