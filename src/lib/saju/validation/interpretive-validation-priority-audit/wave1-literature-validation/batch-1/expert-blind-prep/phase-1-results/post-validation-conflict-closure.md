# Post-Validation Conflict Closure

STR-010/011 Pilot + Phase 1 검증 이후 Conflict 1·2의 **정보 손실 해소**와 **정책 미결**을 분리해 경계를 닫는다.

**금지 준수:** 새 규칙·가중치·threshold 없음. Need 정책·STR verdict·freezeStatus·엔진 추가 수정 없음 (본 문서는 상태 정리만).

**근거:**
- `post-validation-rule-audit.md` (C-A, C-B)
- `conflict-1-side-weight-design.md` + `sourceBreakdown` 구현
- `conflict-2-unknown-time-audit.md` + `directionSensitivity` 구현
- `phase1-closure.md`

**Literature (변경 없음):** STR-010 PARTIALLY-SUPPORTED · STR-011 CONTESTED.

---

## Conflict 1 — Side 내부 동일취급

### 조치 완료 (구현)

| 항목 | 상태 |
|---|---|
| `StrengthSummary.sourceBreakdown` | peer / resource / output / wealth / officer × rooted/unrooted 보존 |
| `decideDirection` / rootedSupport·rootedPressure | **미변경** |
| 숫자 가중·threshold·편/정 δ·재성 감쇄량 | **미도입** |

### 분류

| ID | 내용 | 분류 |
|---|---|---|
| C1-A | support/pressure 내부 source type이 판정 직전에서 소실되던 문제 | **INFORMATION-LOSS-RESOLVED** |
| C1-B | side 묶음(STR-010/011) 방향 유지 | 유지 (검증 ES와 정합; 본 closure 대상 아님) |
| C1-C | peer vs resource, output vs wealth vs officer **실제 강도·차등 가중** | **POLICY-UNRESOLVED** |
| C1-D | `decideDirection`이 여전히 side-내 boolean 균등 기여 | **POLICY-UNRESOLVED** (의도적 동결; breakdown은 진단만) |

**Conflict 1 한 줄:** 정보 손실은 해소. 동일가중을 “채택/폐기”하는 정책은 열지 않음.

---

## Conflict 2 — 시간 미상 provisional

### 조치 완료 (구현)

| 항목 | 상태 |
|---|---|
| `StrengthSummary.directionSensitivity` | hour unknown + leaning-* → `"hour-unknown-provisional"` |
| `directionCandidate` / `resolution` / `certainty` | **미변경** |
| NeedCandidate / NeedResolution | **미변경** |
| 무조건 mixed / direction=null 강제 | **하지 않음** |
| STR-066 (`hour-unknown-sensitive` on null) | **의미 변경 없음** |

### 분류

| ID | 내용 | 분류 |
|---|---|---|
| C2-A | leaning 경로에서 “시주 미상 → 방향 뒤집힘 가능” 메타 소실 | **INFORMATION-LOSS-RESOLVED** |
| C2-B | 삼주 기준 leaning 후보 자체 허용 (무조건 방향 불가 아님) | 유지 (expert ES-5와 정합) |
| C2-C | `certainty=partial` + `resolution=clear-direction` 공존 시맨틱 | **POLICY-UNRESOLVED** (메타로 보완, 어휘 재정의 안 함) |
| C2-D | partial + provisional인데 Need `strengthNeedStatus=ready` 허용 | **POLICY-UNRESOLVED** |
| C2-E | freeze-boundary 문구 vs STR-050/051 코드 | **POLICY-UNRESOLVED** (문서·정책 정렬은 후속) |

**Conflict 2 한 줄:** provisional 정보 손실은 해소. Need ready·clear-direction 어휘 정책은 미결.

---

## INFORMATION-LOSS-RESOLVED (롤업)

1. **C1-A** — `sourceBreakdown`으로 peer/resource/output/wealth/officer 보존.  
2. **C2-A** — `directionSensitivity: hour-unknown-provisional`로 시주 미상 leaning의 provisional 보존.

둘 다 **판정식·Need에 미주입** (진단 메타만).

---

## POLICY-UNRESOLVED (롤업)

1. **C1-C / C1-D** — source type별 실제 강도·`decideDirection` 차등 사용 여부.  
2. **C2-C** — partial + clear-direction 공존을 허용할지, resolution 어휘를 나눌지.  
3. **C2-D** — hour-unknown-provisional일 때 Need ready 유지/게이트.  
4. **C2-E** — freeze-boundary ↔ STR-050/051/066 문서 정합.

위는 새 규칙·가중·Need 변경 없이 **목록으로만 유지**. VERIFIED/freeze 승격 없음.

---

## Closure 판정

| Conflict | 정보 손실 | 정책 | Phase post-validation conflict 종료 |
|---|---|---|---|
| 1 | RESOLVED | UNRESOLVED (강도/균등 boolean) | **정보 층 종료 가능** |
| 2 | RESOLVED | UNRESOLVED (Need ready·어휘) | **정보 층 종료 가능** |

전체: **Conflict 정보 손실 클로저 가능**. 정책 항목은 STR-010/011 literature·Need 정책과 분리된 **open list**.

---

## 하지 않은 것

- 엔진 추가 수정 · Need 정책 변경  
- STR verdict / freezeStatus 변경  
- sourceBreakdown·directionSensitivity를 판정식에 연결  
- 새 점수·가중·threshold · Wave 2
