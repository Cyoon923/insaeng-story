# 블라인드 검증 데이터셋 계획

이 문서는 검증 설계다. 명리 판단 규칙이 아니다.
엔진 결과를 expected에 복사하지 않는다.
Needed Element / 정확도 % / 용신 공식을 만들지 않는다.

기존 설계용 명식과 섞지 않는다.

- 설계용: `src/lib/saju/__tests__/axisReview.fixtures.json` (16개)
- 설계용 충돌 유형: `src/lib/saju/__tests__/conflictType.fixtures.json` (C/I)
- 블라인드: `src/lib/saju/validation/` 아래 3종 세트

한두 건이 틀렸다고 규칙을 바로 바꾸지 않는다. 반복 오류 패턴을 찾는다.

---

## 1. 목적

규칙 설계에 쓰지 않은 새 명식으로 다음을 확인한다.

1. 만세력이 정확한가
2. 원재료 라벨이 정확한가
3. Strength 판단이 전문가와 얼마나 일치하는가
4. Climate 판단이 얼마나 일치하는가
5. Need 후보가 어느 지점에서 달라지는가
6. 엔진이 “결정 불가”로 막은 것이 적절한가

세 질문을 한 “검증 완료”로 합치지 않는다.

---

## 2. 3종 세트 (파일 분리)

| 세트 | 폴더 | 근거 | 전문가 |
|---|---|---|---|
| A. Calculation | `calculation/cases.json` | KASI 등 공식 역서 | 불필요 |
| B. Rule-table | `rule-table/cases.json` | 지장간·십신·왕상휴수사·통근 표 | 불필요 |
| C. Interpretive blind | `interpretive/cases.json`, `blind.cases.json` | 전문가 블라인드 판정 | 필요 |

A/B 정답을 엔진 출력으로 채우지 않는다.
C의 `expertReview`에 엔진 값을 복사하지 않는다.

---

## 3. 단계 크기

처음부터 500개를 만들지 않는다.

| Phase | 누적 (Interpretive) | 조건 |
|---|---|---|
| 1 | 30 | 아래 분포를 의도적으로 커버 |
| 2 | 80 | 30에서 반복 오류가 보이면 먼저 분석. 80 중 20건은 2명 교차검증 권장 |
| 3 | 150~200 | 문제가 큰데 계속 채우지 않음 |

표본을 엔진 direction에 맞춰 억지로 만들지 않는다.
실제 분포가 목표와 다르면 coverage에 그대로 기록한다.

---

## 4. Phase 1 Interpretive 분포 목표

목표일 뿐, 할당량을 채우려고 명식을 조작하지 않는다.

### 시간

- 확정 20
- 미상 10

시간 미상이 더 많아지면 Strength 검증이 흐려진다.

### Strength direction (가능하면 mixed를 가장 많이)

- leaning-strong 6
- leaning-weak 6
- mixed 12
- unresolved 6

각 유형 최소 5.

엔진 결과를 보고 표본을 골라 direction 할당을 맞추지 않는다.
수집 후 분포를 기록한다.

### seasonal phase

왕 / 상 / 휴 / 수 / 사 각 최소 4.
辰未戌丑만으로 한 phase가 과대표집되지 않게 한다.

### rootQuality

- clear 8
- present 6
- shallow 6
- absent 8

정확히 맞출 필요는 없다. 어느 하나가 1~2개면 보강한다.

### mixedPattern

가능한 패턴을 각 최소 2개 목표.

- strong-base-with-pressure
- weak-season-with-support
- weak-season-root-under-pressure
- shallow-root-under-pressure
- help-season-absent-root
- neutral-season-conflict
- other-mixed

실제 명식에서 찾기 어려우면 억지로 만들지 않고 `not-observed`로 기록한다.

### Climate

temperature: cold / balanced / warm 모두.
moisture: dry / balanced / moist 모두.

반드시 포함 목표:

- cold+moist
- balanced+moist
- warm+dry
- balanced+dry
- balanced+balanced

warm+moist는 현재 구조상 관측이 어렵면 억지로 만들지 않는다.

### NeedRelation

- no-candidates 5
- strength-only 3
- climate-only 3
- partial-overlap 3
- disjoint 3

exact-overlap, suppressedShared: 드물거나 없으면 없어도 됨.

### 일간

甲乙丙丁戊己庚辛壬癸 모두. 각 최소 2 이상적. 한두 일간만 과다하지 않게.

### 월지 辰未戌丑

월지로 각 최소 3. 년지만 있는 사례보다 월령 검증을 우선한다.

- 辰 습토
- 未 조열토
- 戌 조토
- 丑 한습토

기준 숫자는 `coverage.criteria.json`에 둔다. 정확도 점수가 아니다.

---

## 5. Calculation Set 계획

전문가 해석과 섞지 않는다.
expected는 공식 자료에서만 채운다. 엔진 시각/원국을 expected에 복사하지 않는다.

### 날짜 경계 (야자시)

일반 해석 세트와 분리한다.

- 22:59
- 23:00
- 23:30
- 23:59
- 00:00
- 00:59
- 01:00

한 정책을 정답으로 하드코딩하지 않는다.
같은 입력을 `night_ja` / `early_ja`로 나란히 저장할 수 있다.

### 절입 경계 (Phase 1)

입춘, 경칩, 입하, 입추, 입동, 대설.
각 절: 1분 전 / 절입 시각 / 1분 후.
최소 6절 × 3.
KASI 시각을 expected로 쓴다. 이후 12절 전체로 확대.

### 연도

1900 근처, 1948~1960 DST, 1987~1988 DST, 1984, 2000, 2020, 2024, 2050 근처, 2099/2100.

### 음력/윤달

일반 음력, 윤달, 평달/윤달 같은 월 비교, 큰달/작은달, 윤년, 2100 비윤년.

Interpretive Set은 연대별 균등이 필수는 아니다.

---

## 6. Rule-table Set 계획

표와 직접 비교한다. 전문가 블라인드가 아니다.

- 천간/지지 오행
- 지장간
- 십신
- 왕상휴수사
- 통근 정의
- presence
- exactStemVisible

설계용 16/C/I를 여기로 옮기지 않는다. 설계용은 회귀용으로 남긴다.
Rule-table 블라인드는 설계에 쓰지 않은 기둥/지장간 조합을 나중에 채운다.

---

## 7. 전문가에게 보여줄 것 / 받지 않을 것

먼저 엔진 결과를 보여주지 않는다.

주는 것:

- 생년월일, 출생시간, 양력/음력
- 필요 시 표준시(KST) / 진태양시 미반영 안내
- 또는 이미 확정된 Four Pillars

받지 않게 할 것: 이름, 상담 내용, 엔진 용어 강요.

전문가가 쓰는 것 (자신의 언어):

- 원국 확인
- 월령
- 통근
- 일간 세력 방향
- 한난조습
- 필요한 오행 후보
- 판단 보류 여부
- 근거

엔진 용어(`mixed`, `leaning-weak`, `NeedCandidate`, `NeedResolution`)를 사전에 강요하지 않는다.
비교 단계에서 맵핑한다.

전문가 1명 = 절대 정답이 아니다.
불일치 시: 엔진 근거 → 전문가 근거 → 문헌/다른 전문가.
Phase 2부터 80건 중 20건 교차검증을 권장한다.

---

## 8. ExpertReview 필드

한 명식:

- reviewerId (익명 코드. 실명 금지)
- reviewDate
- fourPillarsConfirmed
- dayMaster
- monthCommand
- rootAssessment
- strengthAssessment
- climateAssessment
- candidateElements[]
- cannotDetermine
- reasons[]
- comments
- reviewConfidence: high / medium / low

reviewConfidence는 자기평가다. 엔진 certainty와 숫자 비교하지 않는다.
비어 있는 채가 정상이다. 엔진 값으로 채우지 않는다.

---

## 9. 비교 단위와 상태

최종 오행 하나만 비교하지 않는다.

1. Four Pillars
2. Month Command
3. Root
4. Strength direction
5. Mixed/ambiguous 여부
6. Climate temperature
7. Climate moisture
8. Need candidates
9. Decision blocked 여부

각 층 상태:

- match
- partial-match
- difference
- expert-unresolved
- engine-unresolved
- not-comparable

숫자 점수는 만들지 않는다.

---

## 10. Blind case 상태

- unreviewed
- engine-run
- expert-reviewed
- compared
- regression

상태가 expert 값을 자동 생성하지 않는다.
engine-run이어도 expertReview는 비워 둔다.

---

## 11. 규칙 수정 조건

1건 불일치 → 즉시 수정 금지.

검토 조건 예:

- 같은 mixedPattern에서 반복 불일치
- 같은 seasonal phase에서 반복
- 같은 rootQuality에서 반복
- 전문가 2명과 엔진이 같은 방향으로 반복 불일치
- 공식 자료와 계산이 반복 불일치

“이 명식만 맞추는 예외 규칙” 금지.

---

## 12. 실패 사례 보존 (regression)

규칙을 고쳐도 실패 케이스를 삭제하지 않는다.

예: interpretive-017에서 오류 → 규칙 검토 → 017은 regression으로 남김 → 같은 종류의 새 blind 건으로 재검증.

테스트를 통과시키려고 expected를 엔진 결과로 바꾸지 않는다.

---

## 13. 출처와 개인정보

Calculation: KASI publication/API/document ID.
Interpretive: `expert-review-001` 같은 코드. 실명 없음.

fixture에 이름을 넣지 않는다. caseId만 사용.
동의 없는 실존 인물 생년월일을 넣지 않는다.
상담 내용을 넣지 않는다.

---

## 14. Coverage checklist

30개가 모이면 아래 카운트만 출력한다. 판단 규칙도, 정확도 %도 아니다.

- dayStem
- seasonPhase
- rootQuality
- Strength direction
- mixedPattern (`not-observed` 포함)
- temperature / moisture
- NeedRelation
- hour certainty
- 월지 辰未戌丑

구현은 나중. 지금 기준은 `coverage.criteria.json`.

---

## 15. 이번 단계에서 하지 않은 것

- 엔진 판단 함수 수정
- Needed Element / Need Score
- 정확도 % 자동 산출
- 실제 30명 명식 입력
- UI / 음악 추천
