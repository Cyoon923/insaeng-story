# Wave 1 Actual Literature Validation — Batch 3

엔진 판단 코드는 이 문서로 바꾸지 않는다.
기존 rule / freezeStatus / method를 바꾸지 않는다.
SUPPORTED가 나와도 VERIFIED-FACT로 승격하지 않는다.

**목적:** Batch 1–2 완료 후 남은 Wave 1 BOTH 병렬 상류 중 **W1-G3-ROOT-DEPTH**만 독립 문헌 근거로 대조한다.

이번 결과는 **literature evidence**다. BOTH 규칙은 이후 전문가 검증이 남는다.

근거:
- `wave1-literature-prep/wave1-literature-validation-prep.md`
- `wave1-batch-1-literature-validation.md` / `wave1-batch-2-literature-validation.md` (그룹 정의 재사용, 판정 미변경)
- `interpretive-validation-priority-audit.md`
- `strengthSummary.ts` `rootQualityOf`
- `roots.ts` `analyzeStemRoots`
- `strength-rule-inventory.json` STR-005, STR-030-*

**보존 (이번 단계 미변경):** STR-010/011, STR-022/024 literature verdict·confidence, Expert Blind Prep, Pilot 5.

NeedCandidate / NeedResolution / Needed Element는 조사·수정하지 않는다.
Pilot 5를 Batch 3 검증 자료로 재사용하지 않는다.

---

## A. Dependency 재확인 (새 dependency 미작성)

기존 Audit / Batch 1 inventory:

| group | dependsOn | 다른 미검증 BOTH에 의존? |
|---|---|---|
| W1-G1 | STR-003 (VERIFIED-FACT lookup) | 아니오 — Batch 1 완료 |
| W1-G2 | STR-004 (VERIFIED-FACT lookup) | 아니오 — Batch 2 완료 |
| **W1-G3** | **STR-005 (VERIFIED-FACT root hit)** | **아니오** |
| W1-G4 | CLI-001 | 아니오 (Climate 축) |
| W1-G5 | CLI-009, CLI-010 | 아니오 |
| W1-G6 | CLI-002 (**G4 BOTH**) | 예 — G4 미검증 |

STR-030-* `dependsOn` = STR-005만. STR-005는 지장간 **동오행 hit 존재** lookup이며 freezeStatus **VERIFIED-FACT**.  
STR-031/032/033/050는 G3의 **downstream**(EXPERT 또는 이후 해석)이지 G3의 upstream이 아니다.

**재확인 결과:** G3는 다른 미검증 BOTH interpretive rule에 의존하지 않는 **병렬 Strength 상류**로 유지된다. 객관적 inventory 변경 없음 → **Batch 3 = W1-G3-ROOT-DEPTH**.

구분:

- STR-005 hit 존재 = raw 통근 mapping (이번 Batch에서 재검증 완료 처리하지 않음)
- STR-030-* = hit의 **정기/중기/여기 역할 → clear/present/shallow 깊이 라벨** (이번 문헌 대상)

---

## B. 엔진 원문 (이름 추측 금지)

`rootQualityOf` (`strengthSummary.ts`):

1. hits 중 `role===정기` 하나라도 있으면 `clear`
2. 아니면 `role===중기` 있으면 `present`
3. 아니면 `role===여기` 있으면 `shallow`
4. 아니면 `absent`

`analyzeStemRoots` (`roots.ts`):

- 확정 슬롯(년·월·일·시; 시 미상이면 시 생략)의 **모든 지지** 지장간을 본다
- 일간과 **같은 오행**이면 hit (같은 글자일 필요 없음; 같으면 비견, 다르면 겁재)
- **월지와 타 지지를 가중·분리하지 않음**
- **투간 여부는 STR-030에 들어가지 않음** (`exactStemVisible`은 relation item 별도 필드)

이번 Batch가 **하지 않는 것** (downstream / 다른 rule):

- STR-031: root 있으면 strong-side에 올림
- STR-033: shallow를 포함해 substantialStrong OR
- STR-050: leaning-strong에 **clear만** 요구

STR-030은 **깊이 라벨 부여**다. 通根 존재 자체(STR-005)와 Strength 기여 정도(STR-031/033/050)와 분리한다.

엔진 용어 대응: 정기 ≈ 본기, 중기 ≈ 중기, 여기 ≈ 여기. 라벨 `clear` / `present` / `shallow`는 코드 enum.

---

## C. Batch 3 검증 질문

| rule | 엔진 동작 | question |
|---|---|---|
| STR-030-clear | 정기 hit → rootQuality=clear | 지장간 **정기/본기** 통근을 가장 깊은 根으로 두는가? 그 라벨이 세력 판단에서 무엇을 의미하는가? |
| STR-030-present | 정기 없고 중기 → present | **중기**만 있을 때 중간 깊이 통근으로 다루는 문헌 정의가 있는가? |
| STR-030-shallow | 여기만 → shallow | **여기**만 있을 때 얕은 통근으로 다루는가? |

공통 A–F: 通根의 세력 사용; 동오행 존재=동일 通根인지; 본기·중기·여기 깊이; 월지 vs 타 지지; 투간 vs 通根; clear/present/shallow가 고전 분류인지 엔진 추상화인지.

---

## D. 조사한 출처 (확인 가능한 것만)

페이지 미확인 항목은 페이지를 기입하지 않는다.

| id | 저자 / 전승 | 문헌 | 판본·접근 | 위치 | layer |
|---|---|---|---|---|---|
| S1 | 清 沈孝瞻 | 《子平真詮》 | [ctext 評注본 내 沈文](https://ctext.org/wiki.pl?chapter=974137&if=gb) | 「論十干得時不旺失時不弱」: 通根·根之重輕 | ORIGINAL-TEXT |
| S2 | 전승: 徐升 계통 | 《淵海子平》 | [维基文库](https://zh.wikisource.org/wiki/淵海子平) | 「又地支藏遁歌」 | ORIGINAL-TEXT |
| S3 | 明 萬民英 | 《三命通會》 | [識典古籍](https://www.shidianguji.com/zh/book/SK1610/chapter/1kf5v6ol1tqg5) 계열 「論人元司事」 | 十二月 지중 用事 일수 | ORIGINAL-TEXT |
| S4 | 전승: 京圖/劉基 | 《滴天髓》 | [维基文库](https://zh.wikisource.org/wiki/滴天髓) | 「壬水」通根透癸; 「八格」人元透出 | ORIGINAL-TEXT |
| S5 | 民 徐樂吾 | 《子平真詮評注》 | 같은 ctext 장 | 旺衰/強弱·黨眾 평주 | COMMENTARY |

블로그·카페·SEO·GitHub 구현은 핵심 근거로 쓰지 않는다.
학술 논문 전문을 열어 통근 깊이 3단을 인용하지 않았다 (NOT-REVIEWED-FULLTEXT).

---

## E. 출처별 근거

### E1. 《子平真詮》沈 (S1) — ORIGINAL-TEXT

**통근 존재와 세력:**

> 人之日主，不必生逢祿旺，即月令休囚，而年日時中得長祿旺，便不為弱，就使逢庫，亦為有根。

> 是故十干不論月令休囚，只要四柱有根，便能受財官食神而當傷官七煞。

**최소 해석:** 通根은 일간 旺衰에서 **得令(월령)과 별개**로 쓰인다. 월령이 休囚여도 年日時에 根이 있으면 약하다고만 하지 않는다. 庫도 “有根”.

**뿌리 경중 (十二長生·祿旺 vs 墓庫餘氣):**

> 長生祿旺，根之重者也；墓庫餘氣，根之輕者也。… 乙逢戌、丁逢丑，不作此論，以戌中無藏木，丑中無藏火也。得二比肩，不如得一餘氣，如乙逢辰、丁逢未之類。得三比肩，不如得一長生祿刃，如甲逢亥子寅卯之類。… 蓋比劫如朋友之相扶，通根如室家之可住；干多不如根重。

**최소 해석:**

- 같은 오행이 지장간에 **실제로 藏**되어야 根이다 (戌中無藏木 → 乙의 根 아님). STR-005와 정합.
- 깊이 구분은 **본기/중기/여기 3라벨이 아니라** 長生·祿·旺(重) vs 墓庫·餘氣(輕).
- 투간 比劫과 通根을 **별개**로 두고, 通根을 더 중하게 본다.
- 월지 전용 根 가중 공식은 없고, **月令(得時) vs 年日時 通根**은 분명히 나눈다.

**엔진과의 어긋남 (기록만):**

- 寅中戊 = 엔진 **여기 → shallow**. 戊의 長生은 寅 → 沈이면 **根之重**.
- 辰中戊 = 엔진 **정기 → clear**. 戊의 墓는 辰 → 沈이면 **根之輕**.
- 따라서 엔진 3단은 沈의 重/輕과 **다른 축**이다.

### E2. 《淵海子平》藏遁歌 (S2) — ORIGINAL-TEXT

> 子宮癸水在其中，丑癸辛金己土同；寅宮甲木兼丙戊，卯宮乙木獨相逢。辰藏乙戊三分癸…

**최소 해석:** 지지에 어떤 천간이 숨는지를 열거한다. **본기·중기·여기라는 세력 3단 공식이나 clear/present/shallow 분류는 이 노래에 없다.** “三分癸”는 기운의 적음을 암시할 수 있으나, 일간 통근 깊이 enum으로 닫히지 않는다.

지장간 **목록**은 STR-002/STR-005 원재료 층. STR-030의 해석 3단과 같지 않다.

### E3. 《三命通會》人元司事 (S3) — ORIGINAL-TEXT

十二月 지중 用事를 **일수**로 나눈다. 예: 正月寅 — 艮土用事五日, 丙火長生五日, 甲木二十日. 三月辰 — 乙木七日, 壬水墓庫五日, 戊土一十八日. 四月巳 — 戊土七日, 庚金長生五日, 丙火一十八日.

**최소 해석:** 藏干에 **강약·기간 차이**가 있다는 고전 근거. 다만 축은 **司令日數·長生·墓庫**이지 엔진 role 라벨이 아니다.

**엔진과의 어긋남:** 巳에서 通會는 戊 7일 > 庚長生 5일인데, 엔진은 戊=여기(shallow), 庚=중기(present). 일수 순위와 role 순위가 뒤집힌다. 寅의 戊 5일=여기, 丙長生 5일=중기, 甲 20일=정기는 **대략** 맞을 수 있으나 전 12지가 한 규칙으로 닫히지 않는다.

문맥: **月令 人元用事**(격국·사령)에 가깝다. 년·일·시 지지 통근 깊이와 동일 문맥이 아니다.

### E4. 《滴天髓》(S4) — ORIGINAL-TEXT

> 通根透癸，沖天奔地…  
> 戊己日生於四季，當看人元透出天干者取格…

**최소 해석:** “通根”과 “透”가 **함께** 등장하나, 인용 맥락은 壬수 기상 또는 **취격**. 본기/중기/여기 3단 Strength 라벨이 아니다. **다른 해석 층**으로만 기록. STR-030 직접 supporting으로 쓰지 않음.

### E5. 徐樂吾 評注 (S5) — COMMENTARY

得時=旺 / 黨眾=強, 通根扶助을 黨眾에 넣는 후대 해설. 沈 原文으로 소급하지 않는다. 3단 clear/present/shallow를 정의하지 않는다.

---

## F. 개념 층 분리 (Batch 2 교훈)

| 층 | 이번 사용 |
|---|---|
| 通根 (지지 장간에 일간 오행이 있음) | STR-030의 전제. STR-005 raw |
| 得地 / 得令 / 得勢 | 得令은 Batch 2·월령. 得地는 通根과 겹칠 수 있으나 동일 용어로 합치지 않음 |
| 透干 | STR-030 밖. 沈: 比劫 ≠ 通根 |
| 본기·중기·여기 (지장간 자리) | 엔진 role. 고전 노래는 목록 위주 |
| 十二長生 祿旺墓餘氣 | 沈의 根 輕重. 시절 旺相休囚死·十二宫 死와 혼용 금지 |
| 人元司事 일수 | 월령 사령. STR-030 전 지지 일괄 라벨과 다름 |
| 格局 / 用神 / 透出取格 | 직접 근거 아님 |

---

## G. Rule별 판정

### G1. STR-030-clear — 정기 → clear

| 종류 | 내용 |
|---|---|
| supporting | 藏干에 본기(정기)가 해당 지지의 주된 人元이라는 전통(寅甲·卯乙 등). 沈: 祿旺은 根之重 — 많은 경우 정기=祿/旺과 겹침. 통근이 세력에 쓰임 |
| limiting | clear라는 단어·3단 enum은 문헌에 없음. 월지/타지지 미구분. 투간 미반영. 라벨 ≠ leaning-strong 확정(STR-050) |
| conflicting | 辰戌丑未 **정기=토 본기=墓旺**. 沈은 墓庫를 根之輕. 엔진은 같은 정기를 가장 깊은 clear로 둠 |

**Literature verdict:** **PARTIALLY-SUPPORTED**  
**Evidence confidence:** **MEDIUM**  
**Expert required:** YES

### G2. STR-030-present — 중기 → present

| 종류 | 내용 |
|---|---|
| supporting | 한 지지에 본기 외 藏干이 있다는 것(寅丙、巳庚 등)은 원전 목록·人元司事에 있음 |
| limiting | “중기만 = 중간 통근 강도”라는 세력 규칙은 확인되지 않음. present enum은 엔진 추상화 |
| conflicting | 寅丙·申壬·亥甲은 엔진 중기이지만 해당 천간의 **長生** → 沈의 根之重. 巳庚도 庚長生=중기. 중간 깊이와 重根이 충돌 |

**Literature verdict:** **CONTESTED**  
**Evidence confidence:** **MEDIUM**  
**Expert required:** YES

### G3. STR-030-shallow — 여기 → shallow

| 종류 | 내용 |
|---|---|
| supporting | 沈: 餘氣는 根之輕 (乙逢辰, 丁逢未). 辰乙=엔진 여기. 通會 일부 짧은 用事 |
| limiting | 여기=shallow 라벨은 엔진. 여기 hit도 STR-031에서 strong-side에 올림(이번 비대상이나 깊이 의미와 긴장) |
| conflicting | 寅戊 엔진 여기 vs 戊長生(寅) 沈 根之重. 후대 중기/여기 자리 교체 논쟁은 원전 노래만으로 고정 불가 |

**Literature verdict:** **CONTESTED**  
**Evidence confidence:** **MEDIUM**  
**Expert required:** YES

---

## H. 질문 A–F 종합

| 질문 | 문헌 요지 vs 엔진 |
|---|---|
| A. 通根과 세력 | 沈: 有根이면 休囚월에도 약단정 금지. **존재**는 지지됨. 깊이 3단은 별개 |
| B. 동오행만으로 동일 通根? | 아니오. 沈은 重/輕을 나눔. 엔진 STR-005는 동일 hit, STR-030이 role로 나눔 |
| C. 본기·중기·여기 깊이 | 藏干 차이는 있음. **세력 3단 = 그 role과 1:1**이라는 원전 규칙은 없음 |
| D. 월지 vs 타 지지 | 沈: 月令(得時)과 年日時 通根을 **구분**. 엔진 STR-030은 **동일 취급** |
| E. 투간 vs 通根 | 沈: 별개, 通根이 더 중. 엔진 STR-030은 투간을 쓰지 않음 (분리 자체는 문헌과 맞음) |
| F. clear/present/shallow | **고전 직접 분류 아님.** 정기/중기/여기 lookup 위의 **엔진 내부 추상화** |

용어 부재만으로 CONTRADICTED로 처리하지 않았다. 개념 대응을 보았고, 대응이 부분적이거나 다른 축(長生/墓)과 충돌한다.

---

## I. 요약표

| rule | literature verdict | confidence | expert still required |
|---|---|---|---|
| STR-030-clear | PARTIALLY-SUPPORTED | MEDIUM | YES |
| STR-030-present | CONTESTED | MEDIUM | YES |
| STR-030-shallow | CONTESTED | MEDIUM | YES |

| 집계 | 수 |
|---|---:|
| 실제 확인 문헌 | 5 (S1–S5) |
| ORIGINAL-TEXT 증거 단위 | 7 |
| COMMENTARY | 1 |
| MODERN-INTERPRETATION | 0 |
| 독립 교차 확인 | 2 (真詮 ctext 본문; 淵海 维基藏遁歌) |
| SUPPORTED | 0 |
| PARTIALLY-SUPPORTED | 1 |
| CONTESTED | 2 |
| INSUFFICIENT-EVIDENCE | 0 |
| CONTRADICTED | 0 |

---

## J. Unresolved

| id | issue |
|---|---|
| W1B3-U1 | STR-005 hit 표·STR-002 지장간 순서는 FACT. 이번은 깊이 **해석**만 |
| W1B3-U2 | 人元司事 일수 vs 엔진 role vs 十二長生 根輕重 — 세 축 미수렴 |
| W1B3-U3 | 중기/여기 판본 차이 (후대 논쟁) 원전 노래만으로는 고정 불가 |
| W1B3-U4 | STR-031/033이 shallow를 강 측에 넣는 것은 G3 라벨 이후 문제. 미판정 |
| W1B3-U5 | 월지 사령과 년일시 통근을 엔진이 한 quality로 접는 것의 전문가 판단 |

---

## K. 하지 않은 것

- Batch 1–2 파일·verdict 변경
- 엔진 / expected / freezeStatus / 점수·가중치
- SEASON_PHASE, 통근 weight, 월지 root 가중
- G4–G6 문헌 판정
- 전문가 답 생성, Batch 4, Needed Element / 용신 / 희신
