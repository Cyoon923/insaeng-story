# Operator leakage checklist — G4 (MONTH-CLIMATE) expert package

## Deliver to expert

**Only** `expert-blind-package.md`.

Do **not** deliver:

- `operator-case-purpose.md`
- `operator-leakage-checklist.md` (this file)
- `operator-expert-panel.md`
- `selection-audit.md`
- `expert-response-template.json`
- `wave1-batch-4-expert-blind-prep.md`
- `wave1-batch-4-g4-blind-package-inventory.json`
- `../wave1-batch-4-literature-validation.md` / inventory
- climate-rule-inventory / CLI docs / BASE_CLIMATE
- 전문가 패널 운영 조건

## Must be absent from expert packet

- CLI-002 / CLI-003a–d / CLI-004 / CLI-001 / CLI-018
- BASE_CLIMATE / warm / cold / balanced / dry / moist **엔진 enum** (질문에서 영문 enum 유도 금지; 한난·조습·온화 등 일반어는 허용)
- literature verdict / CONTESTED / PARTIALLY-SUPPORTED
- case 선정 목적·슬롯명(餘寒 vs 봄 묶음 등)·operator 용어
- expected / engine climate / adjustedClimate
- fixture id (`s13-…`) — blind id만
- “엔진이 寅卯辰를 balanced+moist로…”형 유도

## Allowed in expert packet

- 조후·월령 중립 목적
- 원국 8건
- Phase A/B (한난·조습·토월·일간·왕쇠 구분)
- 익명 provenance

## Expert package freeze note

- 질문 본문에 엔진 enum·CLI id·verdict **없음** (작성 시 scan)

## Scan (this stage)

| check | result |
|---|---|
| CLI-002/003/004 in expert-blind-package.md | absent |
| warm/cold/balanced/dry/moist engine labels | absent |
| literatureVerdict / CONTESTED | absent |
| source fixture ids | absent |
| selection purpose labels | absent |
| expert panel ops | absent from expert packet |
| expert answers filled | 0 |

## Status this stage

- expert panel: E1 / E2 / E4 active; E3 = unavailable
- expert answers: 0
- g4Executed: false
- G3 untouched / G5 not started
- engineUnchanged: true
- literatureVerdictUnchanged: true
