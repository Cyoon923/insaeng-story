# STR-010 / STR-011 Phase 1 Closure

엔진 코드·STR-010/011 verdict·freezeStatus는 이 문서로 바꾸지 않는다.  
VERIFIED 승격·literature verdict 변경·expected·점수·가중치·threshold·Wave 2를 하지 않는다.  
다수결을 정답으로 해석하지 않는다.  
전문가 observation을 literature verdict로 승격하지 않는다.

**근거:**
- `pilot-5-cases/aggregate/wave1-batch-1-expert-pilot-aggregate.md`
- `pilot-5-cases/aggregate/wave1-batch-1-expert-pilot-closure.md`
- `phase-1-results/phase1-aggregate.md`
- `phase-1-results/phase1-aggregate-inventory.json`

**Literature 층 (변경 없음):** STR-010 PARTIALLY-SUPPORTED · STR-011 CONTESTED.

---

## 0. Closure 판정

| 항목 | 판정 |
|---|---|
| Phase 1 expert validation **종료 가능** | **예** |
| Pilot + Phase 1로 **검증 경계 확정 가능** | **예** |
| STR-010/011 **VERIFIED** | **금지 · 하지 않음** |
| Literature verdict 변경 | **하지 않음** |
| freezeStatus 변경 | **하지 않음** |
| 엔진·점수·가중 변경 | **하지 않음** |
| Wave 2 | **금지** |
| 추가 전문가 +N 자동 권고 | **하지 않음** (항목별 판단 §4) |

**의미:** Phase 1은 “규칙 확정”이 아니라 **말할 수 있는 / 없는 범위의 확정**으로 닫는다.

---

## 1. Expert-supported observations

Pilot(4인) + Phase 1(4인, 동일 ID 재참여)에서 **반복**된 observation.  
정답·엔진 규칙·literature VERIFIED가 아니다.

| ID | Observation | 근거 요약 |
|---|---|---|
| ES-1 | **비겁·인성 → 일간 강화(+) 방향** | Pilot·Phase 1 방법론 4/4; control 생조형(Pilot 02 · p1-02†) strong |
| ES-2 | **식상·재성·관성 → 일간 약화(−) 거시 방향** | Pilot·Phase 1 방법론 4/4; control 감쇄형(Pilot 01 · p1-01) weak |
| ES-3 | **월령·통근(득지)이 세력 판단에 중요** | Pilot C5 · Phase 1 방법론 4/4 |
| ES-4 | **방향 묶음 ≠ 실제 작용량/동일 강도** | 양대 묶음 허용하되 기전·강도 분리 (Pilot·Phase 1) |
| ES-5 | 시주 미상은 **weak 방향 + 조건부/유보**가 정상 | Pilot 05 · p1-08; 설계 실패 아님 |

† p1-02: E3는 DQ-1로 agreement 제외 → 3/3.

**케이스 방향 (Phase 1, DQ 반영):**  
01·04·07·08 weak(lean) 합의 · 02†·03·05 strong(lean) 합의 · **06 open**.  
다수결 = 정답 아님.

---

## 2. NOT validated

아래는 Pilot+Phase 1으로 **확정·채택하지 않는다**.  
엔진 파라미터·STR VERIFIED·freeze에 쓰지 않는다.

| ID | 항목 | 이유 |
|---|---|---|
| NV-1 | **동일 가중치** | E2 거부 · E4 1차 개수 · E3 차별점수 — 미수렴 |
| NV-2 | **단순 개수 합산으로 최종 등급** | 동일; E1은 합충회국 우선 |
| NV-3 | **편/정 고정 강도차**(예: 상관=−0.6 고정) | 방향 동일에 가깝지만 수치·서열은 개인 제안만 |
| NV-4 | **재성의 정확한 감쇄 메커니즘** 단일화 | 방향만 합의; 소모/재극인/통제비용 미통일 |
| NV-5 | **월령/통근/투출의 수치 우선순위** 단일 스케일 | 30–40%·±1.0·월>일 등 개인안만 |
| NV-6 | **합충의 Strength 가중** 표준 | E4 방법론 미기재; E3만 희/용 점수축 |
| NV-7 | **조후·격국·용신을 Strength에 넣는 방식** | E3 편입 vs E2·E4 배제 — open |
| NV-8 | **Case 06(p1-06) 최종 정답** | 실질 disagreement; 다수결 금지 |
| NV-9 | Pilot Case 04 / p1-03의 **단일 교차 라벨 정답** | Pilot open; Phase 1 p1-03은 방향만 strong 합의(E3 근거 오염) |

---

## 3. Data-quality boundary

분석·closure에서 **판정 불일치와 섞지 않는다**.

| ID | Boundary |
|---|---|
| **DQ-1** | Case 02 / E3: 일간 甲→庚 오독 → **agreement·방향 집계에서 제외** |
| **DQ-2** | Case 03 / E3: 월지 丑을 寅으로 득령 채점 → **최종 방향만 사용 가능**; **득령·점수 근거는 사용 금지(오염)** |
| DQ-3·4 | E1 차트 표기 경미 → 본문 판정 축은 유지 |
| DQ-5 | E3 만세력 메모 → 오독 아님 |

이후 라운드에서도: 오독 응답은 “학파 불일치”로 세지 않는다.

---

## 4. Unresolved별 — 추가 전문가 필요 여부

**원칙:** “미해결 = 무조건 +4인”이 아니다.  
Phase 1 목적(방향·경계 observation) 대비 **지금 인원이 경계를 말하는지**만 본다.

| Unresolved | 현재 지도 | 추가 전문가 필요? | 판단 |
|---|---|---|---|
| **p1-06 방향** | E1·E2 강 쪽 ↔ E3·E4 약 쪽; 질 vs 개수 긴장 이미 문서화 | **아니오 (Phase 1 종료 조건으로)** | 불일치 **존재**가 검증 결과. 정답화용 증원은 금지 범위. 훗날 빈도 지도가 필요하면 **선택적·별도 스코프**. |
| **동일가중·개수 합산** | 4인 입장이 이미 대립적으로 선명 | **아니오** | NOT validated로 경계를 닫는 것이 목적. 합의 강제용 증원 불필요. |
| **조후·격·용 → Strength** | E3 vs E2·E4 분기 명확 | **아니오 (본 STR 방향 검증 범위에서)** | STR-010/011 핵심(십신 방향) 밖. 별도 audit 후보이지 Phase 1 필수 증원 아님. |
| **재성 기제 단일화** | 방향 합의·기제 어휘 분산 | **아니오** | 방향 ES-2로 충분. 기제 taxonomy는 후속 주제 후보. |
| **월령/통근/투출 수치 순위** | 개인 스케일만 | **아니오** | 수치 합의는 전문가 수로 해결되지 않음 → NV-5로 닫음. |
| **합충 Strength 가중** | 미표준 | **아니오** | NV-6; 방향 observation과 무관하게 미검증 확정. |
| **시주 미상 프로토콜 단일화** | 조건부/유보 반복 확인 | **아니오** | 운영 선택지 정리면 충분; 증원 불필요. |
| **편/정 고정 강도** | 방향 분리까지는 채워짐 | **아니오** | 고정 강도는 NV-3. |
| **Literature ↔ Expert 병합** | 프로세스 규칙 | **아니오** | 전문가 수와 무관. |

### 종합 (추가 전문가)

| 질문 | 답 |
|---|---|
| Phase 1 closure를 위해 지금 +4인 필요한가? | **아니오** |
| 자동으로 추가 전문가 라운드를 시작하는가? | **아니오** |
| 언제 추가 전문가가 의미 있나? | **선택적:** (a) Case 06형 **빈도 지도**만 목적이거나 (b) 재성 기제·조후혼합 등 **별도 스코프**를 새로 열 때. 그때도 다수결=정답·VERIFIED 금지. |

---

## 5. STR-010 / STR-011 — 현재 말할 수 있는 정확한 범위

### 말할 수 있음 (Expert observation 층)

1. 본 Pilot+Phase 1 표본에서, 전문가들은 비겁·인성을 일간 세력 **강화 방향**으로 둔다.  
2. 식상·재·관을 일간 세력 **약화 거시 방향**으로 둔다 (재성 **기제**는 미확정).  
3. 월령·통근을 단순 십신 라벨 개수보다 중요하게 본다.  
4. 방향 묶음은 스크리닝에 쓰이되, **동일 가중·동일 작용량**으로 확정되지 않았다.  
5. Literature PARTIAL/CONTESTED와 Expert 방향 agreement는 **별층**이다.

### 말할 수 없음

1. STR-010/011이 literature에서 **SUPPORTED / VERIFIED**다.  
2. 엔진이 **동일 가중** 또는 **특정 수치 스케일**을 써야 한다 / 쓰면 안 된다(정책 확정).  
3. Case 06(또는 Pilot 04)의 **정답 Strength**.  
4. 조후·격·용신을 Strength에 **넣어야/빼야** 한다.  
5. 편/정의 **고정 감점표**.  
6. Expert agreement = literature 승격.

### Literature 상태 (유지)

| Rule | Status | Phase 1 효과 |
|---|---|---|
| STR-010 | PARTIALLY-SUPPORTED | **변경 없음** |
| STR-011 | CONTESTED | **변경 없음** |

Expert 방향 agreement는 literature를 **닫거나 올리지 않는다**.

---

## 6. 남은 unresolved (closure 후에도 목록으로만 유지)

경계는 확정됐으나 **채택하지 않은** 주제:

1. p1-06 유형: 득령·근의 질 vs 설극 개수·충형 — 정답 없음, 긴장만 기록  
2. 개수/동일가중 정책 (엔진 결정 시 별도 근거 필요)  
3. 재성 기제 taxonomy  
4. 월령·통근·투출·합충·조후·격용의 Strength 편입 여부  
5. 시주 미상 출력 형식(범위 vs 보류) 운영 선택  

위는 “Phase 1 실패”가 아니라 **NOT validated 목록**.

---

## 7. 하지 않은 것

- STR-010/011 VERIFIED · freezeStatus · literature verdict 변경  
- 엔진 코드·점수·가중·threshold  
- expected · Wave 2  
- 추가 전문가 자동 모집  
- raw / aggregate 원문 재작성(본 closure·inventory만 신규)

---

## 8. Closure 체크리스트

- [x] Expert-supported observations 기록  
- [x] NOT validated 기록  
- [x] DQ boundary 기록  
- [x] Unresolved별 추가 전문가 필요성 개별 판단  
- [x] VERIFIED / freeze / Wave 2 / 엔진 변경 없음  
- [x] Phase 1 **종료 가능**
