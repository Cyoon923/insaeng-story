# Wave 1 Actual Literature Validation — Batch 5

엔진 판단 코드는 이 문서로 바꾸지 않는다.
기존 rule / freezeStatus / method를 바꾸지 않는다.
SUPPORTED가 나와도 VERIFIED-FACT로 승격하지 않는다.
`FIRE_BRANCHES` / `WATER_BRANCHES` / quality 함수를 바꾸지 않는다.

**목적:** Batch 4 완료 후 Climate 축 병렬 상류 **W1-G5-BRANCH-FIRE-WATER**만 독립 문헌 근거로 대조한다.

이번 결과는 **literature evidence**다. BOTH 규칙은 이후 전문가 검증이 남는다.

근거:
- `wave1-literature-prep/wave1-literature-validation-prep.md`
- Batch 1–4 문헌 문서 (그룹 정의 재사용, 판정 미변경)
- `interpretive-validation-priority-audit.md`
- `interpretive-rule-inventory.json`
- `climate-audit/climate-rule-inventory.json` CLI-009~014, CLI-021, CLI-025
- `src/lib/saju/elements/climate.ts`
- `src/lib/saju/constants/elements.ts` `BRANCH_ELEMENT`

**보존 (이번 단계 미변경):** STR-010/011, STR-022/024, STR-030-*, CLI-002, CLI-003a–d, CLI-004, Expert Blind Prep, Pilot 5.

NeedCandidate / NeedResolution / Needed Element는 조사·수정하지 않는다.
G6는 이번 단계에서 판정하지 않는다.

---

## A. Dependency 재확인 (새 dependency 미작성)

기존 Audit / Batch 1 inventory:

| group | dependsOn | 비고 |
|---|---|---|
| W1-G4-MONTH-CLIMATE | CLI-001 | Batch 4 완료. 이번 비대상 |
| **W1-G5-BRANCH-FIRE-WATER** | **CLI-009, CLI-010 (VERIFIED-FACT: 丙丁=火, 壬癸=水)** | G4와 병렬 Climate 상류 |
| W1-G6-CLIMATE-ADJUST | CLI-002 (G4) | G4 의존. 이번 비대상 |

CLI-011 `dependsOn` = CLI-009만.  
CLI-012 `dependsOn` = CLI-010만.  
다른 미검증 BOTH에 의존하지 않음.

**재확인 결과:** G5는 G4와 병렬이며 G6의 공식 upstream은 CLI-002다. inventory에 G6→G5 간선을 새로 만들지 않음 → **Batch 5 = W1-G5-BRANCH-FIRE-WATER**.

downstream (기존 Audit, 추측 없음):

CLI-011 / CLI-012 → CLI-021 (quality clear) / CLI-025 (quality branch-only)

구분:

- CLI-009/010 천간 火/水 글자 = FACT
- CLI-011/012 **지지 본기 층**에서 火=巳午, 水=亥子만 = 이번 문헌 대상
- CLI-013 木金土는 Climate factor 없음 = ENGINE-POLICY (이번 비판정)
- CLI-014 월지 본기·월지 지장간 factor 생략 = ENGINE-POLICY (이번 비판정)
- CLI-021~025 quality 등급 = EXPERT (이번 비판정)
- CLI-018/019 완화 방향 = G6 (이번 비판정)

구현상 `qualityOf`가 `FIRE_BRANCHES`/`WATER_BRANCHES`를 다시 쓰지만, 기존 inventory에 G6 dependsOn G5가 없으므로 새 의존을 추가하지 않는다.

---

## B. 엔진 원문 (이름 추측 금지)

`src/lib/saju/elements/climate.ts`:

```
FIRE_STEMS = {丙, 丁}
WATER_STEMS = {壬, 癸}
FIRE_BRANCHES = {巳, 午}
WATER_BRANCHES = {亥, 子}
```

`climateElementOfBranch`: 巳午만 火, 亥子만 水. 그 외 지지(寅卯辰未申酉戌丑)는 **branch 층 Climate element 없음**.

같은 파일 `collectClimateEvidence`:

- `layer === "branch"`이면 **지지 글자**로만 火/水를 판정한다.
- 그 외(천간·지장간)는 **천간 글자**로 丙丁/壬癸를 판정한다.
- `slot === "month" && layer !== "stem"`이면 월지 본기·월지 지장간 factor를 만들지 않는다 (CLI-014).

따라서:

| 재료 | 엔진 처리 | 이번 rule |
|---|---|---|
| 巳·午 본기 | branch 火 | **CLI-011** |
| 寅 중 丙, 未/戌 중 丁 | hiddenStem 火 (branch 火 아님) | CLI-011이 제외하는 것 |
| 亥·子 본기 | branch 水 | **CLI-012** |
| 辰/丑 중 癸, 申 중 壬 | hiddenStem 水 (branch 水 아님) | CLI-012가 제외하는 것 |

`BRANCH_ELEMENT`도 寅卯=木, 巳午=火, 申酉=金, 亥子=水, 辰戌丑未=土. CLI-011/012는 이 본기 표를 Climate **branch factor**에 쓴 것이다.

`qualityOf` (`adjustedClimate.ts`)는 투출 천간 + 대표지지(巳午/亥子) + 지장간/통근으로 clear/substantial/shallow/hidden/branch-only를 만든다. **이번 Batch는 그 등급 체계를 판정하지 않는다.** CLI-011/012는 “대표 화지/수지가 무엇이냐”만 묻는다.

존재(factor 수집) ≠ 寒暖·燥濕을 실제로 한 단계 움직인다(CLI-018/019). 후자는 G6.

---

## C. 검증 질문 분리

| 코드 | 질문 | 이번 소속 |
|---|---|---|
| A | 지지 **본기**로 火=巳午, 水=亥子인가? | CLI-011/012 핵심 |
| B | 지장간 火/水(寅丙, 辰癸 등)를 본기 火/水와 같은 층으로 치는가? | CLI-011/012가 제외하는 것 |
| C | 단순 존재와 조후 조절을 문헌이 같은 규칙으로 쓰는가? | 수집 vs G6 |
| D | 같은 火/水가 계절·월령에 따라 조후 작용이 달라지는가? | 이번 rule이 고정 lookup인 이유 |
| E | 旺衰·三合·長生·用神을 Climate fact로 쓰나? | 문맥 혼용 |
| F | fire/water quality 등급이 고전 규칙인가? | 엔진 추상화. 이번 비판정 |

旺衰 「夏에 火가 旺」≠「巳午만 branch 火 factor」.  
「火長生在寅」≠「寅이 branch 火」.  
「申子辰 水局」≠「申·辰이 branch 水」.

---

## D. 조사한 출처 (확인 가능한 것만)

| id | 저자 / 전승 | 문헌 | 판본·접근 | 위치 | layer | 시대 메모 |
|---|---|---|---|---|---|---|
| S1 | 전승: 京圖/劉基 | 《滴天髓》 운문 | [维基文库 滴天髓/16](https://zh.wikisource.org/wiki/滴天髓/16) | 寒暖論 / 燥濕 운 | ORIGINAL-TEXT | 火/水 지지 목록 없음 |
| S2 | 전승 原註 | 같은 장 산문 | 维基文库 | 陰支為寒，陽支為暖，金水為寒，木火為暖 | COMMENTARY | 음양지지·오행. 巳午/亥子 한정 아님 |
| S3 | 清 任鐵樵 | 《滴天髓闡微》 | 燥濕 | 丑辰濕土 / 未戌燥土; 夏木 藉壬癸 | COMMENTARY | 辰을 水支가 아니라 濕土 |
| S4 | 明 萬民英 | 《三命通會》 | 卷二 論地支 | 巳火增光 / 午炎火 / 子溪澗水 / 亥雨雪 | ORIGINAL-TEXT | 본기 기상. 寅은 木+丙火生, 辰은 토월 |
| S5 | 전승 《淵海子平》 | 又地支藏遁歌 | [维基文库](https://zh.wikisource.org/wiki/淵海子平大全) | 寅宮甲木兼丙戊; 辰藏乙戊三分癸; 巳中庚金丙戊叢; 亥藏壬甲 | ORIGINAL-TEXT | 본기≠장간 목록 |
| S6 | 明 萬民英 | 《三命通會》 | 卷二 旺相休囚死 | 夏火旺 / 冬水旺 | ORIGINAL-TEXT | **旺衰** 장. 조후 수집 규칙이 아님 |
| S7 | 전승 《窮通寶鑑》 | 十干×月令 | [维基文库](https://zh.wikisource.org/wiki/窮通寶鑑) | 寅月 餘寒用丙; 調候 丙癸 | later 調候 ORIGINAL-TEXT | **천간 丙癸**. 巳午=branch 火 표가 아님 |

블로그·카페·SEO·GitHub는 핵심 근거로 쓰지 않는다.

---

## E. 출처별 근거

### E1. 《滴天髓》운문 (S1) — ORIGINAL-TEXT

> 天道有寒暖，發育萬物，人道得之，不可過也。  
> 地道有燥濕，生成品彙，人道得之，不可偏也。

**최소 해석:** 寒暖·燥濕 **축 이름**이다. 어느 지지가 branch 火/水인지는 말하지 않는다.

### E2. 原註 산문 (S2) — COMMENTARY

> 陰支為寒，陽支為暖，金水為寒，木火為暖…

**최소 해석:** 한난을 (1) 지지 음양, (2) 金水/木火로 본다. **巳午만 火지, 亥子만 수지**라는 수집 규칙이 아니다. 양지 寅은 「暖」이 될 수 있어 엔진의 「寅은 branch 火가 아님」과 **다른 축**이다. 운문에 소급하지 않는다.

### E3. 任鐵樵 燥濕 (S3) — COMMENTARY

> …必藉壬癸以生之，丑辰濕土以培之…若見未戌燥土，反助火而不能晦火…

**최소 해석:** 조습에서 辰·丑은 **濕土**, 未·戌은 **燥土**. 辰 중 癸가 있어도 辰을 水의 대표지로 치지 않는다. 夏의 조는 **壬癸(천간)** 로 다룬다. CLI-012가 辰을 branch 水에서 빼는 것과 **부분 정렬**. 토의 燥濕을 Climate factor로 쓰지 않는 CLI-013과는 별 층.

### E4. 《三命通會》論地支 (S4) — ORIGINAL-TEXT

> 寅建於春，氣聚之陽，有丙火生焉。  
> 巳當初夏，其火增光…  
> 午月炎火正…  
> 子…溪澗江洋之水…  
> 亥地六陰，雨雪載途…

**최소 해석:** 巳·午는 **화지 기상**, 亥·子는 **수지 기상**. 寅은 봄 **목지**이며 그 안에 **丙火가 生**한다. 본기(寅=木/巳=火)와 장간(寅중丙)을 한 문장에서 **구분**한다. 「寅중丙 = branch 火」로 읽지 말 것.

같은 편 辰은 季土·土旺 맥락이고, 申은 金지이면서 「水土長生之地」(水長生在申). **長生 ≠ 본기 수지지.**

### E5. 《淵海子平》地支藏遁歌 (S5) — ORIGINAL-TEXT

> 子宮癸水在其中…寅宮甲木兼丙戊…辰藏乙戊三分癸…巳中庚金丙戊叢…午宮丁火並己土…申位庚金壬水戊…戌宮辛金及丁戊…亥藏壬甲是真蹤。

**최소 해석:** 각 지지는 **본기 + 장간**을 나열한다. 寅의 火는 甲木과 **兼**한 丙. 辰의 水는 土 안에 **三分癸**. 巳의 본기는 火 계열(丙)이지만 庚·戊도 藏. 亥는 壬(본기 수)과 甲.  
문헌은 장간 존재를 인정하면서도 지지 이름을 그 장간 오행으로 바꾸지 않는다.

### E6. 《三命通會》旺相休囚死 (S6) — ORIGINAL-TEXT (旺衰)

> 夏火旺…冬水旺…

**최소 해석:** 계절 오행 왕약. **Climate branch factor 목록이 아니다.** 「夏火旺」을 「년일시에 巳午가 있으면 조후 火」로 건너뛰지 않는다.

### E7. 《窮通寶鑑》(S7) — 후대 調候 (early 子平에 소급 금지)

寅월 餘寒에 **丙**으로 暖을 푼다. 조후 취용은 **일간×월령의 천간(丙癸 등)**. 「년지/일지가 巳午면 branch 火」라는 수집 표가 아니다. 존재와 조절을 같은 규칙으로 닫지 않는다.

---

## F. 질문 A–F

| 질문 | 문헌 요지 vs 엔진 |
|---|---|
| A. 본기 火=巳午, 水=亥子? | 地支 오행·論地支 기상과 **정렬**. 조후 전용 수집 규칙으로 쓰인 고전 표는 확인하지 못함 |
| B. 장간을 본기와 같은 층? | 藏遁歌·論地支는 **구분**. 엔진도 branch≠hiddenStem. **부분 지지** |
| C. 존재 = 조절? | 아니오. 滴天髓/窮通의 조절은 丙癸·濕土 등. CLI-011/012는 수집만 |
| D. 계절에 따라 같은 火/水? | 窮通·沈 調候는 월령×일간에 따라 달라짐. 엔진 CLI-011/012는 사주 내 巳午/亥子를 **계절 무관** 고정 수집 |
| E. 旺衰/三合/長生 혼용? | 火局 寅午戌, 水局 申子辰, 火長生寅, 水長生申은 **본기 화지/수지와 다른 층**. 엔진은 三合·長生으로 branch 火/水를 확장하지 않음 |
| F. quality 등급? | 엔진 추상화. 이번 미판정 |

---

## G. 지지별 (본기 vs 장간 火/水)

| 지지 | 본기 (BRANCH_ELEMENT) | 장간 火/水 | vs CLI-011/012 |
|---|---|---|---|
| 巳 | 火 | 丙 정기 (+庚戊) | branch 火 **aligned** |
| 午 | 火 | 丁 정기 | branch 火 **aligned** |
| 寅 | 木 | 丙 중기 | branch 火 아님 **aligned with 본기**; 장간은 별 층 |
| 未 | 土 | 丁 여기 | branch 火 아님. 滴天髓 계열은 燥土 |
| 戌 | 土 | 丁 중기 | branch 火 아님. 火庫/燥土 층 |
| 亥 | 水 | 壬 정기 | branch 水 **aligned** |
| 子 | 水 | 癸 정기 | branch 水 **aligned** |
| 辰 | 土 | 癸 중기 | branch 水 아님 **aligned with 본기/濕土**; 水庫 층은 별 |
| 丑 | 土 | 癸 여기 | branch 水 아님. 濕土 |
| 申 | 金 | 壬 중기 | branch 水 아님. 水長生 층은 별 |

엔진은 장간 火/水를 **숨은 factor**로 남긴다. CLI-011/012는 그 숨은 층을 지우는 규칙이 아니다.

---

## H. Rule별 판정

### H1. CLI-011 — branch 火 = 巳午만

| 종류 | 내용 |
|---|---|
| supporting | 地支 오행 巳午=火; 通會 巳午 화지 기상; 寅은 목지+丙火生으로 장간 구분; 藏遁歌 寅中丙 ≠ 寅=火 |
| limiting | 조후 전용 「대표 화지=巳午」 표는 없음; 조절은 丙丁 천간이 후대 조후의 주수단; 월지 巳午는 CLI-014로 factor에서 빠짐 |
| conflicting | 火長生在寅, 寅午戌 火局은 寅·戌을 화 관련으로 봄; 原註 陽支=暖은 寅을 暖으로 볼 수 있음 (다른 축) |

**Literature verdict:** **PARTIALLY-SUPPORTED**  
**Evidence confidence:** **MEDIUM**  
**Expert required:** YES

이유: 본기 화지=巳午는 강하다. 그것을 Climate **branch factor 한정**으로 쓰는 것은 엔진 수집 정책이며, 장간·三合·長生·조후 용신을 같은 규칙으로 닫지 못한다.

### H2. CLI-012 — branch 水 = 亥子만

| 종류 | 내용 |
|---|---|
| supporting | 地支 오행 亥子=水; 通會 子·亥 수지 기상; 辰/丑은 土(闡微 濕土); 藏遁歌 辰中癸·申中壬은 藏이지 본기 수가 아님 |
| limiting | 조후 전용 「대표 수지=亥子」 표는 없음; 조절은 壬癸; 辰은 水庫로도 불림 |
| conflicting | 水長生在申, 申子辰 水局; 原註 陰支=寒은 亥·子 외 음지도 寒으로 볼 수 있음 |

**Literature verdict:** **PARTIALLY-SUPPORTED**  
**Evidence confidence:** **MEDIUM**  
**Expert required:** YES

이유: 본기 수지=亥子, 辰≠水支는 강하다. Climate 수집 한정과 水局/長生/濕土를 한 규칙으로 합치지 않는다.

---

## I. 엔진 구조 vs evidence (코드 미수정)

| 엔진 구조 | evidence 비교 |
|---|---|
| 巳午 = branch 火 | **partially aligned** (본기 화지) |
| 亥子 = branch 水 | **partially aligned** (본기 수지) |
| 寅중丙 ≠ branch 火 | **partially aligned** (본기/장간 구분) |
| 辰중癸 ≠ branch 水 | **partially aligned** (토지/濕土) |
| 존재 수집 ≠ 한난조습 이동 | 문헌도 별 층. **aligned as separation** |
| quality clear/substantial/… | **not judged** (EXPERT CLI-021~025) |
| 계절 무관 고정 巳午/亥子 | 조후 작용의 계절 의존과 **not the same proposition** |

---

## J. 학파·시대

| 층 | 내용 |
|---|---|
| 地支 오행 / 藏遁 | 본기 巳午火·亥子水, 장간은 별 목록. early 子平 공통 |
| 滴天髓 운문 | 寒暖/燥濕 축. 대표지 목록 없음 |
| 原註 | 음양지지 한난 — 본기 화수지지와 다른 축 |
| 通會 | 論地支 기상 vs 旺相休囚死 — 문맥 분리 |
| 任 闡微 | 丑辰濕土 未戌燥土. 辰≠水支 |
| 후대 窮通 | 丙癸 조후. 지지 본기 표가 아님 |

새 명리 역사 이론을 만들지 않았다.

---

## K. 요약표

| rule | literature verdict | confidence | expert |
|---|---|---|---|
| CLI-011 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| CLI-012 | PARTIALLY-SUPPORTED | MEDIUM | YES |

| 집계 | 수 |
|---|---:|
| 실제 확인 문헌 | 7 (S1–S7) |
| ORIGINAL-TEXT 증거 단위 | 6 (S1 운문; S4 論地支 화수지지; S5 藏遁歌; S4 寅중丙 구분; S6 旺衰 장; S7 丙癸 조후) |
| COMMENTARY | 2 (S2 原註; S3 任 濕土) |
| MODERN-INTERPRETATION | 0 |
| 독립 교차 확인 | 2 (滴天髓 维基 운문↔原註 분리; 淵海 藏遁歌 维基/ctext 교차) |
| SUPPORTED | 0 |
| PARTIALLY-SUPPORTED | 2 |
| CONTESTED | 0 |
| INSUFFICIENT-EVIDENCE | 0 |
| CONTRADICTED | 0 |

본기 화수지지 대응만으로 SUPPORTED로 올리지 않았다. 규칙은 Climate **branch 수집 한정**이며 조후 조절·quality·三合과 분리해야 한다.

---

## L. Unresolved

| id | issue |
|---|---|
| W1B5-U1 | CLI-009/010 FACT ≠ CLI-011/012 본기 한정이 조후 규칙이라는 주장 |
| W1B5-U2 | 火局 寅戌 / 水局 申辰을 branch factor에 넣을지는 전문가. 엔진은 안 넣음 |
| W1B5-U3 | 장간 火/水의 조후 가중은 CLI-024 등 EXPERT. 이번 미판정 |
| W1B5-U4 | CLI-014 월지 본기 생략은 POLICY. 문헌 미닫음 |
| W1B5-U5 | quality 등급·G6 완화는 다음 그룹 |

---

## M. 하지 않은 것

- Batch 1–4 파일·verdict 변경
- FIRE_BRANCHES / WATER_BRANCHES / quality / 점수
- G6 문헌 판정
- 전문가 답, Batch 6, Needed Element / 용신
