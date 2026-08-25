# Operator leakage checklist — G3 (STR-030) expert package

## Deliver to expert

**Only** `expert-blind-package.md`.

Do **not** deliver:

- `operator-case-purpose.md`
- `operator-leakage-checklist.md` (this file)
- `operator-expert-panel.md`
- `selection-audit.md`
- `expert-response-template.json` (full; has operatorOnlyAfterCollection)
- `wave1-batch-3-expert-blind-prep.md`
- `wave1-batch-3-g3-blind-package-inventory.json`
- `../wave1-batch-3-literature-validation.md` / inventory
- strength-rule-inventory / STR docs
- engine StrengthSummary / case-trace / rootQuality
- 전문가 패널 운영 조건(E3 unavailable 등)

## Must be absent from expert packet

- STR-030 / STR-030-clear / STR-030-present / STR-030-shallow / STR-005
- clear / present / shallow (엔진 enum)
- literature verdict / PARTIALLY-SUPPORTED / CONTESTED / evidence confidence
- rootQuality / rootQualityOf / leaning-* / mixed / substantial*
- case 선정 목적·슬롯명(여기만·본기+장생약 등)·operator 용어
- StrengthSummary / NeedCandidate / NeedResolution
- expected / expertExpected / comparison
- fixture id (`s7-…`, `c2-…`) — blind id만 사용
- “엔진이 정기→clear…”형 유도 질문
- E1/E2/E3/E4 패널 상태·unavailable 표기

## Allowed in expert packet

- 검증 목적: 일간 세력 + 통근 존재/깊이 (중립 문구)
- 원국 8건 (생년월일은 fixture 문서화 1건만)
- 공통 질문 Phase A/B (본기·중기·여기·十二長生·墓庫·투간·월지)
- case별 세력·통근·깊이·투간
- 시간 미상 안내
- 익명 provenance
- “깊음/중간/얕음” 일반어 (엔진 enum 이름 없이 3등급 개념만)

## Expert package freeze

- `expert-blind-package.md` 질문·명식 본문: **변경 금지** (본 운영 조건 업데이트와 무관)

## Scan (this stage)

| check | result |
|---|---|
| STR-030 / clear / present / shallow enum in expert-blind-package.md | absent |
| literatureVerdict / PARTIALLY-SUPPORTED / CONTESTED | absent |
| rootQuality / leaning / strongSide | absent |
| source fixture ids | absent |
| selection purpose labels | absent |
| expert panel ops (E3 unavailable) | absent from expert packet |
| expert answers filled | 0 (empty by design) |

## Status this stage

- expert panel: E1 / E2 / E4 active; E3 = unavailable (not pending)
- expert answers (active): 0
- expecteds: 0
- g3Executed: false
- aggregation: not started (when started: active 3 only; majority ≠ truth)
- E3 missing: not tracked as closure incomplete work
- G1/G2 unchanged: true
- G4+: not started
- engineUnchanged: true
- literatureVerdictUnchanged: true
