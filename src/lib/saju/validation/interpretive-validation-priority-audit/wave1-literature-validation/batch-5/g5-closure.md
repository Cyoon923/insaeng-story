# G5 BRANCH-FIRE-WATER Closure — CLI-011 / CLI-012

엔진 코드·CLI-* literature verdict·freezeStatus·`FIRE_BRANCHES`/`WATER_BRANCHES`는 이 문서로 바꾸지 않는다.  
VERIFIED 승격·점수·가중치·threshold·본기 목록 외 확장 정답화·추가 설문 금지.  
다수결 ≠ 정답. 문헌+전문가를 하나의 정답으로 합치지 않는다 — **검증 경계만 닫는다.**  
E3 추정·백필 없음. G1~G4 재작업 없음.

**근거:**
- `wave1-batch-5-literature-validation.md`
- `wave1-batch-5-literature-inventory.json`
- `expert-results/g5-expert-evidence.md`
- `../final-expert-round/expert-results/final-expert-comparison.md`
- `../final-expert-round/expert-results/raw/E1-raw.md`
- `../final-expert-round/expert-results/raw/E2-raw.md`
- `../final-expert-round/expert-results/raw/E4-raw.md`
- `../final-expert-round/operator-mapping.md`

**Literature 층 (변경 없음):**
| rule | literature verdict | confidence |
|---|---|---|
| CLI-011 | PARTIALLY-SUPPORTED | MEDIUM |
| CLI-012 | PARTIALLY-SUPPORTED | MEDIUM |

---

## 0. Closure 판정

| 항목 | 판정 |
|---|---|
| G5 expert validation **경계 종료 가능** | **예** |
| CLI-011 / CLI-012 **VERIFIED** | **금지 · 하지 않음** |
| Literature verdict 변경 | **하지 않음** |
| freezeStatus / 엔진 변경 | **하지 않음** |
| 삼합·장생을 본기 목록에 넣는 정답화 | **금지** |
| 월지 고정 배율 확정 | **금지** |
| E3 백필 | **하지 않음** |
| 추가 전문가 설문 | **하지 않음** |

**G5 최종:** **CLOSE**

**의미:** 문헌(Batch 5) + 통합 전문가 round에서 G5에 해당하는 observation으로 **말할 수 있는 / 없는 / policy unresolved**가 문서화됨.  
**CLOSE = 검증 경계 종료.** 규칙 확정·VERIFIED가 **아님**.

---

## 1. 말할 수 있음 (speakable)

| ID | 내용 |
|---|---|
| S1 | 지지 **본기** 火 수집은 **巳·午**에 한정할 수 있다 (寅中丙 등을 본기 火支로 치지 않음). |
| S2 | 지지 **본기** 水 수집은 **亥·子**에 한정할 수 있다 (辰中癸·丑 등을 본기 水支로 치지 않음). |
| S3 | **지장간** 火/水는 본기와 **다른 층**이다. |
| S4 | **삼합·장생**만으로 寅·戌·申·辰 등을 본기 火/水 **수집 목록에 직접 편입하지 않는다**. |
| S5 | 火/水 **존재**와 **실제 조후 조절**은 구분된다 (수집 ≠ 조절 절차). |
| S6 | **월지** 火/水와 **년·일·시** 지지 火/水를 **동일 비중**으로 취급하기 어렵다. |

---

## 2. 말할 수 없음

| ID | 내용 |
|---|---|
| N1 | CLI-011/012를 조후 **전용 수집 표**로 **VERIFIED** |
| N2 | 삼합·장생의 **고정 활성화 공식** |
| N3 | 지장간 火/水 **고정 점수/층위 가중** (본기>중기>여기 수치화) |
| N4 | 월지 vs 타 지지 **고정 배율** (예: 2~3배) |
| N5 | CLI-014 월지 본기 생략의 **문헌 확정** |
| N6 | quality 등급(CLI-021+) **확정** |

---

## 3. Policy unresolved

| ID | Policy |
|---|---|
| P1 | 삼합 성립 후 火/水를 **별도 activation layer**로 둘지 / 세력 환산할지 |
| P2 | 지장간 火/水의 **유효 세기** 정책 (투출·합·충 게이트) — quality와 연결 |
| P3 | 월지 vs 타 지지 **위치 가중** (고정비 vs 정성) |
| P4 | CLI-014 월지 branch factor 생략을 **유지할지** |
| P5 | 계절 무관 고정 巳午/亥子 수집 vs 조후 작용의 계절 의존을 엔진에서 **어떻게 분리 문서화할지** |

Open disagreement:

| ID | 쟁점 | 상태 |
|---|---|---|
| OD-G5-A10 | 월지 가중 표현 (고정비 vs 역전 가능) | **open** (P3 · N4) |
| OD-G5-A3 | 삼합 완합 시 “환산” 강도 | **open** (P1) |

---

## 4. DQ / evidence boundary

| ID | 경계 |
|---|---|
| DQ-1 | E3 unavailable · 백필 금지 |
| DQ-2 | E1/E2/E4 AI 자기보고 · 인간 전문가 과대표현 금지 |
| DQ-3 | Literature ≠ expert 합쳐 VERIFIED 금지 |
| DQ-4 | E1 2~3배 수치 · E2 엔진 메타 — 정책 확정 금지 |

---

## 5. 엔진 긴장 (observation only · 변경 없음)

| 긴장 | 비고 |
|---|---|
| FIRE_BRANCHES={巳,午} / WATER={亥,子} | Expert S1–S2와 목록 정렬 |
| hiddenStem ≠ branch | S3 정렬 |
| 삼합·장생으로 branch 미확장 | S4 정렬 |
| 존재 수집 ≠ adjustPolar | S5; 조절은 G6 |
| 전 지지 슬롯 동일 취급 가능 | S6과 긴장 (P3) |

---

## 6. 다음 단계 (이번 문서 밖)

1. Policy 메모 P1–P5 (코드 없이).
2. G6 closure는 **별도** (이미 병행 가능).
3. Wave 2 / Need / quality 등급 — 별도 지시 시에만.
4. 인간 전문가 재수집은 **새 라운드**만.

**금지 재확인:** 엔진·CLI/STR/freeze · VERIFIED · 점수 · 추가 설문 · G1~G4 재오픈.
