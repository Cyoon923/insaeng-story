# Need Candidate Open Questions

답을 새로 정하지 않는다.
엔진을 이 문서로 바꾸지 않는다.
Need Freeze / NeedResolution Audit으로 넘어가지 않는다.

---

## HIGH-RISK NEED INTERPRETIVE RULES

전문가·문헌 검증 전에는 제품 결론으로 내보내지 말 것.

1. **leaning-strong → 식상 / 재성 / 관성 후보** (NEED-010)
   - 일간이 기울어 강하면 설기·재·관이 후보라는 해석.
   - 3개를 순위로 매기지 않는다. 그래도 후보 오행 선택 자체는 미검증.

2. **leaning-weak → 비겁 / 인성 후보** (NEED-011)
   - 일간이 기울어 약하면 일간 오행과 인성이 후보라는 해석.
   - 비겁=일간 오행 복사.

3. **십신 오행 맵** (NEED-009)
   - RESOURCE/OUTPUT/WEALTH/OFFICIAL 표가 코드에 있다.
   - 그 표가 용신 이론으로 검증된 것은 아니다.

4. **rooted-visible + 왕/상 → already-established-relation** (NEED-015)
   - ‘이미 있는 관계는 신강 Need에서 억제’라는 해석.
   - 전체 Strength가 mixed면 제품 경로(`buildNeedCandidateSet`)는 이 규칙에 도달하지 않는다.

5. **cold → 火** (NEED-020)
   - AdjustedClimate 진단 다음의 오행 선택. Climate Audit CLI-041과 같음.
   - 한 = 火 필요라는 단정 금지.

6. **warm → 水** (NEED-021)

7. **dry → 水** (NEED-022)
   - warm→水와 dry→水는 별 규칙. 둘 다 水여도 최종 오행이 아님.

---

## ENGINE-POLICY로 남겨 둔 것 (명리 정답 아님)

- mixed / null에서 Strength 후보를 만들지 않음 (NEED-012, NEED-013)
- mixedPattern으로 conditional 후보를 만들지 않음 (NEED-014)
- moist만으로 火/土를 만들지 않음 (NEED-023)
- Strength와 Climate 같은 오행을 이 계층에서 합치지 않음 (NEED-035)
- 다른 오행을 우선순위로 줄이지 않음 (NEED-036)
- partial certainty로 후보를 막지 않음 (NEED-053)

이 정책들을 지금 바꾸지 않는다. Freeze는 다음 단계.

---

## OPEN / 표본 공백

- **NEED-027 / NEED-042:** `climateCounterSignals`는 항상 `[]`. `climate-moisture-already-moist`는 코드에 없다.
- **leaning-strong + Climate 후보가 동시에 있는 기존 검증 명식이 없다.** 기존 CASE 2는 leaning-strong이지만 Climate Need가 비어 있다. 새 명식을 엔진에 맞춰 만들지 않았다.
- **제품 경로에서 suppressed Strength 후보가 남는 기존 명식이 없다.** suppression fixture 차트는 `directionCandidate=mixed`라 `buildNeedCandidateSet` Strength는 `[]`. 억제는 독립 함수 호출에서만 관측.
- Climate 축 unresolved이면서 Strength leaning-strong/weak인 기존 필수 CASE가 거의 없다. need-case-10/11은 Strength mixed.
- NeedResolution이 이 후보를 어떻게 묶는지는 **미감사**. 이번 문서에서 답을 만들지 않음.

---

## 하지 말 것

- 이 질문으로 Need 매핑을 지금 고치지 말 것
- mixed에서 후보를 만들지 말 것
- counterSignal을 구현하지 말 것
- Needed Element / 용신 / 희신을 만들지 말 것
- Need Freeze Boundary를 이번 단계에서 쓰지 말 것
- NeedResolution Audit을 이번 단계에서 시작하지 말 것
