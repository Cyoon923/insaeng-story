# Strength Freeze Boundary

엔진 판단 코드는 이 문서로 바꾸지 않는다.
FROZEN-POLICY = 명리학적 검증 완료가 아니다.

**Strength 종료 상태:** 사실층 검증 완료 + 보수 정책 경계 확정 + 해석층 검증 대기.

완전 검증 완료가 아니다.
directionCandidate 전체를 검증 완료로 표시하지 않는다.

---

## A. Frozen Facts (VERIFIED-FACT)

Rule-table 332행과 일치하는 원재료만.

| ID | 내용 |
|---|---|
| STR-001 | 천간 → 오행 |
| STR-002 | 지장간 |
| STR-003 | 십신 **라벨** lookup |
| STR-004 | 왕상휴수사 **lookup** |
| STR-005 | 통근 **hit** (동오행) |
| STR-006 | presence 4종 |

이 6개가 맞다고 해서 directionCandidate, 통근 영향력, 관살=pressure가 검증된 것이 아니다.

---

## B. Frozen Conservative Policies (FROZEN-POLICY)

의도적으로 고정 가능한 **엔진 정책**. 명리 절대 정답이 아니다.

- 시간 미상: 시주 후보 자동 선택 없음. hour evidence 없음. 방향을 약/강으로 만들지 않음. (STR-007, STR-066)
- 일간 자신을 visible 비견으로 넣지 않음. (STR-020)
- 정/편 추가 가중 없음. 정기 겁재 = 정기 비견 깊이. (STR-012, STR-013)
- unrooted-visible만으로 방향을 열지 않음. 목록에는 남김. (STR-042)
- hidden만으로 방향을 열지 않음. note만. (STR-043)
- hidden support와 root hit의 note 중복 제거. (STR-044)
- 애매하면 `directionCandidate=null`. 억지 마감 없음. (STR-056)
- mixedPattern / mixedConflictLevel / unresolvedReasons는 진단 메타. 방향·Need에 재주입하지 않음. (STR-060~065)
- mixed 또는 null이면 Strength Need 후보를 만들지 않음. (STR-071)
- certainty는 입력 완전성. 방향이 아님. (STR-067)
- 명시 mixed 분기 STR-052~054는 055와 같은 결과 계열. 추가 점수 없음.

상/휴 미개방(STR-026, STR-027)은 **정책처럼 동작하지만** 이 목록의 FROZEN-POLICY가 아니다. 사용자 지정 예시에 따라 해석 검증 대상이다. 현재 동작은 유지하되 “검증된 정책”이라고 부르지 않는다.

---

## C. Interpretive Rules Not Yet Validated

| 주제 | ID |
|---|---|
| 비겁·인성 = support | STR-010 |
| 식상·재·관 = pressure | STR-011 |
| 대상 천간 오행 presence로 RV 판정 | STR-021 |
| 왕 → strong-side / substantialStrong | STR-022, STR-023 |
| 수/사 → weak-side / substantialWeak | STR-024, STR-025 |
| 상 = help only, 휴 = 무방향 | STR-026, STR-027 |
| rootQuality 깊이 라벨과 방향 사용 | STR-030-*, STR-031, STR-032, STR-033 |
| RV support/pressure가 방향을 연다 | STR-040, STR-041 |
| leaning-strong / leaning-weak 마감식 | STR-050, STR-051 |
| mixed = 양측 실질 boolean | STR-055 |
| leaning일 때만 Strength 축 Need 후보 | STR-070 |

---

## D. Open Questions

- STR-061g `other-mixed` (현재 표본 0).
- mixedPattern 순서가 명리 우선순위로 오해될 여지 (코드는 분류만).
- 왕∧clear AND가 월령·월지 정기의 관련 사실 중첩인지.

상세: `strength-open-questions.md`.

---

## E. Fields Safe for Internal Diagnostics

사용자에게 “검증된 명리 결론”으로 보여주지 말 것. 내부 검토·로그·블라인드 비교용.

| 필드 | 종류 | 이유 |
|---|---|---|
| seasonalPhase | 사실/lookup | STR-004. 방향 결론이 아님 |
| rootQuality | 정의된 진단값 | hit→라벨. 영향력은 미검증 |
| strongSideEvidence / weakSideEvidence | 진단 목록 | 나열이지 점수 아님 |
| hiddenSupportNotes / hiddenPressureNotes | 진단 | 방향 미사용 |
| mixedPattern | 진단 메타 | 용신 아님 |
| mixedConflictLevel | 진단 메타 | 점수 아님 |
| unresolvedStrengthReasons / unresolvedReasons | 진단 메타 | null의 설명 |
| conflicts | 진단 문장 | |
| certainty | 입력 완전성 메타 | 강/약 아님 |
| omittedSlots | 입력 범위 | |
| resolution | direction의 파생 라벨 | 별도 진실 아님 |

seasonalPhase lookup 자체는 사실층으로 내부 사용 가능. 다만 UI에서 “신왕”으로 바꾸어 보여주면 해석 결론이 된다.

---

## F. Fields Not Yet Safe as Final User Conclusions

| 필드 | 종류 | 사용자 최종 결론 |
|---|---|---|
| directionCandidate | 해석 결과 | **아직 불가** |
| resolution | 해석 파생 | **아직 불가** |
| leaning-strong / leaning-weak를 신강/신약으로 번역 | 해석 | **불가** |
| mixed를 중화·중화격 확정으로 번역 | 해석 | **불가** |
| null을 오류·실패로 번역 | 오해 | **불가** |
| mixedPattern으로 용신 제시 | 금지 | **불가** |
| STR-070 후보를 Needed Element로 제시 | 금지 | **불가** |

제품 사주 결과를 production-ready 명리 결론으로 표시하지 않는다. (절입 정책도 별도 미확정.)

---

## G. Rules prohibited from producing Needed Element

다음으로는 최종 오행 / 용신 / 희신을 만들지 않는다.

- mixedPattern, mixedConflictLevel
- unresolvedStrengthReasons
- hidden notes
- UV-only evidence
- 상/휴 seasonal help
- STR-070 후보 목록 (후보지 최종이 아님)
- STR-071 공집합 (공백을 최종 오행으로 채우지 않음)
- Climate으로 Strength null을 해소하는 경로 (이번 단계 금지, 미구현 유지)

---

## directionCandidate 분해

### leaning-strong

- 생성: STR-050 (왕 ∧ clear ∧ RV support ∧ ¬RV pressure)
- VERIFIED-FACT: 왕 lookup, 정기 hit, 십신 라벨, RV presence 판정
- FROZEN-POLICY: 일간 제외, 정/편 무가중, hidden/UV 미사용
- REQUIRES-INTERPRETIVE-VALIDATION: 왕·clear·RV support를 강 마감으로 묶는 일 전체

### leaning-weak

- 생성: STR-051
- FACT: 수/사 lookup, 무근, RV pressure 판정, 십신 라벨
- FROZEN-POLICY: hidden/UV 미사용
- INTERPRETIVE: 수/사·무근·RV 관을 약 마감으로 묶는 일 전체

### mixed

- 생성: STR-055 (및 052–054)
- 의미: strong-side와 weak-side **실질 Evidence가 동시에 존재**하는 엔진 진단
- mixed는 최종 신강/신약이 아니다
- mixedPattern은 용신 규칙 아님
- conflictLevel은 점수 아님
- mixed → Strength Need 없음은 보수 정책 (STR-071)

### null / unresolved

- 생성: STR-056
- 엔진 오류가 아님. 판단 실패로 정의하지 않음
- 원인 분리: 입력 부족(시간 미상은 민감성만), Evidence 미달, 상/휴 보수, UV-only
- unresolved → Strength 후보 없음은 보수 정책 (STR-071)

---

## Evidence 중복 (점수 없음)

가산점 구조는 없다.  
다만 substantialStrong/Weak의 **OR**와 leaning-strong의 **왕∧clear AND**는 관련 사실이 두 조건으로 쓰인다. 이를 검증 완료로 보지 않는다. 코드는 고치지 않는다.
