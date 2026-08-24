# Product Boundary Policy — 결정 대기 상태 고정

이 문서는 제품 절입 기준의 현재 상태를 고정한다.
구현 지시가 아니다. 엔진·제품 코드를 바꾸지 않는다.

절입 기준이 확정되기 전에는 사주 결과를 production-ready로 표시하지 않는다.

---

## 1. v1

- 제품 API 연결 중
- legacy
- not-frozen
- boundary-inaccurate
- production-ready 아님

v1 유지를 「검증 완료」 또는 「동결」로 기록하지 않는다.

---

## 2. v2

- experimental
- astronomical calculation candidate validated
- KASI 336건 전부 ±1분
- 제품 API 미연결

v2 검증은 천문 계산 후보 검증이다. 제품 절입 기준 채택이 아니다.

---

## 3. Product Boundary Policy

- 미확정
- KASI published minute 사용 가능 여부 공식 문의 대기
- hybrid 정책 비추천 (있는 해는 KASI, 없는 해는 v2)
- KASI 사용 허가 전 override 금지
- v2 제품 연결도 승인 전 금지

후보 A(v2 astronomical crossing 초)와 후보 B(KASI 공표 시·분) 모두 아직 채택하지 않는다.

---

## 4. 공식 문의 회신 전 금지

다음을 하지 않는다.

- `solarTerms` 교체
- `buildFourPillars` 변경
- KASI table 저장
- API 자동 수집
- 2023 입춘 예외
- ±30초 보정
- Strength / Climate / Need 수정
- UI 연결

---

## 5. 회신 이후 분기

문의 회신 전에는 CASE를 확정하지 않는다.
회신 내용이 아래 조건을 충족할 때만 해당 CASE를 검토한다.
검토는 승인 전 구현이 아니다.

### CASE A

다음이 모두 충족될 때:

- 1900~2100 또는 제품 필요 범위 공식 데이터 확보 가능
- 상업 이용 가능
- 내부 DB 저장/재사용 가능
- 12절 사용 가능

→ KASI published minute 제품 기준 검토

### CASE C

다음 중 하나라도 해당할 때:

- 전 구간 제공 불가
- 상업 이용 허용 불가
- 내부 저장/재사용 허용 불가

→ v2 astronomical crossing 제품 기준 검토

### CASE B

답변이 일부만 명확할 때:

→ 구현하지 않고 추가 문의

---

## 6. 절대 하지 않을 것

다음 세 가지는 모두 금지한다.

1. 「답이 늦으니 일단 v2」
2. 「일부 해만 KASI」
3. 「현재 v1 그대로 출시」

여기까지다. 이 문서 작성 외에 코드를 수정하지 않는다.
