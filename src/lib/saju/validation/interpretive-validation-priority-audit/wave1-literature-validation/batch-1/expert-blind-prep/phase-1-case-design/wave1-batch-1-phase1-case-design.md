# STR-010 / STR-011 Phase 1 — Case Design

엔진 코드·STR-010/011 verdict·freezeStatus는 바꾸지 않는다.  
expected Strength를 작성하지 않는다.  
engine Strength / Need 결과를 조회·기록하지 않는다.  
전문가 답을 생성하거나 Phase 1을 실행하지 않는다.  
새 점수·가중치·threshold·명리 규칙을 만들지 않는다.  
Pilot 5건 명식을 재사용하지 않는다.

**목적:** Phase 1 전문가 블라인드용 **추가 case set 설계만** 한다.

선행:
- Pilot closure: `pilot-5-cases/aggregate/wave1-batch-1-expert-pilot-closure.md`
- Pilot 5 (재사용 금지): w1b1-blind-01…05

---

## 1. 선정 원칙

**사용 (raw only)**
- calculation/cases.json 출생 입력
- 천간·지지·월지 지장간
- 일간 기준 `shiShenOf` raw 라벨 (가시 천간·월지 지장간)

**사용 금지**
- StrengthSummary / directionCandidate / leaning-* / mixed
- NeedCandidate / NeedResolution
- Pilot·aggregate 전문가 답을 “정답”으로 한 선정
- 원하는 Strength가 나오게 명식 조작·신규 생년월일 창작
- 설계용 fixture (`axisReview`, `conflictType`, `needSuppression` 등)

**중복 방지**
- Pilot 5 생년월일·동일 원국 제외
- 동일 원국 lunar/solar 중복(예: 1984-02-02 vs lunar-1984-0101)은 **하나만**
- 축당 1차 case 1건 우선 (한 case가 부축을 겸하면 inventory에 secondary로만 표기)

---

## 2. Case set (8건)

| caseId | sourceId | 달력 | 출생 입력 | 원국 (전문가 제시용) |
|---|---|---|---|---|
| w1b1-p1-01 | calc-lichun-1984-after-noon | 양력 | 1984-02-06 12:00 KST | 甲子 丙寅 庚午 壬午 |
| w1b1-p1-02 | calc-day-2024-01-01 | 양력 | 2024-01-01 12:00 KST | 癸卯 甲子 甲子 庚午 |
| w1b1-p1-03 | calc-day-1984-02-02 | 양력 | 1984-02-02 12:00 KST | 癸亥 乙丑 丙寅 甲午 |
| w1b1-p1-04 | calc-day-2099-12-31 | 양력 | 2099-12-31 12:00 KST | 己未 丙子 壬寅 丙午 |
| w1b1-p1-05 | calc-lunar-2020-leap0401 | 음력 윤4월 | 2020-윤4-01 12:00 KST | 庚子 辛巳 丙寅 甲午 |
| w1b1-p1-06 | calc-day-2020-01-01 | 양력 | 2020-01-01 12:00 KST | 己亥 丙子 癸卯 戊午 |
| w1b1-p1-07 | calc-day-2028-01-27 | 양력 | 2028-01-27 12:00 KST | 丁未 癸丑 辛亥 甲午 |
| w1b1-p1-08 | calc-day-2022-02-01 (시 생략 제시) | 양력 | 2022-02-01 **시간 미상** | 辛丑 辛丑 乙酉 / 시주 미상 |

신규 생년월일 창작 없음. 08만 Pilot과 같이 **기존 calc 날짜의 시주 미상 제시 변형**.

---

## 3. Case별 검증 목적

### w1b1-p1-01 — Control (감쇄 방향이 구조상 뚜렷한 쪽)

- **primary axis:** control — 감쇄(식상·재·관) 가시 우세
- **raw structural note (operator):** 가시 천간 편재·편관·식신 (생조 가시 0)
- **구분 질문:** 방향이 비교적 단순한 명식에서 전문가가 식상·재·관 약화 방향을 어떻게 서술하는가 (등급 expected 없음)
- **비목적:** Pilot 01 재현·정답 맞춤

### w1b1-p1-02 — Control (생조 방향이 구조상 뚜렷한 쪽)

- **primary axis:** control — 생조(비겁·인성) 가시 우세
- **raw structural note:** 가시 정인·비견 (+ 편관 1 — 완전 순수 생조-only 후보는 풀에 없어 **생조 우세 control**)
- **구분 질문:** 생조 우세 입력에서 비겁+인성 강화 방향 서술·조건
- **coverage gap note:** 가시 생조만·감쇄 0인 calc day 후보가 풀에 없음 → unresolved

### w1b1-p1-03 — Pilot 04형 교차

- **primary axis:** 생조↔감쇄 교차 (인성 가시 다수 + 월지 감쇄 계열)
- **raw structural note:** 가시 정관·정인·편인; 월지 丑 지장간 정관·정재·상관 (월 정기 쪽 감쇄)
- **secondary:** 정인+편인 대비 (편/정 보조)
- **구분 질문:** 천간 인성 생조 vs 월령·재관 압력 교차 시 전문가 서술 분기 (Pilot 04 disagreement 유형 재관찰 — 정답화 금지)

### w1b1-p1-04 — 재성 강·인성 가시 적음

- **primary axis:** 재성 강 / 인성 가시 적음
- **raw structural note:** 가시 정관·편재·편재 (인성 가시 0, 재 2)
- **구분 질문:** 재성 약화 기제(소모·파인·일괄) — 인성 적을 때 재성을 어떻게 보는지

### w1b1-p1-05 — 재성+인성 동시

- **primary axis:** 재성+인성 함께 강(가시)
- **raw structural note:** 가시 편재·정재·편인
- **secondary:** 정재+편재 (편/정 재성)
- **구분 질문:** 재·인이 동시일 때 파인·상쇄·방향 묶음을 어떻게 말하는지 (04와 질문 분리: 여기는 재+인 공존, 03은 월령 교차)

### w1b1-p1-06 — 편/정 (관)

- **primary axis:** 편/정 차이 — 정관+편관 가시
- **raw structural note:** 가시 편관·정재·정관
- **구분 질문:** 세력 **1차 방향**에서 정·편 동일 여부 vs 강도·역할 차이

### w1b1-p1-07 — 월령 vs 투출 방향 불일치

- **primary axis:** 월령(월지 지장간)과 가시 투출이 다른 방향
- **raw structural note:** 월지 丑 — 지장간에 비견·편인(생조) 포함; 가시 천간 편관·식신·정재 (감쇄)
- **구분 질문:** 월령·통근 쪽과 천간 투출이 엇갈릴 때 무엇을 우선하는지 (개수 합산 거부 여부 관찰)

### w1b1-p1-08 — 시간 미상 (1건만)

- **primary axis:** 시주 미상 프로토콜
- **raw structural note:** 삼주 辛丑 辛丑 乙酉; 시 생략 제시
- **구분 질문:** 기준 등급+구간 vs 보류 — Case 05형 uncertainty가 설계 결함이 아님을 Phase 1에서 프로토콜로 물을 때 사용
- **비목적:** 시주 추측 정답

---

## 4. 검증축 coverage

| 축 | 담당 case | 상태 |
|---|---|---|
| Control 감쇄 뚜렷 | p1-01 | covered |
| Control 생조 뚜렷 | p1-02 | covered (우세형; 순수 생조-only 풀 공백) |
| 04형 교차 | p1-03 | covered |
| 재성 강·인성 적음 | p1-04 | covered |
| 재성+인성 동시 | p1-05 | covered |
| 편/정 비교 | p1-06 (주) / p1-03·05 (부) | covered |
| 월령 vs 통근·투출 | p1-07 | covered |
| 시간 미상 | p1-08 | covered (1건) |

---

## 5. 중복·편향 방지

1. Pilot 5 날짜·원국 제외 목록을 inventory에 고정  
2. Strength/Need 미조회 — 구조 라벨만으로 축 배치  
3. 전문가 aggregate 라벨을 선정 필터로 쓰지 않음  
4. 동일 원국 다중 source 중 1개만  
5. 먼 연도(2099) 포함은 풀 내 재성 축 충족용 — 해석 편향 아닌 **기존 calc fixture 재사용**  
6. 윤달 1건 포함으로 달력 종류 다양화 (음력 입력이 축 조작이 아님을 명시)  
7. 축 과다 중복 시 secondary만 표기

---

## 6. Unresolved

| id | issue |
|---|---|
| W1B1-P1-CD-U1 | calc 풀에 가시 생조≥2·감쇄0 control 후보 0건 — p1-02는 우세형 대체 |
| W1B1-P1-CD-U2 | 04형 교차 후보가 실질 1원국(1984-02-02)에 치우침 — Phase 1 실행 전 풀 확장 검토 가능 (창작 금지 유지) |
| W1B1-P1-CD-U3 | 전문가 배포 패키지·질문지 Phase 1 버전 미작성 |
| W1B1-P1-CD-U4 | 실제 Phase 1 실행·답 수집 미실시 |
| W1B1-P1-CD-U5 | 월령「정기」정의(지장간 어느 글자)를 전문가 안내에 어떻게 말할지 — 엔진 용어 누수 주의 |

---

## 7. 하지 않은 것

- Phase 1 실행 / 전문가 답 생성  
- expected Strength / engine Strength 기록  
- STR verdict·freeze·엔진·점수  
- Pilot 5 재사용  
- Wave 2
