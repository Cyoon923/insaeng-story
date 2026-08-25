# Interpretive Validation Priority Audit

엔진 판단 코드는 이 문서로 바꾸지 않는다.
기존 명리 규칙을 수정·합치지 않는다.
새 명리 규칙 / 점수 / rank / winner / Needed Element / 용신 / 희신을 만들지 않는다.
OPEN을 해결하지 않는다.

**목적:** `REQUIRES-INTERPRETIVE-VALIDATION` 53개를 외부 검증 가능한 **upstream → downstream** 순서로 정리한다.

**검증 완료라고 쓰지 않는다.**

근거 inventory (원문):
- `strength-audit/strength-rule-inventory.json`
- `climate-audit/climate-rule-inventory.json`
- `need-audit/need-rule-inventory.json`
- `need-resolution-audit/resolution-rule-inventory.json`

기계 가독 레코드: `interpretive-rule-inventory.json`

---

## A. 수집 결과

| Layer | 수 | 누락 | 중복 ID |
|---|---|---|---|
| Strength | 21 | 없음 | 없음 |
| Climate | 21 | 없음 | 없음 |
| NeedCandidate | 7 | 없음 | 없음 |
| NeedResolution | 4 | 없음 | 없음 |
| **합계** | **53** | 없음 | 없음 |

관측 = 기존 Freeze 문서의 REQUIRES-INTERPRETIVE-VALIDATION 수. 임의 보정 없음.

---

## B. 검증 방법 / 우선순위 정의

| method | 의미 |
|---|---|
| LITERATURE | 문헌·생극표로 1차 대조 가능 |
| EXPERT | 전문가 블라인드 검증이 핵심 |
| BOTH | 문헌 대조 + 전문가 확인 |
| UNRESOLVED | 경로를 억지로 정하지 않음 |

| 우선순위 | 범위 |
|---|---|
| 1 | Strength / Climate upstream interpretive |
| 2 | NeedCandidate (+ Climate Need 오행 매핑) |
| 3 | NeedResolution status 라벨 |

집계: 문헌 대상 29 / 전문가 대상 48 / UNRESOLVED 4  
( LITERATURE_only 1, EXPERT_only 20, BOTH 28 )

---

## C. Wave 1 — Strength (21)

| rule id | name | source layer | 현재 규칙 원문 요약 | 선행 의존 | downstream 영향 | 문헌 | 전문가 | 검증 우선순위 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| STR-010 | 비겁·인성 = support | Strength | 비견·겁재·편인·정인을 일간 도움(support)으로 묶음 | STR-003 | STR-040, STR-050, STR-055, STR-070, NEED-010, NEED-011 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | 십신 라벨 lookup(STR-003)은 FACT. 묶음은 해석. |
| STR-011 | 식상·재·관 = pressure | Strength | 식신·상관·편재·정재·편관·정관을 약화(pressure)로 묶음 | STR-003 | STR-041, STR-051, STR-055, STR-070, NEED-010 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | HIGH-RISK. lookup 검증 ≠ pressure 해석. |
| STR-021 | 대상 천간 오행 presence로 RV | Strength | visible item.presence = 그 천간 오행의 elementPresence | STR-006 | STR-040, STR-041, STR-050, STR-051 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | 일간 presence가 아님. |
| STR-022 | 왕 → strong-side | Strength | phase===왕이면 strongSideEvidence에 왕 기록 | STR-004 | STR-023, STR-050, STR-055 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | 목록 기록 ≠ leaning-strong. |
| STR-023 | 왕 → substantialStrong | Strength | phase===왕이면 substantialStrong=true | STR-022 | STR-055, STR-050 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | 엔진 boolean. 왕이 pressure를 얼마나 견디는지는 미검증. |
| STR-024 | 수/사 → weak-side | Strength | phase===수|사면 weakSideEvidence seasonal | STR-004 | STR-025, STR-051, STR-055 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | 휴를 약 계절로 쓰지 않는 것과 짝(STR-027). |
| STR-025 | 수/사 → substantialWeak | Strength | phase===수|사면 substantialWeak=true | STR-024 | STR-051, STR-055 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | — |
| STR-026 | 상 = help only | Strength | phase===상 → help만. substantialStrong에 상 없음. 방향 미개방 | STR-004 | STR-055, STR-070 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | HIGH-RISK. validationClass는 ENGINE-POLICY였으나 freeze는 해석 검증. |
| STR-027 | 휴 = 무방향 | Strength | phase===휴 → 어느 side에도 seasonal 없음 | STR-004 | STR-055 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | HIGH-RISK. |
| STR-030-clear | 정기 → rootQuality clear | Strength | hit.role 정기 있으면 clear | STR-005 | STR-033, STR-050 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | hit 정확 ≠ 정기가 leaning-strong 조건. |
| STR-030-present | 중기 → present | Strength | 정기 없고 중기 있으면 present | STR-005 | STR-033, STR-050 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | present는 leaning-strong을 닫지 못함. |
| STR-030-shallow | 여기 → shallow | Strength | 여기만 있으면 shallow | STR-005 | STR-033 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | HIGH-RISK: shallow 영향. |
| STR-031 | root 있으면 strong-side | Strength | rootQuality !== absent → strongSide root | STR-030-clear, STR-030-present, STR-030-shallow | STR-033, STR-055 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | — |
| STR-032 | 무근 → weak-side + substantialWeak | Strength | rootQuality===absent → weak-side 및 약 실질 | STR-030-clear | STR-051, STR-055 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | — |
| STR-033 | clear|present|shallow → substantialStrong | Strength | shallow도 강 실질 OR에 포함 | STR-031 | STR-055, STR-050 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | HIGH-RISK. |
| STR-040 | RV support가 강 방향을 연다 | Strength | year/month/hour RV support → rootedSupport | STR-010, STR-021 | STR-050, STR-055 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | — |
| STR-041 | RV pressure가 약 방향을 연다 | Strength | year/month/hour RV pressure → rootedPressure | STR-011, STR-021 | STR-051, STR-055 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | HIGH-RISK. |
| STR-050 | leaning-strong 마감식 | Strength | 왕 && clear && RV support && !RV pressure → leaning-strong | STR-022, STR-030-clear, STR-040 | STR-070, NEED-010, NEED-015, RES-007 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | 전체를 검증 완료로 표시하지 않음. |
| STR-051 | leaning-weak 마감식 | Strength | (사|수) && absent && RV pressure && !RV support → leaning-weak | STR-025, STR-032, STR-041 | STR-070, NEED-011, RES-007 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | — |
| STR-055 | mixed = 양측 실질 | Strength | substantialStrong && substantialWeak → mixed | STR-023, STR-025, STR-033, STR-040, STR-041 | NEED-012, RES-031 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | mixed는 최종 신강/신약 아님. |
| STR-070 | leaning일 때만 Strength Need 후보 | Strength | leaning-strong → 식상/재/관. leaning-weak → 비겁/인성 | STR-050, STR-051 | NEED-010, NEED-011, RES-007, RES-013 | 예 | 예 | 2 (NeedCandidate) / 문헌+전문가 | Need 층과 사실상 동일 판단(NEED-010/011). 합치지 않음. Strength inventory 원문. NEED-010/011과 동일 판단(미합침) |

---

## D. Wave 1 — Climate (21)

| rule id | name | source layer | 현재 규칙 원문 요약 | 선행 의존 | downstream 영향 | 문헌 | 전문가 | 검증 우선순위 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| CLI-002 | 12월지 BASE_CLIMATE 값 | Climate | monthBranch → BASE_CLIMATE[branch] temperature/moisture | CLI-001 | CLI-003a, CLI-003b, CLI-003c, CLI-003d, CLI-004, CLI-018, CLI-019, NEED-020 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | 표가 코드에 있음 ≠ 명리 검증. |
| CLI-003a | 寅卯辰 = balanced+moist | Climate | 봄 클러스터. 寅 balanced, 辰=寅卯와 같음 | CLI-002 | CLI-018, CLI-019, NEED-023 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | 寅을 한으로 보는 조후와 충돌 가능. |
| CLI-003b | 巳午未 = warm+dry | Climate | 여름 클러스터. 未=巳午와 동일 | CLI-002 | CLI-018, CLI-019, NEED-021, NEED-022 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | — |
| CLI-003c | 申酉戌 = balanced+dry | Climate | 가을 클러스터. 戌=申酉와 동일 | CLI-002 | CLI-019, NEED-022 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | — |
| CLI-003d | 亥子丑 = cold+moist | Climate | 겨울 클러스터. 丑=亥子와 동일 | CLI-002 | CLI-018, CLI-019, NEED-020 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | warm+moist 월지 없음. |
| CLI-004 | 토월을 인접 계절과 같게 | Climate | 辰未戌丑을 고유 Climate로 두지 않음 | CLI-002, CLI-003a, CLI-003b, CLI-003c, CLI-003d | CLI-018, CLI-019 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | — |
| CLI-011 | branch 火 = 巳午만 | Climate | 寅중丙은 branch 火 아님 | CLI-009 | CLI-021, CLI-025 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | — |
| CLI-012 | branch 水 = 亥子만 | Climate | 辰중癸는 branch 水 아님 | CLI-010 | CLI-021, CLI-025 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | — |
| CLI-018 | 한난에서 火/水 mit·reinf | Climate | cold: 火 mit / 水 reinf. warm: 반대. balanced: contextual | CLI-002 | CLI-032, CLI-041, CLI-042, NEED-020, NEED-021 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | 조후 방향 자체. |
| CLI-019 | 조습에서 火/水 mit·reinf | Climate | dry: 水 mit / 火 reinf. moist: 火 mit / 水 reinf | CLI-002 | CLI-036, CLI-037, CLI-043, NEED-022 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | 같은 火가 T/M 동시 mit 가능. |
| CLI-021 | quality clear | Climate | 투출 천간 ∧ 대표지지(巳午/亥子)가 factors 안 | CLI-011, CLI-012 | CLI-032, CLI-054, NEED-020 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | 효과 폭은 CLI-032 정책. |
| CLI-022 | quality substantial | Climate | 투출 ∧ (hiddenStem 또는 presence RV/hidden-only) | CLI-017 | CLI-031 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | substantial 효과는 정책(unresolved). |
| CLI-023 | quality shallow | Climate | 투출 천간만 | — | CLI-033 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | 전용 회귀 명식 적음. |
| CLI-024 | quality hidden | Climate | hiddenStem, 투출 없음 | — | CLI-033 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | — |
| CLI-025 | quality branch-only | Climate | 지지 火/水만 | CLI-011, CLI-012 | CLI-033 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | — |
| CLI-036 | 습을 火로 완화 | Climate | base moist → adjustPolar(mit=Fire, reinf=Water) | CLI-019 | CLI-032, CLI-054 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | 한난과 동일 함수. |
| CLI-037 | 조를 水로 완화 | Climate | base dry → adjustPolar(mit=Water, reinf=Fire) | CLI-019 | CLI-032, CLI-043, NEED-022 | 예 | 예 | 1 (Strength/Climate upstream) / 문헌+전문가 | — |
| CLI-041 | resolved cold → 火 Need | Climate | adjusted temperature cold → 火, reason climate-temperature-cold | CLI-018, CLI-032 | NEED-020, RES-008 | 예 | 예 | 2 (NeedCandidate) / 문헌+전문가 | NEED-020과 동일 판단. 합치지 않음. NEED-020과 동일 판단(미합침) |
| CLI-042 | resolved warm → 水 Need | Climate | adjusted temperature warm → 水 | CLI-018, CLI-032 | NEED-021, RES-008 | 예 | 예 | 2 (NeedCandidate) / 문헌+전문가 | NEED-021과 동일 판단. NEED-021과 동일 판단(미합침) |
| CLI-043 | resolved dry → 水 Need | Climate | adjusted moisture dry → 水 | CLI-019, CLI-037 | NEED-022, RES-008 | 예 | 예 | 2 (NeedCandidate) / 문헌+전문가 | NEED-022와 동일 판단. NEED-022와 동일 판단(미합침) |
| CLI-054 | 동일 quality의 두 축 적용 | Climate | 같은 fire/water quality가 T축과 M축에 각각 1회 | CLI-018, CLI-019, CLI-021 | NEED-020, NEED-021, NEED-022 | 아니오 | 예 | 1 (Strength/Climate upstream) / 전문가 | 점수 중복 아님. 이중 효과는 있음. |

---

## E. Wave 2 — NeedCandidate (7)

| rule id | name | source layer | 현재 규칙 원문 요약 | 선행 의존 | downstream 영향 | 문헌 | 전문가 | 검증 우선순위 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| NEED-009 | 십신 오행 맵 | NeedCandidate | 인성=생아, 식상=내가생, 재=내가극, 관=극아 | STR-003 | NEED-010, NEED-011 | 예 | 아니오 | 2 (NeedCandidate) / 문헌 | 표 자체는 생극 문헌으로 대조 가능. 용신 검증은 아님. |
| NEED-010 | leaning-strong → 식상/재/관 | NeedCandidate | output/wealth/official 3후보 | STR-050, STR-070, NEED-009 | NEED-015, RES-007, RES-013, RES-036 | 예 | 예 | 2 (NeedCandidate) / 문헌+전문가 | STR-070과 사실상 동일. 합치지 않음. STR-070과 동일 판단(미합침) |
| NEED-011 | leaning-weak → 비겁/인성 | NeedCandidate | peer=dayElement, resource | STR-051, STR-070, NEED-009 | RES-007, RES-013 | 예 | 예 | 2 (NeedCandidate) / 문헌+전문가 | STR-070과 사실상 동일. 합치지 않음. STR-070과 동일 판단(미합침) |
| NEED-015 | RV+왕/상 → already-established-relation | NeedCandidate | leaning-strong 후보 suppressed | NEED-010, STR-026 | RES-025, RES-027 | 아니오 | 예 | 2 (NeedCandidate) / 전문가 | 제품 경로는 mixed면 미도달. |
| NEED-020 | resolved cold → 火 | NeedCandidate | climate-temperature-cold | CLI-041 | RES-008, RES-013 | 예 | 예 | 2 (NeedCandidate) / 문헌+전문가 | CLI-041과 동일 판단. 합치지 않음. CLI-041과 동일 판단(미합침) |
| NEED-021 | resolved warm → 水 | NeedCandidate | climate-temperature-warm | CLI-042 | RES-008, RES-013 | 예 | 예 | 2 (NeedCandidate) / 문헌+전문가 | CLI-042와 동일. CLI-042와 동일 판단(미합침) |
| NEED-022 | resolved dry → 水 | NeedCandidate | climate-moisture-dry | CLI-043 | RES-008, RES-013, RES-014 | 예 | 예 | 2 (NeedCandidate) / 문헌+전문가 | CLI-043과 동일. CLI-043과 동일 판단(미합침) |

---

## F. Wave 3 — NeedResolution (4)

| rule id | name | source layer | 현재 규칙 원문 요약 | 선행 의존 | downstream 영향 | 문헌 | 전문가 | 검증 우선순위 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| RES-012 | no-candidates → indeterminate | NeedResolution | 양쪽 active 없음 → status indeterminate | NEED-012, NEED-024, NEED-038 | — | 아니오 | 아니오 | 3 (NeedResolution) / UNRESOLVED | 엔진 라벨. 명리 문헌에 대응 항 없음. 필요 오행 없음이 아님. |
| RES-013 | only → single-axis | NeedResolution | strength-only 또는 climate-only → single-axis | NEED-010, NEED-011, NEED-020, NEED-021, NEED-022 | — | 아니오 | 아니오 | 3 (NeedResolution) / UNRESOLVED | 해당 축 승리가 아님. |
| RES-014 | overlap → convergent | NeedResolution | exact/partial-overlap → convergent | NEED-035, NEED-010, NEED-022 | — | 아니오 | 아니오 | 3 (NeedResolution) / UNRESOLVED | 두 축 동의/용신 아님. |
| RES-015 | disjoint → competing | NeedResolution | 교집합 없음 → competing | NEED-036 | — | 아니오 | 아니오 | 3 (NeedResolution) / UNRESOLVED | 나쁜 사주/오류 아님. |

---

## G. 사실상 같은 판단 (표시만, 미합침)

| IDs | 내용 |
|---|---|
| STR-070, NEED-010, NEED-011 | leaning → Strength Need 오행 |
| CLI-041, NEED-020 | cold → 火 |
| CLI-042, NEED-021 | warm → 水 |
| CLI-043, NEED-022 | dry → 水 |

관련만 있고 동일은 아님: STR-010/011 ↔ NEED-009, CLI-002 ↔ 003/004, CLI-018/019 ↔ 036/037/054.

---

## H. 주요 dependency impact

| upstream이 틀리면 | downstream |
|---|---|
| STR-010/011 | STR-040/041 → STR-050/051/055 → NEED-010/011 → RES |
| STR-022~027, STR-030~033 | STR-050/051/055 → Strength Need |
| STR-050/051 | NEED-010/011, STR-070, RES strength-only |
| STR-055 mixed | Strength Need 공백, RES strength-axis-unresolved |
| CLI-002~004 | CLI-018/019 → adjusted → CLI-041~043 → NEED-020~022 → RES |
| CLI-021~025, CLI-054 | adjusted → Climate Need 유무 |
| NEED-010/011/020~022 | RES pattern/status |
| RES-012~015 | 사용자 의미 번역만. 상위 Need 오행을 바꾸지 않음 |

---

## I. OPEN 항목 (해결하지 않음)

| Layer | ID | 현재 상태 |
|---|---|---|
| Strength | STR-061g | other-mixed. 회귀 표본 0. 잔여 분류 |
| Climate | CLI-026 | quality hidden fallback. 도달 드묾 |
| Climate | CLI-035 | moisture balanced 분기. 표에 값 없어 dead |
| Climate | CLI-049 | climateCounterSignals 항상 `[]`. moist counterSignal 미구현 |
| NeedCandidate | NEED-027 | climateCounterSignals 항상 `[]` |
| NeedCandidate | NEED-042 | climate-moisture-already-moist not implemented |
| NeedResolution | RES-028 | climateCounterSignals 빈 복사 (CLI-049/NEED-027과 동일 슬롯) |
| NeedResolution | RES-038 | NeedPolicyGap 타입 잔여. emit 없음 |
| NeedResolution | RES-049 | suppressed shared 시 singleAxis vs climateOnly. 제품 의미 미정 |

OPEN 체인(합치지 않음): CLI-049 ↔ NEED-027 ↔ RES-028.

---

## J. 하지 않은 것

- 엔진 판단 코드 수정
- 기존/신규 명리 규칙 변경
- 점수·rank·winner·Needed Element·용신·희신
- 제품 API / UI
- OPEN 해결
- 다음 단계(전문가 블라인드 실행 등) 선행

---

## K. 권장 검증 순서

1. Strength 십신·계절·통근·방향
2. Climate 12월지·quality·한난조습
3. NeedCandidate 오행 매핑 (+ 동일 Climate Need)
4. NeedResolution status 라벨 (UNRESOLVED로 보류 가능)
5. OPEN은 별도 백로그
