# Operator only — G4 expert panel operating conditions

전문가에게 **이 문서를 전달하지 않는다.**  
`expert-blind-package.md` 질문·본문은 패널 운영과 별개로 유지한다 (전달 전 질문 누수 금지).

G1–G3 결과·문서·엔진·CLI/STR literature verdict·freezeStatus **미변경**.
G3 재검증·G5 진행 **금지**.

---

## 패널 (확정)

| expertId | 역할 | status |
|---|---|---|
| E1 | G4 수집·비교·집계 대상 | **active** |
| E2 | G4 수집·비교·집계 대상 | **active** |
| E3 | G4 전문가 검증 대상 아님 | **unavailable** |
| E4 | G4 수집·비교·집계 대상 | **active** |

**확정 패널 수:** 3 (E1, E2, E4).

---

## E3 규칙

1. status = **unavailable** (pending 아님).
2. E3 답변 **추정·생성·보완·백필 금지**.
3. E3 미수집을 G4 closure **미완료 작업으로 남기지 않음**.
4. 비교·집계는 E1/E2/E4만. “4명 중 3명 미달”로 처리하지 않음.

---

## 비교·집계 규칙

- 입력: E1 / E2 / E4 raw만.
- **다수결 정답화 금지.**
- literature와 합쳐 verdict/VERIFIED 만들지 않음.

---

## 보존

- G1/G2/G3: 읽기만.
- engine / CLI / STR / freezeStatus: 변경 금지.
- Batch 4 literature: 재작성 금지.
