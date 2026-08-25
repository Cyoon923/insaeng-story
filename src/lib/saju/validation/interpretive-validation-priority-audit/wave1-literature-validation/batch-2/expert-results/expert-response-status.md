# G2 SEASON-PHASE — Expert Response Collection Status

근거: `batch-2/expert-results/raw/G2-E{1..4}-raw.md` 파일 존재 및 본문 구조만.
판정 비교·합의·오류 수정·누락 보완 없음.
STR / engine / literature / verdict 미변경.

점검일: 2026-08-25

---

## 파일 존재

| expert | path | exists |
|---|---|---|
| E1 | `raw/G2-E1-raw.md` | yes |
| E2 | `raw/G2-E2-raw.md` | yes |
| E3 | `raw/G2-E3-raw.md` | yes |
| E4 | `raw/G2-E4-raw.md` | yes |

---

## Phase A / B / C 수집 상태

판정 기준 (raw 본문만):

- **Phase A 수집**: `Phase A` 구간과 A-1~A-6(또는 동등 표기) 응답 본문 존재
- **Phase B 수집**: `Phase B` 구간 응답 본문 존재
- **Phase C 7건 수집**: 명식 1~7 각각에 대해 독립 판정 본문(예: 최종 일간 세력 서술) 존재
- **Phase C 미수집**: Phase C 제목만 있거나, 원국 미제시로 판정 보류만 있고 명식 1~7 판정 본문 없음

| expert | Phase A | Phase B | Phase C (7건) | 비고 (raw 근거) |
|---|---|---|---|---|
| E1 | 수집 | 수집 | 수집 | `## Phase A` / `## Phase B` / `### [명식 1]` … `### [명식 7]` |
| E2 | 수집 | 수집 | 수집 | `Phase A` / `Phase B` 후 `명식 1` … `명식 7` 판정 본문 존재 (동일 파일 내 후속 판정 포함) |
| E3 | 수집 | 수집 | **미수집** | `## Phase A` / `## Phase B` 있음. `## Phase C`는 원국 미제시로 판정 보류만 기술. 명식 1~7 독립 판정 본문 없음 |
| E4 | 수집 | 수집 | 수집 | `# Phase A` / `# Phase B` 후 `### [명식 1]` … `### [명식 7]` 판정 본문 존재 (동일 파일 내 후속 판정 포함) |

---

## E3 Phase C

**E3 Phase C 미수집: 예**

raw 근거:

- Phase C 절에서 7개 명식 원국이 메시지에 없다고 명시
- 명식별 ①②③④ 판정 본문 없음
- 원국 수령 후 판정하겠다는 보류 문구만 존재

---

## 집계

| 항목 | 수 |
|---|---:|
| raw 파일 존재 | 4 / 4 |
| Phase A 수집 | 4 |
| Phase B 수집 | 4 |
| Phase C 7건 수집 | 3 (E1, E2, E4) |
| Phase C 미수집 | 1 (E3) |
