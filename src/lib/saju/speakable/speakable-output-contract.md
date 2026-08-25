# Speakable Output Contract — 운율 MVP

엔진 코드·enum·Wave closure·VERIFIED·용신/Needed Element를 이 문서로 바꾸지 않는다.  
**스펙만.** `.ts` 파일 생성·구현은 후속 작업.

**목적:** `StrengthSummary` / `AdjustedClimateSummary` / `NeedCandidateSet` / `NeedResolution`을  
사용자 메시지 · 작사 프롬프트 · 음악 추천 힌트로 **안전하게** 넘기는 최소 계약.

**근거 경계:** Wave 1~3 CLOSE · CL-NEED-HOUR · climate/need/need-resolution freeze · `mvp-engine-readiness-audit.md`

---

## 0. 절대 원칙

| # | 원칙 |
|---|---|
| P1 | **용신 확정 금지** — 출력에 `yongsin` / `heesin` / `neededElement` / `winner` / `finalElement` 필드 없음 |
| P2 | **최종 필요 오행 확정 금지** — 오행은 항상 `candidates[]` / theme 수준 |
| P3 | **신강/신약 단정 운명 문구 금지** — leaning·mixed·null을 “당신은 신강입니다”로 변환 금지 |
| P4 | **unresolved / contested / provisional 보존** — 다운스트림이 확정으로 승격 금지 |
| P5 | **hour-unknown provisional 확정 표현 금지** |
| P6 | **Strength와 Need 혼합 금지** — 별 채널. Strength 방향을 Need 필요로 읽지 않음 |
| P7 | **NeedResolution status ≠ 사용자 결론** — Wave 3 의미 경계 준수 |
| P8 | **음악 추천에 오행 하나 winner 전달 금지** |

---

## 1. 입력 (`SpeakableInput`)

구현 시 엔진 빌더 결과를 **그대로** 받는다. Speakable이 재판정하지 않는다.

```ts
// DRAFT — 문서 전용. 실제 .ts 파일 아님.
type SpeakableInput = {
  strength: StrengthSummary;
  climate: AdjustedClimateSummary;
  needCandidates: NeedCandidateSet;
  needResolution: NeedResolution;
  /** 명시적 전달 권장 (pillars.hourCertainty와 동일해야 함) */
  hourUnknown: boolean;
};
```

| 입력 | Speakable이 읽어도 되는 것 | 읽어도 재판정 금지 |
|---|---|---|
| Strength | `directionCandidate`, `certainty`, `directionSensitivity`, `resolution`, `seasonalPhase`, `unresolvedReasons` | `decideDirection` 재실행 |
| Climate | `certainty`, `temperature`, `moisture` (status/value) | BASE_CLIMATE·adjustPolar 재계산 |
| NeedCandidateSet | active `candidate`만 테마 재료; `strengthNeedStatus` / `climateNeedStatus` | suppressed를 “검증된 기성관계”로 승격 (NEED-015 unresolved) |
| NeedResolution | `relationPattern`, `status`, `decisionBlockedBy`, axis status, active 후보 provenance | status→용신/승리 번역 |

---

## 2. 출력 (`SpeakableOutput`) — 최종 필드

```ts
// DRAFT — 문서 전용.

type SpeakableStatus =
  | "ready-provisional"   // 관찰 가능하나 확정 아님
  | "partial-hold"        // 일부 축만 / blocker / hour-unknown gate
  | "diagnostic-only";    // 사용자 본문보다 내부·작사 힌트용

type ThemeKind =
  | "strength-observation"
  | "need-strength-candidate"
  | "need-climate-candidate"
  | "climate-observation"
  | "relation-meta";

type SpeakableTheme = {
  id: string;
  kind: ThemeKind;
  /** 사용자·작사에 쓸 수 있는 짧은 잠정 문구 (확정 톤 금지) */
  phrase: string;
  /** 오행이 있을 때만. winner 아님 */
  elements?: Array<"木" | "火" | "土" | "金" | "水">;
  provenance: SpeakableProvenance[];
};

type SpeakableProvenance = {
  layer: "strength" | "climate" | "need-strength" | "need-climate" | "need-resolution";
  evidenceRef: string; // 예: strength.directionCandidate=leaning-weak
};

type MusicRecommendationHints = {
  /** 분위기 태그. 오행 winner 없음 */
  moodTags: string[];
  /** 가사·선율 힌트 문구 (잠정) */
  lyricHints: string[];
  /** 참고용 오행 후보 가방. 순위·단일 선택 없음 */
  elementThemeBag: Array<"木" | "火" | "土" | "金" | "水">;
  /** 음악 레이어가 하면 안 되는 것 */
  forbidden: string[];
  provenance: SpeakableProvenance[];
};

type SpeakableOutput = {
  speakableStatus: SpeakableStatus;
  /** 전체 신뢰. complete여도 명리 VERIFIED 아님 */
  confidence: "provisional" | "partial" | "hold";
  provisional: boolean; // 항상 true여도 됨. MVP는 false 금지 권장
  hourUnknown: boolean;
  hourUnknownProvisional: boolean; // directionSensitivity === hour-unknown-provisional

  /** 현재 관찰 가능한 핵심 테마 (1~3 권장) */
  observationThemes: SpeakableTheme[];
  supportThemes: SpeakableTheme[];
  cautionThemes: SpeakableTheme[];
  climateThemes: SpeakableTheme[];

  musicRecommendationHints: MusicRecommendationHints;

  /** 디버그/내부. 사용자 화면 직접 바인딩 금지 */
  internal: {
    strengthDirection: StrengthSummary["directionCandidate"];
    strengthNeedStatus: NeedCandidateSet["strengthNeedStatus"];
    climateNeedStatus: NeedCandidateSet["climateNeedStatus"];
    relationPattern: NeedResolution["relationPattern"];
    resolutionStatus: NeedResolution["status"];
    decisionBlockedBy: NeedResolution["decisionBlockedBy"];
  };

  fallbackApplied: SpeakableFallbackCode[];
};
```

### 필드 요약

| 필드 | 역할 |
|---|---|
| `speakableStatus` | 노출 가능 수준 |
| `confidence` / `provisional` | 잠정성 |
| `observationThemes` | 지금 말해도 되는 관찰 |
| `supportThemes` | 조력·지지 쪽 잠정 이미지 (Strength support 쪽 · Need peer/resource 후보 **분리 표기**) |
| `cautionThemes` | 설기·압력·주의 이미지 (Strength pressure · Need output/wealth/official **분리**) |
| `climateThemes` | 조후 잠정 힌트 |
| `musicRecommendationHints` | 음악 계층 전용 가방 |
| `internal` | UI 비노출 |
| `fallbackApplied` | unresolved 시 적용한 규칙 코드 |

---

## 3. Provenance 규칙

모든 `SpeakableTheme` / `musicRecommendationHints`는 `provenance[]` 필수.

| 출력 소스 | evidenceRef 예 |
|---|---|
| Strength leaning-weak | `strength.directionCandidate=leaning-weak` |
| hour provisional | `strength.directionSensitivity=hour-unknown-provisional` |
| Climate cold | `climate.temperature=cold` + `climate.temperature.status=resolved` |
| Need Strength 水 | `need.strength.element=水` + `need.strength.reason=strengthen-day-master-resource` |
| Need Climate 火 | `need.climate.reason=climate-temperature-cold` |
| Resolution meta | `needResolution.relationPattern=climate-only` (테마 본문에는 쓰지 말고 meta/internal) |

**Strength 테마와 Need 테마는 kind로 분리.** 같은 오행이라도 provenance layer가 다르면 합치지 않는다.

---

## 4. 말해도 되는 표현 / 금지 표현

### 4.1 Strength

| 허용 (잠정) | 금지 |
|---|---|
| “지금 흐름은 **힘이 실리는 쪽**으로 기울어 보일 수 있어요” (leaning-strong + !hourUnknownProvisional) | “당신은 **신강**입니다” |
| “지금은 **기대어 쉬어가는 쪽**으로 읽힐 수 있어요” (leaning-weak) | “신약이라 평생 …” |
| “방향이 한쪽으로 단정되지 않아요” (mixed/null) | mixed를 “중립 확정”으로 |
| hour unknown: “시간이 확실해지면 달라질 수 있는 **잠정** 관찰이에요” | “시주 없어도 신강 확정” |

### 4.2 Climate

| 허용 | 금지 |
|---|---|
| “기운이 **다소 서늘한** 쪽으로 보여요” (cold resolved, provisional) | “당신은 **한습**합니다” (확정) |
| “조금 **건조한** 결이 보여요” (dry) | “조후 완료·검증됨” |
| unresolved 축: 기후 테마 **생략** 또는 “기후는 아직 단정하지 않아요” | unresolved를 balanced로 채움 |

NEED-022(dry→水 Need) 경로는 contested 상속 → climate/need 테마에 **provisional** 필수.

### 4.3 Need (Strength 축 vs Climate 축 분리)

| 허용 | 금지 |
|---|---|
| “이야기·가사에서는 **서로 기대는(비겁)·채워주는(인성)** 이미지가 후보예요” | “용신은 水입니다” |
| “**내보내기·쓰임·다스림** 쪽 이미지가 후보로 열려 있어요” (leaning-strong Need, confirmed hour) | “식상·재·관이 필요합니다(확정)” |
| Climate Need: “따뜻함을 더하는 **불** 이미지가 후보일 수 있어요” | “필요한 오행은 火로 확정” |
| strengthNeedStatus unresolved (hour gate 등): Strength Need 테마 **비움** | gated인데 후보를 확정처럼 노출 |

### 4.4 NeedResolution (Wave 3)

| status | 허용 메타 (작사 내부) | 금지 사용자 문구 |
|---|---|---|
| indeterminate | “지금 후보로 관계를 닫지 않음” | “필요한 오행이 없습니다” |
| single-axis | “한 갈래 후보만 열려 있음” | “Climate가 이겼습니다” |
| convergent | “겹치는 이미지가 있음(미확정)” | “용신 확정·두 이론 일치” |
| competing | “갈래가 서로 다름(미해소)” | “사주가 나쁨·분석 오류” |

`resolutionStatus` / `relationPattern`은 **`internal` + music forbidden 가드**에만. `observationThemes` 본문에 raw enum 노출 금지.

---

## 5. unresolved / fallback 규칙

```ts
type SpeakableFallbackCode =
  | "FB-STRENGTH-NULL"
  | "FB-STRENGTH-MIXED"
  | "FB-STRENGTH-NEED-GATED"      // CL-NEED-HOUR
  | "FB-CLIMATE-AXIS-UNRESOLVED"
  | "FB-NEED-015-NO-CLAIM"        // suppressed를 채택 표현 안 함
  | "FB-RESOLUTION-BLOCKED"
  | "FB-HOUR-UNKNOWN-PROVISIONAL"
  | "FB-STORY-FIRST";             // 사주 테마 빈약 → 이야기 우선
```

| 조건 | fallback | 출력 |
|---|---|---|
| `directionCandidate === null` | FB-STRENGTH-NULL | Strength observation 최소화; `confidence=hold` 또는 `partial` |
| `mixed` | FB-STRENGTH-MIXED | “한쪽으로 단정하지 않음”; Strength Need 테마 없음 (엔진과 동일) |
| `directionSensitivity=hour-unknown-provisional` 또는 strengthNeed gated | FB-STRENGTH-NEED-GATED / FB-HOUR-UNKNOWN-PROVISIONAL | Strength **관찰만** 잠정; Need Strength 테마 **빈 배열**; `hourUnknownProvisional=true` |
| Climate T 또는 M unresolved | FB-CLIMATE-AXIS-UNRESOLVED | 해당 축 climateThemes 생략 |
| Need-015 suppressed 존재 | FB-NEED-015-NO-CLAIM | suppressed를 “이미 충분해서 제외됨”으로 **말하지 않음** |
| `decisionBlockedBy.length > 0` | FB-RESOLUTION-BLOCKED | resolution을 결론으로 안 씀; 후보 가방만 |
| observation+need+climate 테마 모두 빈약 | FB-STORY-FIRST | `speakableStatus=diagnostic-only`; 음악은 고객 이야기·선택 분위기 우선 |

**MVP:** `provisional`은 **기본 true**. `confidence=hold`일 때 사용자 본문은 이야기 중심, 사주는 한 줄 잠정만.

---

## 6. hour unknown 처리

| 엔진 | Speakable |
|---|---|
| `hourUnknown === true` | `hourUnknown=true` |
| `directionSensitivity === "hour-unknown-provisional"` | `hourUnknownProvisional=true`; Strength 문구에 **잠정** 필수 |
| Strength Need `unresolved` + candidates `[]` (CL-NEED-HOUR) | Need Strength 테마 **생성 금지** |
| Climate는 partial certainty 가능 | Climate 테마는 축 resolved일 때만; 그래도 provisional |

**금지:** “시간이 없어도 방향·Need가 확정됐다.”

---

## 7. 음악 추천 전달 규칙

### 넘겨도 됨 (`musicRecommendationHints`)

- `moodTags`: 예) `따뜻한`, `잔잔한`, `희망적인` — 엔진 leaning/climate와 **느슨히** 매핑 (확정 오행 아님)
- `lyricHints`: 잠정 phrase 복사 (support/caution/climate에서)
- `elementThemeBag`: active Need 후보 오행 **집합** (중복 제거, **순서=등장 순·비순위**)
- Strength·Climate·Need를 **태그로만** 구분 가능하면 `provenance`로 유지
- `forbidden`: Wave 3·freeze 금지 문구 목록

### 넘기면 안 됨

| 금지 페이로드 |
|---|
| 단일 `element: "水"` winner |
| `yongsin` / `heesin` / `neededElement` / `finalElement` |
| `rank` / `score` / `priority` / `winner` |
| raw `resolutionStatus: "convergent"`를 “정답” 플래그로 |
| hour-unknown인데 Strength Need 확정 후보 |
| NEED-015 suppressed = “이미 이루어진 관계라 제외” 확정 카피 |
| “신강/신약/한습/조열” 단정 문자열 |
| 대운·세운·월운·일운 (엔진 미구현 · 계약 범위 밖) |

### 매핑 스케치 (구현 시 · 비확정 점수 없음)

| 엔진 관찰 | moodTags 예 (잠정) |
|---|---|
| leaning-strong (confirmed hour) | `힘있는`, `펼치는` + caution에 설기 이미지 |
| leaning-weak (confirmed hour) | `기대는`, `채워지는` |
| cold → 火 candidate | `따뜻한`, `녹이는` |
| dry → 水 candidate | `촉촉한`, `감싸는` (provisional) |
| hour-unknown provisional | mood는 **이야기·사용자 선택 분위기 우선**; 사주 태그는 0~1개·잠정 |

---

## 8. Strength ↔ Need 비혼합 (체크리스트)

어댑터 구현 시 assert:

1. `supportThemes`의 Strength 기원 phrase와 Need `peer`/`resource` phrase를 **한 문장으로 합치지 않음**
2. `cautionThemes`의 Strength pressure와 Need `output`/`wealth`/`official`을 **한 “필요 오행”으로 합치지 않음**
3. `elementThemeBag`에 넣을 때 source를 provenance에 남김
4. Strength `leaning-strong` ≠ “식재관이 필요하다” 자동 문구 (Need 채널이 열렸을 때만 Need phrase)

---

## 9. 권장 `speakableStatus` 결정표

| 조건 | speakableStatus | confidence |
|---|---|---|
| hourUnknownProvisional | `partial-hold` | `partial` |
| strength null/mixed + climate unresolved | `diagnostic-only` | `hold` |
| blockers만 있고 후보 가방은 있음 | `partial-hold` | `partial` |
| confirmed hour + leaning + (optional climate themes) | `ready-provisional` | `provisional` |
| 그 외 기본 | `ready-provisional` | `provisional` |

---

## 10. 비범위

- 대운·세운·월운·일운
- OPEN counter-signal (DEFER)
- NEED-015 해결
- Wave 1 POLICY-UNRESOLVED 수치 해결
- UI 카피 최종 디자인 · LLM 프롬프트 전문
- 실제 TypeScript 모듈 생성

---

## 11. 구현 순서 (참고 · 이번 작업 아님)

1. 이 계약으로 `buildSpeakableOutput(input): SpeakableOutput`  
2. 단위 테스트: 금지 필드 부재 · hour-unknown Need 테마 빈 배열 · convergent≠용신  
3. 사주 인생곡 → lyricHints + moodTags만 전달
