# Wave 3 NeedResolution Closure — Product / Semantic Policy

엔진 코드·enum·freezeStatus·literature verdict·UX 구현은 이 문서로 바꾸지 않는다.  
전문가 설문·문헌 재검증·VERIFIED·NEED-015 해결·점수/가중·Wave 1/2 재작업 금지.

**입력:**
- `../wave3-needresolution-prep/wave3-resolution-policy-audit.md`
- `../wave3-needresolution-prep/wave3-resolution-policy-audit.json`
- `src/lib/saju/elements/needResolution.ts` (`STATUS_BY_PATTERN`, `relationPatternOf`)
- `need-resolution-freeze-boundary.md` (의미 혼동 금지와 정합)

**대상:** RES-012 · RES-013 · RES-014 · RES-015

---

## 0. Closure 판정

| 항목 | 판정 |
|---|---|
| Wave 3 NeedResolution **semantic/product boundary** | **CLOSE** |
| VERIFIED / 명리 정답 확정 | **아니오 · 금지** |
| 내부 enum/status 변경 | **하지 않음** (유지) |
| UX 실제 구현 | **하지 않음** (경계만 고정) |
| NEED-015 해결 | **하지 않음** |
| 엔진 / Wave 1·2 재작업 | **하지 않음** |

**CLOSE 의미:** RES-012~015의 **제품·시맨틱 의미 경계가 문서상 종료**됨.  
**CLOSE ≠** 명리 검증 완료 · 용신 확정 · status를 사용자 최종 오행으로 내보내도 됨.

---

## 1. 공통 성격 (고정)

| 주장 | 고정 |
|---|---|
| 규칙 종류 | **product/semantic policy** — `relationPattern` → `status` lookup |
| 명리 신규 판단 | **없음** |
| 입력 | active Need 후보 오행 Set만 (`candidate`). suppressed는 active 제외 |
| 출력에 없음 | winner · neededElement · score · rank · yongsin · heesin |
| 내부 이름 | `indeterminate` / `single-axis` / `convergent` / `competing` **유지** |

집합 계산(RES-006~011) = FACT.  
의미 라벨(RES-012~015) = 이번 closure의 **시맨틱 경계**.

---

## 2. RES-012~015 최종 의미 경계

### RES-012 — `indeterminate` (`no-candidates`)

| | |
|---|---|
| **의미** | 현재 활성 Need 후보로 Strength/Climate **관계를 결정할 수 없음** |
| **의미하지 않음** | 필요한 오행이 **없음** · 결론 불필요 · “필요 없음” 확정 |
| **코드** | 양축 active 오행 없음 → `relationPattern=no-candidates` → `status=indeterminate` |

### RES-013 — `single-axis` (`strength-only` \| `climate-only`)

| | |
|---|---|
| **의미** | 현재 **한 축에서만** 유효(active) 후보가 존재 |
| **의미하지 않음** | 그 축이 최종적으로 **더 중요**하거나 **승리**함 · provisional winner |
| **코드** | 한 축만 active → `status=single-axis`; `singleAxisElements` = 그 축 |

### RES-014 — `convergent` (`exact-overlap` \| `partial-overlap`)

| | |
|---|---|
| **의미** | 현재 Strength/Climate **후보 집합에 overlap(교집합)이 존재** |
| **의미하지 않음** | **용신 확정** · **정답 확정** · 두 이론의 **완전한 일치** · winner |
| **코드** | 교집합 있음 → `status=convergent`; `supportedElements`는 공통 오행 메타(최종 아님). `supportedElements[0]` ≠ winner |

### RES-015 — `competing` (`disjoint`)

| | |
|---|---|
| **의미** | 현재 두 축 후보 집합에 **overlap이 없음** |
| **의미하지 않음** | **나쁜 사주** · **분석 실패** · **엔진 오류** |
| **코드** | 양축 active · 교집합 없음 → `status=competing`; blocker `competing-axes` (해소 공식 아님) |

### UX 금지 번역 (구현은 후속 · 경계만)

| status | 금지 카피 예 |
|---|---|
| indeterminate | “필요한 오행이 없습니다” |
| single-axis | “Climate(또는 Strength)가 이겼습니다” |
| convergent | “용신/정답입니다” · “두 이론이 일치해 확정” |
| competing | “사주가 나쁩니다” · “분석 오류” |

---

## 3. Propagation boundary (upstream → RES)

### NEED-015 — POLICY-UNRESOLVED

| 고정 | |
|---|---|
| RES가 해결? | **아니오.** Suppression 타당성을 RES status로 **표현·승격 금지** |
| 기계 효과 | `suppressed`는 active에서 빠져 pattern/status가 바뀔 수 **있음** — 그건 집합 연산일 뿐 NEED-015 채택이 아님 |
| 표현 금지 | “already-established-relation이 검증되어 convergent/…” 류 |

### NEED-022 — G6 조습 CONTESTED 상속 (BOUNDARY-INHERITED)

| 고정 | |
|---|---|
| 보존 | dry→水 Climate 후보가 RES 입력에 들어가도 **조습 CONTESTED 경계는 유지** |
| 승격 금지 | `single-axis` / `convergent` / `competing`가 moisture 정책을 **VERIFIED·확정값으로 올리지 않음** |
| 신뢰 상한 | 해당 경로 RES 라벨 ≤ Climate 입력 경계 |

### 일반 규칙

**upstream unresolved / contested / POLICY-UNRESOLVED를 downstream `status`가 확정값·명리 정답으로 승격시키지 않는다.**

관련 유지: CL-NEED-HOUR(Strength Need gated) → Climate-only `single-axis` 등이 늘 수 있으나, 그 status도 **한 축만 후보**일 뿐 Climate 승리가 아님.

---

## 4. Interpretive validation 파이프라인 상태

| Wave | 층 | 경계 |
|---|---|---|
| Wave 1 | Strength / Climate interpretive | CLOSE (정책 unresolved 일부 잔존 · VERIFIED 아님) |
| Wave 2 | NeedCandidate | CLOSE (NEED-015 POLICY-UNRESOLVED · NEED-022 contested 상속) |
| Wave 3 | NeedResolution status 라벨 | **CLOSE (본 문서 · semantic/product만)** |

Priority Audit §K 권장 순서 1–4의 **검증 경계**는 종료.  
OPEN(§I)과 UX 적용·Needed Element 제품 설계는 **Wave 3 closure 밖**.

---

## 5. 다음 최초 미완료 단계

Interpretive validation **우선순위 순서상** 다음 최초 미완료:

**OPEN 백로그** (`interpretive-validation-priority-audit.md` §I) — Wave가 아님.

특히 체인: **CLI-049 ↔ NEED-027 ↔ RES-028** (`climateCounterSignals` 항상 `[]`).

그 다음(병행·별도, Wave 아님):
- Wave 1 잔여 **POLICY-UNRESOLVED** (CL-NEED-HOUR 제외 28건) — 정책 결정 트랙
- NEED-015 POLICY-UNRESOLVED — Need 억제 정책 트랙
- RES speakable/UX 카피 적용 — 제품 트랙 (이번 closure가 경계만 고정)

---

## 6. 하지 않은 것

- 엔진·enum 변경 · UX 구현 · VERIFIED
- 전문가 설문 · 문헌 재검증
- NEED-015 해결 · 점수/가중
- Wave 1/2 재작업 · OPEN 해결 · Needed Element 설계
