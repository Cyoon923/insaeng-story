# Wave 2 NeedCandidate Closure

엔진 코드·freezeStatus·literature verdict 승격·rule ID 병합·점수/threshold·Wave 3·NEED-010/011/020/021 재검증은 이 문서로 하지 않는다.  
VERIFIED 금지. 신규 대형 전문가 설문 금지.

**대상 (최소 검증):** NEED-009, NEED-015, NEED-022  
**재사용만 (재검증 아님):** NEED-010, NEED-011, NEED-020, NEED-021 — `wave2-needcandidate-prep/wave2-evidence-reuse-audit.md` class A.

**근거:**
- `interpretive-validation-priority-audit.md`
- Wave 1 G1 literature: `batch-1/wave1-batch-1-evidence-hardening.md` (E-YH-02, E-SM-01)
- Wave 1 G6: `batch-6/g6-closure.md`, `wave1-batch-6-literature-validation.md`
- Wave 1 expert raw 재검색: G1 Phase1 / G2 / G6 / final-expert-round E1·E2·E4
- Need 구현 맵: `needCandidates.ts` RESOURCE/OUTPUT/WEALTH/OFFICIAL

---

## 0. Closure 판정

| 항목 | 판정 |
|---|---|
| Wave 2 NeedCandidate **검증 경계 종료** | **예 — CLOSE** |
| NEED-* **VERIFIED** | **금지 · 하지 않음** |
| freezeStatus / 엔진 변경 | **하지 않음** |
| NEED-010/011/020/021 재문헌·재설문 | **하지 않음** |
| NEED-015 신규 전문가 1문항 | **하지 않음** (직접 근거 없음 → POLICY-UNRESOLVED) |
| Wave 3 | **하지 않음** |

**의미:** CLOSE = 7개 NeedCandidate interpretive 항목의 **검증 경계가 문서화됨**. 규칙 확정·용신 검증이 아니다.

---

## 1. NEED-009 — 십신 오행 생극 lookup

**혼동 금지:** G1 STR-010/011은 십신을 Strength **support/pressure 묶음**이다. NEED-009는 **일간 오행 → 생극 대상 오행** 상수 맵이다.

### 코드 맵 (관측만)

| 관계 | 생극 | 木일간 | 火 | 土 | 金 | 水 |
|---|---|---|---|---|---|---|
| RESOURCE 인성 | 生我 | 水 | 木 | 火 | 土 | 金 |
| OUTPUT 식상 | 我生 | 火 | 土 | 金 | 水 | 木 |
| WEALTH 재 | 我克 | 土 | 金 | 水 | 木 | 火 |
| OFFICIAL 관 | 克我 | 金 | 水 | 木 | 火 | 土 |

표준 五行相生(수→목→화→토→금→수)·相克(목극토, 화극금, 토극수, 금극목, 수극화)과 **1:1 일치**.

### 기존 문헌 대조 (신규 문헌 수집 아님)

Wave 1 G1 hardening에 **이미** 있는 생극 명명:

| ID | 출처 | 생극 lookup에 쓰는 말 | G1 묶음과 |
|---|---|---|---|
| E-YH-02 | 《淵海子平》 论印綬 | **生我 = 印 = 生氣** | 인성 名만. support 집합 정의 아님 |
| E-SM-01 | 《三命通會》 古人立印食官財名義 | **生我印 / 我生食 / 我尅妻財 / 尅我官煞** | 네 방향 **명명**. 식재관을 한 pressure 축으로 묶지 않음 |

G1 STR-010/011 verdict(PARTIAL/CONTESTED)는 **묶음** 쟁점. NEED-009 lookup과는 **층을 분리**한다.

### 상태

| 필드 | 값 |
|---|---|
| **status** | **LOOKUP-CLOSED** (문헌 생극 명명 ↔ 코드 맵 일치) |
| **VERIFIED** | 아니오 |
| **용신 검증** | 아니오 |
| **추가 문헌/설문** | 아니오 |

---

## 2. NEED-022 — resolved dry → 水 (CLI-043과 동일 판단, 미합침)

G6 조습 경계를 **그대로 상속**. 새 규칙·새 verdict·새 함수 확정 없음.

| 상속 | 내용 |
|---|---|
| 동일 판단 | CLI-043 = NEED-022 (Audit §G). ID 합치지 않음 |
| Literature | CLI-019 CONTESTED · CLI-037 CONTESTED (변경 없음). Batch 6: 燥則宜潤 **방향**은 부분 있으나 土·한난 이축과 갈림 |
| Speakable 상속 | G6 S3 조습에 土 무시 어려움; S4 한난≠조습 동일 함수 확정 불가 |
| 한난 Need와 분리 | NEED-021(暖→水)과 **별 규칙**. 둘 다 水여도 합치지 않음 |
| 확정 금지 | CLI-013 土 factor, adjustPolar 분리, CLI-032 폭, dry 라벨 12칸 |

### 상태

| 필드 | 값 |
|---|---|
| **status** | **BOUNDARY-INHERITED** (G6 조습 CONTESTED 경로의 Need 층 별칭) |
| **VERIFIED / 신규 확정** | 아니오 |
| **추가 설문** | 아니오 |

---

## 3. NEED-015 — RV + 왕/상 → already-established-relation

**질문:** leaning-strong에서 이미 rooted-visible이고 계절 旺/相인 식상·재·관을 Need 후보에서 자동 suppressed하는 것이 판단 원칙으로 타당한가?

### Wave 1 재검색 (E1/E2/E4 · E3는 unavailable)

| 찾은 것 | 이 질문과의 관계 |
|---|---|
| G1 식재관 = 약화 **거시** | Strength 방향. Need **억제 게이트 아님** |
| G2 旺相 ≠ 최종 신강; 식재관이 득령을 약화할 수 있음 | Strength 뒤집힘. “이미 있는 관계를 Need에서 빼라”가 **아님** |
| P1-E3 A-8 식상 **得氣·旺이면 用(격)** | Need 자동 억제와 **반대 방향에 가까움**. 그래도 NeedCandidate 문항은 아님 |
| G6/G4 왕쇠≠조후 | Climate. Need-015 아님 |
| STR-026 상=help | G2 **미닫음**(ENG-5). Strength side ≠ Need suppression |

**직접 근거: 없음.** 자동 억제를 타당한 원칙으로 채택하거나 폐기한 Wave 1 답변이 없다.

### 결정

신규 1문항 설문은 **실행하지 않음** (직접 근거 공백을 설문으로 메우지 않음; 사용자 허용: POLICY-UNRESOLVED로 남김).

| 필드 | 값 |
|---|---|
| **status** | **POLICY-UNRESOLVED** |
| **제품 경로** | mixed면 `buildNeedCandidateSet` 미도달 (NEED-018). 코드 동작은 유지, 명리 채택 아님 |
| **추가 전문가 질문** | 지금 **불필요**. 나중에 이 게이트를 닫을 때만 최소 1문항 |

---

## 4. 재사용 class A (이번 문서에서 재검증하지 않음)

| Rule | 처리 |
|---|---|
| NEED-010 / NEED-011 | STR-070과 동일 판단. G1 억부 거시 재사용 |
| NEED-020 / NEED-021 | CLI-041/042와 동일. G6 S1 寒火·熱水 재사용 |

CL-NEED-HOUR: hour-unknown + leaning은 Strength Need gated (구현 유지, 재결정 아님).

---

## 5. Wave 2 전체

| 질문 | 답 |
|---|---|
| Wave 2 NeedCandidate CLOSE 가능? | **예** (검증 경계) |
| VERIFIED / 엔진 확정? | **아니오** |
| 지금 추가 전문가 질문? | **아니오** |

POLICY-UNRESOLVED로 남는 Need 층: **NEED-015만** (이번 7개 중).

---

## 6. 하지 않은 것

- 엔진 수정 · VERIFIED · freeze 변경
- NEED-010/011/020/021 재검증
- NEED-015 신규 설문
- Wave 3 · 용신/희신/순위
- G6 조습 정책 확정
