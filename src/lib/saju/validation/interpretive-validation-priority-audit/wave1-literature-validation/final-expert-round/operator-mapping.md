# Operator mapping — Final integrated expert blind (G5 + G6)

**전문가에게 전달:** `expert-blind-package.md` **만**.  
**본 문서·inventory:** 운영자 전용. G5/G6·CLI·fixture·literature verdict·expected·선정 목적 포함.

엔진·CLI/STR·freezeStatus·literature verdict 미변경.  
전문가 답 생성·다수결 정답화·G5/G6 closure·점수·가중 금지.  
G1~G4 재작업 금지.  
E3 패널 **완전 제외** (unavailable, 백필 없음).  
E1/E2/E4 각 1회, 총 3회로 종료.

**선행 문헌 (재작성 없음):**
- `../batch-5/wave1-batch-5-literature-validation.md`
- `../batch-5/wave1-batch-5-literature-inventory.json`
- `../batch-6/wave1-batch-6-literature-validation.md`
- `../batch-6/wave1-batch-6-literature-inventory.json`

**후속 (본 라운드 밖):** G5 closure · G6 closure · comparison · aggregation — **각각 분리** 수행.

---

## 1. 통합 목적

G5 **BRANCH-FIRE-WATER**와 G6 **CLIMATE-ADJUST**에서 문헌이 **expert YES**로 남긴 쟁점만 하나의 설문으로 묶는다.  
월지 baseline(CLI-002 등)은 G4에서 경계가 닫혔으므로 **재질문하지 않음** — case 서술에서 “월령·전국 기후 전제”만 요청.

---

## 2. G5 검증 범위 (operator)

| rule | literature (불변) | expert 초점 |
|---|---|---|
| CLI-011 | PARTIALLY-SUPPORTED | 지지 **본기** 火 = 巳·午만인가 |
| CLI-012 | PARTIALLY-SUPPORTED | 지지 **본기** 水 = 亥·子만인가 |

**G5 부수 층 (본 라운드에서 질문·case로 커버):**
- 본기 vs 지장간 火/水 (문헌 B)
- 삼合·장생 vs 본기 수집 (W1B5-U2)
- 존재 vs 조절 분리 (문헌 C; G6와 공유)
- 계절 무관 고정 수집 vs 계절 의존 (문헌 D → A-9와 통합)
- CLI-014 월지 본기 생략 (W1B5-U4 → A-10)

**G5 본 라운드 비대상 (operator only):**
- CLI-009/010 FACT (= 천간 丙丁/壬癸) — 이미 VERIFIED-FACT
- CLI-013 木金土 factor 없음 — ENGINE-POLICY
- CLI-021~025 quality 등급 체계 — EXPERT 별도; A-8에서 “세기 조건”만
- W1B5-U3 장간 가중 수치 — CLI-024; 점수화 금지

---

## 3. G6 검증 범위 (operator)

| rule | literature (불변) | expert 초점 |
|---|---|---|
| CLI-018 | PARTIALLY-SUPPORTED | 한난에서 火 mit / 水 reinf **방향** |
| CLI-019 | CONTESTED | 조습에서 火/水 역할; 土 층 |
| CLI-036 | CONTESTED | moist 축에 cold와 **동일 함수**(mit=火) |
| CLI-037 | CONTESTED | dry 축에 warm과 **동일 함수**(mit=水) |

**G6 부수 층:**
- 존재 vs 조절 + quality 게이트 (W1B6-U2 → A-4, A-8)
- 일간×월령 의존 (W1B6-U5 → A-9)
- 土 조습 factor (W1B6-U4 → A-6)
- CLI-002 CONTESTED 입력 라벨 (W1B6-U1) — **질문 제외**; case는 월지 글자·전문가 자체 baseline 전제

**G6 본 라운드 비대상:**
- CLI-032 한 칸 폭, CLI-054 양축 동시 이동 (W1B6-U3)
- adjustedClimate / NeedCandidate / expected 값
- BASE_CLIMATE enum 라벨을 전문가에게 노출

---

## 4. 질문 ↔ G5/G6 매핑 (10)

| Q | expert-blind-package | G5 | G6 | literature unresolved |
|---|---|---|---|---|
| A-1 | 본기 火=巳午, 水=亥子 | CLI-011, CLI-012 | — | W1B5-U1 |
| A-2 | 지장간 = 본기 동층? | CLI-011/012 제외 축 | quality 층 | W1B5-U3 (방향만) |
| A-3 | 삼合·장생 포함 | W1B5-U2 | — | W1B5-U2 |
| A-4 | 존재 vs 조절 | 문헌 C | 문헌 C, W1B6-U2 | W1B5-U5, W1B6-U2 |
| A-5 | 한난 火/水 방향 | — | CLI-018 | — |
| A-6 | 조습 火/水 + 土 | — | CLI-019, W1B6-U4 | W1B6-U4 |
| A-7 | 한난·조습 동일 규칙? | — | CLI-036, CLI-037 | — |
| A-8 | 조절 세기 조건 | — | W1B6-U2 | W1B6-U2 |
| A-9 | 월령·일간 필요 | 문헌 D | W1B6-U5 | W1B6-U5 |
| A-10 | 월지 vs 타 지지 비중 | CLI-014 | — | W1B5-U4 |

Phase B 4-1 표 12항은 A-1~A-10 + 세부 라벨화. **공통 질문 수 = 10** (Phase A).

---

## 5. 중복 제거 (통합 시 제외·병합)

| 제거/병합 | 이유 |
|---|---|
| G5「계절에 따라 같은 火/水?」+ G6「월령·일간에 따라?」 | **A-9** 하나로 병합 |
| G5「존재=조절?」+ G6「존재 vs 조절?」 | **A-4** 하나로 병합 |
| G5「장간 가중」+ G6「quality clear 게이트」 | **A-8** “세기·조건”으로 병합; 등급표·점수는 제외 |
| G6「clear → balanced 한 칸」(문헌 F) | 엔진 추상화; 전문가 유도 질문 **제외** |
| G4 월지 baseline / 사계 묶음 / 토월 동일 | G4 CLOSE; **재질문 없음** |
| CLI-002 CONTESTED 월지 lookup | G4 unresolved; 본 라운드 **비질문** (W1B6-U1은 operator 기록만) |
| CLI-021~025 개별 등급 | EXPERT 미판정; A-8 일반 조건만 |
| CLI-032 / CLI-054 | Batch 6 미판정; 제외 |
| 旺衰·用神·格局 | 층 혼용 방지; 설문 범위 밖 (case 지시로 왕쇠≠조후만) |

---

## 6. Case ↔ fixture ↔ G5/G6 (8)

| blindId | sourceFixture | pillars (요약) | G5 커버 | G6 커버 |
|---|---|---|---|---|
| w1fr-01 | s13-eul-in-jeonggi-geop | 庚申 甲寅 乙酉 | 寅=木; 寅中丙 vs branch火; 火 hidden | 火 hidden-only → 조절? |
| w1fr-02 | s14-jeong-o-wang-jeonggi | 甲辰 丙午 丁酉 庚申 | 午 branch火; 辰癸≠branch水 | warm+dry; 丙丁 clear; 申壬 hidden |
| w1fr-03 | s7-gap-jin-yogi | 庚申 戊辰 甲子 | 子 branch水; 辰癸; 申子辰 | moist; 火 absent; hidden 水 |
| w1fr-04 | s15-gyeong-hae-hyu | 甲寅 辛亥 庚子 | 亥·子 branch水; 寅丙 hidden火 | cold+moist; 火 need 방향 |
| w1fr-05 | s1-gimo-bingja-muo | 己卯 丙子 戊午 戊午 | 子·午 branch 水/火 | cold+moist + 丙 clear + 午; 양축 조절 |
| w1fr-06 | s10-byeong-chuk-hyu | 丙巳 己丑 丙子 | 丑≠亥子; 巳≠午; 子 | cold+moist + 丙 clear; 한난·조습 동시 |
| w1fr-07 | s8-sin-mi-sang | 庚子 己未 辛卯 | 未·子 hidden | warm+dry; hidden 水만 → 조습? |
| w1fr-08 | s9-gap-sul-mugun | 丙午 戊戌 甲申 | 午 branch火; 申中壬 | dry; 丙 clear; hidden 水 |

**제외 (기존 fixture 풀):**
- s13/s14/s7/s1/s10/s8/s9 외 寅·午·亥·辰·丑·未·戌 슬롯은 위 8건으로 커버
- s3, s11, s12 등 — 08(申壬)·01(寅) 등과 중복
- cli-case-* 전용 명식 — s1/s7/s8/s9/s10과 동일 원국 우선
- 신규 명식 — 금지

---

## 7. Leakage check

### 전문가 패키지에 **없어야** 함

| 항목 | expert-blind-package |
|---|---|
| G5 / G6 / W1-G5 / W1-G6 명칭 | absent |
| CLI-011~012, CLI-018/019/036/037, CLI-002 등 rule ID | absent |
| literature verdict / CONTESTED / PARTIALLY-SUPPORTED | absent |
| engine enum: warm, cold, balanced, dry, moist | absent |
| adjustedClimate / fireQuality / waterQuality / expected | absent |
| source fixture id (s13-, s7-, …) | absent |
| blind 선정 목적 (餘寒, branch-only, …) | absent |
| operator-mapping.md, inventory.json | absent |
| E3 패널 조건 | absent |

### 전문가 패키지에 **있어도** 됨

- 조후·한난·조습·火·水·지장간·본기·通根·투출 (일반 명리 용어)
- 월령·전국 기후 **전제** (baseline 재판정 아님)
- blind case id `w1fr-01` … `w1fr-08`

### Scan (prep stage)

| check | result |
|---|---|
| CLI-* in expert-blind-package.md | **absent** |
| G5/G6 group names | **absent** |
| warm/cold/balanced/dry/moist | **absent** |
| literatureVerdict | **absent** |
| sourceFixtureIds | **absent** |
| selection purpose in case headers | **absent** |
| expert answers | **0** |

---

## 8. 패널

| Expert | status |
|---|---|
| E1 | active |
| E2 | active |
| E3 | **unavailable** — 제외, 백필·추정 없음 |
| E4 | active |

응답: E1 ×1, E2 ×1, E4 ×1 → **총 3회**로 라운드 종료.

---

## 9. 하지 않은 것

- Batch 5/6 literature 재작성
- 엔진 / FIRE_BRANCHES / adjustPolar / freezeStatus
- 전문가 답 생성
- G5·G6 comparison / closure
- G1~G4 재오픈
- 점수·가중치·threshold
