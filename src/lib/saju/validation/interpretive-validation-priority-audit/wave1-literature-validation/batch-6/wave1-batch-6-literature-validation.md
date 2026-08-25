# Wave 1 Actual Literature Validation — Batch 6

엔진 판단 코드는 이 문서로 바꾸지 않는다.
기존 rule / freezeStatus / method를 바꾸지 않는다.
SUPPORTED가 나와도 VERIFIED-FACT로 승격하지 않는다.
`adjustPolar` / quality / BASE_CLIMATE를 바꾸지 않는다.

**목적:** Batch 5 완료 후 Climate 축 **W1-G6-CLIMATE-ADJUST**만 독립 문헌 근거로 대조한다.

이번 결과는 **literature evidence**다. BOTH 규칙은 이후 전문가 검증이 남는다.

근거:
- `wave1-literature-prep/wave1-literature-validation-prep.md`
- Batch 1–5 문헌 문서 (그룹 정의 재사용, **이전 verdict 미변경**)
- `interpretive-validation-priority-audit.md`
- `interpretive-rule-inventory.json`
- `climate-audit/climate-rule-inventory.json` CLI-018/019/032/036/037/038/054
- `src/lib/saju/elements/climate.ts` `temperatureRole` / `moistureRole`
- `src/lib/saju/elements/adjustedClimate.ts` `adjustPolar`

**보존:** STR-010/011, STR-022/024, STR-030-*, CLI-002 CONTESTED, CLI-003a CONTESTED, CLI-003b PARTIALLY-SUPPORTED, CLI-003c CONTESTED, CLI-003d PARTIALLY-SUPPORTED, CLI-004 CONTESTED, CLI-011/012 PARTIALLY-SUPPORTED, Expert Blind Prep, Pilot 5.

NeedCandidate / NeedResolution / Needed Element는 조사·수정하지 않는다.
Wave 2로 진행하지 않는다.

---

## A. Dependency 재확인 (새 dependency 미작성)

기존 Audit / Batch 1 inventory:

| group | dependsOn | 상태 |
|---|---|---|
| W1-G4 | CLI-001 | Batch 4 완료. **CLI-002 = CONTESTED / MEDIUM** |
| W1-G5 | CLI-009, CLI-010 | Batch 5 완료. 공식 G6 upstream 아님 |
| **W1-G6-CLIMATE-ADJUST** | **CLI-002 (G4)** | 이번 대상 |

공식 dependsOn:

- CLI-018 → CLI-002
- CLI-019 → CLI-002
- CLI-036 → CLI-019
- CLI-037 → CLI-019

inventory에 G6→G5 간선 없음. 구현이 `qualityOf`에서 巳午/亥子를 쓰더라도 새 의존을 추가하지 않는다.

**CLI-002 CONTESTED가 G6에 미치는 영향 (추측 없음, 기존 체인):**

G6는 **월지 baseClimate 값 위**에서 火/水 역할을 매기고 `adjustPolar`를 돌린다. CLI-002가 CONTESTED이면 “어느 월이 cold/warm/moist/dry인가”가 문헌적으로 닫히지 않은 채로 조정이 적용된다.  
따라서 G6를 **SUPPORTED로 올리지 않는다.** 한난·조습 **방향 개념**이 있어도, 엔진 표에 대한 적용은 상류 CONTESTED에 묶인다.

downstream (기존 Audit):

CLI-018 → CLI-032, CLI-041, CLI-042, NEED-020, NEED-021  
CLI-019 → CLI-036, CLI-037, CLI-043, NEED-022  
CLI-036 → CLI-032, CLI-054  
CLI-037 → CLI-032, CLI-043, NEED-022

CLI-032(효과 폭), CLI-054(한 火가 T·M 동시 이동), Need 생성은 이번 비판정.

---

## B. 엔진 원문 (이름 추측 금지)

`temperatureRole` / `moistureRole` (`climate.ts`):

| base | 火 | 水 |
|---|---|---|
| temperature cold | mitigation | reinforcement |
| temperature warm | reinforcement | mitigation |
| temperature balanced | contextual | contextual |
| moisture dry | reinforcement | mitigation |
| moisture moist | mitigation | reinforcement |
| moisture balanced | contextual | contextual |

`adjustPolar` (`adjustedClimate.ts`) — 한난·조습 **동일 함수**:

| mitigation quality | 결과 |
|---|---|
| clear ∧ reinforcement도 strong | unresolved (충돌) |
| substantial | unresolved (review) |
| **clear** | **resolved `balanced`** (한 단계 중화) |
| absent / hidden / shallow / branch-only | **base 유지** |
| temperature/moisture `balanced` | polar 조정 **안 함**. 값 유지 |

CLI-018 = 한난 역할표.  
CLI-019 = 조습 역할표.  
CLI-036 = base moist에 위 함수(mit=火, reinf=水).  
CLI-037 = base dry에 위 함수(mit=水, reinf=火).  
cold 축도 같은 함수(mit=火). warm 축도 같은 함수(mit=水).

일간·월령 차등 취용 없음. quality가 clear가 아니면 값이 안 움직인다. 존재(hidden/branch-only) ≠ 조절.

旺衰 신강약·용신 희기와 이 표를 같은 문장으로 닫지 않는다.

---

## C. 검증 질문 분리

| 코드 | 질문 | 소속 |
|---|---|---|
| A | 火/水가 寒暖을 조절하는가? | CLI-018 방향 |
| B | 火/水가 燥濕을 조절하는가? | CLI-019 방향 |
| C | 단순 존재와 조절 가능한 세력의 차이? | quality 게이트. CLI-021+는 EXPERT 미판정 |
| D | 월령·일간·장간·투간에 따라 효과가 달라지는가? | 엔진은 아니오(고정). 문헌은 후대 조후에서 예 |
| E | 한난 조절과 조습 조절을 **같은 함수**로 해도 되는가? | CLI-036/037 핵심 |
| F | 엔진이 base를 clear mit 때 `balanced`로 한 칸 옮기는가? | 엔진 추상화 |
| G | CLI-002 CONTESTED가 적용 대상을 약화하는가? | 전 rule 공통 |

格局·용신·傷官佩印을 Climate adjustment fact로 쓰지 않는다. 층만 적는다.

---

## D. 조사한 출처

| id | 저자 / 전승 | 문헌 | 접근 | 위치 | layer |
|---|---|---|---|---|---|
| S1 | 京圖/劉基 전승 | 《滴天髓》 운문 | [维基文库 /16](https://zh.wikisource.org/wiki/滴天髓/16) | 寒暖 / 燥濕 운 | ORIGINAL-TEXT |
| S2 | 原註 | 같은 장 | 维基文库 | 得氣之寒，遇暖而發…過於濕者滯…過於燥者烈 | COMMENTARY |
| S3 | 清 任鐵樵 | 《滴天髓闡微》 | 燥濕 / 寒暖 | 夏木 壬癸·丑辰濕土; 冬金 丙丁; 未戌燥土 助火 | COMMENTARY |
| S4 | 清 沈孝瞻 | 《子平真詮》 | 論用神配氣候得失 | 月令用神 + 配氣候; 調候為急; 冬木逢火 | ORIGINAL-TEXT |
| S5 | 民 徐樂吾 | 《子平真詮評注》 | 같은 장 徐注 | 冬寒·夏燥를 用神 배치로 해설 | COMMENTARY |
| S6 | 《窮通寶鑑》 | 十干×月令 | [维基文库](https://zh.wikisource.org/wiki/窮通寶鑑) | 初春餘寒用火; 春末水渴; 일간별 丙癸 | later 調候 ORIGINAL-TEXT |
| S7 | 明 萬民英 | 《三命通會》 | 旺相休囚死 | 夏月大旱 / 冬月大寒 | ORIGINAL-TEXT | **旺衰 장**. 조정 규칙이 아님 |

블로그·카페·SEO·GitHub 미사용.

---

## E. 출처별 근거

### E1. 滴天髓 운문 (S1) — ORIGINAL-TEXT

> 天道有寒暖，發育萬物，人道得之，不可過也。  
> 地道有燥濕，生成品彙，人道得之，不可偏也。

**최소 해석:** 寒暖(天道)과 燥濕(地道)을 **다른 축**으로 둔다. 火/水 factor로 baseClimate를 한 칸 옮기는 절차가 아니다. 한난=조습 동일 함수를 말하지 않는다.

### E2. 原註 (S2) — COMMENTARY

> 得氣之寒，遇暖而發，得氣之暖，遇寒而成…  
> 過於濕者，滯而無成，過於燥者，烈而有禍。水有金生，遇寒土而愈濕，火有木生，遇暖土而愈燥…

**최소 해석:** 寒은 暖을 만나 발하고, 濕/燥는 **과불급**을 경계한다. 濕의 가세에 **寒土**, 燥의 가세에 **暖土**가 나온다. **火/水만의 polar 함수가 아니다.** 木火傷官要濕 / 金水傷官要燥는 **傷官 格局** 층 — Climate fact로 합치지 않음.

### E3. 任鐵樵 (S3) — COMMENTARY

夏木: **壬癸**로 생하고 **丑辰濕土**로 培한다. 未戌燥土는 **助火**하여 물을 무력하게 한다. 冬金: **丙丁**을 쓸 수 있으나 丑辰濕土는 助水하여 불을 무력하게 한다.

**최소 해석:** 한난 조후는 주로 **丙丁/壬癸 천간**. 조습은 **濕土/燥土**가 핵심 재료. 엔진 CLI-013이 土를 Climate factor에서 빼는 것과 **긴장**. 일간·계절 의존. quality clear → balanced 한 칸이 아님.

### E4. 沈孝瞻 (S4) — ORIGINAL-TEXT

> 論命惟以月令用神為主，然亦須配氣候而互參之。  
> …冬木逢火…即可以調候也。  
> …非官之不畏夫傷，而調候為急，權而用之也。

**최소 해석:** 조후는 **월령 용신 배치와 함께** 본다. 冬木逢火는 **겨울 목 일간 + 火**. “cold로 분류된 월지 + 사주 어디든 火 clear면 temperature=balanced”가 아니다. 用神 층. Climate adjustment 표로 소급하지 않음.

### E5. 徐樂吾 (S5) — COMMENTARY

沈의 冬寒·夏燥·調候를 用神 해설로 확장. 沈 원문의 12칸 lookup·동일 polar 함수가 아님.

### E6. 窮通寶鑑 (S6) — 후대 調候 (early 子平 소급 금지)

初春 **餘寒 → 火暖**, 春末 **水渴 → 水**. 같은 봄도 월이 다르고, 같은 월도 **일간**이 다르면 丙/癸 취용이 달라진다.

**최소 해석:** 조절은 **일간×월령**. 엔진처럼 월지 라벨(cold/moist)만 보고 전간 火 quality로 두 축을 같이 밀지 않는다. 寅을 엔진이 balanced로 두면 이 餘寒 조후와 적용 대상이 어긋난다 (CLI-002 CONTESTED의 구체적 파급).

### E7. 三命通會 旺衰 장 (S7) — ORIGINAL-TEXT

夏旱·冬寒은 **왕상휴수사 장의 시절 기상**. 「火가 旺하니 水로 조절하라」는 Climate `adjustPolar`가 아니다. 문맥 혼용 방지용.

---

## F. 질문 A–G

| 질문 | 문헌 vs 엔진 |
|---|---|
| A. 寒→火, 熱→水 | 후대 조후·滴天髓 遇暖/遇寒 **방향 개념** 있음. 엔진 역할표와 **부분 정렬**. 적용은 일간×월령 |
| B. 燥→水, 濕→火 | 개념적으로 水潤·火燥가 있음. 任은 **土**로 조습. 엔진은 火/水만 |
| C. 존재 vs 조절 | 문헌은 通根·透出·得氣를 따짐. 엔진은 quality 등급(EXPERT) 후에야 값이 움직임. 방향 규칙 자체는 존재를 조절로 치지 않음(weak면 base 유지) — 분리 자체는 엔진 정책 |
| D. 월령·일간 | 窮通·沈은 달라짐. 엔진 G6는 **무관** |
| E. 동일 함수 | 운문은 天道/地道 **분리**. 任은 한난=천간火水, 조습=濕土燥土. **동일 adjustPolar 직접 근거 없음** |
| F. clear → balanced 한 칸 | 문헌 미확인. 엔진 추상화. 窮通은 취용이지 축 값을 balanced로 덮지 않음 |
| G. CLI-002 | CONTESTED 표 위에 조정이 올라감. G6 SUPPORTED 불가 |

---

## G. Rule별 판정

### G1. CLI-018 — 한난에서 火 mit / 水 reinf (및 반대)

| 종류 | 내용 |
|---|---|
| supporting | 寒遇暖而發; 冬木逢火; 窮通 餘寒用火; 熱地 用水 계열 후대 조후 |
| limiting | 일간·월령 의존; balanced 월은 엔진이 조정 안 함(寅 餘寒과 충돌 가능); quality 게이트; CLI-002 표 |
| conflicting | 원註 음양지지 한난(Batch 4); 조후=用神 權變이지 전간 火 quality polar 이동이 아님 |

**Verdict:** **PARTIALLY-SUPPORTED** / **MEDIUM** / expert YES  

한난 **방향 관념**은 부분 지지. 엔진 조건(표 lookup + clear 한 칸 + 일간 무시)은 문헌 직접 규칙이 아니다. CLI-002 CONTESTED로 적용 대상이 약하다. SUPPORTED 아님.

### G2. CLI-019 — 조습에서 水/火 mit·reinf

| supporting | 燥濕 축 존재; 過燥/過濕 경계; 水潤·火烈 이미지 |
| limiting | 傷官要濕/要燥는 格局; 任의 조습 주재료는 土 |
| conflicting | CLI-013 土 제외 vs 丑辰濕土·未戌燥土; 한난과 별 함수여야 한다는 운문 이축 |

**Verdict:** **CONTESTED** / **MEDIUM** / expert YES  

조습을 火/水 역할표만으로 닫고, 한난과 대칭시키는 것은 문헌 체계와 축이 갈린다.

### G3. CLI-036 — moist에 cold와 같은 adjustPolar (mit=火)

| supporting | 火가 濕을 말리는 이미지; 未戌燥土 助火(土층) |
| limiting | 任은 습을 **濕土/壬癸**로 다루고, 한을 火로 푸는 것과 **같은 함수**라고 하지 않음 |
| conflicting | 天道寒暖 ≠ 地道燥濕 동일 절차; CLI-002 어느 월이 moist인지도 CONTESTED |

**Verdict:** **CONTESTED** / **MEDIUM** / expert YES

### G4. CLI-037 — dry에 warm과 같은 adjustPolar (mit=水)

| supporting | 燥則宜潤; 夏木 壬癸; 窮通 水渴 |
| limiting | 난을 水로 식히는 것과 조를 水로 윤택하는 것을 동일 함수로 묶는 원문 없음 |
| conflicting | 조습에 土를 쓰는 층; CLI-002 dry 클러스터(巳午未 등) CONTESTED |

**Verdict:** **CONTESTED** / **MEDIUM** / expert YES  

燥用水 **방향**은 부분 있으나, 규칙 본문은 warm 축과 **동일 함수 적용**이므로 방향만으로 PARTIALLY-SUPPORTED로 올리지 않는다.

---

## H. CLI-002 CONTESTED → G6

| 파급 | 내용 |
|---|---|
| 적용 대상 | 寅=balanced면 窮通 餘寒 조후가 G6 polar에 안 탐 |
| 未=warm+dry | 三伏生寒·未土 차별(Batch 4) 위에 또 火/水 조정이 올라감 |
| 결론 | G6 verdict는 상류 표를 전제하지 않고 **방향/함수만** 독립 평가하되, 엔진 규칙 전체(표+조정)는 닫히지 않음 |

이전 Batch CLI-002 verdict를 바꾸지 않는다.

---

## I. 학파·시대

| 층 | 내용 |
|---|---|
| 운문 | 寒暖 / 燥濕 **이축**. 과불급. 절차 없음 |
| 原註 | 遇暖遇寒; 燥濕에 寒土暖土 |
| 沈 | 월령 용신 + 調候為急. 일간×계절 예시 |
| 任 | 천간 火水 + **濕土燥土**. 동일 함수 아님 |
| 窮通 | 일간×월령 취용. 축 값 overlay 아님 |
| 通會 왕쇠 | 시절 기상 ≠ adjustPolar |

旺衰/格局/用神을 Climate adjustment로 합치지 않았다. 층만 표시.

---

## J. 요약표

| rule | literature verdict | confidence | expert |
|---|---|---|---|
| CLI-018 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| CLI-019 | CONTESTED | MEDIUM | YES |
| CLI-036 | CONTESTED | MEDIUM | YES |
| CLI-037 | CONTESTED | MEDIUM | YES |

| 집계 | 수 |
|---|---:|
| 실제 확인 문헌 | 7 |
| ORIGINAL-TEXT | 5 (S1 이축; S4 調候為急; S6 餘寒/水渴; S6 일간차등; S7 왕쇠 장 — 혼용 방지) |
| COMMENTARY | 3 (S2 原註; S3 任; S5 徐) |
| MODERN-INTERPRETATION | 0 |
| 독립 교차 | 2 (滴天髓 维基 운문↔原註; 窮通 维基 vs 沈 調候 용신 층) |
| SUPPORTED | 0 |
| PARTIALLY-SUPPORTED | 1 |
| CONTESTED | 3 |
| INSUFFICIENT-EVIDENCE | 0 |
| CONTRADICTED | 0 |

동일 함수 부재만으로 CONTRADICTED로 처리하지 않았다. 방향 관념과 엔진 절차를 분리했다.

---

## K. Unresolved

| id | issue |
|---|---|
| W1B6-U1 | CLI-002 CONTESTED — 조정 입력 라벨 미닫힘 |
| W1B6-U2 | quality clear/substantial 게이트는 EXPERT (CLI-021+) |
| W1B6-U3 | CLI-032 한 칸 폭, CLI-054 양축 동시 이동 미판정 |
| W1B6-U4 | 土를 조습 factor로 쓸지 (任 vs CLI-013 POLICY) |
| W1B6-U5 | 일간×월령 조후를 엔진 overlay로 대응할지 — 미설계 |

---

## L. 하지 않은 것

- Batch 1–5 verdict·파일 변경
- 엔진 / freezeStatus / 점수 / threshold / 예외 규칙
- Wave 2, NeedCandidate, 용신 설계
- 전문가 답 생성
