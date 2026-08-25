# Climate Open Questions

답을 새로 정하지 않는다.
엔진을 이 문서로 바꾸지 않는다.

---

## HIGH-RISK CLIMATE INTERPRETIVE RULES

전문가·문헌 검증 전에는 제품 결론으로 내보내지 말 것.

1. **12월지 baseClimate 분류 자체** (CLI-002)
   - 코드 표가 있다. 검증된 조후표가 아니다.

2. **寅을 balanced로 두는 것** (CLI-003a)
   - 인월을 한으로 보는 조후와 충돌할 수 있다.

3. **辰 / 丑 / 未 / 戌의 조후** (CLI-004)
   - 현재는 고유 토 조후가 아니라 인접 계절과 동일.
   - 습토/조토 세분은 lookup에 없고, Earth factor도 없다.

4. **Fire quality가 cold를 얼마나 완화하는가** (CLI-021 vs CLI-032)
   - clear → 한 단계 balanced.
   - substantial → 이동하지 않고 unresolved.
   - hidden/shallow는 0단계.
   - 이 간격이 명리적으로 맞는지 미검증.

5. **Water quality가 warm을 얼마나 완화하는가**
   - Fire/cold와 대칭인 같은 함수. 대칭이 타당한지 미검증.

6. **Fire가 moist를 얼마나 완화하는가** (CLI-036)
   - cold 완화와 **동일** `adjustPolar`.
   - 한난과 조습의 민감도가 같다는 가정.

7. **clear / substantial / shallow / hidden / branch-only 차이**
   - 라벨 조건은 코드에 있다.
   - 그 라벨이 조후 강도를 대표하는지는 INTERPRETIVE.

8. **substantial이면 unresolved** (CLI-031)
   - 과잉 판단을 막기 위한 ENGINE-POLICY.
   - 명리 정답이 아니다.

9. **clear이면 한 단계만 balanced, 반대 극단 금지** (CLI-032)
   - 가장 강한 제품 체감 규칙 중 하나.

10. **cold → 火 Need** (CLI-041)
    - 상태 판정 다음의 해석. FACT 아님.

11. **warm → 水 Need** (CLI-042)

12. **dry → 水 Need** (CLI-043)
    - moist는 Need를 열지 않음 (CLI-044, ENGINE-POLICY).

13. **시간 미상 시 보정 확정** (CLI-039, CLI-040)
    - partial이어도 resolved 가능.
    - substantial일 때만 경고 노트.
    - 시주가 바뀌면 quality가 바뀌어도 축을 지금 닫는다.

14. **같은 火가 한난과 조습을 동시에 한 단계씩 이동** (CLI-054)
    - 점수는 아니다. 이중 효과는 있다.

---

## Open

- CLI-023 shallow 전용 회귀 명식이 거의 없다.
- CLI-029 `both-fire-and-water-clear-or-substantial`을 관측하는 기존 필수 CASE가 없다.
- CLI-035 moisture balanced 분기는 현재 12월지 표에서 dead.
- CLI-049 counterSignal 슬롯은 있고 생성은 없다. warm+moist는 표에도 없다.
- 월지 skip(CLI-014)과 presence rooted(CLI-022)의 겹침이 substantial을 얼마나 만드는지 표본이 적다.
- Need 火/水가 Adjusted 상태의 해석이라는 점을 블라인드 비교에서 어떻게 물을지 미정.

---

## 하지 말 것

- 이 질문으로 baseClimate를 지금 고치지 말 것
- moist 정책을 재설계하지 말 것
- Earth Climate factor를 넣지 말 것
- Needed Element / 용신 / 희신을 만들지 말 것
