# Wave 1 Actual Literature Validation — Batch 2

엔진 판단 코드는 이 문서로 바꾸지 않는다.
기존 rule / freezeStatus / method를 바꾸지 않는다.
SUPPORTED가 나와도 VERIFIED-FACT로 승격하지 않는다.

**목적:** Batch 1(W1-G1) 완료 후 남은 Wave 1 BOTH 그룹 중 **가장 upstream**인 Batch 2만 독립 문헌 근거로 대조한다.

이번 결과는 **literature evidence**다. BOTH 규칙은 이후 전문가 검증이 남는다.

근거:
- `wave1-literature-prep/wave1-literature-validation-prep.md`
- `wave1-batch-1-literature-validation.md` (그룹 정의 재사용, 판정 미변경)
- `interpretive-validation-priority-audit.md`

**보존 (이번 단계 미변경):** STR-010/011 literature verdict·confidence, Expert Blind Prep, Pilot 5 cases, expert response template.

NeedCandidate / NeedResolution / Needed Element는 조사·수정하지 않는다.

---

## A. 남은 Wave 1 BOTH 그룹 (기존 grouping 유지)

| group id | 포함 rule | upstream (기존) | downstream (기존) | Batch 2 후보 |
|---|---|---|---|---|
| ~~W1-G1-SHISHEN-SIDE~~ | STR-010, STR-011 | — | — | **Batch 1 완료** |
| W1-G2-SEASON-PHASE | STR-022, STR-024 | STR-004 | STR-023/025, STR-050/051/055 | 후보 |
| W1-G3-ROOT-DEPTH | STR-030-clear/present/shallow | STR-005 | STR-033, STR-050 | 후보 |
| W1-G4-MONTH-CLIMATE | CLI-002, CLI-003a–d, CLI-004 | CLI-001 | CLI-018/019 → NEED climate | 후보 |
| W1-G5-BRANCH-FIRE-WATER | CLI-011, CLI-012 | CLI-009, CLI-010 | CLI-021, CLI-025 | 후보 |
| W1-G6-CLIMATE-ADJUST | CLI-018, CLI-019, CLI-036, CLI-037 | **CLI-002 (G4)** | CLI-032/041~043, NEED-020~022 | **제외** (G4 의존) |

남은 candidate group 수: **5** (G2–G6; 그중 G6는 상류 의존으로 Batch 2 최상류 후보에서 제외)

그룹을 합치거나 재분할하지 않았다.

---

## B. Batch 2 선택

**선택 그룹:** W1-G2-SEASON-PHASE  
**대상:** STR-022, STR-024 (2개)

선택 이유 (규칙 수가 적어서 / 검증이 쉬워서가 **아님**):

1. **다른 BOTH 그룹에 의존하지 않는 Strength 상류**다. dependsOn은 FACT 표 `STR-004`(왕상휴수사 lookup)뿐이며, G3·G4·G5와 병렬이다. G6는 G4에 의존하므로 최상류가 아니다.
2. **downstream 영향이 크다.** STR-023/025(substantial)와 leaning 마감식 STR-050/051/055로 이어진다. Batch 1이 연 세력 방향(support/pressure) 위에 **월령 강·약 측 seasonal evidence**가 겹친다.
3. Batch 1이 Strength Need 체인(STR-010/011 → … → NEED)을 우선했고 Climate 표(G4)는 “이후 Batch”로 미뤘다. **같은 Strength 축의 다음 상류**로 G2를 택한다. G3(통근 깊이)도 병렬 상류이나, 고전에서 月令·得時/失時가 旺衰의 첫 축으로 더 자주 서술되고, clear/present/shallow 3단은 엔진 전용 해석에 가깝다.
4. G4는 Climate 축 최상류로 downstream이 크나, Strength 체인 연속성과 “Climate는 이후”라는 Batch 1 기록을 유지한다. G5는 CLI-021/025로 범위가 더 좁다.

이번 단계에서 **판정하지 않는** BOTH: STR-030-*, CLI-002, CLI-003a–d, CLI-004, CLI-011, CLI-012, CLI-018, CLI-019, CLI-036, CLI-037.

---

## C. Batch 2 검증 질문 (Prep 원문 유지)

| rule | 엔진 동작 (요약) | question |
|---|---|---|
| STR-022 | `phase===왕` → `strongSideEvidence`에 seasonal 왕 | 월령(왕상휴수사)에서 ‘왕’을 일간 세력의 강(strong-side) 근거로 기록하는 조건이 문헌에서 어떻게 정의되는가? 왕이면 곧바로 신강으로 닫는지, 목록/근거로만 남기는지 구분이 있는가? |
| STR-024 | `phase===수\|사` → `weakSideEvidence` seasonal | 월령이 ‘수’ 또는 ‘사’일 때 이를 일간 세력의 약(weak-side) 근거로 두는 조건이 문헌에서 어떻게 정의되는가? ‘휴’와 ‘수/사’를 약 계절로 구분하는 서술이 있는가? |

엔진 (`buildStrengthSummary`): 왕→strong-side; 상→strong-side(help만, STR-026·이번 비대상); 휴→어느 side에도 seasonal 없음(STR-027·이번 비대상); 수|사→weak-side. **leaning-strong/weak 마감식은 STR-050/051이며 이번 판정 대상이 아니다.**

용어 대응 (엔진 한글 ↔ 고전): 왕=旺, 상=相, 휴=休, 수=囚, 사=死.

---

## D. 조사한 출처 (확인 가능한 것만)

페이지를 확인하지 못한 항목은 페이지를 기입하지 않는다.
블로그·카페·SEO·GitHub 구현은 핵심 근거로 쓰지 않는다.

| id | 저자 / 전승 | 문헌 | 판본·접근 | 위치 | layer |
|---|---|---|---|---|---|
| S1 | 전승: 徐升 계통 | 《淵海子平》 | [维基文库](https://zh.wikisource.org/wiki/淵海子平) 2026-08-24 확인 | 「论日为主」身旺身弱·月令何者旺 | ORIGINAL-TEXT |
| S2 | 明 萬民英 | 《三命通會》卷二 | [識典古籍 SK1610](https://www.shidianguji.com/zh/book/SK1610/chapter/1kf5v6ol1tqg5); [ctext 卷二](https://ctext.org/wiki.pl?chapter=17423&if=gb) 교차 | 「論五行旺相休囚死並寄生十二宫」 | ORIGINAL-TEXT |
| S3 | 清 沈孝瞻 | 《子平真詮》 | [ctext 評注본 내 沈文](https://ctext.org/wiki.pl?chapter=974137&if=gb) 2026-08-24 | 「論十干得時不旺失時不弱」書云得時/失時; 通根 활법 | ORIGINAL-TEXT |
| S4 | 民 徐樂吾 | 《子平真詮評注》 평주 | 같은 ctext 장, 沈 단락 사이 삽입 | 「旺衰強弱四字…得時為旺，失時為衰」 | COMMENTARY |
| S5 | 전승: 京圖/劉基 계통 | 《滴天髓》 | [维基文库](https://zh.wikisource.org/wiki/滴天髓) 2026-08-24 | 「衰旺論」; 「月令論」(得令·格局/用 문맥) | ORIGINAL-TEXT (+ 月令 괄호 설명은 전승 주석 가능성 → 문맥 분리) |

학술 논문 전문을 열어 왕상휴수사–신강 연결을 인용하지 않았다 (NOT-REVIEWED-FULLTEXT).

---

## E. 출처별 근거 (Batch 2 관련만)

### E1. 《淵海子平》「论日为主」(S1) — ORIGINAL-TEXT

**원문:**

> 以日为主，大要看日加临于甚度，或身旺？或身弱？又看地支有何格局？金木水火土之数；后看月令中金木水火土，何者旺？又看岁运有何旺？却次日下消详。此非是拘之一隅之说也。

**최소 해석:** 일간 身旺/身弱을 볼 때 **월령에서 어느 오행이 旺한가**를 본다. 다만 월령만으로 단정하지 말고(非拘一隅) 지지 格局·세운을 이어 본다.

**문맥:** Strength / 旺衰. 格局은 “또 보라”로 병기되나, 이번 rule의 seasonal side 기록과 직접 겹치는 부분은 **月令何者旺**.

**관계:** STR-022 — 왕(월령 득시)을 세력 판단의 **근거 축**으로 쓰는 것과 부분 일치. “왕이면 곧바로 신강 확정”은 이 문장에 없음.

### E2. 《三命通會》「論五行旺相休囚死…」(S2) — ORIGINAL-TEXT

**원문 (요지, 識典·ctext 교차):**

> 盛德乘時曰旺。如春木旺，旺則生火…故火相…故水休…故金囚…所以春木尅土則死。夏火旺…金死。六月土旺…水死。秋金旺…木死。冬水旺…火死。

> 凡推造化，見生旺者，未必便作吉論；見休、囚死絶，未必便作凶言。如生旺太過，宜乎制伏；死絶不及，宜乎生扶。

**최소 해석:**

| 상태 | 정의 요약 (봄 木 예) |
|---|---|
| 旺 | 시절을 탄 盛德 |
| 相 | 旺의 자식 기운(子乘父業) |
| 休 | 生我者가 물러남(美而無極·無事) |
| 囚 | 旺에 극당해 施設 못함 |
| 死 | 旺에게 극·산산 등으로 기절 |

**문맥:** 오행의 **시절 성쇠 표**. 곧장 “일간 leaning-strong/weak” 마감식이 아니다. 같은 장에 **寄生十二宫**(長生…死…墓)이 이어지나, 이는 **월령 旺相休囚死와 다른 층**(장생십이궁)이다. 혼용하지 않는다.

**관계:**

- STR-022: 旺=시절 최강 — **supporting**
- STR-024: 囚·死를 약세 쪽으로 보는 고전 분류 — **supporting**; 다만 休는 囚/死와 **정의가 다름** → 엔진이 휴를 weak-side에 넣지 않는 것과 방향 일치(limiting으로 기록)
- “生旺=길, 休囚死=흉”으로 단순화하면 원문과 충돌(limiting)

### E3. 《子平真詮》沈「論十干得時不旺失時不弱」(S3) — ORIGINAL-TEXT

**원문:**

> 書云，得時俱為旺論，失時便作衰看，雖是至理，亦死法也。然亦可活看…故生月即不值令，而年時如值祿旺，豈便為衰？不可執一而論…是故十干不論月令休囚，只要四柱有根，便能受財官食神而當傷官七煞。

**최소 해석:** “得時=旺, 失時=衰”는 **이치이나 死法**. 월령이 休囚여도 통근·祿旺이 있으면 약하다고만 할 수 없다. 반대로 得時여도 타 기운에 눌리면 실세가 약할 수 있다(得時不旺 / 失時不弱).

**문맥:** 日主 旺衰 vs 通根. **用神·격국 성패 장과 분리**해 읽는다.

**관계:** STR-022가 왕을 strong-side **증거로만** 남기고 leaning을 왕만으로 닫지 않는 설계와 **정합(부분)**. “왕=무조건 신강”으로 읽으면 沈과 **충돌**.

### E4. 徐樂吾 평주 (S4) — COMMENTARY

**원문:**

> 旺衰強弱四字，昔人論命，每籠統互用…大致得時為旺，失時為衰；黨眾為強，助寡為弱。故有雖旺而弱者，亦有雖衰而強者…春木夏火秋金冬水為得時，比劫印綬通根扶助為黨眾。

**최소 해석:** 후대 주석이 得時/失時(旺衰)와 黨眾(強弱)을 나눈다. 沈 원문의 활법을 **해설**한 층이다. 원저자 沈의 문장으로 소급하지 않는다.

**관계:** STR-022/024의 “측 증거” vs “최종 강약” 분리에 **참고(commentary support)**. 원전 단독 근거로 쓰지 않음.

### E5. 《滴天髓》「衰旺論」「月令論」(S5)

**衰旺論 원문 (ORIGINAL-TEXT):**

> 能知衰旺之真機…旺則宜洩宜傷，衰則喜幫喜助…然旺中有衰者存，不可損也。衰中有旺者存，不可益也。

**최소 해석:** 衰旺은 立命의 핵심이나, 단순 旺=억제·衰=생조로 고정하지 말고 **진기**를 보라. 월령 phase→side 목록 규칙의 직접 정의는 없다.

**月令論 (ORIGINAL-TEXT + 전승 주석 혼재 주의):**

> 月令提綱，譬之宅也，人元用事之神，宅之向也…令星，乃命之至要，宜氣象得令者吉，喜神得令者吉…

**문맥 분리:** 여기의 得令은 주로 **氣象·格局·用神/喜神** 층이다. STR-022/024의 “일간 seasonal strong/weak side evidence”와 **동일 문맥이 아니다.** 직접 supporting으로 쓰지 않고 **다른 해석 층**으로만 기록한다.

---

## F. Rule별 판정

### F1. STR-022 — 왕 → strong-side evidence

| 종류 | 내용 |
|---|---|
| supporting | S2: 盛德乘時曰旺. S1: 身旺身弱 판단에 月令何者旺. S3: 得時俱為旺論을 기본 이치로 인용 |
| limiting | S3: 得時=旺은 死法 → 왕만으로 신강 확정 금지. S2: 生旺未必吉. 엔진도 leaning은 STR-050에서만 닫음(이번 rule은 목록) |
| conflicting | S5 月令/喜神得令 문맥을 일간 세력 strong-side와 동일시하면 층 혼동. 일부 통속 해석은 “왕=신강”으로 단정(고전 활법과 불일치) |

**Literature verdict:** **PARTIALLY-SUPPORTED**  
**Evidence confidence:** **MEDIUM**  
**Expert validation required:** YES (BOTH 유지)

이유: 왕을 월령상 강한 시절 증거로 쓰는 것은 복수 고전에서 반복된다. 그러나 (1) 왕→곧바로 신강 확정은 沈·만민영이 부정에 가깝고, (2) 엔진의 strongSideEvidence 목록 모델은 문헌에 “evidence list”로 명시되지 않으며, (3) 得令의 격국/용신 문맥과 섞이면 안 된다.

### F2. STR-024 — 수/사 → weak-side evidence

| 종류 | 내용 |
|---|---|
| supporting | S2: 囚=극당해 施設 불가, 死=기절 — 시절상 약세. S3: 失時·月令休囚를 衰 쪽으로 언급(활법 전제) |
| limiting | S2: 休의 정의(無事·退避)≠囚/死 — 엔진이 휴를 weak-side에 넣지 않음과 방향 일치. S3: 休囚여도 通根이면 약하지 않을 수 있음 → seasonal weak evidence ≠ 최종 신약 |
| conflicting | “失時”를 相·休·囚·死 전부에 걸치면, 엔진이 **수·사만** weak-side에 넣는 것과 범위가 갈림. 상은 엔진에서 help(strong-side). 十二宫의 死와 시절 死 혼동 위험. 학파에 따라 囚만 약, 死·絶만 약으로 더 잘게 나누기도 함 |

**Literature verdict:** **PARTIALLY-SUPPORTED**  
**Evidence confidence:** **MEDIUM**  
**Expert validation required:** YES (BOTH 유지)

이유: 囚·死를 시절 약세로 보는 고전 분류는 있다. 휴를 약 측에서 뺀 점은 休≠囚死 정의와 맞닿는다. 그러나 (1) 失時 전체 vs 수|사만, (2) 수와 사를 **동일 weakSideEvidence**로 동등 취급, (3) seasonal weak ≠ leaning-weak 확정 — 문헌이 엔진 규칙을 그대로 정의하지는 않는다.

---

## G. 문맥 혼용 발견

| 발견 | 조치 |
|---|---|
| 旺相休囚死(시절 표) vs 寄生十二宫 長生…死 | 같은 《三命通會》 장이라도 **분리**. STR-022/024는 전자만 |
| 得令(滴天髓 月令·喜神/격국) vs 일간 seasonal side | **직접 근거로 사용하지 않음** |
| 用神 扶抑·調候 vs 旺衰 side evidence | 이번 Batch 비대상. 혼용하지 않음 |
| 徐 評注의 旺衰/強弱 분리를 沈 原文으로 소급 | **금지**. S4=COMMENTARY |

---

## H. 요약표

| rule | literature verdict | confidence | expert still required |
|---|---|---|---|
| STR-022 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| STR-024 | PARTIALLY-SUPPORTED | MEDIUM | YES |

| 집계 | 수 |
|---|---:|
| 실제 확인 문헌 | 5 (S1–S5) |
| ORIGINAL-TEXT 증거 단위 | 6 (S1 身旺; S2 旺相休囚死 정의; S2 通變 주의; S3 得時死法; S3 通根활법; S5 衰旺論) |
| COMMENTARY | 1 (S4 徐) |
| MODERN-INTERPRETATION | 0 |
| 독립 교차 확인 | 2 (三命通會 識典↔ctext; 沈文 ctext 내 원문/평주 분리) |
| SUPPORTED | 0 |
| PARTIALLY-SUPPORTED | 2 |
| CONTESTED | 0 |
| INSUFFICIENT-EVIDENCE | 0 |
| CONTRADICTED | 0 |

---

## I. Unresolved

| id | issue |
|---|---|
| W1B2-U1 | 엔진 SEASON_PHASE 표(환절 토왕 등)의 **칸칸 값**은 STR-004 FACT 영역. 이번은 side 기록 해석만 봄 |
| W1B2-U2 | 相→help only (STR-026), 休→무방향 (STR-027)은 EXPERT·비Batch2. 수/사만 weak로 둔 짝 관계 전체는 미판정 |
| W1B2-U3 | 滴天髓 月令 괄호 人元用事 일수는 전승 주석 가능 — 페이지/판본 미확정 |
| W1B2-U4 | 전문가: “왕/수사 evidence를 세력 축에 어떻게 가중하는가”는 문헌만으로 닫지 못함 |

---

## J. 하지 않은 것

- STR-010/011 및 Batch 1 산출물 변경
- 엔진 / expected / freezeStatus / VERIFIED-FACT
- G3–G6 문헌 판정
- Pilot 5 재사용·전문가 답 생성
- Needed Element / 용신 / 희신 / Batch 3
