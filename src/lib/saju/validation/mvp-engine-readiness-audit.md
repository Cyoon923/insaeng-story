# MVP Engine Readiness Audit — 운율 / 사주 인생곡

추가 검증 목록이 아니다. Wave 1~3 · CL-NEED-HOUR · OPEN DEFER · 기존 freeze를 기준으로, **MVP 엔진 완성까지 실제로 막는 것만** 찾는다.

**하지 않음:** 문헌/전문가 추가 · 코드 수정 · unresolved 임의 해결 · 점수/가중 · closure 재작업.

**제품 전제 (관측):** 사주 인생곡 = 사주 정보 + 이야기 + 음악 취향 → 가사/곡. 신청 UI는 draft만 저장하며 **엔진 미호출**.

---

## 분류 범례

| Code | 의미 |
|---|---|
| **A** | 구현 + 검증 경계 확보 (VERIFIED 아님) |
| **B** | 구현됐으나 policy unresolved / 확정 노출 불가 |
| **C** | 미구현 · **MVP 필수** |
| **D** | 미구현 · MVP 후순위 |
| **E** | dead / DEFER |

---

## 1. 원국 계산

| | |
|---|---|
| **Class** | **A** |
| **구현** | `buildFourPillars` — 양력/음력, 절기, 년월일시주, 시주 unknown, 경고 |
| **validation** | calculation/rule-table 테스트 · FACT 층. interpretive Wave 대상 아님 |
| **MVP blocker** | **아니오** |
| **다음 최소 1개** | 신청 플로우에 `BirthInput` → pillars 배선 (제품 통합; 엔진 미구현 아님) |

---

## 2. 대운

| | |
|---|---|
| **Class** | **D** |
| **구현** | **없음** (`src/lib/saju`에 대운 모듈 0) |
| **validation** | 해당 없음 |
| **MVP blocker** | **아니오** (가사 MVP는 원국+이야기  Provisional 테마로 가능. “사주 흐름” 카피는 **후속 운 엔진** 범위) |
| **다음 최소 1개** | MVP 후 대운 시작점·순행/역행 정책 문서 1장 → 구현 |

---

## 3. 세운

| | |
|---|---|
| **Class** | **D** |
| **구현** | **없음** |
| **MVP blocker** | **아니오** |
| **다음 최소 1개** | 대운 이후 세운 겹침 규칙 |

---

## 4. 월운

| | |
|---|---|
| **Class** | **D** |
| **구현** | **없음** |
| **MVP blocker** | **아니오** |
| **다음 최소 1개** | 세운 이후 |

---

## 5. 일운

| | |
|---|---|
| **Class** | **D** |
| **구현** | **없음** |
| **MVP blocker** | **아니오** |
| **다음 최소 1개** | 최후순위 |

---

## 6. Strength

| | |
|---|---|
| **Class** | **B** (경계 A + 정책 B) |
| **구현** | `buildStrengthSummary` — leaning / mixed / null, certainty, `directionSensitivity` |
| **validation** | Wave 1 G1–G3 경계 CLOSE. VERIFIED 아님. Registry A/B/E 다수 POLICY-UNRESOLVED. CL-NEED-HOUR로 hour-unknown provisional **구현됨** |
| **MVP blocker** | **아니오** — freeze: 최종 신강 단정·용신 금지. **잠정/진단** 테마 입력으로는 사용 가능 |
| **다음 최소 1개** | speakable 매핑에서 leaning·partial·provisional만 허용 (단정 카피 금지) |

---

## 7. Climate

| | |
|---|---|
| **Class** | **B** |
| **구현** | `collectClimateEvidence` + `buildAdjustedClimateSummary` |
| **validation** | Wave 1 G4–G6 CLOSE. CLI-002/019/037 등 CONTESTED·PARTIAL 유지. “한습합니다” 최종 노출 **불가** (climate freeze) |
| **MVP blocker** | **아니오** — 조후 **잠정 힌트**만 |
| **다음 최소 1개** | cold/warm/dry를 가사 분위기 힌트로만 매핑 (확정 기후 문구 금지) |

---

## 8. Need

| | |
|---|---|
| **Class** | **B** |
| **구현** | `buildNeedCandidateSet` — Strength/Climate 후보, CL-NEED-HOUR gate |
| **validation** | Wave 2 CLOSE. NEED-015 POLICY-UNRESOLVED. NEED-022 contested 상속. 후보 ≠ Needed Element/용신 |
| **MVP blocker** | **아니오** — 후보 목록을 최종 오행으로 쓰면 **위반**. 잠정 테마 재료로는 가능 |
| **다음 최소 1개** | 후보·reason을 lyric theme bag에 넣고 “확정 필요 오행” 라벨 금지 |

---

## 9. NeedResolution

| | |
|---|---|
| **Class** | **A** (semantic) / 노출은 **B** |
| **구현** | `buildNeedResolution` — pattern/status/blockers |
| **validation** | Wave 3 CLOSE — product/semantic 경계. VERIFIED 아님 |
| **MVP blocker** | **아니오** — status를 사용자 최종으로 쓰면 안 됨 (indeterminate≠필요없음 등) |
| **다음 최소 1개** | Wave 3 금지 번역을 speakable 레이어에 고정 |

---

## 10. 사용자용 최종 메시지 / 음악 추천 출력

| | |
|---|---|
| **Class** | **C** |
| **구현** | **없음.** winner/neededElement/yongsin/음악 추천 API 없음. `validationReport`는 내부 진단. 신청 UI는 엔진 미연결 |
| **validation** | freeze가 **최종 사용자 결론 경로를 명시적으로 비워 둠** |
| **MVP blocker** | **예** |
| **이유** | 엔진 계층은 “검증 경계 CLOSE”이나, 가사/추천에 넣을 **안전한 speakable 계약·어댑터가 없어** 원국→음악 파이프라인이 완성되지 않음. 날것 status/후보를 UI에 붙이면 freeze 위반 |
| **다음 최소 1개** | **Speakable output contract 1장 + 최소 어댑터 스펙** (입력: Strength/Climate/Need/Resolution + hourUnknown; 출력: 잠정 테마 키·금지 문구; 용신/최종 오행 필드 없음) |

---

## Cross-cutting (참고 · 비blocker)

| 항목 | Class | MVP |
|---|---|---|
| CL-NEED-HOUR | A (구현+정책) | 시간 미상 Strength Need gated — 유지 |
| Wave 1 POLICY-UNRESOLVED 28 | B | 잠정 노출 전제면 MVP 비차단 |
| NEED-015 | B | mixed 미도달·억제 미검증 — 확정 억제 카피만 금지 |
| CLI-049↔NEED-027↔RES-028 | **E DEFER** | 비차단 (impact audit) |
| OPEN 기타 | E/D | 비차단 |

---

## MVP blocker 요약

| # | Blocker | Class |
|---|---|---|
| 1 | **Speakable / 음악 추천 출력 계층 부재** | C |

운 사이클(대운~일운)은 미구현이나 **가사 MVP 필수로 보지 않음** (D).  
Strength/Climate/Need/Resolution은 **구현·경계 있음**, 확정 노출만 금지 (B) → blocker 아님.

---

## 바로 UI/음악 개발?

| | |
|---|---|
| 이야기·스타일·결제 UI | **가능** (이미 draft 중심) |
| 엔진 raw → “용신/확정 오행/convergent=정답” UI | **불가** |
| 엔진 → 잠정 테마 → 작사 프롬프트 | **speakable contract 후에만** |

---

## 하지 않은 것

코드/정책 해결 · 문헌/전문가 · closure 재오픈 · 운 엔진 설계 착수
