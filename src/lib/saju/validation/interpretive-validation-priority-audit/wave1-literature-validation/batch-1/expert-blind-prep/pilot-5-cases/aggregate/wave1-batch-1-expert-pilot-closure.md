# STR-010 / STR-011 Expert Pilot — Closure Evaluation

엔진 코드·STR-010/011 verdict·freezeStatus는 이 문서로 바꾸지 않는다.  
VERIFIED 승격·expected·점수·가중치·threshold·Pilot 5건 맞춤 규칙을 만들지 않는다.  
전문가 답을 생성하지 않는다. Wave 2로 진행하지 않는다.  
다수결을 정답으로 해석하지 않는다.

**근거:**  
`aggregate/wave1-batch-1-expert-pilot-aggregate.md`  
`aggregate/wave1-batch-1-expert-pilot-aggregate-inventory.json`  
`raw/E1-raw.md` … `raw/E4-raw.md`

Literature 층 (변경 없음): STR-010 PARTIALLY-SUPPORTED / STR-011 CONTESTED.

---

## 1. Pilot 목적 달성 여부

| Pilot 목적 | 상태 |
|---|---|
| 엔진·문헌 미노출 블라인드 프로토콜로 STR-010/011 방향 질문 | **달성** |
| 4인 raw 원문 보존·비교 가능 | **달성** |
| 방향 묶음(비겁+인성 / 식상·재·관) observation | **달성** |
| Case로 추상 답과 명식 답의 긴장 관찰 | **달성** (특히 04) |
| STR-010/011을 닫거나 VERIFIED로 승격 | **목적 밖 · 미실시 (정상)** |
| 엔진 동일 가중 확정 | **목적 밖 · 미달성·미실시 (정상)** |

**판정:** Expert Blind **Pilot 단계는 종료 가능**.  
Pilot이 “규칙 확정”까지 끝낸 것은 아니다.

---

## 2. 4/4 방향 수렴이 확인된 범위

Observation only (정답 아님).

| 범위 | 수렴 |
|---|---|
| 비겁+인성 → 강화(+) 방향 | **4/4** |
| 식상+재+관 → 약화(−) 거시 방향 | **4/4** (재성 기제는 분리·조건부 disagreement) |
| 월령·통근·위치 > 단순 개수 | **4/4** |
| Case 01 direction = weak | **4/4** |
| Case 02 direction = strong | **4/4** |
| Case 03 direction = weak | **4/4** |
| Case 05 direction = weak (삼주) | **4/4** + uncertainty 공통 |

**수렴하지 않은 것:** 세등급(편약/차약/극약 등), Case 04 최종 라벨, 동일 가중 허용, 재성 기제, 편/정 전면 합의.

---

## 3. Case 04 disagreement — 추가 검증 요구 여부

**요구함 (Phase 1 핵심).**

이유 (observation):
- 전원 교차 구조(인성 투출·근 vs 실령·재성)는 공유.
- 최종 Strength 라벨은 open disagreement (중화신강 쪽 ↔ 신약/중화~신약).
- E2가 판단자 갈림을 raw에서 명시.

해석 금지:
- 3:1 또는 유사 비율을 정답으로 쓰지 않음.
- Pilot 04 한 건으로 엔진 분기 규칙을 만들지 않음.

Phase 1에서 필요한 것: **같은 구조 유형의 추가 case**로 disagreement가 재현·세분화되는지 관찰 (맞춤 규칙 금지).

---

## 4. Case 05 uncertainty — 설계 결함 vs 정상 조건부

**정상적인 조건부 판단에 가깝다.** 테스트 “실패”로 보지 않는다.

| 관점 | 평가 |
|---|---|
| Pilot 설계 | 시주 미상 슬롯을 **의도적으로** 포함 |
| 4인 응답 | 전원 시주/야간 경계 uncertainty를 **명시** |
| 방향 | 삼주 기준 weak는 4/4 |

다만 Phase 1에서는:
- “시주 미상 = 등급 확정 불가/구간 판정” 프로토콜을 **질문으로** 더 분명히 물을 것,
- 야간 일주 변동을 **별 case**로 둘지 설계 선택.

Case 05를 폐기하거나 Pilot 무효로 돌리지 않는다.

---

## 5. Pilot 종료 / Phase 1 권고

| 항목 | 권고 |
|---|---|
| Pilot 종료 | **가능 · 권고 (종료)** |
| STR-010/011 VERIFIED 승격 | **금지 · 하지 않음** |
| Literature verdict 변경 | **하지 않음** |
| Phase 1 확대 진입 | **권고 (예)** — 방향 스크리닝 다음의 **경계·기제** 검증 |
| Wave 2 | **금지** |

Phase 1 = STR-010/011 expert validation **확대 라운드** (Pilot 후속).  
엔진 구현·Need 층·Wave 2와 혼동하지 않는다.

---

## 6. Phase 1에서 더 검증할 핵심 질문

1. **교차 구조(Case 04형):** 월령·재성 압력 vs 천간 인성·근이 맞설 때, 전문가는 방향을 어떻게 두는가? (라벨 다수결 금지)
2. **재성 기제:** 약화 방향 동의와 별개로, 소모 / 파인조건부 / 탈기 일괄 중 무엇을 쓰는가?
3. **방향 묶음 ≠ 동일 가중:** 스크리닝용 묶음을 인정하면서도 최종 등급에 개수 합산을 거부하는가? (E1 공백 보완)
4. **편/정:** 1차 방향 동일 vs 강도·역할 차이 — E1·E2형 공백을 메울 명시 질문
5. **시주 미상 프로토콜:** 기준 등급 + 변동 범위를 허용하는가, 판정 보류인가?
6. (유지) Literature PARTIAL/CONTESTED와 Expert 방향 agreement는 **별층** — 병합해 VERIFIED로 올리지 않음

---

## 7. 권장 expert / case 범위와 이유

### Experts
- **추가 약 4~8인** (합계 대략 8~12인 수준 목표; 고정 quota 아님)
- 이유: Pilot 4인은 **방향 스크리닝**에는 충분. Case 04형·재성 기제·편정은 **학파 분산**이 더 필요.  
- 다수결 정답화 금지 → 인원 증가는 “합의 강제”가 아니라 **불일치 지도**용.

### Cases
- **추가 약 6~10건** (Pilot 5 재탕·규칙 맞춤 제작 금지)
- 우선 유형:
  - Case 04형 교차(인성 다수 투출 + 실령·재왕) **2~3**
  - 재성 유·무 / 파인 가능 구조 **2**
  - 편·정 대비가 드러나는 입력 **1~2**
  - 시주 미상 + (선택) 야간 일주 경계 **1~2**
- Case 01~03형 “방향 명확”은 **소수만** 앵커로 유지 (재확인용).

선정은 계속 raw 구조(간지·십신 매핑)만 사용. 엔진 leaning으로 고르지 않음.

---

## 8. Unresolved (종료 평가 시점)

| id | status |
|---|---|
| W1B1-EP-U1 E1 provenance | resolved |
| W1B1-EP-U2 Case 04 disagreement | **open → Phase 1** |
| W1B1-EP-U3 Case 05 hour uncertainty | open (정상 조건부; Phase 1 프로토콜) |
| W1B1-EP-U4 재성 기제 | **open → Phase 1** |
| W1B1-EP-U5 동일 가중 (E1 불명) | **open → Phase 1** |
| W1B1-EP-U6 편/정 공백 | **open → Phase 1** |
| W1B1-EP-U7 literature↔expert 층 분리 | **유지** |
| W1B1-EP-CLOSE-01 | Pilot 종료 가능; 규칙 미폐쇄 |
| W1B1-EP-CLOSE-02 | Phase 1 진입 권고; Wave 2 비진입 |

---

## 9. 하지 않은 것

- STR-010/011 VERIFIED / verdict / freeze 변경  
- 엔진·점수·가중치·threshold·Pilot 맞춤 규칙  
- 전문가 답 생성  
- Wave 2  
- aggregate observation 재작성 (본 문서는 종료 평가만)
