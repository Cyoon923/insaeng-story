# Operator only — G3 expert panel operating conditions

전문가에게 **이 문서를 전달하지 않는다.**  
`expert-blind-package.md` 질문·본문은 **변경하지 않는다.**

G1/G2 결과·문서·엔진·STR-030-*·literature verdict·freezeStatus **미변경**.

---

## 패널 (확정)

| expertId | 역할 | status |
|---|---|---|
| E1 | G3 수집·비교·집계 대상 | **active** |
| E2 | G3 수집·비교·집계 대상 | **active** |
| E3 | G3 전문가 검증 대상 아님 | **unavailable** |
| E4 | G3 수집·비교·집계 대상 | **active** |

**확정 패널 수:** 3 (E1, E2, E4).

---

## E3 규칙

1. status = **unavailable** (pending / 대기 / 추가 수집 예정 **아님**).
2. E3 답변을 **추정·생성·보완·백필하지 않는다.**
3. E3 미수집을 G3 closure의 **미완료 작업으로 남기지 않는다.**  
   closure 시 E3는 “구조적 unavailable”로만 기록한다.
4. 비교·집계·합의 관찰에서 E3 칸을 비우거나 제외한다. “4명 중 3명”으로 미달 처리하지 않는다.

---

## 비교·집계 규칙

- 입력: **E1 / E2 / E4** raw만.
- **다수결 정답화 금지.** 2/3·3/3 합의도 규칙 채택·VERIFIED·엔진 변경의 근거가 아니다.
- open disagreement·학파 차이는 그대로 유지한다.

---

## 보존

- G1 / G2 expert results·closure: 읽기만, 수정 금지.
- engine / STR / literature verdict / freezeStatus: 변경 금지.
- `expert-blind-package.md`: 질문 내용 변경 금지.
