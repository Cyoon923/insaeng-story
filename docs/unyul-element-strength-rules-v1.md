# 운율 오행 Strength Rules v1

상태: **확정 (문서)**  
범위: Strength Level 판정 규칙만  
제외: 코드 구현 · score 숫자 · UI · engine 수정

관련 감사: Strength Score 엔진 감사 (READY-FOR-STRENGTH-RULE-TABLE)

---

## 1. 정의

**Strength** = 원국(四柱)에서 각 오행(木火土金水)이 **실제로 가진 세력**.

Strength는 다음과 **절대 섞지 않는다.**

| 개념 | 의미 | Strength와의 관계 |
|------|------|-------------------|
| **Need** | 균형을 위해 어떤 오행이 필요한지 | 별도 축. Strength 약함 ≠ 자동 Need |
| **Supplement** | 보완 오행(상품/표현용) | Supplement = 木 이어도 Strength 木을 weak로 두지 않음 |
| **Core** | 구조상 핵심 오행 | Core = 火 이어도 Strength 火를 strong로 두지 않음 |
| **DM leaning** | 일간 강약 방향 (`leaning-strong` / `leaning-weak` / `mixed` / null) | 일간 판정 ≠ 오행별 Strength |
| **Climate (조후)** | warm/cold/dry/moist | Strength에 합산 금지 |

v1 산출물은 오행마다 하나의 `strengthLevel`과 `reasons`이다.  
`score`는 본 문서에서 **미정**이며 optional로만 계약을 남긴다.

---

## 2. v1 포함 축 (입력 evidence)

구현 시 엔진이 이미 제공하는 값만 사용한다. v1에서 **새로 창작한 명리 축을 넣지 않는다.**

| 축 | 필드 / 출처 | 역할 |
|----|-------------|------|
| 월령 | `seasonPhase` ← `seasonPhaseOf(element, monthBranch)` | 세력 **기반** (왕/상/휴/수/사) |
| 존재 형태 | `presence` ← `ElementPresenceKind` | rooted-visible / unrooted-visible / hidden-only / absent |
| 지지 본기 | cluster `layer: "branch"` 또는 `branchElement` | 해당 오행이 지지 본기로 서는가 |
| 지장간 role | hidden stem `여기` \| `중기` \| `정기` | 근·밀도의 깊이 |
| 통근 | `rootHits` ← `analyzeStemRoots` (오행 동계 천간 기준 hits) | 정기 > 중기 > 여기 |
| 투간 proxy | `exactStemVisible` | 지장간과 **동일 글자** 천간 노출 |
| 월령 outlet | `monthOutletSlots` | 월지 지장간이 천간에 나온 슬롯 |
| 클러스터 | `clusterAnchors` | stem / branch / hiddenStem 위치 목록 |
| 노출 슬롯 | `visibleSlots` | 천간으로 드러난 기둥 (목록만, **count 점수화 금지**) |
| 근 슬롯 | `rootedSlots` | 지장간에 해당 오행이 있는 기둥 |

### v1에서 쓰는 root 상태 용어

문서·reasons에서 아래 라벨만 사용한다.

| rootStatus | 조건 |
|------------|------|
| `root-absent` | `rootHits` 비어 있음 (및 presence가 rooted-\*가 아님) |
| `root-shallow` | hits 중 최심이 **여기**만 |
| `root-present` | hits 중 최심이 **중기** (정기 없음) |
| `root-clear` | hits 중 **정기** 1개 이상 |

`hasBranchMain` = 해당 오행의 cluster에 `layer: "branch"` anchor가 있음.  
`hasExactStemVisible` = `exactStemVisible === true` (또는 monthOutlet로 동일 성격이 reasons에 명시된 경우).

---

## 3. v1 제외 축

| 제외 | 이유 |
|------|------|
| climate / 조후 | Need·기후 축. Strength 세력이 아님 |
| Need / NeedCandidate | 필요 ≠ 세력 |
| Supplement / supplementElement | 표현·보완 결과. Strength 입력 금지 |
| Core / finalElement / role | 구조 역할. Strength 입력 금지 |
| DM `directionCandidate` | 일간 방향. 오행 Strength 입력 금지 |
| **합 / 충 / 형 / 파 / 해** | 현재 엔진 미구현. **향후 modifier layer** |
| 생조 / 설극 **직접 가감** | `generationChains` 등은 reasons 보조만. level 산식에 가산·감산 금지 |

### 향후 modifier layer (명시)

합·충·형·파·해는 v2+에서 Strength **수정자**로만 연결한다.

- 단순 “합 존재” ≠ 화기 성립. **화기 성립 시에만** 오행 이동·재배치를 검토한다.
- 충은 해당 지지/근에 **한정** 감쇠. 전 오행 일괄 감점 금지.
- 형·파·해는 Strength 본선보다 후순위·약하게.

v1 `ElementStrengthProfile.rawEvidence`에는 합충 필드를 넣지 않는다.

---

## 4. 판단 우선순위

레벨을 정할 때 아래 순서로 읽고, **앞선 축이 뒤 축의 과대 확정을 막는다.**

```
1. 월령 (seasonPhase)     ← 기반
2. 통근 / 본기 (rootStatus, hasBranchMain)
3. 천간 노출 (presence, visibleSlots의 유무·성격)
4. 투간 (exactStemVisible / monthOutlet)
5. 지장간 밀도 (hiddenStem anchors의 role·분포)
```

해석 원칙:

1. **월령이 약하면** 천간·지장간이 많아도 `strong` / `very-strong`으로 올리지 않는다.
2. **통근이 없으면** 월령이 왕·상이어도 `very-strong` 금지, 상한은 대체로 `balanced`.
3. **천간 노출**은 드러남을 보강할 뿐, 단독으로 `very-strong` 금지.
4. **투간**은 표면 세력 보강. hidden-only를 한 단계 올릴 때 사용 가능(아래 규칙).
5. **지장간 밀도**는 동점·reasons·`balanced`↔`strong` 경계 보조. 밀도만으로 `strong` 확정 금지.

---

## 5. strengthLevel 5단 규칙 (숫자 없음)

### 5.1 판정 절차

1. `hourUnknown`이면 전체 프로파일에 **partial evidence**를 표시하고, hour 슬롯이 필요한 조건은 “확인된 슬롯만”으로 평가한다. ( §6 )
2. 아래 **§5.2 ~ §5.6**을 **very-strong → very-weak** 순으로 검사한다.
3. **먼저 만족하는 가장 높은 레벨**을 채택한다.
4. 어떤 레벨 조항에도 안 걸리면 `balanced`를 기본으로 하되, `reasons`에 `fallback-balanced`를 남긴다. (정상 fixture에서는 §5.6까지에서 거의 결정됨)
5. 같은 오행에 대해 Supplement/Core/climate/Need를 참조하지 않는다.

### 5.2 `very-strong`

다음을 **모두** 만족:

| 조건 | 허용 값 |
|------|---------|
| seasonPhase | `왕` **만** ( `상`은 very-strong 불가 ) |
| presence | `rooted-visible` |
| rootStatus | `root-clear` |
| 추가 (하나 이상) | `hasBranchMain` **또는** `hasExactStemVisible` **또는** `monthOutletSlots.length > 0` |

**가드:** `unrooted-visible` / `hidden-only` / `absent` 이면 불가.  
**가드:** root가 clear가 아니면 불가.  
**가드:** visible stem 개수·hidden stem 개수만으로 승격 불가.

### 5.3 `strong`

`very-strong`이 아니고, 다음 **어느 하나**:

**S1 — 월령 기반 실세**

| 조건 | 허용 값 |
|------|---------|
| seasonPhase | `왕` 또는 `상` |
| presence | `rooted-visible` |
| rootStatus | `root-clear` 또는 `root-present` |

**S2 — 왕 + 실근이지만 투간·본기 보강 없음** (`very-strong` 미달)

| 조건 | 허용 값 |
|------|---------|
| seasonPhase | `왕` |
| presence | `rooted-visible` |
| rootStatus | `root-clear` |
| 추가 | `hasBranchMain`·exact·outlet **모두 없음** → `strong` (very-strong 아님) |

> S2는 §5.2 미달분을 받기 위한 명시 조항이다. 실정상 §5.2 실패 후 S1으로도 잡힌다.

**가드:** seasonPhase ∈ {`수`,`사`} 이면 `strong` 불가.  
**가드:** presence ≠ `rooted-visible` 이면 S1/S2 불가.  
**가드:** `root-shallow` / `root-absent` 만으로는 `strong` 불가.

### 5.4 `balanced`

`very-strong`·`strong`이 아니고, 다음 **어느 하나**:

**B1 — 노출 + 근, 월령 중립~약**

| 조건 | 허용 값 |
|------|---------|
| seasonPhase | `휴` 또는 `수` |
| presence | `rooted-visible` |
| rootStatus | `root-clear` 또는 `root-present` 또는 `root-shallow` |

**B2 — 월령은 강하나 근이 얕거나 없음 (왕/상 + 약한 근)**

| 조건 | 허용 값 |
|------|---------|
| seasonPhase | `왕` 또는 `상` |
| presence | `rooted-visible` 또는 `unrooted-visible` |
| rootStatus | `root-shallow` 또는 `root-absent` |

→ 상한 `balanced`. (`strong` 승격 금지 — 우선순위: 월령 다음 통근)

**B3 — hidden-only 이지만 정기 근이 분명**

| 조건 | 허용 값 |
|------|---------|
| seasonPhase | `왕` 또는 `상` 또는 `휴` |
| presence | `hidden-only` |
| rootStatus | `root-clear` |

→ 투간 없어도 `balanced`. (hidden 밀도만으로 `strong` 금지)

**B4 — 사(死)월령 + 실근 노출**

| 조건 | 허용 값 |
|------|---------|
| seasonPhase | `사` |
| presence | `rooted-visible` |
| rootStatus | `root-clear` 또는 `root-present` |

→ 천간이 많아도 상한 `balanced`.

### 5.5 `weak`

상위 레벨이 아니고, 다음 **어느 하나**:

**W1**

| 조건 | 허용 값 |
|------|---------|
| presence | `unrooted-visible` |
| 그 외 | seasonPhase 무관 (단 B2에 이미 잡힌 왕/상+unrooted는 balanced) |

> 왕/상 + unrooted-visible 은 **B2가 먼저** 적용되어 `balanced`.  
> 휴/수/사 + unrooted-visible → `weak`.

**W2**

| 조건 | 허용 값 |
|------|---------|
| presence | `hidden-only` |
| rootStatus | `root-present` 또는 `root-shallow` |
| seasonPhase | 임의 (B3 `root-clear`는 제외) |

**W3**

| 조건 | 허용 값 |
|------|---------|
| presence | `hidden-only` |
| rootStatus | `root-clear` |
| seasonPhase | `수` 또는 `사` |

**W4**

| 조건 | 허용 값 |
|------|---------|
| seasonPhase | `사` 또는 `수` |
| presence | `rooted-visible` |
| rootStatus | `root-shallow` 만 |

### 5.6 `very-weak`

상위가 아니고, 다음 **어느 하나**:

**V1** — `presence === "absent"`  
**V2** — `hidden-only` + `root-absent` (이론상 드묾; rootedSlots와 불일치 시 reasons로 기록)  
**V3** — `hidden-only` + `root-shallow` + seasonPhase `사`

### 5.7 레벨 충돌 시 우선순위 (요약)

| 상황 | 채택 |
|------|------|
| very-strong 조건과 strong 조건 동시 | **very-strong** |
| strong과 balanced 동시 | **strong** |
| 왕 + rooted-visible + root-absent | **balanced** (B2), strong 금지 |
| visible 다수 + season `사`/`수` | 상한 **balanced**(B4) 또는 **weak**(W1/W4) |
| hidden-only + root-clear + 왕/상/휴 | **balanced** (B3), strong 금지 |
| hidden-only + 지장간만 많음 + root-shallow | **weak**, strong 금지 |
| Supplement/Core가 해당 오행 | **무시** (level 불변) |

---

## 6. Guardrail (필수)

1. **오행 글자 개수 단순 count 금지** — stem/branch/hidden 개수로 점수를 만들지 않는다. 슬롯 목록은 evidence·reasons용.
2. **visible stem이 많다고 `very-strong` 확정 금지** — §5.2의 월령·근·본기/투간 조건을 모두 충족해야 한다.
3. **hidden stem이 많다고 `strong` 확정 금지** — `hidden-only`의 상한은 원칙적으로 `balanced` (B3) 또는 `weak`.
4. **Supplement = 해당 오행 → weak 판정 금지.**
5. **Core = 해당 오행 → strong 판정 금지.**
6. **climate를 Strength에 합산 금지.**
7. **`hourUnknown`이면 partial evidence:**
   - `rawEvidence`에 확인된 슬롯만 담는다.
   - reasons에 `hour-unknown-partial`을 넣는다.
   - hour에만 있던 근/노출이 빠져 level이 달라질 수 있음을 명시한다.
   - 불확실하다고 level을 자동 `null`로 두지는 않는다 (v1은 5단 중 하나를 유지). 다만 제품 표시에서 partial 배지를 쓸 수 있다.

---

## 7. 대표 fixture 예상 profile

아래는 **score 순위가 아니다.**  
v1 규칙(§5)으로 읽은 **예상 `strengthLevel`** 이다.  
구현 골든 테스트의 1차 기대값으로 쓴다.

### 7.1 MX-1981 — `辛酉 / 乙未 / 丙申 / 戊戌`

월지 未 → 환절 → 土왕 · 金상 · 火휴 · 木수 · 水사

**질적 관계 (문서화):** `土 ≥ 金 > 火 ≥ 木 > 水`

| 오행 | season | presence | root (요약) | 예상 level | 적용 조항 |
|------|--------|----------|-------------|------------|-----------|
| 土 | 왕 | rooted-visible | clear (정기 다수) + branch + 투간 | **very-strong** | §5.2 |
| 金 | 상 | rooted-visible | clear + branch + 투간 | **strong** | S1 (상 → very-strong 불가) |
| 火 | 휴 | rooted-visible | present/shallow (여기·중기) | **balanced** | B1 |
| 木 | 수 | rooted-visible | present (중기) + outlet/투간 | **balanced** | B1 |
| 水 | 사 | hidden-only | present (중기) | **weak** | W2 |

`土 ≥ 金`: 土만 very-strong, 金은 strong.  
`火 ≥ 木`: 동일 balanced 밴드; 火는 일간 노출, 木은 수(囚)월령 — reasons에서 火를 약간 우위로 서술 가능하나 **level은 동일**.

### 7.2 LS-gapin — `甲寅 / 甲寅 / 甲子 / 甲子`

| 오행 | 예상 level | 근거 요약 |
|------|------------|-----------|
| 木 | **very-strong** | 왕 + RV + clear + branch/투간·outlet |
| 火 | **weak** | 상 + hidden-only + present(중기) → W2 (B3는 clear만) |
| 土 | **weak** | 사 + hidden-only + shallow → W2/V3 경계, v1은 **weak** (여기+사) |
| 金 | **very-weak** | absent |
| 水 | **balanced** | 휴 + hidden-only + clear(子 정기) → B3 |

### 7.3 MX-gimo — `己卯 / 丙子 / 戊午 / 戊午`

| 오행 | 예상 level | 근거 요약 |
|------|------------|-----------|
| 木 | **balanced** | 상 + hidden-only + clear(卯 정기) → B3 |
| 火 | **balanced** | 사 + RV + clear → B4 (상한 balanced) |
| 土 | **balanced** | 수 + RV + present(중기) → B1 |
| 金 | **very-weak** | absent |
| 水 | **balanced** | 왕 + hidden-only + clear(子) → B3 |

### 7.4 MX-1990 — `己巳 / 丁丑 / 庚辰 / 庚辰`

| 오행 | 예상 level | 근거 요약 |
|------|------------|-----------|
| 木 | **weak** | 수 + hidden-only + shallow(여기) → W2 |
| 火 | **balanced** | 휴 + RV + clear → B1 |
| 土 | **very-strong** | 왕 + RV + clear + branch + outlet/투간 → §5.2 |
| 金 | **strong** | 상 + RV + present(중기) → S1 |
| 水 | **weak** | 사 + hidden-only + present/shallow → W2/W3 |

### 7.5 NL-2005 — `乙酉 / 甲申 / 甲子 / 壬申`

| 오행 | 예상 level | 근거 요약 |
|------|------------|-----------|
| 木 | **weak** | 사 + unrooted-visible → W1 |
| 火 | **very-weak** | absent |
| 土 | **weak** | 휴 + hidden-only + shallow → W2 |
| 金 | **balanced** | 왕 + hidden-only + clear(다수) → B3 (**strong 금지**) |
| 水 | **strong** | 상 + RV + clear/present + outlet/투간 → S1 |

### 7.6 LW-eulhae — `乙亥 / 乙酉 / 甲寅 / 甲子`

| 오행 | 예상 level | 근거 요약 |
|------|------------|-----------|
| 木 | **balanced** | 사 + RV + clear → B4 (visible 다수여도 strong 금지) |
| 火 | **weak** | 수 + hidden-only + present → W2 |
| 土 | **weak** | 휴 + hidden-only + shallow → W2 |
| 金 | **balanced** | 왕 + hidden-only + clear → B3 |
| 水 | **balanced** | 상 + hidden-only + clear + branch → B3 |

---

## 8. 충돌 예시 (필수)

### 8.1 왕하지만 root 없음

- 예: seasonPhase `왕` + `unrooted-visible` 또는 `rooted-visible`이나 hits 없음에 가까운 `root-absent`
- 방향: **`balanced` (B2)**
- 금지: `strong` / `very-strong`

### 8.2 visible 많지만 season 약함

- 예: LW-eulhae 木 — 천간 4노출이나 seasonPhase `사`
- 방향: 근이 있으면 **`balanced` (B4)**; 근 없으면 **`weak` (W1)**
- 금지: visible 개수로 `very-strong`

### 8.3 hidden-only지만 정기 root 다수

- 예: NL-2005 金 — 酉·申 정기 다수, 천간 금 없음
- 방향: season 왕/상/휴이면 **`balanced` (B3)**
- 금지: hidden 밀도로 `strong`

### 8.4 unrooted-visible 다수

- season 왕/상: **`balanced` (B2)**
- season 휴/수/사: **`weak` (W1)**
- 금지: 노출 개수만으로 `strong`

### 8.5 hour unknown

- 확인된 연·월·일만으로 §5 적용
- reasons: `hour-unknown-partial`
- hour에만 있던 clear root가 빠지면 level이 한 단계 내려갈 수 있음 → 문서·UI에 partial 고지
- level 자체를 비우지 않음 (v1)

---

## 9. 출력 계약 초안

```ts
type ElementStrengthProfile = {
  element: Element;
  rawEvidence: {
    seasonPhase: SeasonPhase;
    presence: ElementPresenceKind;
    visibleSlots: PillarSlot[];
    rootedSlots: PillarSlot[];
    monthOutletSlots: PillarSlot[];
    clusterAnchors: ElementClusterAnchor[];
    rootHits: RootHit[];
    exactStemVisible: boolean;
  };
  strengthLevel:
    | "very-weak"
    | "weak"
    | "balanced"
    | "strong"
    | "very-strong";
  /** v1 미정. 규칙·normalize 확정 전 사용하지 않는다. */
  score?: number;
  reasons: string[];
};
```

권장 상위 묶음:

```ts
type ElementStrengthProfileSet = {
  profiles: ElementStrengthProfile[]; // 木火土金水 5
  certainty: "complete" | "partial"; // hourUnknown → partial
  omittedSlots: PillarSlot[];
};
```

- `score`는 본 문서에서 **미정**. 오각형 UI는 score 확정·0~100 normalize 이후.
- `reasons`는 적용 조항 id를 남긴다. 예: `level:very-strong`, `gate:season-wang`, `gate:root-clear`, `guard:no-count`, `hour-unknown-partial`.

---

## 10. 남은 정책 gap

점수화·구현 전에 아직 열어 둔 항목:

1. **`상` + very-strong 예외** — v1은 왕만 very-strong. 완화 여부는 v1.1.
2. **B1에서 `root-shallow`를 balanced에 둘지 weak로 내릴지** — v1은 休/囚 + RV면 shallow도 balanced. fixture로 재검토.
3. **土(LS-gapin) shallow+사** — weak vs very-weak 경계(V3). v1은 weak.
4. **동일 level 내 상대 서열** (火 ≥ 木 등) — reasons/UI 힌트만, score 전제 금지.
5. **합충형파해 modifier** 스키마·적용 시점.
6. **생조 reasons 문구** 표준화 (level 불변).
7. **`score` 스케일·normalize** — 별도 문서.

---

## 11. 다음 구현 단계 (코드는 아직 금지인 단계의 다음)

1. 본 문서를 리뷰 확정(이미 v1 규칙표로 채택).
2. `buildElementStrengthProfiles(pillars)` — rawEvidence + strengthLevel + reasons만 (`score` 없음).
3. §7 fixture를 골든 테스트로 고정.
4. hourUnknown partial 케이스 추가.
5. score / normalize / 오각형 UI는 그 다음.

---

## 변경 이력

| 버전 | 내용 |
|------|------|
| v1 | 최초 확정. 포함/제외 축, 5단 조건, guardrail, fixture 예상 level |
