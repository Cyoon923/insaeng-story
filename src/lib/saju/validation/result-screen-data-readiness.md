# 무료 결과 화면 — 표현 정책 (Speakable / Need freeze)

**문서 성격:** 화면 카피·슬롯 허용 규칙. 엔진 VERIFIED가 아님.  
**근거:** SpeakableOutput contract · Need / NeedResolution freeze · CL-NEED-HOUR · Wave 3 · `need-realcase-validation.md`  
**비범위:** 엔진/타입 코드 수정 · 음악 추천 · 대운·세운·월운·일운 구현  

`provisional`은 기본. 확정 톤·용신·단일 winner·임의 점수 금지.

---

## 1. 공통 금지 (전 화면)

| 금지 | 이유 |
|---|---|
| 「필요한 기운은 ○」단일 확정 | Need/Resolution에 winner 없음 |
| TOP3 / 1위·2위·3위 순위 | `strength-three-way-unranked` 등 비순위 계약 |
| 점수 · 퍼센트 · 가중치 | 엔진 미생성 · 임의 금지 |
| 부족한 오행 = 필요한 오행 | presence/absent ≠ Need |
| 용신 · 희신 · neededElement 확정 | freeze P1–P2 |
| 세운 없이 「올해」「2026년」운 의미 | 연운 엔진 없음 |
| 근거 없는 「행운을 부르는 행동」 | action 매핑 미존재 |
| convergent = 정답 / Climate가 이김 | Wave 3 |

---

## 2. 화면 슬롯 — 허용 / 조건부 / 금지

| 슬롯 (제품 초안) | 판정 | 표현 정책 |
|---|---|---|
| 「2026년 필요한 기운은 ○」 | **금지** | 슬롯 제거 또는 비순위 후보 안내로만 재정의(아래 §3). 「○」채우기 금지 |
| 「필요한 기운 TOP 3」 | **금지**(순위) | 「보완 후보(비순위)」로만 대체 가능(§3) |
| 오행 밸런스 木火土金水 | **조건부 허용** | presence 정성만. % 막대 금지 |
| 「올해의 키워드」 | **금지**(올해 의미) | 「원국 잠정 키워드」로 완화 시에만 조건부 |
| 주의할 점 | **조건부 허용** | caution 데이터 있을 때만 |
| 행운을 부르는 행동 | **금지** | 섹션 숨김 |
| 한 줄 핵심 해석 | **조건부 허용** | Speakable observation · 잠정 문구만 |

---

## 3. 현재 구현 가능한 항목 (허용 카피)

### 3.1 한 줄 핵심 해석 (잠정) — 조건부 허용

| | |
|---|---|
| **데이터** | `SpeakableOutput.observationThemes` (우선 1문장) |
| **허용 예** | 「지금은 기대어 쉬어가는 쪽으로 읽힐 수 있어요.」 / 「방향이 한쪽으로 단정되지 않아요.」 / hour-unknown 시 「시간이 확실해지면 달라질 수 있는 잠정 관찰이에요…」 |
| **금지 예** | 「당신은 신강입니다」 · 「용신은 水」 · 「2026년 대운은…」 |
| **가드** | `provisional` 유지. `speakableStatus=diagnostic-only` / `confidence=hold`이면 한 줄만·이야기 우선. Climate 문장을 Strength 결론으로 합치지 않음 |

### 3.2 주의할 점 — 조건부 허용 (데이터 있을 때만)

| | |
|---|---|
| **데이터** | `cautionThemes` (및 필요 시 climate 주의 톤 phrase) |
| **허용** | Need caution 후보가 있을 때만 목록 표시. 0건이면 **섹션 생략** |
| **금지** | 「사주가 나쁨」 · 빈 섹션을 운세 경고로 채움 · hour-unknown인데 Strength Need caution 노출 |
| **가드** | `hourUnknownProvisional`이면 Strength Need 기반 caution **비움**(CL-NEED-HOUR) |

### 3.3 오행 밸런스 (정성 presence만) — 조건부 허용

| | |
|---|---|
| **데이터** | `analyzeElementPresence` → rooted-visible / unrooted-visible / hidden-only / absent |
| **허용** | 五요소를 **상태 라벨**로만 (예: 뚜렷 · 약함 · 숨음 · 없음). 축 설명 한 줄 가능 |
| **금지** | %, 점수, 「가장 부족하니 이것이 필요」, presence→Need 자동 채움 |
| **가드** | 밸런스 블록에 Need 후보·용신 문구 혼입 금지 |

### 3.4 비순위 보완 후보 칩 — 조건부 허용

| | |
|---|---|
| **데이터** | active Strength Need · Climate Need · Resolution `supportedElements` / `singleAxisElements` (표시용 가방). **순위 필드 없음** |
| **허용** | 칩/태그로 오행·짧은 잠정 라벨. 「후보」「잠정」「겹침」명시. 최대 N개는 **상한이지 순위 아님** |
| **금지** | TOP1–3 · 「대표 기운 ○」· deferred를 1등으로 승격 · suppressed를 「이미 충분」확정 카피 |
| **가드** | Strength/Climate 축 **분리 표기**. hour gate 시 Strength 칩 비움. dry Climate는 contested·잠정. `deferred-strength-only-element` 시 Strength-only는 「보류」또는 비표시 |

---

## 4. 상태별 카피 가드

확정형 카피(「필요합니다」「확정」「용신」「1위」「올해 운」)는 아래 상태에서 **출력 금지**.

### 4.1 `hour-unknown` / `hourUnknownProvisional`

| 허용 | 금지 |
|---|---|
| Strength **관찰** 한 줄(잠정) | Strength Need 칩 · TOP · 대표 ○ |
| Climate Need가 있으면 **잠정** Climate 칩만 | 「시간이 없어도 필요 오행 확정」 |
| presence 정성 밸런스 | 시주 없는 신강/신약 단정 |

### 4.2 `contested` (예: dry→水 NEED-022)

| 허용 | 금지 |
|---|---|
| 「조금 건조한 결이 보일 수 있어요(잠정)」 | 「한습/조열합니다」확정 · 「물은 필수 용신」 |
| Climate 水 칩 + contested/잠정 배지 | 대표 ○ = 水 |

### 4.3 `climate-only` (Strength Need 없음 · Climate 후보만)

| 허용 | 금지 |
|---|---|
| Climate 잠정 후보 · Strength는 「방향 단정 불가/Need 없음」 | Climate 水/火를 「당신에게 필요한 기운」확정 |
| mixed/null Strength 관찰 문장 | 「Climate가 이겼다」 |

### 4.4 `resolution-blocked` (`decisionBlockedBy` 비어 있지 않음)

| Blocker 예 | 화면 |
|---|---|
| `strength-three-way-unranked` | 3후보 **동등** 나열만. 순위 금지 |
| `deferred-strength-only-element` | 겹침만 「겹침 후보」. Strength-only 확정 금지. 대표 ○ 금지 |
| `strength-axis-unresolved` | Strength Need 슬롯 비움 |
| `no-active-climate-need` | Climate Need 슬롯 비움 · Strength 후보만(있을 때) |
| `no-candidates` / indeterminate | 후보 칩 전체 숨김 · 한 줄「단정되지 않음」+ 이야기 우선 |

`resolutionStatus=convergent`여도 **정답/확정 번역 금지**(Wave 3).

### 4.5 경계 case 빠른 가드 (실측)

| Case | 하면 안 되는 화면 카피 |
|---|---|
| RC-04 | 「필요한 기운은 水」 |
| RC-05/08/13 | hour-unknown인데 Strength TOP/대표 |
| RC-09 | 「습하니 土/火가 필요」 |
| RC-01 | 火·土·金에 1·2·3위 |
| RC-02 | 「용신 水」「convergent=확정」 |

---

## 5. 구현 체크리스트 (UI 바인딩)

1. Speakable `provisional === true` 전제.  
2. 사용자 본문은 `observationThemes` / `cautionThemes` / presence / 비순위 칩만.  
3. `internal.*` · raw `decisionBlockedBy` enum은 화면 본문에 노출하지 않음(디버그 제외).  
4. `musicRecommendationHints`는 이 화면 정책 범위 밖.  
5. 세운·월운·일운·대운 필드 참조 금지(미구현).  
6. 빈 주의·빈 후보 → 섹션 생략. 가짜 채움 금지.

---

## 6. 한 줄 결론

무료 결과 화면은 **잠정 관찰 · 주의(있을 때) · 정성 밸런스 · 비순위 후보**만 구현한다.  
「필요한 기운 ○」「TOP3」「올해/2026 운」「행운 행동」은 **현재 데이터 계약상 금지**다.  
엔진 코드 변경이 아니라 **카피·슬롯 계약 준수**로 맞춘다.
