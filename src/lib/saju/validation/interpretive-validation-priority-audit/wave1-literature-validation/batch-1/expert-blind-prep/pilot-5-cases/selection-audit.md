# Wave 1 Batch 1 — STR-010/011 Expert Blind Pilot 5 — Selection Audit

엔진 판단 코드·STR-010/011·literature verdict·freezeStatus를 바꾸지 않는다.
전문가 답·expected를 만들지 않는다.
comparison을 실행하지 않는다.

선행: `wave1-batch-1-expert-blind-prep.md`

---

## 1. 선정 원칙 (준수)

사용 가능 (raw / calculation):

- 천간·지지·월지·지장간
- 일간 기준 십신 raw mapping (`shiShenOf` 표)
- 생년월일·시간·양/음력·절기 입력 조건

사용 금지 (선정에 미사용):

- strengthStatus / directionCandidate / leaning-* / mixedPattern
- NeedCandidate / NeedResolution / supportedElements / climateNeed
- neededElement / yongsin / heesin
- literature verdict

기존 `pilot/cases.json`의 `input: null` 껍데기와 `pilotBlind.test.ts`를 덮어쓰지 않는다.
설계용 fixture (`axisReview`, `conflictType`, `needSuppression`, `shiShen.fixtures`)는 `doNotReuseDesignFixtures` / `forbiddenCaseIds`에 따라 제외한다.

---

## 2. 후보 풀

| 단계 | 수 | 설명 |
|---|---:|---|
| calculation/cases.json 전체 | 72 | 절기·일주·음력·그레고리 등 |
| a priori 제외 (경계 중복·DST) | 약 37 | jie-boundary 18 + hour-boundary 7 + dst 5 + lichun 분단위 쌍 등 |
| 입력 무효 (reject expected) | 6 | 윤달 없음·없는 날짜 등 빌드 실패 |
| 구조 분석 unique 명식 | **35** | calc(day/lichun/lunar/gregorian) + `__tests__/fixtures.json` 차트 |
| 최종 선정 | **5** | 아래 §4 |

검토한 candidate case 수(구조 분석 기준): **35**

---

## 3. Category 커버리지 목표 (억지 1:1 매핑 금지)

Expert Blind Prep 6 categories를 참고하되, Pilot 5건이므로 전 category를 하나씩 채우지 않는다.

| category | 이번 Pilot에서의 역할 |
|---|---|
| C-OUTPUT | w1b1-blind-01 |
| C-PEER (+ resource) | w1b1-blind-02 |
| C-WEALTH | w1b1-blind-03 |
| C-RESOURCE (+ 정/편) | w1b1-blind-04 |
| C-OFFICIAL (+ wealth, hour unknown) | w1b1-blind-05 |
| C-ZHENG-PIAN | 01·02·04에서 관찰 가능 (별도 5번째 전용 case 없음) |

---

## 4. 최종 선정 5건

### w1b1-blind-01 — 선정

| 항목 | 내용 |
|---|---|
| source | `calculation/cases.json` → `calc-day-2023-01-22` |
| provenance | day-pillar 외부 일진 대조군. 개인 실명 없음 |
| why candidate | 천간에 식신·상관이 함께 보여 C-OUTPUT·정/편(식상) 관찰에 유리 |
| raw features | 원국 壬寅 / 癸丑 / 庚辰 / 壬午. 월지 丑. 가시 천간 십신 raw: 식신·상관·식신 |
| helps observe | STR-011(식상 방향·묶음). 정/편(식신 vs 상관) |
| selected | YES |

### w1b1-blind-02 — 선정

| 항목 | 내용 |
|---|---|
| source | `calculation/cases.json` → `calc-day-2000-01-01` |
| provenance | KASI/달력 일진 앵커(2000-01-01). 개인 실명 없음 |
| why candidate | 가시 천간에 비견·겁재·편인이 함께 있어 C-PEER / 인성 대비 관찰 |
| raw features | 己卯 / 丙子 / 戊午 / 戊午. 월지 子. 가시: 겁재·편인·비견 |
| helps observe | STR-010(비겁·인). 정/편(비견 vs 겁재) |
| selected | YES |

### w1b1-blind-03 — 선정

| 항목 | 내용 |
|---|---|
| source | `calculation/cases.json` → `calc-day-1960-04-19` |
| provenance | day-pillar 외부 일진 대조. 개인 실명 없음 |
| why candidate | 년·월 천간이 정재로 반복되어 C-WEALTH 관찰. 월지 辰(진술축 월) |
| raw features | 庚子 / 庚辰 / 丁丑 / 丙午. 가시: 정재·정재·겁재 |
| helps observe | STR-011(재성). 보조로 STR-010(겁재). 진월 입력 |
| selected | YES |

### w1b1-blind-04 — 선정

| 항목 | 내용 |
|---|---|
| source | `calculation/cases.json` → `calc-day-1945-08-15` |
| provenance | 공개 달력 일진 대조용 날짜. **인물·사건 해석용 아님.** 실명·상담 정보 없음 |
| why candidate | 가시 천간이 정인·편인 중심으로 C-RESOURCE·정/편(인성) 관찰 |
| raw features | 乙酉 / 甲申 / 丙辰 / 甲午. 가시: 정인·편인·편인 |
| helps observe | STR-010(인성·정/편인) |
| selected | YES |

### w1b1-blind-05 — 선정

| 항목 | 내용 |
|---|---|
| source | `calculation/cases.json` → `calc-day-1988-09-17` 생년월일 재사용. **시만 Pilot 시간미상 슬롯을 위해 생략** |
| provenance | day-pillar 외부 일진 대조. 새 생년월일 창작 아님. hour unknown은 Pilot 입력 다양성 |
| why candidate | 년 정재·월 편관으로 C-WEALTH + C-OFFICIAL. 시간 미상 1건 확보 |
| raw features (시 미상) | 戊辰 / 辛酉 / 乙亥 / 시 미상. 가시: 정재·편관. 월지 酉 |
| helps observe | STR-011(재·관). 시간 미상 조건 |
| selected | YES |
| note | 동일 날짜에 정오 시주가 있는 calc 원본과 시주만 다름. 엔진 결과를 보고 고르지 않음 |

---

## 5. 제외 예시 (동일 풀에서 검토 후 미선정)

| candidate | source | raw feature 요약 | 제외 이유 |
|---|---|---|---|
| calc-day-2021-02-12 | day-pillar | 비견·겁재·정재 | 02와 비겁 중복. 재는 03이 더 분리 |
| calc-day-2024-02-10 | day-pillar | 비견·식신·편관 | 다카테고리 혼합이 커서 분리 관찰에 불리 |
| calc-lichun-2024-절입 | lichun | 편관·편인·상관 | 절입 경계 특수성. Pilot 일반 관찰용 비우선 |
| calc-day-2022-02-01 | day-pillar | 편관·편관·정인 | 05가 관+재·시간미상으로 관을 담당 |
| calc-lunar-2020-0101 | lunar | 식신·비견·겁재 | 01·02와 역할 겹침. 음력 변환 설명 부담 |
| fixture:1990 after lichun | fixtures.json | 편재·식신·편인 | calc day-pillar로 출처 통일 우선 |
| jie-boundary * | calculation | 분단위 인접 쌍 | 구조 중복·전문가 혼동. 풀에서 a priori 제외 |
| axisReview / conflictType / needSuppression / shiShen.fixtures | design fixtures | — | Pilot `doNotReuseDesignFixtures` |

“엔진이 leaning-* 이므로 제외/선정” 형태의 기록은 없다.

---

## 6. Case 제시 순서

학습효과·grouping 암시 완화를 위해 **presentationOrder**를 caseId와 분리한다.

| presentationOrder | caseId | 관찰 초점(운영자용) |
|---:|---|---|
| 1 | w1b1-blind-01 | 식상 |
| 2 | w1b1-blind-02 | 비겁·인 |
| 3 | w1b1-blind-03 | 재 |
| 4 | w1b1-blind-04 | 인성 정/편 |
| 5 | w1b1-blind-05 | 재·관 + 시간 미상 |

전문가 배포물에는 “관찰 초점” 열을 넣지 않는다.

---

## 7. Leakage 분리

| 전문가 배포 | 운영자(본 audit·inventory) |
|---|---|
| 생년월일·시간(또는 미상)·양력·원국 간지 | + 십신 raw mapping, category, rule 관찰 메모 |
| 질문 세트 (rule ID 없음) | STR-010/011, literature 상태 |
| 빈 답변란 | 선정/제외 사유 |

숨김: engine Strength/Need, literature verdict, expected, comparison, 다른 전문가 답.

---

## 8. 이번 단계 상태

| 항목 | 값 |
|---|---|
| expert answers | 0 |
| expert expecteds | 0 |
| comparison 실행 | 아니오 |
| 신규 생년월일 창작 | 0 (05는 기존 날짜 + 시 생략) |
| `pilot/cases.json` 수정 | 아니오 |
