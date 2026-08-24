# Strength Rule Audit

이 문서는 현재 엔진 동작을 보존한 채 규칙을 분류한다.
Strength 판단 결과를 바꾸지 않는다. 새 규칙을 추가하지 않는다.

**Strength 단계 상태:** 사실층 검증 완료 + 보수 정책 경계 확정 + 해석층 검증 대기.

완전 검증 완료가 아니다.

---

## 원재료 ≠ 해석

금지된 연결:

- 왕상휴수사 표가 맞다 → Strength direction이 맞다
- 통근 hit가 맞다 → 통근 영향력이 맞다
- 십신 라벨이 맞다 → 관/재/식상이 약화 pressure다

Rule-table 332행 match는 STR-001~006(FACT)만 덮는다.

---

## 코드 경로

`confirmedSlots` → `analyzeStemRoots` / `analyzeElementPresence` / `shiShenOf` / `seasonPhaseOf` → `collectStrengthEvidence` → `buildStrengthSummary.decideDirection` → (소비) `buildNeedCandidateSet`이 `directionCandidate`만 읽음.

`mixedPattern` / `mixedConflictLevel` / `unresolvedStrengthReasons`는 Need에 들어가지 않는다.

---

## 분류 요약

| freezeStatus | 수 |
|---|---:|
| VERIFIED-FACT | 6 |
| FROZEN-POLICY | 32 |
| REQUIRES-INTERPRETIVE-VALIDATION | 21 |
| OPEN | 1 |
| **합계** | **60** |

상세는 `strength-rule-inventory.json`.

---

## directionCandidate

| 값 | 코드 조건 | 신뢰 |
|---|---|---|
| leaning-strong | 왕 ∧ clear ∧ RV support ∧ ¬RV pressure | FACT lookup + 해석 마감(STR-050) |
| leaning-weak | (사∨수) ∧ absent ∧ RV pressure ∧ ¬RV support | 동일 (STR-051) |
| mixed | substantialStrong ∧ substantialWeak (명시 분기 052–054는 055에 흡수 가능) | 엔진 진단. 최종 신강/신약 아님 |
| null | 위 미해당 | 오류가 아님. 보수적 미마감 |

directionCandidate 전체를 검증 완료로 표시하지 않는다.

---

## mixed / unresolved 메타

- mixedPattern: 진단 라벨. 방향·Need 불변. 용신 아님.
- mixedConflictLevel: 진단. 점수 아님.
- unresolvedStrengthReasons: direction이 이미 null인 뒤의 설명. 방향을 만들지 않음.
- hour-unknown-sensitive: 약/강을 만들지 않음.
- mixed 또는 null → Strength Need 후보 없음 (STR-071, 보수 정책).

---

## Evidence 중복

score/weight 없음. boolean OR/AND만 있다.

- 왕 월지는 구조적으로 월지 정기가 같은 오행(rule-table wang-month-root). leaning-strong은 왕∧clear를 AND로 요구 → 관련 사실의 중첩 조건. 가산점은 아님. 해석 검증 대상.
- substantialStrong = 왕 ∨ rootedRoot ∨ RV support. 여러 경로가 같은 boolean을 true로 만든다. 중복 강화 점수는 아님. OR 설계 자체는 해석 검증 대상(STR-055).
- hidden support와 root는 sourceKey로 note 중복을 제거(STR-044). 방향에는 hidden 미사용.

---

## 숨은 점수

`strengthSummary` / `strength.ts` / Strength 관련 types에 score, weight, rank, winner, neededElement, yongsin, heesin 없음.

Need 층의 `strength-three-way-unranked`는 Strength 점수가 아니다.
