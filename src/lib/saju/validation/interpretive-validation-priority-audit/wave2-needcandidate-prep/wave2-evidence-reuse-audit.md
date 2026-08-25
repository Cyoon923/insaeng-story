# Wave 2 NeedCandidate — Evidence Reuse Audit

엔진 코드·rule ID 병합·VERIFIED 승격·점수/threshold·Wave 2 본검증·Wave 3·신규 전문가 설문은 이 문서로 하지 않는다.

**목적:** Wave 2(NEED-009/010/011/015/020/021/022) 착수 전, Wave 1 evidence를 재사용해 **중복 검증을 막는다.**

**기준:** `interpretive-validation-priority-audit.md`  
**정책 전제 (이미 적용, 재결정 아님):** CL-NEED-HOUR — hour unknown + leaning-* 는 Strength provisional 유지, Strength Need gated/unresolved (`c96b6ec`).

**분류**

| Code | 의미 |
|---|---|
| **A** | Wave 1 evidence로 해당 Need 판단을 재사용 가능. 동일 명제 재설문/재문헌 금지 |
| **B** | 일부만 재사용. 최소 추가만 (문헌 데스크 대조 등). 전면 블라인드 금지 |
| **C** | Wave 1이 그 명제를 **직접** 검증하지 않음. 신규 검증 대상 |

**사실상 동일 판단 (ID 미합침)** — Audit §G:

| Need | 동일 판단 |
|---|---|
| NEED-010 / NEED-011 | STR-070 |
| NEED-020 | CLI-041 |
| NEED-021 | CLI-042 |
| NEED-022 | CLI-043 |

관련만 있고 동일 아님: STR-010/011 ↔ NEED-009.

**Wave 1 ID 제외 메모 (RN-W1-001):** STR-070·CLI-041·042·043은 Wave 1 *rule ID*로 문헌 배치에 넣지 않았다. 아래는 **동일 판단의 상위 층(G1/G6 speakable)** 재사용이지, 그 ID를 VERIFIED로 승격하는 것이 아니다.

---

## NEED-009 — 십신 오행 맵 (인성=생아, 식상=내가생, 재=내가극, 관=극아)

| 항목 | 내용 |
|---|---|
| **Reuse class** | **B** |
| **method (Audit)** | LITERATURE only (전문가 열 아니오) |
| **1. upstream** | STR-003 (십신 라벨 FACT). 오행은 `stemElement` + RESOURCE/OUTPUT/WEALTH/OFFICIAL 상수 |
| **2. Wave 1 동일/유사** | **동일 아님.** G1은 십신을 Strength **support/pressure 묶음**(STR-010/011). NEED-009는 **일간 오행 → 생극 대상 오행** 표. Audit: “관련만” |
| **3. literature reuse** | STR-003 FACT; G1 문헌은 묶음이지 생극표가 아님. 생극(生我/我生/我克/克我)은 Wave 1 전용 대조 없음 |
| **4. expert reuse** | **없음 (불필요).** Audit이 전문가 대상이 아님. G1 전문가는 생극 lookup을 묻지 않음 |
| **5. 추가 검증** | **예 — 문헌 데스크 대조만** |
| **6. 남는 것** | 표준 오행 생극·십신 오행 대응이 코드 맵과 일치하는지 **문헌 표 1회 대조**. 용신·희신·순위 검증 **아님**. 전문가 설문 **아님** |

---

## NEED-010 — leaning-strong → 식상/재/관 3후보

| 항목 | 내용 |
|---|---|
| **Reuse class** | **A** |
| **동일 판단** | **STR-070** (미합침). 의존 STR-050, NEED-009 |
| **1. upstream** | STR-050 leaning-strong 게이트; STR-010/011 억부 방향; NEED-009 오행 맵; CL-NEED-HOUR (시주 미상이면 이 규칙 제품 경로 미도달) |
| **2. Wave 1 동일/유사** | G1 speakable: 식상·재·관 = 일간 **약화 거시 방향**. STR-070 = leaning일 때만 그 축을 Strength Need 후보로 연다. 억부 “신강 → 설기·재·관”과 **같은 판단**. STR-050 마감식 자체는 **미 VERIFIED** (upstream 게이트, Need 매핑 재검증 아님) |
| **3. literature reuse** | G1 STR-010 PARTIALLY-SUPPORTED · STR-011 CONTESTED — 거시 방향만. STR-070 전용 literature verdict **없음** (Wave 1 ID 제외). 재문헌 배치 금지 |
| **4. expert reuse** | G1 Phase1: 식재관 약화 거시 (재성 **기제**는 미확정 = A03, Need 3후보 재질문이 아님). 3개 **순위**는 Wave 3 RES-036 영역 |
| **5. 추가 검증** | **아니오** (매핑 명제). 전면 블라인드 **금지** |
| **6. 남는 것** | 없음. 하지 말 것: 신강=용신 단수, 식/재/관 가중, STR-050 재설문 |

---

## NEED-011 — leaning-weak → 비겁/인성

| 항목 | 내용 |
|---|---|
| **Reuse class** | **A** |
| **동일 판단** | **STR-070** (미합침). 의존 STR-051, NEED-009 |
| **1. upstream** | STR-051 leaning-weak; STR-010 비겁·인성 support; NEED-009; CL-NEED-HOUR 게이트 |
| **2. Wave 1 동일/유사** | G1 speakable: 비겁·인성 = **강화 방향**. STR-070 weak 분기와 **같은 판단**. STR-051은 미 VERIFIED 게이트 |
| **3. literature reuse** | G1 STR-010 PARTIALLY-SUPPORTED. STR-070 전용 verdict 없음 — 재문헌 금지 |
| **4. expert reuse** | G1: 비겁·인성 강화 방향. G2: 실령+통근 신강 가능 등은 **Strength 최종**이지 Need 오행 재질문이 아님 |
| **5. 추가 검증** | **아니오** |
| **6. 남는 것** | 없음. 하지 말 것: 신약=용신, peer=일간복사 재설문, STR-051 재설문 |

---

## NEED-015 — RV + 왕/상 → `already-established-relation` suppression

| 항목 | 내용 |
|---|---|
| **Reuse class** | **C** |
| **method (Audit)** | EXPERT (문헌 열 아니오) |
| **1. upstream** | NEED-010 (leaning-strong 후보만 suppressible); STR-026 (상=help, Strength 방향 미개방); STR-004 계절; STR-021 RV |
| **2. Wave 1 동일/유사** | **직접 검증 없음.** G2는 STR-022/024. STR-026/027은 **인접·미닫음** (g2-closure ENG-5, NV-G2-6). “상=Strength help only” ≠ “RV+왕/상이면 그 오행 Need를 suppressed” |
| **3. literature reuse** | 해당 명제 전용 Wave 1 문헌 없음 |
| **4. expert reuse** | G2 상/휴 라벨 분쟁은 Strength side. Need 억제 문항 **없음** |
| **5. 추가 검증** | **예** — 이 규칙만 |
| **6. 남는 것** | leaning-strong이고 해당 관계 오행이 **rooted-visible이며 월령 왕 또는 상**일 때, Need 후보를 `already-established-relation`로 억제하는가. 제품 경로: **mixed면 미도달**(NEED-018). 휴·수·사, leaning-weak 억제(NEED-017 정책) 확장 **금지**. Wave 1 G2 재검증 **금지** |

---

## NEED-020 — resolved cold → 火 (`climate-temperature-cold`)

| 항목 | 내용 |
|---|---|
| **Reuse class** | **A** |
| **동일 판단** | **CLI-041** (미합침) |
| **1. upstream** | CLI-018 + adjusted `temperature===cold` (CLI-032 폭은 G6 미판정 P6). G4 CLI-002 표는 CONTESTED (언제 cold가 되는지는 상류) |
| **2. Wave 1 동일/유사** | G6 S1: 한난 기본 방향 **寒에 火 · 熱에 水**. CLI-041과 **같은 판단**. CLI-041은 Wave 1 ID 제외·Batch 6 `notJudgedThisBatch` |
| **3. literature reuse** | CLI-018 PARTIALLY-SUPPORTED. 寒用火 거시. CLI-002 CONTESTED는 **cold 라벨 입력**이지 寒→火 방향 재질문이 아님 |
| **4. expert reuse** | G6 S1; G4 S3 한난≠조습; G5 S5 존재≠조절 (Need는 **resolved 이후** 오행) |
| **5. 추가 검증** | **아니오**. G6/G4 재설문·CLI-032 정답화 **금지** |
| **6. 남는 것** | 없음. 용신 아님. balanced/unresolved에서 후보 없음은 엔진 분기(재검증 아님) |

---

## NEED-021 — resolved warm → 水 (`climate-temperature-warm`)

| 항목 | 내용 |
|---|---|
| **Reuse class** | **A** |
| **동일 판단** | **CLI-042** (미합침) |
| **1. upstream** | CLI-018; adjusted `temperature===warm` |
| **2. Wave 1 동일/유사** | G6 S1 **熱에 水**. CLI-042와 **같은 판단** |
| **3. literature reuse** | CLI-018 PARTIALLY-SUPPORTED |
| **4. expert reuse** | G6 S1 |
| **5. 추가 검증** | **아니오** |
| **6. 남는 것** | 없음 |

---

## NEED-022 — resolved dry → 水 (`climate-moisture-dry`)

| 항목 | 내용 |
|---|---|
| **Reuse class** | **B** |
| **동일 판단** | **CLI-043** (미합침). NEED-021과 **별 규칙**(둘 다 水여도 합치지 않음) |
| **1. upstream** | CLI-019 · CLI-037; adjusted `moisture===dry`. G6: CLI-019/036/037 **CONTESTED**; S4 한난≠조습 동일 함수 확정 불가 |
| **2. Wave 1 동일/유사** | 조후 **燥에 水 완화**는 CLI-037/019 방향과 같음. 다만 G6 S1은 **한난**만 명시. 조습은 S3(土 무시 어려움)·CONTESTED로 **한난 Need만큼 speakable하지 않음** |
| **3. literature reuse** | Batch 6 CLI-037 CONTESTED. 재G6 문헌 배치 금지. 남는 것은 **燥→水 Need = CLI-043**이 G6 조습 경계에 묶인다는 **데스크 명시**뿐 |
| **4. expert reuse** | G6 조습 土·함수 분리. “燥이면 水 Need 후보” 단독 문항 **없음** — 전면 재설문 금지 |
| **5. 추가 검증** | **최소:** 문헌에서 燥喜水/潤燥가 NEED-021(暖用水)과 **다른 축의 같은 물**인지 데스크 1회 확인. 전문가 블라인드 **아님** |
| **6. 남는 것** | CLI-043/NEED-022를 G6 CONTESTED 조습 경로의 **Need 층 별칭**으로 문서화. 土 moisture factor(C11)·adjustPolar 분리(C10) 재결정 **금지**. moist→火(NEED-023, 정책) 확장 **금지** |

---

## 집계 (이번 audit)

| Class | Rules |
|---|---|
| **A** | NEED-010, NEED-011, NEED-020, NEED-021 |
| **B** | NEED-009, NEED-022 |
| **C** | NEED-015 |

| 질문 | 답 |
|---|---|
| 추가 검증이 있는 rule 수 (B+C) | **3** |
| 전면 Wave 2 전문가 블라인드 | **불필요** (A 4건 재사용 + B는 문헌 데스크) |
| 전문가 설문이 **정말** 필요한가 | **전면 라운드: 아니오.** 닫으려면 **NEED-015만** 최소 1문항. 지금 단계에서는 설문 실행 안 함 |

---

## 명시적 비목표

- 신규 전문가 설문 실행
- 엔진 수정 · VERIFIED · rule ID 병합 · 점수/threshold
- Wave 2 본검증 · Wave 3 RES
- G1~G6 재검증 · CL-NEED-HOUR 재결정
