# Wave 1 Literature Final Audit

엔진 판단 코드는 이 문서로 바꾸지 않는다.
기존 Batch 1–6 rule verdict / freezeStatus / method를 바꾸지 않는다.
SUPPORTED로 승격하지 않는다.
전문가 답을 생성하지 않는다.
Wave 2로 진행하지 않는다.

**목적:** Wave 1 BOTH 19개에 대한 Batch 1–6 문헌 검증 산출물을 **종합 감사**한다.  
범위는 기존 Batch 문서·inventory만이다.

근거:
- `wave1-literature-prep/wave1-literature-validation-prep.md` (BOTH 19)
- `wave1-literature-validation/batch-1` … `batch-6` md + inventory
- Batch 1 evidence hardening (verdict 불변, confidence MEDIUM 확정)

---

## A. Coverage — BOTH 19 / 6 groups

| group | batch | rule IDs | 수 |
|---|---|---|---:|
| W1-G1-SHISHEN-SIDE | 1 (+ hardening) | STR-010, STR-011 | 2 |
| W1-G2-SEASON-PHASE | 2 | STR-022, STR-024 | 2 |
| W1-G3-ROOT-DEPTH | 3 | STR-030-clear, STR-030-present, STR-030-shallow | 3 |
| W1-G4-MONTH-CLIMATE | 4 | CLI-002, CLI-003a, CLI-003b, CLI-003c, CLI-003d, CLI-004 | 6 |
| W1-G5-BRANCH-FIRE-WATER | 5 | CLI-011, CLI-012 | 2 |
| W1-G6-CLIMATE-ADJUST | 6 | CLI-018, CLI-019, CLI-036, CLI-037 | 4 |
| **합계** | | | **19** |

Prep BOTH 목록과 대조: **누락 0 / 초과 0**.

---

## B. Canonical literature rollup (Batch 원문과 일치)

| ruleId | batch | literatureVerdict | evidenceConfidence | expertStillRequired |
|---|---|---|---|---|
| STR-010 | 1 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| STR-011 | 1 | CONTESTED | MEDIUM | YES |
| STR-022 | 2 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| STR-024 | 2 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| STR-030-clear | 3 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| STR-030-present | 3 | CONTESTED | MEDIUM | YES |
| STR-030-shallow | 3 | CONTESTED | MEDIUM | YES |
| CLI-002 | 4 | CONTESTED | MEDIUM | YES |
| CLI-003a | 4 | CONTESTED | MEDIUM | YES |
| CLI-003b | 4 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| CLI-003c | 4 | CONTESTED | MEDIUM | YES |
| CLI-003d | 4 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| CLI-004 | 4 | CONTESTED | MEDIUM | YES |
| CLI-011 | 5 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| CLI-012 | 5 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| CLI-018 | 6 | PARTIALLY-SUPPORTED | MEDIUM | YES |
| CLI-019 | 6 | CONTESTED | MEDIUM | YES |
| CLI-036 | 6 | CONTESTED | MEDIUM | YES |
| CLI-037 | 6 | CONTESTED | MEDIUM | YES |

**집계**

| verdict | 수 |
|---|---:|
| SUPPORTED | **0** |
| PARTIALLY-SUPPORTED | **9** |
| CONTESTED | **10** |
| INSUFFICIENT-EVIDENCE | **0** |
| CONTRADICTED | **0** |

MD 요약표 ↔ inventory `rules`/`verdicts` 대조: **불일치 없음**.  
후속 Batch `preservedFromPriorBatches`: **원 Batch verdict와 불일치 없음**.

---

## C. Audit checks

### C1. SUPPORTED 오승격

전 Batch `SUPPORTED` count = 0.  
SUPPORTED로 올린 rule **없음**. PASS.

### C2. CONTESTED vs INSUFFICIENT-EVIDENCE

전 Batch `INSUFFICIENT_EVIDENCE` = 0.  
근거가 약한·충돌하는 경우 CONTESTED 또는 PARTIALLY-SUPPORTED로만 기록.  
두 라벨 **혼용·치환 없음**. PASS.

### C3. Literature vs Expert 분리

19개 모두 method=BOTH.  
문헌 verdict가 나와도 `expertStillRequired` / `expertValidationRequired` = YES 유지.  
VERIFIED-FACT / freezeStatus 변경 없음.  
Pilot 5 expert answers = 0 (생성 없음). PASS.

### C4. Dependency / upstream 불확실성 과장 여부

| 관계 | 기록 | 감사 |
|---|---|---|
| G4 CLI-002 CONTESTED → G6 | Batch 6: G6를 SUPPORTED로 올리지 않음. CLI-002 verdict 미변경 | 적절. 과장 없음 |
| CLI-018 PARTIALLY-SUPPORTED under CLI-002 CONTESTED | 한난 **방향 관념**만 부분 지지. 표 적용·한 칸 balanced는 limiting | 상류 CONTESTED를 “방향 개념도 전부 무효”로 과장하지 않음 |
| G5 ↔ G6 | inventory에 G6 dependsOn G5 없음. Batch 5/6이 새 간선 미작성 | 적절 |
| G3 STR-005 FACT ≠ STR-030 깊이 | Batch 3이 hit 존재와 깊이 라벨 분리 | 적절 |

**새 dependency 발명 없음.** PASS.

### C5. Unresolved 누락 / 시효

Batch별 unresolved는 inventory에 있다 (B1:4, B2:4, B3:5, B4:5, B5:5, B6:5).

**시효 갱신 (verdict 변경 아님):**

| id | 상태 |
|---|---|
| W1B4-U5-G6-CLI-018-019-not-judged | Batch 6 완료로 **문헌 판정 완료**. 이슈 자체는 “미판정”이 아님 → superseded |
| W1B5-U5-quality-and-G6-unjudged | G6 문헌 판정은 완료. **quality(CLI-021+)는 여전히 EXPERT 미판정** → partially open |

나머지 unresolved는 여전히 open (FACT≠해석, 교감, 일간×월령 미매핑, 土 factor, quality 게이트 등).

### C6. Schema note (비차단)

Batch 1 inventory는 `verdicts[].literatureEvidenceVerdict` 키를 쓰고, Batch 2–6은 `rules[].literatureVerdict`를 쓴다.  
값·의미는 일치. Final inventory는 후자 키로 rollup한다. **verdict를 바꾸지 않음.**

---

## D. Wave 1 Literature 상태 요약

- Wave 1 BOTH 문헌 검증 **1차 완료** (19/19).
- 문헌만으로 엔진 규칙·freeze를 닫지 않음.
- 다음 가능 단계(이 문서에서 실행하지 않음): Expert Blind (Pilot 5 외 확장), Wave 2 Need 층, quality EXPERT 규칙.
- 엔진 코드·expected·점수·Needed Element: 이 감사에서 **비변경**.

---

## E. 하지 않은 것

- Batch 1–6 파일 수정·삭제
- rule verdict / freezeStatus / 엔진 코드 변경
- 전문가 답 생성
- Wave 2 시작
