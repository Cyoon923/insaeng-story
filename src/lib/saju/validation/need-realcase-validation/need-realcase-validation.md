# Need Real-Case Validation — 원국 투입 실전 검증

**범위:** StrengthSummary · AdjustedClimate · NeedCandidateSet · NeedResolution · hour-unknown gate  
**비범위:** 음악 추천 · 카탈로그 · UI · 엔진 코드 수정 · 신규 전문가 설문  

**원칙:** 용신/희신/단일 winner 금지. 엔진 출력은 **관측**만. 기존 freeze/audit와 충돌하면 표시.

**근거 fixture 출처:**  
`needCandidates.test.ts` · `needResolution.test.ts` · `strengthSummary.test.ts` · `adjustedClimate.test.ts` · `axisReview.fixtures.json` · `resolution-case-trace.json` · Wave2/3 closure · need-freeze-boundary (NEED-022/023 등)

**실행:** 현재 `buildStrengthSummary` / `buildAdjustedClimateSummary` / `buildNeedCandidateSet` / `buildNeedResolution` 실측 (2026-08-25).

---

## Coverage map

| # | 목표 coverage | Case ID |
|---|---|---|
| 1 | 명확 신강형 | RC-01 |
| 2 | 명확 신약형 | RC-02 |
| 3 | 중화/mixed | RC-03 |
| 4 | 월령 강 + 설극 큰 구조 | RC-04 |
| 5 | 월령 약 + (통근 약/미통근) 구조 ※ | RC-05 |
| 6 | 한(寒) 보완 | RC-06 |
| 7 | 열(熱) 보완 | RC-07 |
| 8 | 조(燥) 보완 | RC-08 |
| 9 | 습(濕) 구조 | RC-09 |
| 10 | Strength ∩ Climate 동일 오행 | RC-10 (=RC-02) |
| 11 | Strength ≠ Climate (Climate 비움) | RC-11 (=RC-01) |
| 12 | 시간 미상 | RC-12, RC-13 |

※ RC-05: fixture 풀에서 “월령 약(사) + 통근 강” 동시 만족 chart가 없어, **월령 약(사) + 미통근 甲**으로 대체. 목표 #5와 **부분 불일치** — 아래 충돌란 참고.

**총 unique 원국:** 11 · **보고 case 행:** 13 (RC-10/11은 동일 원국의 coverage 재라벨)

---

## RC-01 — 명확 신강형 (확정 시주)

| | |
|---|---|
| **원국** | 甲寅 / 甲寅 / 甲子 / 甲子 |
| **출처** | needCandidates C (confirmed leaning-strong) |
| **Strength** | `leaning-strong` · certainty `complete` · resolution `clear-direction` · phase `왕` · sensitivity `null` |
| **Climate** | T `balanced` · M `moist` · certainty `complete` |
| **Strength Need** | ready: 火(output) · 土(wealth) · 金(official) — 전부 `candidate`, **비순위** |
| **Climate Need** | ready · `[]` |
| **NeedResolution** | `strength-only` / `single-axis` · blockers: `no-active-climate-need`, `strength-three-way-unranked` |
| **말해도 되는 부족/보완 후보** | Strength 축 **잠정 후보 집합** 火·土·金 (설기·재·관 이미지). Climate 보완 후보 없음. **하나 확정 금지.** |
| **flags** | provisional 노출 권장 · unresolved Strength 축 아님 · contested 아님 · blocker로 최종 닫힘 |
| **판정** | ✅ 엔진 동작은 freeze와 일치 (3후보 + three-way-unranked) |
| **충돌** | 없음 (VERIFIED 용신 아님) |

---

## RC-02 / RC-10 — 명확 신약형 + Strength∩Climate 水

| | |
|---|---|
| **원국** | 丙午 / 戊戌 / 甲申 / 甲子 |
| **출처** | needCandidates C (confirmed leaning-weak) · speakable fixture |
| **Strength** | `leaning-weak` · `complete` · `clear-direction` · phase `수` |
| **Climate** | T `balanced` · M `dry` · `complete` |
| **Strength Need** | ready: 木(peer) · 水(resource) |
| **Climate Need** | ready: 水 (`climate-moisture-dry`) |
| **NeedResolution** | `partial-overlap` / `convergent` · supported: 水 · deferred: 木 · blocker: `deferred-strength-only-element` |
| **말해도 되는 부족/보완 후보** | **겹침 후보** 水 (Strength 인성 + Climate 조습) — “겹친다≠용신”. Strength-only 木은 deferred → 확정 승격 금지. dry→水는 **NEED-022 contested 상속** → 잠정 문구. |
| **flags** | provisional · contested-inherited(dry) · convergent≠정답 |
| **판정** | ✅ overlap/defer 배선 정상 |
| **충돌** | Wave3: convergent를 정답으로 읽으면 freeze 위반 (엔진 버그 아님) |

---

## RC-03 — 중화/mixed

| | |
|---|---|
| **원국** | 己卯 / 丙子 / 戊午 / 戊午 |
| **출처** | need CASE1 · res-case-1 |
| **Strength** | `mixed` · `complete` · `mixed` · phase `수` |
| **Climate** | base cold+moist → adjusted T/M **둘 다 balanced** · `complete` |
| **Strength Need** | `unresolved` · `[]` |
| **Climate Need** | `ready` · `[]` |
| **NeedResolution** | `no-candidates` / `indeterminate` · blockers: `strength-axis-unresolved`, `no-active-climate-need` |
| **말해도 되는 부족/보완 후보** | **없음.** “방향 단정 불가 · 보완 오행 후보 열리지 않음”만. |
| **flags** | Strength unresolved · Climate ready-but-empty |
| **판정** | ✅ mixed→Strength Need 비움 (NEED-012) |
| **충돌** | 없음 |

---

## RC-04 — 월령 강(왕) + 설극/압력 큰 구조

| | |
|---|---|
| **원국** | 甲辰 / 丙午 / 丁酉 / 庚申 |
| **출처** | strength CASE5 · climate CASE2 · res climate-only confirmed |
| **Strength** | `mixed` · `complete` · phase `왕` (일간 丁·午월) |
| **Climate** | T `warm` · M `dry` · `complete` |
| **Strength Need** | `unresolved` · `[]` |
| **Climate Need** | ready: 水 (`climate-temperature-warm` + `climate-moisture-dry`) |
| **NeedResolution** | `climate-only` / `single-axis` · singleAxis: 水 · blocker: `strength-axis-unresolved` |
| **말해도 되는 부족/보완 후보** | Climate 축 **잠정** 水 (열·조 완화 이미지). Strength Need 없음. 水≠용신. |
| **flags** | Strength mixed unresolved · Climate provisional · dry contested 상속 가능 |
| **판정** | ✅ mixed여도 Climate Need는 열림 |
| **충돌/의심** | ⚠ 일간이 火(丁)인데 월령 왕+ mixed — Strength Need 없이 Climate 水만 남는 제품 해석이 “신약 보완”으로 오독되기 쉬움 (제품 카피 위험) |

---

## RC-05 / RC-08 — 월령 약(사) · 조(燥) · 시간 미상 병행

| | |
|---|---|
| **원국** | 甲酉 / 庚酉 / 甲酉 / unknown |
| **출처** | strength CASE2 · need CASE3 · NEED-022 dry path |
| **Strength** | `leaning-weak` · `partial` · sensitivity `hour-unknown-provisional` · phase `사` |
| **Climate** | T `balanced` · M `dry` · `partial` |
| **Strength Need** | **gated** `unresolved` · `[]` (CL-NEED-HOUR) |
| **Climate Need** | ready: 水 (`climate-moisture-dry`) |
| **NeedResolution** | `climate-only` / `single-axis` · blocker: `strength-axis-unresolved` |
| **말해도 되는 부족/보완 후보** | Strength 관찰만 잠정(신약 기울기). Strength Need **비움**. Climate 水만 잠정·contested. |
| **flags** | hour-unknown-provisional · Strength Need gated · dry contested |
| **판정** | ✅ gate + dry Climate Need |
| **충돌** | ⚠ coverage #5 “통근 강” **미충족** (甲 미통근). fixture 공백. |

---

## RC-06 — 한(寒) 보완

| | |
|---|---|
| **원국** | 甲寅 / 辛亥 / 庚子 / unknown |
| **출처** | need CASE6 · cold→火 |
| **Strength** | `null` · `partial` · phase `휴` |
| **Climate** | T `cold` · M `moist` · `partial` |
| **Strength Need** | `unresolved` · `[]` |
| **Climate Need** | ready: 火 (`climate-temperature-cold`) — moist reason **없음** |
| **NeedResolution** | `climate-only` / `single-axis` · blocker: `strength-axis-unresolved` |
| **말해도 되는 부족/보완 후보** | Climate **잠정** 火 (한 완화). Strength 방향 단정 불가 → Strength Need 없음. 습 보완 후보 **열리지 않음** (NEED-023). |
| **flags** | Strength null · Climate cold provisional |
| **판정** | ✅ cold→火 · moist 무Need 정책 준수 |
| **충돌** | 습 구조와 공존하나 습 Need 없음 — freeze 의도. 사용자에게 “습하니 토/화 필요”로 말하면 **정책 위반**. |

---

## RC-07 — 열(熱) 보완

| | |
|---|---|
| **원국** | 庚子 / 己未 / 辛卯 / unknown |
| **출처** | need CASE4 · warm+dry |
| **Strength** | `mixed` · `partial` · phase `상` |
| **Climate** | T `warm` · M `dry` · `partial` |
| **Strength Need** | `unresolved` · `[]` |
| **Climate Need** | ready: 水 (`climate-temperature-warm` + `climate-moisture-dry`) |
| **NeedResolution** | `climate-only` / `single-axis` · blocker: `strength-axis-unresolved` |
| **말해도 되는 부족/보완 후보** | Climate 잠정 水 (열·조). Strength mixed → Need 없음. |
| **flags** | mixed · dry contested 가능 |
| **판정** | ✅ |
| **충돌** | 없음 (정책 내) |

---

## RC-09 — 습(濕) 구조

| | |
|---|---|
| **원국** | 己卯 / 丙子 / 戊午 / 戊午 (=RC-03) |
| **출처** | adjustedClimate CASE1 · base cold+moist → balanced |
| **Strength** | `mixed` |
| **Climate** | base `moist` → adjusted M **`balanced`** (완화됨) |
| **Strength / Climate Need** | Strength `[]` · Climate `[]` |
| **NeedResolution** | `no-candidates` / `indeterminate` |
| **말해도 되는 부족/보완 후보** | **없음.** base가 습이어도 adjusted balanced면 Climate Need 비움. |
| **flags** | moist Need 미구현 (NEED-023) |
| **판정** | ✅ 정책대로 “습 구조 ≠ 습 Need 후보” |
| **충돌** | ⚠ coverage #9를 “습 보완 오행이 나온다”로 기대하면 **엔진과 기대 불일치**. 현재 설계는 **습 Need 없음**. |

---

## RC-11 — Strength Need ≠ Climate (Climate 비움) (=RC-01)

RC-01과 동일 원국. Climate Need `[]`, Strength 火·土·金만 → **축 불일치(Climate 공백)** coverage.

말해도 되는 것: Strength 잠정 후보 집합만. Climate와 “다른 오행이 경쟁”하는 형태가 아니라 **Climate 비활성**.

---

## RC-12 — 시간 미상 + leaning-strong gate

| | |
|---|---|
| **원국** | 甲寅 / 甲寅 / 甲子 / unknown |
| **출처** | CL-NEED-HOUR A · need CASE2 |
| **Strength** | `leaning-strong` · `partial` · `hour-unknown-provisional` |
| **Climate** | T balanced · M moist · `partial` |
| **Strength Need** | **gated** `[]` |
| **Climate Need** | `[]` |
| **NeedResolution** | `no-candidates` / `indeterminate` |
| **말해도 되는 부족/보완 후보** | Strength **관찰만** 잠정. Need 후보 **말하지 않음**. |
| **판정** | ✅ gate 정상 (RC-01과 대비) |
| **충돌** | 없음 |

---

## RC-13 — 시간 미상 + leaning-weak + Climate 水

| | |
|---|---|
| **원국** | 丙午 / 戊戌 / 甲申 / unknown |
| **출처** | CL-NEED-HOUR B · need CASE5 |
| **Strength** | `leaning-weak` · `partial` · `hour-unknown-provisional` |
| **Climate** | M `dry` · Climate Need 水 |
| **Strength Need** | **gated** `[]` |
| **NeedResolution** | `climate-only` / `single-axis` · blocker `strength-axis-unresolved` |
| **말해도 되는 부족/보완 후보** | Strength Need 금지. Climate 水만 잠정·contested. RC-02와 달리 木/水 Strength 후보 **노출 금지**. |
| **판정** | ✅ |
| **충돌** | 없음 |

---

## Cross-cutting observations

1. **hour gate:** RC-01↔RC-12, RC-02↔RC-13 — Strength 방향은 유지, Strength Need만 차단. 정책 실측 통과.  
2. **moist Need:** 전 case에서 `climate-moisture-moist` reason **0건**. NEED-023 실측 재확인.  
3. **dry→水:** RC-02/05/07/08/13 — 후보 생성은 되나 NEED-022 **contested** → 확정 카피 금지.  
4. **convergent:** RC-02만 — supported 水 + deferred 木 + blocker. winner 필드 없음.  
5. **strength-three-way-unranked:** RC-01 — 신강형 3후보를 엔진이 순위로 닫지 않음 (의도적 blocker).  
6. **mixed:** Strength Need 항상 비움; Climate Need는 독립적으로 열릴 수 있음 (RC-04/07).

---

## Conflict with prior validation evidence

| 이슈 | Case | 성격 |
|---|---|---|
| dry→水 Need contested (NEED-022) | RC-02,05,07,08,13 | 기존 경계와 **일치** (승격 금지) |
| moist Need 없음 (NEED-023) | RC-06,09 | coverage #9 기대와 **제품 기대 충돌 가능** · 엔진-freeze는 일치 |
| coverage #5 통근 강 fixture 공백 | RC-05 | **선정 한계** · 엔진 오류 아님 |
| convergent 오독 위험 | RC-02 | Wave3 의미 경계와 충돌 가능(카피) |
| Climate-only를 “최종 필요 오행”으로 읽기 | RC-04,06,07,13 | freeze 위반 위험(카피) |

---

## Summary tables (보고용)

### 잘 동작 (엔진·정책 일치)

RC-01, RC-02, RC-03, RC-06, RC-07, RC-12, RC-13 (및 동일 원국 RC-10/11)

### 의심 / 오판 가능 (카피·coverage)

| Case | 이유 |
|---|---|
| RC-04 | mixed Strength + Climate 水만 → “물 용신” 오독 |
| RC-05 | #5 coverage 부분 불일치(미통근) |
| RC-08 | dry contested를 확정 조습 처방으로 읽기 |
| RC-09 | 습 구조인데 습 Need 없음 → 기대 불일치 |

### 실제 Need 엔진 blocker (코드 필드)

| Blocker | 관측 case |
|---|---|
| `strength-axis-unresolved` | RC-03~09,12,13 |
| `no-active-climate-need` | RC-01,03,09,11,12 |
| `strength-three-way-unranked` | RC-01,11 |
| `deferred-strength-only-element` | RC-02,10 |
| Strength Need hour gate (`strengthNeedStatus=unresolved` + `[]`) | RC-05,08,12,13 |

### 코드 수정 필요?

**아니오 (이번 검증 범위).**  
관측된 동작은 freeze/CL-NEED-HOUR/Wave2–3 경계와 대체로 일치.  
필요한 것은 (1) speakable/카피 가드 유지, (2) coverage #5용 **통근 강+월령 약** fixture 추가 조사, (3) 습 Need 제품 기대가 있으면 **별도 정책 결정**(지금은 NEED-023 DEFER/금지).

엔진 Strength/Climate/Need/Resolution **판정 로직 변경 불필요**로 판단.
