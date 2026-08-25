# Operator leakage checklist — Pilot 5 expert package

## Deliver to expert

**Only** `expert-blind-package.md` (인쇄/PDF/문서).

Do **not** deliver:

- `selection-audit.md`
- `pilot-5-case-inventory.json` (esp. `operatorOnly`, `rawStructuralFeaturesOperatorOnly`, `coverageSummaryOperatorOnly`)
- `expert-response-template.json` full file (contains `operatorOnlyAfterCollection.expertExpected` / `comparison`)
- `wave1-batch-1-expert-blind-prep.md` / schema JSON
- literature validation / evidence hardening docs
- this checklist

Operator stores answers later into `expert-response-template.json` → `expertFacing` only at first; leave `operatorOnlyAfterCollection` empty until after collection.

## Must be absent from expert packet

- STR-010 / STR-011
- literature verdict / evidence confidence
- support / pressure / leaning-* / mixed
- StrengthSummary / NeedCandidate / NeedResolution
- expected / comparison / matchStatus / expertExpected
- engineResultsFilled / agreementRate
- 다른 전문가 답
- “엔진이 비겁·인성을 같은 편으로 묶는데 맞습니까?”형 유도 질문

## Allowed in expert packet

- 생년월일·시간(또는 미상)·양력
- 원국 간지
- 시간 미상 시 일주 참고·야간 출생 가능성 안내(중립)
- 중립 질문·빈 답란
- 익명 provenance 칸

## Preflight (2026-08-25)

- expert package leakage scan: PASS (no rule id / verdict / support·pressure / expected)
- five case pillars vs birth input: PASS
- response schema separates expertFacing vs operatorOnlyAfterCollection: PASS
- pilotExecuted: **false** (not marked as run)
- expert answers: **0**
- expecteds: **0**
- comparison: not executed
