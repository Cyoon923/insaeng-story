# 전문가 답변 mapping 안내 (Pilot)

엔진이 자동 mapping하지 않는다. 사람이 한다.
원문을 엔진 용어로 덮어쓰지 않는다.
Pilot 5건 차이로 Strength / Climate / Need 규칙을 바꾸지 않는다.

---

## STEP A. 원문 저장

`expertRaw`에 질문 1~10 답을 그대로 둔다.

특히 아래 세 칸을 남긴다.

- `expertStrengthRaw`
- `expertClimateRaw`
- `expertNeedRaw`

예:

전문가: “신약에 가깝지만 뿌리가 있어 아주 약하지는 않다”

저장:

```
expertStrengthRaw: "신약에 가깝지만 뿌리가 있어 아주 약하지는 않다"
```

이것을 즉시 `leaning-weak`로 하드코딩하지 않는다.
`expertReview.strengthAssessment`에도 원문 또는 전문가 표현만 둔다.

---

## STEP B. 사람 비교용 mapping

`mapping` 칸만 사용한다.

| 필드 | 값 |
|---|---|
| mappedBy | 매핑한 사람 식별 코드. 실명 금지 |
| mappingNotes | 표현 차이와 판단 차이 메모 |
| strength | strong / weak / mixed / unresolved / not-comparable |
| climateTemperature | cold / balanced / warm / not-comparable |
| climateMoisture | dry / balanced / moist / not-comparable |
| needCandidates | 전문가가 말한 오행 목록. 없으면 [] |
| cannotDetermine | true / false / null(아직 모름) |

엔진 `leaning-strong` 같은 값을 mapping에 자동 복사하지 않는다.

---

## 표현 차이와 판단 차이

표현 차이 예:

- 엔진 = mixed
- 전문가 = “신약 쪽이지만 강한 인성이 있어 단정 어려움”

무조건 difference로 두지 않는다.

`mappingNotes` 예: `weak tendency + ambiguity`

Strength 층은 `partial-match`를 검토한다.

판단 차이 예:

- 엔진 = leaning-strong
- 전문가 = 명확한 신약

이는 difference.

---

## 비교 층과 상태

비교하는 층만:

- four-pillars
- month-command
- root
- strength-direction
- climate-temperature
- climate-moisture
- need-candidates
- decision-blocked

상태만:

- match
- partial-match
- difference
- expert-unresolved
- engine-unresolved
- not-comparable

점수는 만들지 않는다.

전문가가 해당 층을 비웠으면 `expert-unresolved`.
엔진이 결정을 막았으면 `engine-unresolved` 또는 `decision-blocked` 층을 본다.
질문이 서로 다른 대상을 가리키면 `not-comparable`.

---

## Need 비교

최종 Needed Element 정답률을 만들지 않는다.

전문가가 `木`이라고 했고 엔진이 strengthCandidate `木` + climateCandidate `水`이면
전체를 한 번에 difference로 만들지 않는다.

각각 본다.

1. 전문가 木가 엔진 후보 안에 있는가
2. 엔진이 추가 후보를 왜 남겼는가 (메모만. 규칙을 지금 고치지 않음)
3. 엔진 decisionBlocked와 전문가 cannotDetermine가 맞는가

전문가가 한 오행을 고르지 않았으면 그것이 정상일 수 있다.
cannotDetermine를 실패로 보지 않는다.

---

## 차이 분류 (규칙 수정 전)

5건에서 차이가 나도 규칙을 바꾸지 않는다.

우선 분류:

1. 질문 문제
2. mapping 문제
3. 전문가 학파 차이
4. 엔진 구조 문제 후보

반복 오류 판단은 본 검증(30건) 이후.

---

## 30건 확대 조건

아래가 모두 끝난 뒤에만 Phase 1 30건으로 간다.

- 5건 engine report 생성
- 5건 expert review 독립 작성
- 5건 raw 보존
- 5건 사람 mapping 완료
- 5건 layer comparison 완료
