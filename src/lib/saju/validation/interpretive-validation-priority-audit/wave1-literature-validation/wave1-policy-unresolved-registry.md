# Wave 1 — Policy-Unresolved Registry

Wave 1 G1~G6 **검증 경계는 CLOSE**. 아래는 남은 **POLICY-UNRESOLVED**와, 이미 적용된 **CL-NEED-HOUR**만 구분한다.

**CL-NEED-HOUR:** `POLICY-RESOLVED` / 엔진 `IMPLEMENTED` — 패키지 **Provisional Strength, Gated Need** (commit `c96b6ecf6bf0399d3edac241611733d0cb595005`).

**이 문서가 하지 않는 것:** 다른 클러스터 정책 결정 · 추천값 · 점수/가중 · VERIFIED · 추가 설문 · Wave 1 재검증 · Wave 2 착수.

**규칙:** 다수결 ≠ 정책. Literature verdict ≠ 정책 확정. Expert observation ≠ 채택.

**근거 (closure / conflict / comparison):**
- G1: `batch-1/.../phase1-closure.md`, `post-validation-conflict-closure.md` (+ inventories)
- G2: `batch-2/g2-closure.md` + inventory
- G3: `batch-3/g3-closure.md` + inventory
- G4: `batch-4/g4-closure.md` + inventory
- G5: `batch-5/g5-closure.md` + inventory · `final-expert-round/.../final-expert-comparison.md`
- G6: `batch-6/g6-closure.md` + inventory · 동일 final-comparison

**status:** CL-NEED-HOUR(D01, D02, D03, E04) = `POLICY-RESOLVED` / `IMPLEMENTED`. 그 외 = `POLICY-UNRESOLVED`.

---

## 영역 범례

| Code | Domain |
|---|---|
| A | Strength |
| B | Root |
| C | Climate |
| D | Need |
| E | Cross-domain |

---

## A. Strength

### W1-POL-A01 — Side 내부 동일가중 / boolean 균등 기여

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-A01` |
| **source group** | G1 |
| **관련 rule** | STR-010, STR-011; `decideDirection` |
| **결정 질문** | peer/resource/output/wealth/officer를 side 내 **동일 boolean 기여**로 둘지, **차등 강도**를 쓸지? |
| **말할 수 있음** | 방향 묶음(비겁·인성 강화 / 식재관 약화 거시) 관찰; `sourceBreakdown`으로 유형 **보존**됨 |
| **결정할 수 없음** | 동일가중 채택/폐기; 유형별 고정 δ |
| **disagreement / case** | G1 NV-1·NV-2; Conflict C1-C / C1-D; p1-06 질 vs 개수 긴장 |
| **engine 영향** | `decideDirection`, substantialStrong/Weak 집계 |
| **provenance** | G1 phase1 NV-1/2; post-validation C1-C, C1-D |
| **status** | POLICY-UNRESOLVED |

### W1-POL-A02 — 편/정 고정 강도차

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-A02` |
| **source group** | G1 |
| **관련 rule** | STR-010/011 (편정 라벨) |
| **결정 질문** | 정/편에 **고정 강도표**를 둘지? |
| **말할 수 있음** | 방향 층에서 정·편 구분 관찰은 있음 |
| **결정할 수 없음** | 고정 감점·서열 수치 |
| **disagreement / case** | G1 NV-3 |
| **engine 영향** | 십신→Strength 기여량 |
| **provenance** | G1 phase1 NV-3 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-A03 — 재성(·식·관) 감쇄 기제·순위

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-A03` |
| **source group** | G1, G2 |
| **관련 rule** | STR-010/011; G2 충돌 시 감쇄 서술 |
| **결정 질문** | 재성(및 식·관) **감쇄 기제·고정 순위**를 단일화할지? |
| **말할 수 있음** | 약화 **거시 방향** 합의에 가까움 |
| **결정할 수 없음** | 소모/재극인/통제비용 등 단일 taxonomy; 고정 순위·점수 |
| **disagreement / case** | G1 NV-4; G2 OD-2, NV-G2-4 |
| **engine 영향** | pressure side 집계·감쇄 |
| **provenance** | G1 NV-4; G2 OD-2 / NV-G2-4 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-A04 — 충돌 시 Strength 최종 우위 공식

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-A04` |
| **source group** | G2 |
| **관련 rule** | STR-022/024 + decideDirection / substantial* |
| **결정 질문** | 월령·통근·합국 충돌 시 **무엇을 최종 우위로 닫을지?** |
| **말할 수 있음** | 왕≠자동 신강; 수·사 weak-side 방향; 점수단독 경계 |
| **결정할 수 없음** | 단일 충돌 해소 공식 |
| **disagreement / case** | G2 OD-1; Case 3·4 뒤집힘 서술; ENG-4 |
| **engine 영향** | `substantialStrong/Weak` + `decideDirection` |
| **provenance** | G2 OD-1, NV-G2-3 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-A05 — 월령·통근·투출 Strength 수치 우선순위

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-A05` |
| **source group** | G1, G2 |
| **관련 rule** | STR-010/011, STR-022/024 |
| **결정 질문** | 월령/통근/투출의 **단일 수치 우선순위·가중표**를 둘지? |
| **말할 수 있음** | 월령·통근이 단순 개수보다 중요하다는 **방향** |
| **결정할 수 없음** | 30–40%·±1.0 등 스케일; “최대 비중” 고정 문구 |
| **disagreement / case** | G1 NV-5; G2 OD-3, NV-G2-1 |
| **engine 영향** | Strength 증거 가중·게이트 |
| **provenance** | G1 NV-5; G2 OD-3 / NV-G2-1 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-A06 — 합충의 Strength 표준 가중

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-A06` |
| **source group** | G1 |
| **관련 rule** | STR-010/011 (합충 서술) |
| **결정 질문** | 합·충을 Strength에 **표준 가중**으로 넣을지? |
| **말할 수 있음** | 합충이 세력에 영향할 수 있다는 관찰 |
| **결정할 수 없음** | 표준 가중표 |
| **disagreement / case** | G1 NV-6 |
| **engine 영향** | Strength 증거 수집 |
| **provenance** | G1 NV-6 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-A07 — 旺相休囚死 → 최종 Strength 점수 맵

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-A07` |
| **source group** | G2 |
| **관련 rule** | STR-022, STR-024 (인접 STR-026/027) |
| **결정 질문** | 왕상휴수사를 **등간격·최종 Strength Score**로 매핑할지? |
| **말할 수 있음** | 왕≠신강; 휴를 weak-side에 안 넣는 방향과 엔진 부분 정렬 |
| **결정할 수 없음** | 등간격 점수; 수=사 동등 가중 확정; STR-026/027 G2에서 닫기 |
| **disagreement / case** | G2 NV-G2-2, NV-G2-5, NV-G2-6; OD-PC 라벨; Phase C 休/死·相/休 |
| **engine 영향** | seasonal side evidence, STR-026/027 |
| **provenance** | G2 NV-G2-2/5/6, OD-PC |
| **status** | POLICY-UNRESOLVED |

### W1-POL-A08 — 질(득령·근) vs 개수·충형 긴장 (Case06형)

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-A08` |
| **source group** | G1, G2 |
| **관련 rule** | STR-010/011, STR-022/024 |
| **결정 질문** | 득령·근의 질과 설극 개수·충형이 충돌할 때 **엔진 게이트**를 어떻게 둘지? (정답 라벨 아님) |
| **말할 수 있음** | 불일치 **존재**가 검증 결과; 다수결 금지 |
| **결정할 수 없음** | Case 정답 Strength; 단일 게이트 공식 |
| **disagreement / case** | G1 p1-06 / NV-8; G2 Case 06 |
| **engine 영향** | strong/weak 게이트·뒤집힘 |
| **provenance** | G1 remaining unresolved; G2 Case06 / NV-G2-7 |
| **status** | POLICY-UNRESOLVED |

---

## B. Root

### W1-POL-B01 — Structural depth vs effective root strength

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-B01` |
| **source group** | G3 |
| **관련 rule** | STR-030-clear/present/shallow |
| **결정 질문** | 엔진에서 **구조적 깊이**와 **유효 근력**을 분리할지? |
| **말할 수 있음** | 존재 ≠ 깊이/유효; role만으로 최종 근력 확정 불가 |
| **결정할 수 없음** | 분리 구현 여부·API |
| **disagreement / case** | G3 Case 06 layer≠effective |
| **engine 영향** | `rootQuality` 의미, STR-030 라벨 |
| **provenance** | G3 P1 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-B02 — STR-030 라벨을 구조 layer로 제한

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-B02` |
| **source group** | G3 |
| **관련 rule** | STR-030-* |
| **결정 질문** | clear/present/shallow를 **구조적 layer**로만 읽을지? |
| **말할 수 있음** | 전통 표준 3등급으로 검증되지 않음 (추상화) |
| **결정할 수 없음** | 제품/문서 해석 정책 |
| **disagreement / case** | G3 C8 / OD-A8 혼합 라벨 |
| **engine 영향** | STR-030 소비 방식 |
| **provenance** | G3 P2 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-B03 — 합·충에 따른 root 유효성

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-B03` |
| **source group** | G3 |
| **관련 rule** | STR-030; 충 감쇄 서술 |
| **결정 질문** | 충·합 후 root **유효 감쇄**를 어떻게 둘지? |
| **말할 수 있음** | 충이 영향을 줄 수 있음 |
| **결정할 수 없음** | % 감쇄·제거 공식 |
| **disagreement / case** | G3 OD-G3-02 Case 02 |
| **engine 영향** | root 유효 플래그 |
| **provenance** | G3 P5; OD-G3-02 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-B04 — 十二長生·墓庫 등 추가축 결합

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-B04` |
| **source group** | G3 |
| **관련 rule** | STR-030 (인접 장생·묘고) |
| **결정 질문** | 장생·묘고를 root depth와 **어떤 공식으로 결합**할지? |
| **말할 수 있음** | 층위만으로 설명되지 않는 실질 강도 요인 가능 |
| **결정할 수 없음** | 결합 공식 |
| **disagreement / case** | G3 OD-2 예외 목록 차이 |
| **engine 영향** | root 유효 계산 |
| **provenance** | G3 P6 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-B05 — 중기/여기 ordering

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-B05` |
| **source group** | G3 |
| **관련 rule** | STR-030-present / shallow |
| **결정 질문** | 중기>여기를 **절대 / 지지유형별 / 비정기 묶음** 중 무엇으로 할지? |
| **말할 수 있음** | 고정 절대 규칙으로 확정 불가 |
| **결정할 수 없음** | 일관 서열 정책 |
| **disagreement / case** | G3 OD-1 (E1 고지 역전 가능 vs E2/E4 경향) |
| **engine 영향** | present/shallow 매핑 |
| **provenance** | G3 P7; OD-1 |
| **status** | POLICY-UNRESOLVED |

---

## C. Climate

### W1-POL-C01 — 일간의 climate/조후 판정 개입 범위

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C01` |
| **source group** | G4, G6 |
| **관련 rule** | CLI-002~004; CLI-018/019 |
| **결정 질문** | 일간을 **기후 본체**에 넣을지, **필요도/주체 해석**만 넣을지? |
| **말할 수 있음** | 객관 기후 ≠ 일간별 의미 구분은 공통에 가까움 |
| **결정할 수 없음** | 엔진 lookup에 일간 의존 여부 |
| **disagreement / case** | G4 OD-1; G6 OD-1; final OD-1 (A-9) |
| **engine 영향** | `baseClimate` / adjust / Need climate |
| **provenance** | G4 P1; G6 P4 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C02 — Month baseline → Chart final climate

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C02` |
| **source group** | G4 |
| **관련 rule** | CLI-002 (+ 전국 수정) |
| **결정 질문** | Baseline과 Final을 **어떻게 전환**할지? |
| **말할 수 있음** | 월지만으로 최종 확정 불가; baseline≠final |
| **결정할 수 없음** | 전환 규칙·전향 공식 |
| **disagreement / case** | G4 OD-2, OD-G4-04 |
| **engine 영향** | `BASE_CLIMATE` → adjusted 경로 |
| **provenance** | G4 P2 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C03 — 중간·전환월 범위

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C03` |
| **source group** | G4 |
| **관련 rule** | CLI-003a/c (`balanced` 등) |
| **결정 질문** | 중간·온화·전환월 **목록·라벨**을 어떻게 둘지? |
| **말할 수 있음** | 중간·전환 상태 **존재 가능** |
| **결정할 수 없음** | 卯辰만 vs 申酉 포함 등 확정 목록 |
| **disagreement / case** | G4 OD-3 |
| **engine 영향** | `temperature: balanced` 부여 |
| **provenance** | G4 P3 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C04 — 전국·합충·투간에 의한 한난/조습 수정

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C04` |
| **source group** | G4 |
| **관련 rule** | CLI-002~004 수정층 |
| **결정 질문** | 합충·투간 등으로 baseline을 **얼마나/어떻게 수정**할지? |
| **말할 수 있음** | 전국이 수정할 수 있음 |
| **결정할 수 없음** | 전향 공식·Case 정답 라벨 |
| **disagreement / case** | G4 OD-2, OD-G4-03/04/08 |
| **engine 영향** | chart climate final |
| **provenance** | G4 P4 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C05 — CLI-002/003/004 baseline lookup 수준 + G6 적용 문서화

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C05` |
| **source group** | G4, G6 |
| **관련 rule** | CLI-002 (CONTESTED), CLI-003*, CLI-004; CLI-018+ |
| **결정 질문** | 월지 표를 **baseline lookup만**으로 제한할지, 그 위 G6 조정을 어떻게 문서·제한할지? |
| **말할 수 있음** | 12칸 최종값 VERIFIED 아님; G6는 상류 CONTESTED에 묶임 |
| **결정할 수 없음** | 제품 해석 정책·적용 제한 범위 |
| **disagreement / case** | G4 P5; G6 P5; W1B6-U1 |
| **engine 영향** | `BASE_CLIMATE` 소비, adjustPolar 입력 |
| **provenance** | G4 P5; G6 P5 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C06 — 삼합 성립 후 火/水 activation

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C06` |
| **source group** | G5 |
| **관련 rule** | CLI-011/012 (수집 후층) |
| **결정 질문** | 삼합 완합 시 별도 **activation layer** vs **세력 환산**? |
| **말할 수 있음** | 본기 목록에 삼합·장생 **직접 편입하지 않음** |
| **결정할 수 없음** | 환산 강도·반합 처리 |
| **disagreement / case** | G5 OD-G5-A3; w1fr-03 |
| **engine 영향** | climate evidence / 국 처리 |
| **provenance** | G5 P1 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C07 — 지장간 火/水 유효 세기 + 조절 게이트

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C07` |
| **source group** | G5, G6 |
| **관련 rule** | CLI-011/012; CLI-021+ (quality); CLI-018/019 |
| **결정 질문** | hiddenStem 火/水의 **유효 세기**와 adjust **게이트**(투출·通根·quality)를 어떻게 연결할지? |
| **말할 수 있음** | 본기≠지장간; 존재≠조절; 투출·通根 등 필요 |
| **결정할 수 없음** | clear/substantial 수치 게이트; 층위 점수 |
| **disagreement / case** | final A-2/A-4/A-8; w1fr-01/07/08 |
| **engine 영향** | `qualityOf`, adjustPolar |
| **provenance** | G5 P2; G6 P3 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C08 — CLI-014 월지 branch factor 생략

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C08` |
| **source group** | G5 |
| **관련 rule** | CLI-014 (POLICY) |
| **결정 질문** | 월지 본기·월지 지장간 climate factor **생략을 유지**할지? |
| **말할 수 있음** | 월지 火/水 비중이 타 지지와 다름 (방향) |
| **결정할 수 없음** | CLI-014 채택/폐기 |
| **disagreement / case** | G5 A-10 / OD-G5-A10 |
| **engine 영향** | `collectClimateEvidence` month skip |
| **provenance** | G5 P4 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C09 — 계절 무관 수집 vs 계절 의존 작용 문서화

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C09` |
| **source group** | G5 |
| **관련 rule** | CLI-011/012 |
| **결정 질문** | 고정 巳午/亥子 **수집**과 조후 **작용의 계절 의존**을 엔진/문서에서 어떻게 분리할지? |
| **말할 수 있음** | 본기 목록 한정과 조절 계절 의존은 **다른 명제** |
| **결정할 수 없음** | 문서·코드 분리 설계 |
| **disagreement / case** | — |
| **engine 영향** | evidence vs adjust 문서 |
| **provenance** | G5 P5 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C10 — 한난·조습 엔진 함수 분리

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C10` |
| **source group** | G6 |
| **관련 rule** | CLI-018/019/036/037; `adjustPolar` |
| **결정 질문** | temperature vs moisture regulation을 **분리**할지, 동일 함수를 유지할지? |
| **말할 수 있음** | 동일 규칙/단일 함수로 **확정할 수 없음** (전문가 3/3) |
| **결정할 수 없음** | 구현 선택 (유지/분리) — **이 registry가 선택하지 않음** |
| **disagreement / case** | final A-7; CLI-036/037 CONTESTED |
| **engine 영향** | `adjustPolar`, temperatureRole/moistureRole |
| **provenance** | G6 P1 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C11 — 土를 moisture Climate factor로

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C11` |
| **source group** | G6 |
| **관련 rule** | CLI-019; CLI-013 |
| **결정 질문** | 濕土/燥土를 Climate **moisture factor**로 넣을지? |
| **말할 수 있음** | 조습에 土를 무시하기 어려움 |
| **결정할 수 없음** | CLI-013 변경 여부 |
| **disagreement / case** | final A-6; w1fr-06/07/08 |
| **engine 영향** | climate element 수집, CLI-013 |
| **provenance** | G6 P2; W1B6-U4 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-C12 — CLI-032 폭 · CLI-054 양축 동시

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-C12` |
| **source group** | G6 |
| **관련 rule** | CLI-032, CLI-054 |
| **결정 질문** | clear mit 시 **한 칸** 폭·한 火의 **T+M 동시 이동**을 어떻게 둘지? |
| **말할 수 있음** | Batch 6에서 **미판정** |
| **결정할 수 없음** | 폭·동시이동 정책 전부 |
| **disagreement / case** | — |
| **engine 영향** | `adjustPolar` 결과값 |
| **provenance** | G6 P6; W1B6-U3 |
| **status** | POLICY-UNRESOLVED |

---

## D. Need

### W1-POL-D01 — partial + clear-direction 공존 시맨틱

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-D01` |
| **source group** | G1 (post-validation Conflict 2) |
| **관련 rule** | STR-050/051 경로; certainty/resolution |
| **결정 질문** | `certainty=partial` + `resolution=clear-direction` 공존을 **허용**할지, 어휘를 나눌지? |
| **말할 수 있음** | provisional 메타(`directionSensitivity`)로 정보 손실은 해소됨 |
| **결정됨** | `partial` + leaning 시 `resolution=clear-direction` **유지** (Q3-B 라벨 개편 없음). UX는 `directionSensitivity=hour-unknown-provisional`로 잠정 해석 가능. |
| **disagreement / case** | Conflict C2-C |
| **engine 영향** | StrengthSummary 시맨틱 유지; Need는 D02에서 게이트 |
| **provenance** | G1 C2-C; `need-hour-policy-decision.md`; commit `c96b6ec` |
| **status** | POLICY-RESOLVED |

### W1-POL-D02 — hour-unknown-provisional 시 Need ready

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-D02` |
| **source group** | G1 (Conflict 2) |
| **관련 rule** | NeedCandidate / strengthNeedStatus |
| **결정 질문** | partial+provisional일 때 Need `ready`를 **유지/게이트**할지? |
| **말할 수 있음** | 시주 미상 leaning을 무조건 null로 강제하지 않음 (정보층) |
| **결정됨** | hour unknown + leaning-* + `hour-unknown-provisional`이면 Strength Need **게이트**. `strengthNeedStatus`를 `ready`로 만들지 않음. 후보 미노출. NeedResolution도 Strength 축을 ready로 취급하지 않음. confirmed hour leaning-*는 기존 `ready` 유지. |
| **disagreement / case** | Conflict C2-D |
| **engine 영향** | `needCandidates.ts`, `needResolution.ts` |
| **provenance** | G1 C2-D; commit `c96b6ec` |
| **status** | POLICY-RESOLVED / IMPLEMENTED |

### W1-POL-D03 — freeze-boundary ↔ STR-050/051/066 문서 정합

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-D03` |
| **source group** | G1 (Conflict 2) |
| **관련 rule** | STR-050, STR-051, STR-066 |
| **결정 질문** | freeze-boundary 문구와 코드 의미를 **어떻게 정렬**할지? |
| **말할 수 있음** | STR-066 의미 변경 없이 provisional 메타 추가됨 |
| **결정됨** | Strength 판정식(STR-050/051)과 leaning 진단은 **유지**. freeze “약/강으로 만들지 않음”은 **Need 확정 금지**로 정렬: 시간 미상 leaning은 provisional Strength, Strength Need는 unresolved. STR-066 의미·점수/threshold 변경 없음. |
| **disagreement / case** | Conflict C2-E |
| **engine 영향** | Need 게이트만; `decideDirection` 불변 |
| **provenance** | G1 C2-E; commit `c96b6ec` |
| **status** | POLICY-RESOLVED / IMPLEMENTED |

---

## E. Cross-domain

### W1-POL-E01 — 조후·격·용신을 Strength에 편입할지

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-E01` |
| **source group** | G1 |
| **관련 rule** | STR-010/011 vs Climate/格局 |
| **결정 질문** | 조후·격국·용신을 Strength 판정에 **넣을지/뺄지?** |
| **말할 수 있음** | STR 방향 검증 범위 밖 분기로 문서화됨 |
| **결정할 수 없음** | 편입 정책 |
| **disagreement / case** | G1 NV-7 (E3 편입 vs E2·E4 배제) |
| **engine 영향** | Strength 입력 축 |
| **provenance** | G1 NV-7 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-E02 — rootQuality → Strength 기여

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-E02` |
| **source group** | G3 |
| **관련 rule** | STR-030 → STR-031/033/050 |
| **결정 질문** | `rootQuality`를 Strength에 **어떻게 기여**시킬지? |
| **말할 수 있음** | structural ≠ effective; role≠최종 Strength |
| **결정할 수 없음** | STR-031/033/050 사용 방식 |
| **disagreement / case** | G3 OD-G3-04 Strength vs root 혼동 금지 |
| **engine 영향** | Strength pipeline |
| **provenance** | G3 P3 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-E03 — 월지 vs 타 지지 위치 가중 (Root + Climate 火水)

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-E03` |
| **source group** | G3, G5 |
| **관련 rule** | STR-030; CLI-011/012/014 |
| **결정 질문** | 월지 vs 년일시를 Root·Climate 火水에서 **동일 위치가중 정책**으로 둘지, 축별로 둘지? |
| **말할 수 있음** | 월지 ≠ 타 지지 동일 취급 어려움 (Root·Climate 공통 방향) |
| **결정할 수 없음** | 고정 배율; Root/Climate 통합 스케일 |
| **disagreement / case** | G3 P4 Case06; G5 OD-G5-A10; (Strength 쪽은 A05와 인접) |
| **engine 영향** | root 위치가중, climate slot 가중 |
| **provenance** | G3 P4; G5 P3 |
| **status** | POLICY-UNRESOLVED |

### W1-POL-E04 — 시주 미상 출력·운영 프로토콜

| 필드 | 내용 |
|---|---|
| **policyId** | `W1-POL-E04` |
| **source group** | G1 |
| **관련 rule** | STR-050/066; Need; UI/운영 |
| **결정 질문** | 시주 미상 시 **범위 출력 vs 보류** 등 운영 형식을 어떻게 둘지? |
| **말할 수 있음** | 조건부/유보가 반복 확인됨; provisional 메타 존재 |
| **결정됨** | 시주 미상 + leaning은 사용자 출력 **잠정(provisional)**. Strength 결과는 유지하되 Need는 확정 후보로 진행하지 않음. `directionCandidate=null`/mixed는 기존처럼 Strength Need unresolved. 확정 톤 금지. |
| **disagreement / case** | G1 remaining hour-unknown; C2-* |
| **engine 영향** | Need 게이트 + `directionSensitivity` 메타 (카피 레이어는 메타를 잠정으로 해석) |
| **provenance** | G1 phase1 remaining; Conflict 2; commit `c96b6ec` |
| **status** | POLICY-RESOLVED / IMPLEMENTED |

---

## Policy clusters (한 번에 결정할 묶음)

결정하지 않음 — **동시 검토 권고 묶음**만.

| Cluster | Members | 이유 |
|---|---|---|
| **CL-STR-WEIGHT** | A01, A03, A04, A05 | side 균등·감쇄·충돌 우위·월령/근 수치가 한 Strength 게이트로 연결 |
| **CL-ROOT-LAYER** | B01, B02, B05, E02 | structural/effective · STR-030 의미 · 중기/여기 · Strength 기여 |
| **CL-CLI-BASELINE** | C02, C04, C05 | baseline→final · 전국 수정 · CLI-002 위 G6 |
| **CL-CLI-DAYMASTER** | C01 | G4+G6 일간 범위 (단일 병합 항목) |
| **CL-CLI-FW-GATE** | C06, C07, C10, C11 | 국 활성 · hidden 세기 · 함수 분리 · 土 factor |
| **CL-NEED-HOUR** | D01, D02, D03, E04 | **RESOLVED / IMPLEMENTED** — Provisional Strength, Gated Need |
| **CL-POS-WEIGHT** | E03, A05 (인접) | 월지 우위가 Root/Climate/Strength에 반복 |

---

## Wave 2 전 vs 이후 (분류만 · 결정 아님)

### Wave 2 전에 반드시 결정해야 하는 것 (권고 게이트)

**CL-NEED-HOUR는 해소됨.** Need/Resolution·시주 미상 입력 시맨틱은 더 이상 이 클러스터로 Wave 2를 막지 않는다.

(Strength/Climate를 Wave 2가 **직접 재설계**하지 않는다면 A/C 전부 선행 필수는 아님. 남은 unresolved는 아래 집계.)

### Wave 2와 독립적으로 나중에 가능

- `W1-POL-A02` 편정 고정 δ  
- `W1-POL-A07` 왕상 점수 맵 · STR-026/027  
- `W1-POL-A08` Case06형 정답화 금지 유지 하의 게이트 설계  
- `W1-POL-B03`~`B05` 충/% · 장생묘고 · 중기/여기  
- `W1-POL-C03` 중간월 범위  
- `W1-POL-C06` 삼합 activation 세부  
- `W1-POL-C08`~`C09` CLI-014 · 계절 수집 문서화  
- `W1-POL-C11`~`C12` 土 factor · CLI-032/054  
- `W1-POL-E01` 조후·격·용→Strength  

### Wave 2 착수 시 함께 보면 좋은 것 (필수는 아님)

- `CL-STR-WEIGHT` (A01/A04/A05) — Strength Need 입력이면  
- `CL-CLI-BASELINE` (C02/C05) — Climate Need 입력이면  
- `W1-POL-E02` rootQuality→Strength  

---

## 집계

**POLICY-UNRESOLVED (남은 결정)**

| Domain | Count |
|---|---:|
| A Strength | 8 |
| B Root | 5 |
| C Climate | 12 |
| D Need | 0 |
| E Cross-domain | 3 |
| **Total unique unresolved** | **28** |

**POLICY-RESOLVED / IMPLEMENTED**

| ID | Cluster |
|---|---|
| W1-POL-D01, D02, D03, E04 | CL-NEED-HOUR (4) |

카탈로그 전체 unique = 32 (unresolved 28 + resolved 4).

**병합으로 흡수된 원천 P* 예:** G4 P1+G6 P4 → C01; G4 P5+G6 P5 → C05; G5 P2+G6 P3 → C07; G3 P4+G5 P3 → E03; G1 NV-4+G2 OD-2 → A03; G1 NV-5+G2 OD-3 → A05.
