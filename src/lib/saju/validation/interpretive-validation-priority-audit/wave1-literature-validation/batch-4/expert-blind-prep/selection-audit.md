# Wave 1 Batch 4 — CLI-002~004 Expert Blind — Selection Audit

엔진·CLI-002~004·literature verdict·freezeStatus 미변경.
전문가 답·expected 미생성.
G3 재검증·G5 진행 금지.
선행 문헌: `../wave1-batch-4-literature-validation.md` (재작성 없음).

---

## 1. G4 검증 경계 (문헌에서 추출 · 재판정 아님)

| rule | literature (불변) | expert 초점 |
|---|---|---|
| CLI-002 | CONTESTED | 월지→한난·조습 **고정 쌍 lookup**이 타당한가 |
| CLI-003a | CONTESTED | 寅卯辰를 한 기후 묶음으로 보는가 |
| CLI-003b | PARTIALLY-SUPPORTED | 巳午未 열·조 묶음; **未=巳午** 여부 |
| CLI-003c | CONTESTED | 申酉戌 묶음·가을 조 |
| CLI-003d | PARTIALLY-SUPPORTED | 亥子丑 한·습; **丑=亥子** 여부 |
| CLI-004 | CONTESTED | 辰未戌丑 = 인접 계절과 **동일 기후**인가 |

문헌 unresolved (전문가 라운드가 닫지 않는 것 포함): W1B4-U1~U5.  
G6(CLI-018/019)·Need는 **비대상**.

선정 시 **사용:** 월지 글자·사계절 슬롯 커버.  
**미사용:** BASE_CLIMATE 값, adjusted climate, literature verdict, Strength/Need.

---

## 2. 최종 선정 (8)

| blindId | sourceId | 월지 | 커버 |
|---|---|---|---|
| w1b4-mc-01 | s13-eul-in-jeonggi-geop | 寅 | 초봄·餘寒 vs 봄 묶음 |
| w1b4-mc-02 | s14-jeong-o-wang-jeonggi | 午 | 한여름 열·조 |
| w1b4-mc-03 | s8-sin-mi-sang | 未 | 季夏·토월 vs 巳午 동일 |
| w1b4-mc-04 | s7-gap-jin-yogi | 辰 | 季春·토월 vs 寅卯 동일 |
| w1b4-mc-05 | s1-gimo-bingja-muo | 子 | 한겨울 한·습 |
| w1b4-mc-06 | s10-byeong-chuk-hyu | 丑 | 季冬·토월 vs 亥子 동일 |
| w1b4-mc-07 | s3-gap-yu-unrooted | 酉 | 중추·조/숙살 |
| w1b4-mc-08 | s9-gap-sul-mugun | 戌 | 季秋·토월 vs 申酉 동일 |

---

## 3. 제외

| id | 이유 |
|---|---|
| s2, s11, s16 | 寅 — 01로 커버 |
| s12 | 辰 — 04로 커버 |
| s15, s5 | 亥 — 겨울은 05로 커버 |
| s6 | 酉 — 07로 커버 |
| 신규 명식 | 금지 |

---

## 4. 하지 않은 것

- literature/engine 재작성
- climate 점수·BASE_CLIMATE 수정
- 전문가 답
- G5+
