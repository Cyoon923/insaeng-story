# OPEN Impact Audit — CLI-049 ↔ NEED-027 ↔ RES-028

엔진 수정·OPEN 해결·새 명리 규칙·전문가/문헌 추가 검증은 이 문서로 하지 않는다.

**질문:** 이 체인이 **지금 구현 필수**인가?

**대상**

| ID | 관측 |
|---|---|
| CLI-049 | Climate 층: moist/`climate-moisture-already-moist` counterSignal **생성 미구현** |
| NEED-027 | NeedCandidate: `climateCounterSignals: []` **리터럴 고정** |
| RES-028 | NeedResolution: 그 배열을 `counterSignals`로 **복사만** (입력이 항상 `[]`) |

**코드 근거:** `needCandidates.ts` return `climateCounterSignals: []` · `needResolution.ts` map 복사 · Climate freeze J (warm+moist 월지 표 없음) · Need open questions (“counterSignal을 구현하지 말 것”)

---

## 1. 실제 도달 가능한가

| 경로 | 도달 |
|---|---|
| `buildNeedCandidateSet` → `climateCounterSignals` 필드 | **항상** (값이 항상 `[]`) |
| moist / warm+moist **생성 로직** | **도달 불가** — 코드 없음. BASE에 warm+moist 월지도 없음 |
| RES-028 climate 슬롯 복사 | **항상** 빈 배열만 합류 |
| Strength `already-established-relation` → `counterSignals` | **별 경로** (RES-027). 본 OPEN 체인 아님 |

**요약:** 빈 슬롯·복사는 매 호출 도달. **설계된 climate counterSignal 생성은 dead path.**

---

## 2. 사용자 결과에 노출되는가

| 표면 | 노출 |
|---|---|
| `src/app` UI | **없음** — `needResolution` / `counterSignals` 미사용 |
| `buildValidationReport` | 객체에 배열 포함 가능. `validationStatus`는 `relationPattern` · `finalDecisionBlocked`만. **counterSignals로 판정/카피하지 않음** |
| 인생곡·상담·결제 플로우 | **비의존** |

**요약:** 제품 사용자 화면 기준 **비노출**. 내부 리포트·테스트·audit trace만.

---

## 3. 미구현이어도 Strength / Need 핵심이 틀어지는가

| 핵심 | 영향 |
|---|---|
| Strength `directionCandidate` / certainty | **없음** |
| Strength Need 후보 · `strengthNeedStatus` | **없음** (후보 생성 루프가 climateCounterSignals를 안 읽음) |
| Climate Need 후보 (cold→火, warm→水, dry→水) | **없음** |
| `relationPattern` / RES-012~015 `status` | **없음** (active Set만 사용) |
| `decisionBlockedBy` | **없음** |

Need audit: “`climateCounterSignals`는 항상 `[]`. **후보 생성/삭제에 영향 없음**.”

**요약:** 핵심 Strength/Need **결과 왜곡 없음.**

---

## 4. 단순 메타 / 보조진단인가

**예.**  
타입·전달 슬롯만 있는 **예약 진단 필드**. score/priority/winner 아님. 후보를 지우거나 축을 바꾸지 않음.  
(Strength suppressed counterSignal은 별도 메타 — 구현됨, 본 체인 아님.)

---

## 5. 운율 MVP에서 지금 막는 기능이 있는가

**없음.**  
가사·스타일·결제·상담 예약·사주 입력 플로우는 이 슬롯에 의존하지 않음.  
Needed Element / 용신 UI도 아직 제품 최종으로 내보내지 않는 경계와 일치.

---

## 6. 나중으로 미뤄도 되는가

**예.**  
구현하려면: (a) moist counter 명리·제품 의미 결정, (b) warm+moist 표/정책(현재 표에 없음), (c) UX에 쓸지 여부 — 모두 Wave 1~3 CLOSE 밖·OPEN 백로그.

억지 구현은 Need open questions의 “구현하지 말 것”과도 충돌.

---

## 결론

| 선택지 | 해당 |
|---|---|
| IMPLEMENT-NOW | 아니오 |
| **DEFER** | **예** |
| REMOVE-DEAD-PATH | 아니오 (빈 슬롯·복사는 의도적 plumbing. 생성 로직만 미구현. 타입 제거는 지금 불필요) |

### **DEFER**

**이유**
1. 생성 경로 dead · 제품 UI 비노출  
2. Strength/Need/RES status 핵심 불변  
3. 메타 슬롯일 뿐 MVP 기능 비차단  
4. 구현 시 명리·표·UX 선행 결정 필요 → 지금 OPEN을 닫을 이유 없음  

### 실제로 막는 기능

**없음** (운율 MVP · 현재 사용자 결과 경로).

### 다음 작업

1. 이 체인을 **백로그 DEFER**로 두고 Wave/OPEN 강제 해결하지 않음  
2. 제품 우선: Wave 1 잔여 POLICY-UNRESOLVED 트랙, NEED-015(별도), RES speakable/UX(경계는 Wave 3 고정)  
3. climate counterSignal은 **제품이 moist 보조진단을 쓸 때**만 재오픈  

---

## 하지 않은 것

- 코드 수정 · OPEN 해결 · 새 명리 규칙  
- 전문가/문헌 추가 검증 · 슬롯 삭제
