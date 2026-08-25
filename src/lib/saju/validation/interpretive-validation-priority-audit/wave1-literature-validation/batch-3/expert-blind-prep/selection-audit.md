# Wave 1 Batch 3 — STR-030 Expert Blind — Selection Audit

엔진 코드·STR-030-*·literature verdict·freezeStatus를 바꾸지 않는다.
전문가 답·expected를 만들지 않는다.
G4 이후를 진행하지 않는다.

선행: `../wave1-batch-3-literature-validation.md`

---

## 1. 선정 원칙

사용 (raw만):

- 네 기둥 간지
- 일간 통근 hit의 지장간 **역할**(정기·중기·여기) — `analyzeStemRoots` (STR-005 층)
- 같은 지지에서의 **十二長生** 위치(참고 축; 엔진 rootQuality 미사용)
- 천간 **투간**(일간과 동일 글자 투출 여부)

사용 금지:

- `rootQuality` / clear / present / shallow
- directionCandidate / leaning-* / mixed
- StrengthSummary / Need* / literature verdict
- 신규 생년월일·신규 명식

풀: `axisReview.fixtures.json` + `conflictType.fixtures.json`

---

## 2. 후보 검토 요약

| id | 역할(요약) | 장생(근 지지) | 비고 |
|---|---|---|---|
| s13 | 월 寅 정기만 | 帝旺 | 본기만·월지 |
| s1 | 일·시 午 중기만 | 帝旺 | 중기만 |
| s7 | 월 辰 여기만 | 衰 | 여기만 |
| s16 | 월 寅 여기만 | 死 | 여기만(약 장생) |
| c2 | 辰·丑 정기 + 寅 여기 | 衰·墓·死 | 본기+약한 장생 |
| s12 | 寅여기+辰정기+午중기 | 長生·冠帶·帝旺 | 여기+長生 포함 |
| s10 | 년 巳 정기만 | 臨官 | 타 지지 근(월지 무근) |
| s2 | 년·월 寅 정기 + 甲 투간 | 臨官 | 투간 있음 |
| s14 | 월 午 정기, 동간 투간 없음 | 臨官 | 투간 없음 |
| s11 | 년·월 寅 중기 | 死 | 중기+死(대비용) |

최종 **8**건.

---

## 3. 최종 선정

| blindId | sourceId | 커버 슬롯 |
|---|---|---|
| w1b3-rd-01 | s7-gap-jin-yogi | 여기만 |
| w1b3-rd-02 | s13-eul-in-jeonggi-geop | 본기만(월지) |
| w1b3-rd-03 | s1-gimo-bingja-muo | 중기만 |
| w1b3-rd-04 | c2-gi-sa-jeonggi-support | 본기 + 十二長生상 약(墓·衰) |
| w1b3-rd-05 | s12-mu-jin-wang-multi | 여기 + 長生이 있는 지지(다층 근) |
| w1b3-rd-06 | s10-byeong-chuk-hyu | 타 지지(년) 근 · 월지 무근 |
| w1b3-rd-07 | s2-gap-in-unknown-hour | 본기 + 투간 있음 |
| w1b3-rd-08 | s14-jeong-o-wang-jeonggi | 본기 + 투간 없음 |

---

## 4. 제외

| id | 이유 |
|---|---|
| s3, s8, s9, s15, i1 | 무근 — 깊이 3단 비표적 |
| s16, i2 | 여기만 슬롯 s7로 커버 |
| s11 | 중기만은 s1로 커버 |
| s4, s6 | 본기 다중·슬롯 중복 |

---

## 5. 하지 않은 것

- rootQuality/Strength 조회 후 맞춤 선정
- 신규 명식
- 전문가 답·verdict·엔진 변경
- G4+
