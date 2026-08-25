# Wave 1 Actual Literature Validation — Batch 4

엔진 판단 코드는 이 문서로 바꾸지 않는다.
기존 rule / freezeStatus / method를 바꾸지 않는다.
SUPPORTED가 나와도 VERIFIED-FACT로 승격하지 않는다.
`BASE_CLIMATE` / `baseClimate.ts` 값을 바꾸지 않는다.

**목적:** Batch 1–3 완료 후 Climate 축 상류 **W1-G4-MONTH-CLIMATE**만 독립 문헌 근거로 대조한다.

이번 결과는 **literature evidence**다. BOTH 규칙은 이후 전문가 검증이 남는다.

근거:
- `wave1-literature-prep/wave1-literature-validation-prep.md`
- Batch 1–3 문헌 문서 (그룹 정의 재사용, 판정 미변경)
- `interpretive-validation-priority-audit.md`
- `interpretive-rule-inventory.json`
- `climate-audit/climate-rule-inventory.json` CLI-001~004
- `src/lib/saju/data/baseClimate.ts`

**보존 (이번 단계 미변경):** STR-010/011, STR-022/024, STR-030-*, Expert Blind Prep, Pilot 5.

NeedCandidate / NeedResolution / Needed Element는 조사·수정하지 않는다.
G5·G6는 이번 단계에서 판정하지 않는다.

---

## A. Dependency 재확인 (새 dependency 미작성)

기존 Audit / Batch 1 inventory:

| group | dependsOn | 비고 |
|---|---|---|
| W1-G4-MONTH-CLIMATE | CLI-001 (VERIFIED-FACT: 월지 글자 복사) | Climate 축 상류 |
| W1-G6-CLIMATE-ADJUST | **CLI-002 (G4)** | G4 미검증이면 G6 판정 보류 — **유지** |
| W1-G5-BRANCH-FIRE-WATER | CLI-009, CLI-010 | G4와 병렬. 이번 비대상 |

CLI-002 `dependsOn` = CLI-001만.  
CLI-003a–d `dependsOn` = CLI-002.  
CLI-004 `dependsOn` = CLI-002 + CLI-003a–d.

**재확인 결과:** G4는 Climate 상류이며 G6는 G4(CLI-002)에 의존한다. 기존 inventory를 바꾸지 않음 → **Batch 4 = W1-G4-MONTH-CLIMATE**.

downstream (기존 Audit, 추측 없음):

G4 (CLI-002~004) → CLI-018/019 → adjusted → CLI-041~043 → NEED-020~022 → RES  
CLI-003a → CLI-018/019, NEED-023  
CLI-003b → CLI-018/019, NEED-021/022  
CLI-003c → CLI-019, NEED-022  
CLI-003d → CLI-018/019, NEED-020  
CLI-004 → CLI-018/019

구분:

- CLI-001 월지 글자 = FACT
- CLI-002~004 조후 **값·클러스터** = 이번 문헌 대상
- CLI-018/019/036/037 火/水 완화 = G6. 이번에 닫지 않음

---

## B. 엔진 원문 (이름 추측 금지)

`BASE_CLIMATE` (`src/lib/saju/data/baseClimate.ts`):

| 월지 | temperature | moisture | 엔진 클러스터 |
|---|---|---|---|
| 寅卯辰 | balanced | moist | CLI-003a 봄. 辰=寅卯와 같음 |
| 巳午未 | warm | dry | CLI-003b 여름. 未=巳午와 같음 |
| 申酉戌 | balanced | dry | CLI-003c 가을. 戌=申酉와 같음 |
| 亥子丑 | cold | moist | CLI-003d 겨울. 丑=亥子와 같음 |

- CLI-002: `monthBranch → BASE_CLIMATE[branch]` `{ temperature, moisture }` 12칸 표 전체
- CLI-003*: 사계절 클러스터 값
- CLI-004: 辰未戌丑을 **고유 Climate로 두지 않고** 인접 계절과 공유
- 표에 `warm+moist`, moisture `balanced` 월지는 없다 (CLI-035 dead branch — 이번 비수정)

일간·년시·투간에 따라 표가 바뀌지 않는다. 월지 한 글자 lookup.

코드에 표가 있음 ≠ 명리 검증됨 (climate audit freeze 경계와 동일).

---

## C. 검증 질문 분리 (A–F를 한 명제로 합치지 않음)

| 코드 | 질문 | 이번 소속 |
|---|---|---|
| A | 月令/월지가 조후 판단의 주요 기준인가? | CLI-002 전제 |
| B | 寒/暖(熱)을 월지·시절로 보는가? | 한난 축 |
| C | 燥/濕을 월지·시절로 보는가? | 조습 축 |
| D | 엔진 12칸 cold/warm/balanced × dry/moist가 문헌 표와 같은가? | CLI-002 값, CLI-003* |
| E | balanced가 고전 개념인가, 엔진 중립 추상화인가? | 특히 CLI-003a/c |
| F | 한 월지에 temperature+moisture를 **동시에 고정 부여**하는가? | CLI-002 구조 |

旺衰(왕상휴수사)·格局·用神·喜忌와 조후를 같은 문장으로 쓰지 않는다.  
「겨울에 水가 旺」≠「겨울 명식이 cold」.  
「夏에 火가 旺」≠「巳午未=warm/dry」.

---

## D. 조사한 출처 (확인 가능한 것만)

페이지 미확인은 기입하지 않는다.

| id | 저자 / 전승 | 문헌 | 판본·접근 | 위치 | layer | 시대 메모 |
|---|---|---|---|---|---|---|
| S1 | 전승: 京圖/劉基 | 《滴天髓》 운문 | [维基文库 滴天髓/16](https://zh.wikisource.org/wiki/滴天髓/16) | 寒暖論 / 燥濕 운 | ORIGINAL-TEXT | 조후를 **두 축 이름**으로 나눔 |
| S2 | 전승 原註 (운문과 분리) | 같은 장 산문 | 维基文库; 闡微는 【原注】로 표시 | 陰支為寒，陽支為暖，金水為寒，木火為暖 | COMMENTARY | 월지 12칸 표가 아님 |
| S3 | 清 任鐵樵 | 《滴天髓闡微》 | 闡微 寒暖 | 西北金水=寒 고정을 비판 | COMMENTARY | 후대 주석 |
| S4 | 明 萬民英 | 《三命通會》 | 卷二 論五行旺相休囚死 | 夏月大旱 / 冬月大寒 | ORIGINAL-TEXT | 旺衰 장과 같은 편 — 문맥 분리 |
| S5 | 清 沈孝瞻 | 《子平真詮》 | 論用神配氣候得失 | 月令用神 + 調候為急. 12칸 BASE_CLIMATE 표는 아님 | ORIGINAL-TEXT | 格局/用神 층 |
| S6 | 民 徐樂吾 | 《子平真詮評注》 | 같은 장 徐注 | 冬寒·夏燥를 用神 배치로 해설 | COMMENTARY | 후대 체계화. 沈에 소급 금지 |
| S7 | 전승: 《攔江網》계통 / 清 余春台 정리로 전함 | 《窮通寶鑑》 | [维基文库](https://zh.wikisource.org/wiki/窮通寶鑑) | 十干×月令 조후; 四季土 | later 調候 체계 (이 책의 ORIGINAL-TEXT, **early 子平에 소급 금지**) | 일간 의존 |

블로그·카페·SEO·GitHub는 핵심 근거로 쓰지 않는다.

---

## E. 출처별 근거

### E1. 《滴天髓》운문 (S1) — ORIGINAL-TEXT

> 天道有寒暖，發育萬物，人道得之，不可過也。  
> 地道有燥濕，生成品彙，人道得之，不可偏也。

**최소 해석:** 命理에서 **寒暖**과 **燥濕**을 서로 다른 도(天道/地道)로 말한다. 「지나치면 안 된다」는 **중화를 목표**로 하지, 월지마다 `balanced` 라벨을 주라는 표가 아니다.

**관계:** 질문 B·C·F의 **개념 층** 지지. D(12칸 표)는 이 운문에 없음.

### E2. 滴天髓 原註 산문 (S2) — COMMENTARY

> 陰支為寒，陽支為暖，金水為寒，木火為暖…若五行陽遇子月…陰逄午月…

**최소 해석:** 한난을 (1) 지지 음양, (2) 金水/木火, (3) 子·午월 예외로 본다. **寅卯辰=balanced+moist 같은 계절 클러스터가 아니다.** 양지 寅·午는 「暖」, 음지 卯·子는 「寒」이 될 수 있어 엔진 봄·겨울 묶음과 축이 다르다.

운문 저자의 직접 12월지 표로 소급하지 않는다.

### E3. 任鐵樵 (S3) — COMMENTARY

西北金水=寒, 東南木火=暖에 **집착하지 말 것.** 寒甚에도 暖의 氣가 필요하고, 국 전체로 본다. **월지 단독 고정 표와 긴장.**

### E4. 《三命通會》(S4) — ORIGINAL-TEXT (시절 기상; 旺衰 장과 인접)

> 觀夏月大旱，金石流，水土焦。六月暑氣增，寒氣滅；秋月金勝，草木黃落；冬月大寒太冷，水結冰，火氣頓減。

**최소 해석:** 夏=한·조에 가까운 기상, 冬=한. 秋는 金勝·초목 황락(조/숙살). **「火가 旺」과 「명식이 warm」을 한 문장으로 쓰지 말 것** — 같은 장에 旺相休囚死가 있다. 조후 전용 12칸 표는 없다.

### E5. 《子平真詮》沈 (S5) — ORIGINAL-TEXT

> 論命惟以月令用神為主，然亦須配氣候而互參之。  
> …冬木逢火…即可以調候也。  
> …非官之不畏夫傷，而調候為急，權而用之也。

**최소 해석:** 월령이 用神의 주된 출발점이며, 기후를 **함께** 본다. 調候는 冬木·金水傷官 등 **일간×계절 용신 배치** 맥락이다. **한난조습 12칸 lookup 표가 아니다.** 辰戌丑未 雜氣·土 위주 서술도 Climate 표가 아니다.

### E6. 徐樂吾 (S6) — COMMENTARY

徐注는 沈의 冬寒·夏燥·調候를 **用神 배치 해설**로 확장한다. 沈 원문의 「12월지 lookup」이 아니다. 후대 체계화. 沈에 소급하지 않는다.

### E7. 《窮通寶鑑》(S7) — 후대 調候 원문 (early 子平에 소급 금지)

**총론:**

> 北方陰極而生寒，寒生水。南方陽極而生熱，熱生火。…西方陰止以收而生燥，燥生金。

방위·오행 기상. 월지 12칸 표가 아님.

**春木 (寅≠卯≠辰):**

> 春月之木，漸有生長之象。初春猶有餘寒，當以火溫暖…春末陽壯水渴，藉水資扶…正月甲木，初春尚有餘寒。

寅=餘寒(엔진 balanced와 충돌). 辰=陽壯水渴(寅과 같지 않음). 같은 월이라도 일간에 따라 취용이 달라진다.

**四季土:**

> 辰戌丑未，四土之神。惟未土為極旺…辰土帶木氣…戌丑之土，帶金氣洩之…未月土則帶火氣…多作火炎土燥，不可作稼穡看。

四庫를 **한 계절 클러스터 값으로 접지 않음.** 未≠辰丑戌.

**六月:** 「三伏生寒」, 丁火 退氣 — 未를 巳午와 동일 warm+dry로 두는 것과 긴장.

**일간 의존:** 같은 寅월이라도 甲은 丙癸, 戊는 丙甲癸 등. 엔진처럼 월지만으로 T+M이 닫히지 않음.

---

## F. 질문 A–F

| 질문 | 문헌 요지 vs 엔진 |
|---|---|
| A. 月令이 조후 출발점? | 沈 月令用神+配氣候; 窮通은 月令×日干. **월지는 중요 출발점.** 다만 월지 **단독 확정**은 후대에도 약함 |
| B. 寒暖 | 운문·三命 시절 기상·窮通 餘寒/炎/凍. **개념은 있음.** 엔진 warm/cold/balanced 3값은 표로 고정 |
| C. 燥濕 | 운문 地道燥濕; 窮通 燥渴·滋潤·火炎土燥. **개념은 있음.** 월지 dry/moist 단독 표는 없음 |
| D. 12칸 매핑 | **고전에서 동일 표를 확인하지 못함** |
| E. balanced | **고전 월지 라벨로 확인되지 않음.** 不可過·中和는 목표이지 寅·申의 상태명이 아님 |
| F. T+M 동시 부여 | 寒暖 장과 燥濕 장이 **나란히** 있음 → 두 축 **개념**은 지지. **월지마다 한 쌍을 lookup**하는 구조는 문헌 표가 아님 |

---

## G. 12월지 개별 / 辰未戌丑

| 월지 | 문헌 스케치 | vs 엔진 | 비교 |
|---|---|---|---|
| 寅 | 窮通 初春餘寒, 要火暖 | balanced+moist | **conflicting** (한 vs 중립) |
| 卯 | 寅보다 餘寒 약, 春木 既濟 | 寅과 동일 | **partially aligned** (습/생장) / 온도 묶음은 약 |
| 辰 | 土司令, 陽壯水渴, 四庫 | 寅卯와 동일 moist | **contested** |
| 巳 | 夏 炎, 金燥土焦 | warm+dry | **partially aligned** |
| 午 | 炎상; 原註 午月은 一陰收藏 | warm+dry | **partially aligned** (熱) / 다른 층 |
| 未 | 火炎土燥 **및** 三伏生寒 | 巳午와 동일 | **contested** |
| 申 | 初秋 火氣未除 vs 金涼 | balanced+dry | **not directly supported** (balanced) |
| 酉 | 中秋 肅殺 | 申과 동일 | **partially aligned** (조/숙) |
| 戌 | 九月土盛, 四庫, 燥토 논 | 申酉와 동일 | **contested** |
| 亥 | 冬 寒 | cold+moist | **partially aligned** |
| 子 | 大寒; 原註 一陽懷胎 | cold+moist | **partially aligned** |
| 丑 | 天寒氣凍, 四庫 습토 논 | 亥子와 동일 | **contested** (한습 vs 고유 丑土) |

**辰未戌丑:** 沈·窮通 모두 四庫/季土를 **별 층**으로 다룬다. CLI-004의 「인접 계절과 같은 Climate」는 문헌의 단순화가 아니다. 未(火氣)≠丑(冬寒/金洩)≠辰(木氣)≠戌(金氣).

---

## H. Rule별 판정

월령을 조후 **출발점**으로 쓰는 근거(A)와, **이 표의 칸값**(D)을 한 문장으로 지지하지 않는다.

### H1. CLI-002 — 12월지 BASE_CLIMATE 표

| 종류 | 내용 |
|---|---|
| supporting | 月令提綱; 寒暖·燥濕이 命理 축으로 존재; 후대 조후가 月令을 인덱스로 씀 |
| limiting | 운문은 12칸 표가 아님; 중화는 목표; 일간·전국 구성이 후대에 필수 |
| conflicting | 음양지지 한난 ≠ 사철 클러스터; 窮通은 日干×月 |

**Literature verdict:** **CONTESTED**  
**Evidence confidence:** **MEDIUM**  
**Expert required:** YES

이유: 「월지로 조후를 시작한다」는 부분 지지와 「이 12쌍 lookup이 고전 표」는 별개다. 규칙 본문은 후자이므로 CONTESTED.

### H2. CLI-003a — 寅卯辰 = balanced+moist

| supporting | 春에 수분이 필요하다는 窮通 既濟 |
| limiting | 寅卯辰를 한 칸으로 접지 않음 |
| conflicting | 寅 餘寒 vs balanced; 辰 季土 ≠ 寅卯 |

**Verdict:** **CONTESTED** / **MEDIUM** / expert YES

### H3. CLI-003b — 巳午未 = warm+dry

| supporting | 夏旱·炎·金燥土焦; 巳午 熱燥에 가장 가까움 |
| limiting | 火旺 ≠ 명식 warm/dry 확정 |
| conflicting | 未 三伏生寒·退氣 vs 巳午 동일 값 |

**Verdict:** **PARTIALLY-SUPPORTED** / **MEDIUM** / expert YES  
(여름 기상은 부분 지지. 未 동일 취급은 별도 충돌 — CLI-004와 겹침)

### H4. CLI-003c — 申酉戌 = balanced+dry

| supporting | 秋 肅殺·西方生燥; 酉의 조에 가까운 서술 |
| limiting | balanced에 해당하는 월지명 없음; 申은 餘火 논 |
| conflicting | 戌 季土 ≠ 申酉 |

**Verdict:** **CONTESTED** / **MEDIUM** / expert YES

### H5. CLI-003d — 亥子丑 = cold+moist

| supporting | 冬月大寒; 窮通 天寒氣凍; 北方生寒 |
| limiting | 子 一陽 예외(原註); 丑은 四庫 |
| conflicting | 丑=亥子 동일 값 |

**Verdict:** **PARTIALLY-SUPPORTED** / **MEDIUM** / expert YES  
(亥子 한습은 상대적으로 강. 丑 접지는 CLI-004)

### H6. CLI-004 — 토월=인접 계절

| supporting | 辰을 봄, 未를 夏令에 붙이는 **절기 소속**은 있음 |
| limiting | 소속 계절 ≠ 동일 T+M |
| conflicting | 窮通 四土 차별; 未極旺 火炎土燥; 沈 雜氣土 주 |

**Verdict:** **CONTESTED** / **MEDIUM** / expert YES

---

## I. 엔진 표 vs evidence (코드 미수정)

| grouping | evidence 비교 |
|---|---|
| 寅卯辰 balanced/moist | 寅 **conflicting**; 卯 **partial**; 辰 **contested** |
| 巳午未 warm/dry | 巳午 **partially aligned**; 未 **contested** |
| 申酉戌 balanced/dry | 酉 **partial**; 申·戌 **not directly supported / contested** |
| 亥子丑 cold/moist | 亥子 **partially aligned**; 丑 **contested** |
| 2축 lookup 구조 | 개념 축은 **partially aligned**; 표 형식은 **not directly supported** |
| balanced 라벨 | **not directly supported** |

---

## J. 학파·시대

| 층 | 내용 |
|---|---|
| early | 滴天髓 운문: 寒暖 / 燥濕 이름, 과불급 금지. 12칸 없음 |
| 原註 | 음양지지·오행 한난. 월지 클러스터와 다른 축 |
| 明 通會 | 시절 기상 서술, 旺衰와 같은 편 |
| 清 沈 | 月令 格局·用神 + 調候為急. 조후 12칸 표 아님 |
| 후대 | 徐 調候 用神 해설; 窮通 日干×月 조후 — **고전 보편 규칙으로 소급하지 않음** |

새 명리 역사 이론을 만들지 않았다. 출처 층만 보존한다.

---

## K. 요약표

| rule | literature verdict | confidence | expert |
|---|---|---|---|
| CLI-002 | CONTESTED | MEDIUM | YES |
| CLI-003a | CONTESTED | MEDIUM | YES |
| CLI-003b | PARTIALLY-SUPPORTED | MEDIUM | YES |
| CLI-003c | CONTESTED | MEDIUM | YES |
| CLI-003d | PARTIALLY-SUPPORTED | MEDIUM | YES |
| CLI-004 | CONTESTED | MEDIUM | YES |

| 집계 | 수 |
|---|---:|
| 실제 확인 문헌 | 7 (S1–S7) |
| ORIGINAL-TEXT 증거 단위 | 6 (S1 운문 2축; S4 시절기상; S5 月令/調候為急; S7 春木차등; S7 四季土; S7 방위한열조) |
| COMMENTARY | 3 (S2 原註; S3 任; S6 徐) |
| MODERN-INTERPRETATION | 0 |
| 독립 교차 확인 | 2 (滴天髓 维基 운문↔闡微 원주 표시; 窮通 维基 본문 vs 沈 調候為急 무 12칸 표) |
| SUPPORTED | 0 |
| PARTIALLY-SUPPORTED | 2 |
| CONTESTED | 4 |
| INSUFFICIENT-EVIDENCE | 0 |
| CONTRADICTED | 0 |

용어 부재만으로 CONTRADICTED로 처리하지 않았다. 개념 대응을 보았고, 표 값·토월 접지는 문헌 체계와 축이 다르다.

---

## L. Unresolved

| id | issue |
|---|---|
| W1B4-U1 | CLI-001 FACT ≠ CLI-002 값 검증 |
| W1B4-U2 | 原註 음양지지 한난 vs 사철 클러스터 — 전문가 |
| W1B4-U3 | 窮通 일간 의존을 엔진 lookup에 어떻게 대응할지는 G6/전문 — 이번 미설계 |
| W1B4-U4 | moisture balanced 월지 없음 (CLI-035 dead branch)은 구현 이슈. 문헌으로 채우지 않음 |
| W1B4-U5 | G6 CLI-018/019는 G4 위에 있음. 미판정 |

---

## M. 하지 않은 것

- Batch 1–3 파일·verdict 변경
- baseClimate / 12월지 매핑 / counter-signal / 점수
- G5·G6 문헌 판정
- 전문가 답, Batch 5, Needed Element / 용신
