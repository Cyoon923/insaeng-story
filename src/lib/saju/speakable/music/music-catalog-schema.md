# Music Catalog Schema — 운율 음악 추천 (설계만 · migration 없음)

기준: `types.ts` · `adaptMusicRecommendQuery.ts`  
범위: 관리자 등록 곡 ↔ `MusicRecommendQuery` 매칭용 **최소 카탈로그**  
비범위: 실제 migration · YouTube 사례 피드 변경 · 사주 엔진 결과 저장

---

## 1. 현재 DB / ORM 방식

| 항목 | 현재 상태 |
|---|---|
| ORM | **없음** (Prisma/Drizzle 미사용) |
| 드라이버 | `@neondatabase/serverless` (`neon`) |
| 저장소 | Neon Postgres **또는** 로컬 `data/app-data.json` 폴백 |
| 패턴 | 단일 테이블 `app_store(id, data JSONB)`에 앱 전체 `AppData` 블롭 |
| 접근 | `src/lib/server/store.ts` (`readData` / `writeData`) |

**설계 선택 (이번 스키마):**  
ORM을 새로 도입하지 않고, 기존 `AppData` JSONB 블롭에 **컬렉션 배열**을 추가하는 방식이 현재 스택과 일치한다.

- 컬렉션 키(제안): `musicCatalog`
- 논리 테이블/컬렉션 이름: **`music_catalog`** (문서·향후 전용 테이블명으로도 동일 사용)
- 단기: `AppData.musicCatalog: MusicCatalogTrack[]`
- 중기(선택): 행 수가 커지면 Postgres `music_catalog` 테이블로 분리 가능 — **지금은 migration 하지 않음**

YouTube 사례 피드(`YouTubeVideo` / `youtubeFeed`)는 **추천 DB로 재사용하지 않는다.**

---

## 2. 레코드 타입 (설계)

```ts
// DRAFT — 문서 전용. 실제 .ts / migration 아님.
type Element = "木" | "火" | "土" | "金" | "水";

type MusicCatalogTrack = {
  id: string;
  title: string;
  youtubeUrl: string;
  thumbnailUrl?: string;

  /** 관리자 메타. 추천 winner / 용신 아님 */
  primaryElement: Element;
  /** 보조 오행 가방. 순위·점수 아님 */
  secondaryElements: Element[];

  moodTags: string[];
  situationTags: string[];
  energyTags: string[];
  message: string;
  lyricKeywords: string[];

  active: boolean;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
};
```

### 금지 필드 (DB에 두지 않음)

| 금지 | 이유 |
|---|---|
| `score` / `rank` / `priority` / `winner` | 추천 순위 생성 금지 |
| `yongsin` / `heesin` / `neededElement` / `finalElement` | Speakable 계약 P1–P2 |
| 사주 엔진 스냅샷 (`StrengthSummary`, `NeedResolution`, …) | 엔진 결과 저장 금지 |
| YouTube 피드 전용 필드 재사용 (`views`, 채널 메타 등) | 사례 피드 ≠ 추천 카탈로그 |

---

## 3. 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | `string` | **필수** | `nowId()` 등 앱 생성 ID |
| `title` | `string` | **필수** | 곡 제목 (표시·forbidden 스캔) |
| `youtubeUrl` | `string` | **필수** | 시청/참고 링크 (추천 전용; 사례 피드와 별도) |
| `thumbnailUrl` | `string` | 선택 | 없으면 YouTube ID에서 파생 가능(구현 시) |
| `primaryElement` | `Element` | **필수** | 관리자 주 오행 메타. **추천 winner 아님** |
| `secondaryElements` | `Element[]` | **필수**(빈 배열 허용) | 보조 오행. 비순위 집합 |
| `moodTags` | `string[]` | **필수**(빈 배열 허용) | 예: 따뜻한, 잔잔한 — `MusicRecommendQuery.moodTags`와 교집합 |
| `situationTags` | `string[]` | **필수**(빈 배열 허용) | 상황 태그 (이별, 응원, 가족 등) |
| `energyTags` | `string[]` | **필수**(빈 배열 허용) | 에너지/템포 감 (힘있는, 잔잔한 등과 별도 축 가능) |
| `message` | `string` | **필수** | 곡이 전하는 한 줄 메시지 → forbidden 스캔용 `copy` |
| `lyricKeywords` | `string[]` | **필수**(빈 배열 허용) | 가사 키워드 → lyricHints 느슨 매칭용 |
| `active` | `boolean` | **필수** | `false`면 추천 후보에서 제외 |
| `createdAt` | `string` (ISO) | **필수** | 등록 시각 |
| `updatedAt` | `string` (ISO) | **필수** | 수정 시각 |

**매칭 시 오행 가방 규칙**

```
elementTags(for MusicCatalogEntry) =
  unique([primaryElement, ...secondaryElements])
```

- `primaryElement`는 가방의 **한 원소**일 뿐이며, 단일 winner·점수·순위로 승격하지 않는다.
- `MusicRecommendQuery.elementThemeBag`과의 **교집합만** 기록 (`matchedElements`).

---

## 4. `MusicCatalogEntry` ↔ DB 필드 대응표

현재 매칭 어댑터 표면(`MusicCatalogEntry`)과의 매핑.

| `MusicCatalogEntry` | DB (`MusicCatalogTrack`) | 변환 |
|---|---|---|
| `id` | `id` | 그대로 |
| `title` | `title` | 그대로 |
| `moodTags` | `moodTags` | 그대로 |
| `elementTags` | `primaryElement` + `secondaryElements` | 합쳐 비순위 집합 (중복 제거, primary 우선 등장) |
| `themeTags` | `situationTags` + `energyTags` + `lyricKeywords` | 배열 concat (중복 제거) |
| `copy` | `message` (+ 필요 시 `title`) | forbidden 문자열 스캔 |
| _(없음)_ | `youtubeUrl` / `thumbnailUrl` | 매칭 후 UI 표시용. Entry에는 아직 없음 → Match 확장 시 추가 |
| _(없음)_ | `active` | `true`만 `filterMusicCatalogByQuery` 입력에 넣음 |
| _(없음)_ | `createdAt` / `updatedAt` | 관리·정렬용. 추천 score 아님 |

`MusicRecommendQuery` 연결:

| Query 필드 | 카탈로그 사용 |
|---|---|
| `moodTags` | ↔ `moodTags` 교집합 |
| `lyricHints` | ↔ `message` / `lyricKeywords` 느슨 매칭 (후속) |
| `elementThemeBag` | ↔ `primaryElement`∪`secondaryElements` 교집합 |
| `forbidden` | `title` + `message` (+ theme 계열) 포함 시 **제외** |
| `provenance` / `provisional` / `contestedInherited` | DB에 저장하지 않음. 쿼리·매치 응답에만 유지 |

---

## 5. 관리자 등록 화면 — 입력 필드 목록

| UI 라벨(안) | 필드 | 위젯 | 필수 | 메모 |
|---|---|---|---|---|
| 곡 제목 | `title` | text | ✓ | |
| YouTube URL | `youtubeUrl` | url | ✓ | 사례 피드 자동 동기화 없음 |
| 썸네일 URL | `thumbnailUrl` | url | | 비우면 미리보기만 파생 |
| 주 오행 | `primaryElement` | select 木火土金水 | ✓ | 안내: “추천 1등/용신 아님” |
| 보조 오행 | `secondaryElements` | multi-select | | primary와 중복 선택 시 저장 시 제거 |
| 분위기 태그 | `moodTags` | multi-select + 직접입력 | ✓ 최소 0 | 신청 UI MOODS와 정렬 권장 |
| 상황 태그 | `situationTags` | multi + chips | | |
| 에너지 태그 | `energyTags` | multi + chips | | |
| 메시지 | `message` | textarea | ✓ | forbidden 문구 입력 차단(클라이언트 가드) |
| 가사 키워드 | `lyricKeywords` | chip input | | |
| 공개(추천 포함) | `active` | toggle | ✓ | 기본 `true` |
| _(시스템)_ | `id` / `createdAt` / `updatedAt` | 자동 | ✓ | 화면 비노출 또는 읽기전용 |

관리자 화면에 **넣지 말 것:** 용신/희신/필요오행, 점수·순위, 사주 결과 붙여넣기, YouTube 사례 목록에서 “추천 DB로 가져오기” 일괄 변환(의도적 분리).

---

## 6. `AppData` 확장 스케치 (migration 전 참고)

```ts
// DRAFT — AppData에 추가할 키만. 이번 작업에서 코드 변경하지 않음.
type AppData = {
  // ...existing
  musicCatalog?: MusicCatalogTrack[]; // 없으면 []
};
```

Neon 전용 테이블을 나중에 둘 경우(참고만):

```sql
-- DRAFT — 실행하지 않음
CREATE TABLE music_catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  thumbnail_url TEXT,
  primary_element TEXT NOT NULL,
  secondary_elements JSONB NOT NULL DEFAULT '[]',
  mood_tags JSONB NOT NULL DEFAULT '[]',
  situation_tags JSONB NOT NULL DEFAULT '[]',
  energy_tags JSONB NOT NULL DEFAULT '[]',
  message TEXT NOT NULL,
  lyric_keywords JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

---

## 7. 다음 구현 파일 (순서 제안)

1. `src/lib/saju/speakable/music/catalogTypes.ts` — `MusicCatalogTrack` 타입 확정  
2. `src/lib/saju/speakable/music/toMusicCatalogEntry.ts` — Track → `MusicCatalogEntry` 매퍼 (`active` 필터 포함)  
3. `src/lib/types/app.ts` — `AppData.musicCatalog` 키 추가  
4. `src/lib/server/store.ts` — `EMPTY.musicCatalog = []` (테이블 migration 없이 블롭 키만)  
5. `src/app/api/admin/music-catalog/route.ts` — CRUD API  
6. `src/app/admin/...` — 등록/목록 UI  
7. `adaptMusicRecommendQuery.ts` — Track 매퍼 연동 테스트 보강  

**하지 않음(유지):** `src/lib/constants/youtube.ts`, `youtubeFeed.ts`, 사례/홈 YouTube UI.
