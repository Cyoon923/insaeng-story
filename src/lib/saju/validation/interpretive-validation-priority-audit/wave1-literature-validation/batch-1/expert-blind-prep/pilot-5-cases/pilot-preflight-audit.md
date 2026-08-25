# STR-010/011 Pilot Preflight Audit

엔진 rule / literature verdict / freezeStatus를 바꾸지 않는다.
전문가 답을 생성·채우지 않는다.
Pilot을 실행한 것으로 기록하지 않는다 (`pilotExecuted: false`).

**범위:** `expert-blind-package.md` + Pilot 5 case (`w1b1-blind-01` … `05`) + 응답 저장 schema.

---

## Verdict

**전달 가능 (readyForExpertDelivery: true).**  
최소 패키지 구조 수정만 적용함 (아래 §Fixes).

---

## Checks

| # | 확인 | 결과 |
|---|---|---|
| 1 | engine result / literature verdict / STR rule이 전문가 패킷에 노출되지 않음 | **PASS** — `expert-blind-package.md`에 STR-010/011, PARTIALLY-SUPPORTED/CONTESTED, support/pressure, StrengthSummary 없음 |
| 2 | 각 case 입력정보가 판단에 충분 | **PASS** — 양력·생년월일·시간/미상·사주 원국. 원국은 출생입력과 일치(엔진 대조). case 05에 야간 출생 시 일주 변동 안내 추가 |
| 3 | 질문이 특정 답을 유도하지 않음 | **PASS** — “같은 방향으로 묶을 수 있는가”는 가부·조건·불가 모두 허용. 엔진 묶음을 사실처럼 제시하지 않음 |
| 4 | 전문가가 독립 판단·근거 기록 가능 | **PASS** — Phase A 서술 → Phase B → 명식별 세력·근거. “조건에 따라/어렵다” 허용 |
| 5 | 응답 schema가 답·disagreement 보존 | **PASS (수정 후)** — `expertFacing` raw 우선; `phaseAVsPhaseBConflictNote`; operator mapping/expected/comparison은 `operatorOnlyAfterCollection` |
| 6 | expected/정답 필드가 전문가 화면에 노출되지 않음 | **PASS (수정 후)** — 전문가는 md만 수신. template의 expected/comparison은 operatorOnly. checklist에 비배포 명시 |

---

## Fixes applied (package structure only)

1. `expert-response-template.json` — `expertFacing` / `operatorOnlyAfterCollection` 분리; preservationRules; `pilotExecuted: false`
2. `expert-blind-package.md` — case 05 시간 미상·일주 참고 안내
3. `operator-leakage-checklist.md` — 배포 허용/금지·preflight 상태

Batch 1–6 literature 문서, 엔진 코드, inventory의 rule verdict는 미변경.

---

## Still not done (의도적)

- 전문가 답 생성·기입: **0**
- Pilot 실행 / comparison: **아니오**
- Wave 2: **아니오**
