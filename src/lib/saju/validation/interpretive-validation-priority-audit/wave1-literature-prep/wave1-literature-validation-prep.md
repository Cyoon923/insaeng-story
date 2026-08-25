# Wave 1 Literature Validation Prep

엔진 판단 코드는 이 문서로 바꾸지 않는다.
기존 규칙을 수정·검증 완료 처리하지 않는다.
실제 문헌을 인용하거나 VERIFIED로 바꾸지 않는다.

**목적:** Wave 1(Strength / Climate upstream) 중 문헌 검증이 가능한 규칙에 대해  
**무엇을 어떤 근거 종류로 검증해야 하는지** 검증 항목만 만든다.

**이번 단계는 문헌 조사·판정이 아니다.**

근거:
- `interpretive-rule-inventory.json`
- `interpretive-validation-priority-audit.md`

NeedCandidate / NeedResolution은 제외.

---

## A. 대상 집계

| 항목 | 수 |
|---|---|
| Wave 1 총 | 38 |
| Strength | 20 |
| Climate | 18 |
| LITERATURE | 0 |
| BOTH | 19 |
| EXPERT | 19 |
| UNRESOLVED | 0 |
| 작성된 validation question (LITERATURE+BOTH) | 19 |

기존 method 분류를 바꾸지 않았다.

---

## B. 검증 성공 조건 (공통, LITERATURE/BOTH)

- 독립된 신뢰 가능한 출처가 같은 원칙을 지지하는지 대조한다
- 문헌 간 차이가 있으면 학파/계통 차이로 기록하고 단일 정답으로 강제하지 않는다
- 문헌만으로 결정할 수 없으면 전문가 블라인드 검증으로 넘긴다
- 이번 준비 단계에서 VERIFIED로 바꾸지 않는다

숫자 기준·새 명리 판단 기준을 임의로 만들지 않는다.

---

## C. LITERATURE / BOTH — 문헌 검증 질문

| rule id | name | layer | method | 원문 요약 | validation question | evidence types | dependency impact |
|---|---|---|---|---|---|---|---|
| STR-010 | 비겁·인성 = support | Strength | BOTH | 비견·겁재·편인·정인을 일간 도움(support)으로 묶음 | 일간 세력 판단에서 비견·겁재·편인·정인을 ‘도움(support)’으로 묶는 것이 문헌에서 어떤 조건·범위로 정의되는가? 정/편을 세력 방향에서 다르게 취급하는 문헌이 있는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | STR-040, STR-050, STR-055, STR-070, NEED-010, NEED-011 |
| STR-011 | 식상·재·관 = pressure | Strength | BOTH | 식신·상관·편재·정재·편관·정관을 약화(pressure)로 묶음 | 식신·상관·편재·정재·편관·정관을 ‘약화(pressure/설기·재·관)’로 한 묶음으로 쓰는 것이 문헌에서 어떻게 서술되는가? 식상·재·관을 동일 방향 축으로 묶는 근거와 반례가 있는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | STR-041, STR-051, STR-055, STR-070, NEED-010 |
| STR-022 | 왕 → strong-side | Strength | BOTH | phase===왕이면 strongSideEvidence에 왕 기록 | 월령(왕상휴수사)에서 ‘왕’을 일간 세력의 강(strong-side) 근거로 기록하는 조건이 문헌에서 어떻게 정의되는가? 왕이면 곧바로 신강으로 닫는지, 목록/근거로만 남기는지 구분이 있는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | STR-023, STR-050, STR-055 |
| STR-024 | 수/사 → weak-side | Strength | BOTH | phase===수|사면 weakSideEvidence seasonal | 월령이 ‘수’ 또는 ‘사’일 때 이를 일간 세력의 약(weak-side) 근거로 두는 조건이 문헌에서 어떻게 정의되는가? ‘휴’와 ‘수/사’를 약 계절로 구분하는 서술이 있는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | STR-025, STR-051, STR-055 |
| STR-030-clear | 정기 → rootQuality clear | Strength | BOTH | hit.role 정기 있으면 clear | 지장간 통근에서 ‘정기’를 가장 깊은 뿌리(clear)로 보는 정의가 문헌에서 어떻게 서술되는가? 정기 통근이 세력 판단에서 갖는 위치는 무엇인가? | 고전 원문; 현대 명리 이론서 | STR-033, STR-050 |
| STR-030-present | 중기 → present | Strength | BOTH | 정기 없고 중기 있으면 present | 정기 없이 ‘중기’만 있을 때 통근 깊이(중간, present)로 다루는 문헌상의 정의와 세력 반영 범위는 무엇인가? | 고전 원문; 현대 명리 이론서 | STR-033, STR-050 |
| STR-030-shallow | 여기 → shallow | Strength | BOTH | 여기만 있으면 shallow | ‘여기’만 있는 통근을 얕은 뿌리(shallow)로 두는 문헌 정의가 있는가? 여기 통근을 세력에 어느 정도까지 반영한다고 서술하는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | STR-033 |
| CLI-002 | 12월지 BASE_CLIMATE 값 | Climate | BOTH | monthBranch → BASE_CLIMATE[branch] temperature/moisture | 12월지 각각에 한난(寒暖)·조습(燥濕)을 배정하는 조후 표가 문헌에서 어떻게 구성되는가? 본 엔진의 BASE_CLIMATE 값이 특정 학파의 표와 어떤 대응 관계에 있는지 대조할 수 있는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | CLI-003a, CLI-003b, CLI-003c, CLI-003d, CLI-004, CLI-018, CLI-019, NEED-020 |
| CLI-003a | 寅卯辰 = balanced+moist | Climate | BOTH | 봄 클러스터. 寅 balanced, 辰=寅卯와 같음 | 寅·卯·辰을 같은 봄 조후(한난 중립·습)로 묶는 서술이 문헌에 있는가? 특히 寅월을 한(寒)으로 보는 학파와, 辰을 寅卯와 같게 두는 서술이 어떻게 대비되는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교; 전문가 판단 병행 필요 | CLI-018, CLI-019, NEED-023 |
| CLI-003b | 巳午未 = warm+dry | Climate | BOTH | 여름 클러스터. 未=巳午와 동일 | 巳·午·未를 같은 여름 조후(난·조)로 묶고 未를 巳午와 동일하게 보는 문헌 근거는 무엇인가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | CLI-018, CLI-019, NEED-021, NEED-022 |
| CLI-003c | 申酉戌 = balanced+dry | Climate | BOTH | 가을 클러스터. 戌=申酉와 동일 | 申·酉·戌을 같은 가을 조후(한난 중립·조)로 묶고 戌을 申酉와 동일하게 보는 문헌 근거는 무엇인가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | CLI-019, NEED-022 |
| CLI-003d | 亥子丑 = cold+moist | Climate | BOTH | 겨울 클러스터. 丑=亥子와 동일 | 亥·子·丑을 같은 겨울 조후(한·습)로 묶고 丑을 亥子와 동일하게 보는 문헌 근거는 무엇인가? warm+moist 월지 배정이 별도로 있는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | CLI-018, CLI-019, NEED-020 |
| CLI-004 | 토월을 인접 계절과 같게 | Climate | BOTH | 辰未戌丑을 고유 Climate로 두지 않음 | 辰·未·戌·丑 토월을 고유 조후로 두지 않고 인접 계절 조후를 공유한다고 보는 문헌/학파가 있는가? 습토·조토 세분을 요구하는 서술과의 차이는 무엇인가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교; 전문가 판단 병행 필요 | CLI-018, CLI-019 |
| CLI-011 | branch 火 = 巳午만 | Climate | BOTH | 寅중丙은 branch 火 아님 | 조후에서 ‘지지 火’를 대표지로 볼 때 巳·午만으로 한정하는 문헌 정의가 있는가? 寅 중 丙 등 지장간 火를 지지 火와 어떻게 구분하는가? | 고전 원문; 현대 명리 이론서 | CLI-021, CLI-025 |
| CLI-012 | branch 水 = 亥子만 | Climate | BOTH | 辰중癸는 branch 水 아님 | 조후에서 ‘지지 水’를 대표지로 볼 때 亥·子만으로 한정하는 문헌 정의가 있는가? 辰 중 癸 등을 지지 水와 어떻게 구분하는가? | 고전 원문; 현대 명리 이론서 | CLI-021, CLI-025 |
| CLI-018 | 한난에서 火/水 mit·reinf | Climate | BOTH | cold: 火 mit / 水 reinf. warm: 반대. balanced: contextual | 조후상 한(寒)일 때 火를 완화·水를 가세로, 난(暖)일 때 그 반대로 쓰는 원칙이 문헌에서 어떻게 서술되는가? 한난이 중립일 때 火·水를 어떻게 다루는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | CLI-032, CLI-041, CLI-042, NEED-020, NEED-021 |
| CLI-019 | 조습에서 火/水 mit·reinf | Climate | BOTH | dry: 水 mit / 火 reinf. moist: 火 mit / 水 reinf | 조후상 조(燥)일 때 水를 완화·火를 가세로, 습(濕)일 때 그 반대로 쓰는 원칙이 문헌에서 어떻게 서술되는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교 | CLI-036, CLI-037, CLI-043, NEED-022 |
| CLI-036 | 습을 火로 완화 | Climate | BOTH | base moist → adjustPolar(mit=Fire, reinf=Water) | 습을 火로 말리고 水로 가습한다고 보는 조후 서술이 문헌에 있는가? 한(寒)을 火로 완화하는 것과 같은 민감도/동일 함수로 취급해도 된다고 보는 근거가 있는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교; 전문가 판단 병행 필요 | CLI-032, CLI-054 |
| CLI-037 | 조를 水로 완화 | Climate | BOTH | base dry → adjustPolar(mit=Water, reinf=Fire) | 조를 水로 윤택하게 하고 火로 가조한다고 보는 조후 서술이 문헌에 있는가? 난(暖)을 水로 완화하는 것과 동일하게 취급해도 되는지 문헌에서 구분하는가? | 고전 원문; 현대 명리 이론서; 복수 문헌 비교; 전문가 판단 병행 필요 | CLI-032, CLI-043, NEED-022 |

---

## D. EXPERT — 문헌 질문 미작성 (분류 유지)

문헌 1차 대상이 아님. 질문 표를 만들지 않았다. method를 BOTH/LITERATURE로 바꾸지 않음.

| rule id | name | layer | 원문 요약 | dependency impact | 비고 |
|---|---|---|---|---|---|
| STR-021 | 대상 천간 오행 presence로 RV | Strength | visible item.presence = 그 천간 오행의 elementPresence | STR-040, STR-041, STR-050, STR-051 | 전문가 블라인드 단계에서 별도 질의 |
| STR-023 | 왕 → substantialStrong | Strength | phase===왕이면 substantialStrong=true | STR-055, STR-050 | 전문가 블라인드 단계에서 별도 질의 |
| STR-025 | 수/사 → substantialWeak | Strength | phase===수|사면 substantialWeak=true | STR-051, STR-055 | 전문가 블라인드 단계에서 별도 질의 |
| STR-026 | 상 = help only | Strength | phase===상 → help만. substantialStrong에 상 없음. 방향 미개방 | STR-055, STR-070 | 전문가 블라인드 단계에서 별도 질의 |
| STR-027 | 휴 = 무방향 | Strength | phase===휴 → 어느 side에도 seasonal 없음 | STR-055 | 전문가 블라인드 단계에서 별도 질의 |
| STR-031 | root 있으면 strong-side | Strength | rootQuality !== absent → strongSide root | STR-033, STR-055 | 전문가 블라인드 단계에서 별도 질의 |
| STR-032 | 무근 → weak-side + substantialWeak | Strength | rootQuality===absent → weak-side 및 약 실질 | STR-051, STR-055 | 전문가 블라인드 단계에서 별도 질의 |
| STR-033 | clear|present|shallow → substantialStrong | Strength | shallow도 강 실질 OR에 포함 | STR-055, STR-050 | 전문가 블라인드 단계에서 별도 질의 |
| STR-040 | RV support가 강 방향을 연다 | Strength | year/month/hour RV support → rootedSupport | STR-050, STR-055 | 전문가 블라인드 단계에서 별도 질의 |
| STR-041 | RV pressure가 약 방향을 연다 | Strength | year/month/hour RV pressure → rootedPressure | STR-051, STR-055 | 전문가 블라인드 단계에서 별도 질의 |
| STR-050 | leaning-strong 마감식 | Strength | 왕 && clear && RV support && !RV pressure → leaning-strong | STR-070, NEED-010, NEED-015, RES-007 | 전문가 블라인드 단계에서 별도 질의 |
| STR-051 | leaning-weak 마감식 | Strength | (사|수) && absent && RV pressure && !RV support → leaning-weak | STR-070, NEED-011, RES-007 | 전문가 블라인드 단계에서 별도 질의 |
| STR-055 | mixed = 양측 실질 | Strength | substantialStrong && substantialWeak → mixed | NEED-012, RES-031 | 전문가 블라인드 단계에서 별도 질의 |
| CLI-021 | quality clear | Climate | 투출 천간 ∧ 대표지지(巳午/亥子)가 factors 안 | CLI-032, CLI-054, NEED-020 | 전문가 블라인드 단계에서 별도 질의 |
| CLI-022 | quality substantial | Climate | 투출 ∧ (hiddenStem 또는 presence RV/hidden-only) | CLI-031 | 전문가 블라인드 단계에서 별도 질의 |
| CLI-023 | quality shallow | Climate | 투출 천간만 | CLI-033 | 전문가 블라인드 단계에서 별도 질의 |
| CLI-024 | quality hidden | Climate | hiddenStem, 투출 없음 | CLI-033 | 전문가 블라인드 단계에서 별도 질의 |
| CLI-025 | quality branch-only | Climate | 지지 火/水만 | CLI-033 | 전문가 블라인드 단계에서 별도 질의 |
| CLI-054 | 동일 quality의 두 축 적용 | Climate | 같은 fire/water quality가 T축과 M축에 각각 1회 | NEED-020, NEED-021, NEED-022 | 전문가 블라인드 단계에서 별도 질의 |

---

## E. 주요 dependency impact (Priority Audit 유지)

| upstream | downstream (기존 inventory impacts) |
|---|---|
| STR-010/011 | STR-040/041 → STR-050/051/055 → NEED-010/011 → RES |
| STR-022~027, STR-030~033 | STR-050/051/055 → Strength Need |
| STR-050/051 (EXPERT, Wave1) | NEED-010/011, STR-070, RES strength-only |
| STR-055 (EXPERT, Wave1) | Strength Need 공백, RES strength-axis-unresolved |
| CLI-002~004 | CLI-018/019 → adjusted → CLI-041~043 → NEED-020~022 → RES |
| CLI-021~025, CLI-054 (EXPERT) | adjusted → Climate Need 유무 |
| CLI-018/019/036/037 | CLI-041~043 / NEED-020~022 경로의 상위 조후 방향 |

새 dependency를 추측해 추가하지 않았다.

---

## F. Review notes

| id | note |
|---|---|
| RN-W1-001 | Wave 1 관측 수: Strength 20 + Climate 18 = 38. Priority Audit의 Strength/Climate interpretive 21+21=42 중 STR-070·CLI-041·042·043은 wave 2로 분류되어 Wave 1에서 제외. 분류를 바꾸지 않음. |
| RN-W1-002 | Wave 1에 LITERATURE-only / UNRESOLVED는 0. LITERATURE-only는 NEED-009(wave 2)뿐. 분류를 바꾸지 않음. |
| RN-W1-003 | STR-026/027은 원 inventory validationClass가 ENGINE-POLICY였으나 freezeStatus는 REQUIRES-INTERPRETIVE-VALIDATION, Priority Audit method는 EXPERT. 이번 단계에서 method를 수정하지 않음. 문헌 질문 대상(LITERATURE/BOTH)에도 넣지 않음. |
| RN-W1-004 | CLI-054는 method=EXPERT이므로 문헌 질문 표를 만들지 않음. BOTH인 CLI-018/019/036/037과 관련만 비고로 유지. |
| RN-W1-005 | 문헌 검증 질문은 ‘무엇을 물을지’만 정의. 실제 출처·인용·판정은 다음 단계. AI 일반 지식을 근거로 쓰지 않음. |

---

## G. 하지 않은 것

- 엔진 코드 / 기존 규칙 / expected 수정
- 새 명리 규칙, 점수, rank, winner
- Needed Element / 용신 / 희신
- NeedCandidate / NeedResolution 변경
- OPEN 해결
- 실제 문헌 조사·인용·VERIFIED 승격
- AI 일반 지식을 근거 문헌으로 사용

---

## H. 다음 단계 (이번 문서 범위 밖)

실제 문헌 조사 및 판정은 별도 단계에서 진행한다.
