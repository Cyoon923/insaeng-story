# G6 CLIMATE-ADJUST Closure — CLI-018 / CLI-019 / CLI-036 / CLI-037

엔진 코드·CLI-* literature verdict·freezeStatus·`adjustPolar`/`temperatureRole`/`moistureRole`는 이 문서로 바꾸지 않는다.  
VERIFIED 승격·점수·가중치·threshold·동일 함수 정답화·추가 설문 금지.  
다수결 ≠ 정답. 문헌+전문가를 하나의 정답으로 합치지 않는다 — **검증 경계만 닫는다.**  
E3 추정·백필 없음. G1~G4 재작업 없음. CLI-002 CONTESTED 상류는 **유지** (재판정 없음).

**근거:**
- `wave1-batch-6-literature-validation.md`
- `wave1-batch-6-literature-inventory.json`
- `expert-results/g6-expert-evidence.md`
- `../final-expert-round/expert-results/final-expert-comparison.md`
- `../final-expert-round/expert-results/raw/E1-raw.md`
- `../final-expert-round/expert-results/raw/E2-raw.md`
- `../final-expert-round/expert-results/raw/E4-raw.md`
- `../final-expert-round/operator-mapping.md`

**Literature 층 (변경 없음):**
| rule | literature verdict | confidence |
|---|---|---|
| CLI-018 | PARTIALLY-SUPPORTED | MEDIUM |
| CLI-019 | CONTESTED | MEDIUM |
| CLI-036 | CONTESTED | MEDIUM |
| CLI-037 | CONTESTED | MEDIUM |

---

## 0. Closure 판정

| 항목 | 판정 |
|---|---|
| G6 expert validation **경계 종료 가능** | **예** |
| CLI-018/019/036/037 **VERIFIED** | **금지 · 하지 않음** |
| Literature verdict 변경 | **하지 않음** |
| freezeStatus / 엔진 / adjustPolar 변경 | **하지 않음** |
| 한난·조습 **동일 함수** 정답화 | **금지** |
| clear→balanced 한 칸 확정 | **금지** |
| CLI-002 재판정 | **하지 않음** |
| E3 백필 · 추가 설문 | **하지 않음** |

**G6 최종:** **CLOSE**

**의미:** 문헌(Batch 6) + 통합 전문가 round의 G6 evidence로 **말할 수 있는 / 없는 / policy unresolved**가 문서화됨.  
**CLOSE = 검증 경계 종료.** 규칙 확정·VERIFIED·G6 SUPPORTED 승격이 **아님** (상류 CLI-002 CONTESTED 유지).

---

## 1. 말할 수 있음 (speakable)

| ID | 내용 |
|---|---|
| S1 | 한난에서 火/水의 **기본 방향**(寒에 火·熱에 水)은 인정할 수 있다. |
| S2 | **존재**와 **실제 조절**은 구분된다. |
| S3 | 조습 판단에 **土(濕土/燥土)** 를 무시하기 어렵다. |
| S4 | **한난 조절**과 **조습 조절**을 **동일 규칙/단일 함수**로 확정할 수 없다. |
| S5 | 조절에는 **투출·通根·득기** 등 세기 조건이 필요하며, 단순 존재만으로는 부족하다. |
| S6 | 조절 판단에 **월령(기후 배경)** 이 필요하다. |

---

## 2. 말할 수 없음

| ID | 내용 |
|---|---|
| N1 | CLI-018 전제(표 lookup + clear 한 칸 + 일간 무시) **VERIFIED** |
| N2 | 조습을 **火/水 역할표만**으로 닫는 규칙 **VERIFIED** |
| N3 | moist/cold · dry/warm에 **동일 adjustPolar** **VERIFIED** |
| N4 | clear mitigation → `balanced` **한 칸** 폭 **VERIFIED** |
| N5 | quality clear/substantial **게이트 수치** |
| N6 | 일간×월령 조후를 엔진 overlay로 매핑하는 **확정 설계** |
| N7 | Case 05/06 등 **최종 한난·조습 우세 라벨** |
| N8 | CLI-032 / CLI-054 (본 라운드 비대상) |

---

## 3. Policy unresolved

| ID | Policy |
|---|---|
| P1 | temperature regulation vs moisture regulation을 엔진에서 **분리할지** (동일 함수 유지 vs 분리) |
| P2 | 土(濕土/燥土)를 Climate **moisture factor**로 넣을지 (vs CLI-013) |
| P3 | 조절 **세기 게이트** (quality / 투출·통근) 정책 |
| P4 | **일간**을 G6 조절에 넣을 범위 |
| P5 | CLI-002 CONTESTED 표 위에서 G6를 **baseline-only 문서화**할지 / G6 적용을 제한할지 |
| P6 | CLI-032 폭 · CLI-054 양축 동시 (별도 미판정) |

Open disagreement:

| ID | 쟁점 | 상태 |
|---|---|---|
| OD-1 | 일간을 조절 판정 본체에 넣는 깊이 | **open** (P4) |
| OD-G6-05 | Case 05 한난 우세 프레임 | **open** (N7) |
| OD-G6-06 | Case 06 한난 완화 정도 | **open** (N7) |

---

## 4. DQ / evidence boundary

| ID | 경계 |
|---|---|
| DQ-1 | E3 unavailable · 백필 금지 |
| DQ-2 | E1/E2/E4 AI 자기보고 |
| DQ-3 | Literature ≠ expert 합쳐 VERIFIED 금지 |
| DQ-4 | E2 엔진 변수 제안 · E1 용신 언어 — 정책 확정 금지 |
| DQ-5 | W1B6-U1 (CLI-002)는 **상류 unresolved**로 유지; 본 CLOSE가 CLI-002를 닫지 않음 |

---

## 5. 엔진 긴장 (observation only · 변경 없음)

| 긴장 | 비고 |
|---|---|
| temperatureRole 寒←火 / 熱←水 | S1 방향과 부분 정렬 |
| moistureRole 火水만 · 土 제외 | S3과 긴장 (P2) |
| 한난·조습 **동일 adjustPolar** | S4와 긴장 (P1); CLI-036/037 CONTESTED 유지 |
| quality clear 전 base 유지 | S2·S5와 개념 정렬; 게이트 확정은 P3 |
| 일간 무시 | OD-1 / P4 |
| CLI-002 표 위 조정 | P5 · SUPPORTED 불가 유지 |

---

## 6. 다음 단계 (이번 문서 밖)

1. Policy 메모 P1–P6 (코드 없이).
2. Downstream Need / adjusted 해석 시 G6를 **방향·경계 문서**로만 읽을지.
3. Wave 2 · 인간 재수집 — 별도 지시.
4. CLI-002 / G4 unresolved는 **G4 closure**에 남김.

**금지 재확인:** 엔진·CLI/STR/freeze · VERIFIED · 점수 · 동일 함수 정답화 · 추가 설문 · G1~G5 재오픈(G5는 별도 CLOSE).
