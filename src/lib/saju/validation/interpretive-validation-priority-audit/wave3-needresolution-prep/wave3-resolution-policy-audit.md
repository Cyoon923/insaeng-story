# Wave 3 NeedResolution — Policy Audit (prep only)

엔진 수정·VERIFIED·새 명리 규칙·점수/가중·NEED-015 해결·Wave 1/2 재검증·전문가 설문·신규 문헌 검증은 이 문서로 하지 않는다.

**목적:** RES-012~015가 **명리 이론 검증 대상이 아니라**, upstream NeedCandidate 집합을 사용자 의미로 번역하는 **product/semantic policy**인지 확인한다.

**기준:** `interpretive-validation-priority-audit.md` §F · `need-resolution-freeze-boundary.md` · `needResolution.ts` `STATUS_BY_PATTERN` / `relationPatternOf`

**전제:** Wave 2 NeedCandidate 검증 경계 CLOSE. NEED-015 = POLICY-UNRESOLVED. NEED-022 = G6 조습 CONTESTED boundary 상속.

---

## 공통 성격 (4개 공통)

| 질문 | 답 |
|---|---|
| 명리 판단 신규? | **아니오.** 오행을 고르거나 용신을 정하지 않음 |
| 단순 상태 분류/라벨? | **예.** `relationPattern` → `status` lookup (`STATUS_BY_PATTERN`) |
| 입력 | active Need 후보의 **오행 Set만** (`isActive` = `status===candidate`). suppressed·certainty·axis status는 pattern에 **안 들어감** (RES-005) |
| winner / neededElement / score | **없음** (RES-045) |
| Audit method | 문헌·전문가 열 **아니오** → UNRESOLVED (명리 경로 없음 = **정책 라벨**) |

집합 계산(RES-006~011) = FACT.  
의미 라벨(RES-012~015) = **제품 시맨틱**. 문헌에 대응 항 없음.

---

## RES-012 — no-candidates → indeterminate

| # | 항목 | 내용 |
|---|---|---|
| 1 | **코드 조건** | `strengthActive∪climateActive` 오행 없음 → `relationPattern=no-candidates` |
| 2 | **출력** | `status=indeterminate` |
| 3 | **upstream** | Strength/Climate active 0. 예: mixed/null Strength(NEED-012/013) + Climate 후보 없음; hour-unknown Need gate 후 양쪽 공백; Climate unresolved만 등으로 active 0 |
| 4 | **명리 신규?** | 아니오 |
| 5 | **분류 라벨?** | 예 — “분류할 active 후보가 없다” |
| 6 | **오해 가능성** | **높음.** `indeterminate` / “불확정” → **필요한 오행이 없다** / 결론 불필요 |
| 7 | **권고** | 내부 enum **유지**. UX/speakable는 **이름변경 또는 금지 번역** — “필요 오행 없음” 금지 |

**의미 경계:** indeterminate ≠ 필요한 오행이 없음.

---

## RES-013 — only → single-axis

| # | 항목 | 내용 |
|---|---|---|
| 1 | **코드 조건** | `strength-only` 또는 `climate-only` (한 축만 active) |
| 2 | **출력** | `status=single-axis`; `singleAxisElements` = 그 축 active |
| 3 | **upstream** | NEED-010/011만 / NEED-020~022만. CL-NEED-HOUR로 Strength gated면 Climate-only가 흔해짐 |
| 4 | **명리 신규?** | 아니오 |
| 5 | **분류 라벨?** | 예 — “한 축만 후보가 열려 있다” |
| 6 | **오해 가능성** | **높음.** single-axis → **그 축이 이겼다 / 최종** |
| 7 | **권고** | 내부 enum **유지**. UX는 “한 축만 후보 있음(잠정·미최종)” 등으로 **이름/카피 변경** |

**의미 경계:** single-axis ≠ 해당 축이 최종 승자.

---

## RES-014 — overlap → convergent

| # | 항목 | 내용 |
|---|---|---|
| 1 | **코드 조건** | `exact-overlap` 또는 `partial-overlap` (교집합 있음) |
| 2 | **출력** | `status=convergent`; `supportedElements`는 convergent일 때만 채움 (공통 오행 + 양축 supports). partial이면 deferred 가능 |
| 3 | **upstream** | NEED-010/011과 NEED-020~022가 같은 오행을 공유할 때. 특히 NEED-022(水) ↔ leaning-weak resource 水 등 |
| 4 | **명리 신규?** | 아니오. “두 이론이 동의했다”를 **계산하지 않음** — 집합 교집합만 |
| 5 | **분류 라벨?** | 예 — “양축 active에 공통 오행이 있다” |
| 6 | **오해 가능성** | **매우 높음.** convergent → **용신 확정 / 정답 일치 / winner** |
| 7 | **권고** | 내부 enum **유지하되 UX에서는 사실상 이름변경 필수.** “축 간 오행 겹침(미확정)” 등. `supportedElements[0]`을 winner로 읽지 않음 (RES-046) |

**의미 경계:** convergent ≠ 용신 확정 / 두 이론의 정답 일치.

---

## RES-015 — disjoint → competing

| # | 항목 | 내용 |
|---|---|---|
| 1 | **코드 조건** | 양축 active 있고 교집합 없음 → `disjoint` |
| 2 | **출력** | `status=competing`; `competingElementsByAxis` 분리; blocker `competing-axes` |
| 3 | **upstream** | Strength 후보 집합 ∩ Climate 후보 집합 = ∅ (NEED-036 정책: 이 층에서 우선순위로 줄이지 않음) |
| 4 | **명리 신규?** | 아니오. 어느 축이 맞는지 고르지 않음 |
| 5 | **분류 라벨?** | 예 — “양축 후보 오행이 서로 안 겹친다” |
| 6 | **오해 가능성** | **높음.** competing → **나쁜 사주 / 엔진 오류 / 충돌 실패** |
| 7 | **권고** | 내부 enum **유지**. UX는 “축별 후보 불일치(미해소)” 등 **이름/카피 변경**. 오류 표시 금지 |

**의미 경계:** competing ≠ 나쁜 사주 / 엔진 오류.

---

## Wave 2 전파: NEED-015 · NEED-022

### NEED-015 (POLICY-UNRESOLVED)

| 전파 경로 | 효과 |
|---|---|
| `isActive` | `suppressed`는 active에서 **제외** → relationPattern/status가 바뀜 |
| 예 | Strength 식상만 suppressed + Climate 火 active → strength-only가 줄거나 climate-only / overlap 형태 변화 |
| `suppressedShared` / counterSignals | Climate와 겹친 suppressed는 메타로만 남음 (RES-025/027) |
| RES-012~015 자체 | 억제 **타당성을 재판정하지 않음**. 입력 집합을 기계 분류만 함 |

**결론:** NEED-015가 미결이면, suppression이 켜진 차트의 RES 라벨은 **입력 정책 미결을 상속**한다. RES를 닫아도 NEED-015가 해결되지 않음. RES가 NEED-015를 고치지 않음.

### NEED-022 (BOUNDARY-INHERITED / G6 조습 CONTESTED)

| 전파 경로 | 효과 |
|---|---|
| Climate 水 후보 | `climate-moisture-dry` → climate-only / overlap / competing 입력 |
| RES-013 | Climate-only + dry→水면 `single-axis` (Climate 승리가 아님) |
| RES-014 | Strength도 水면 `convergent` (용신 아님; 조습 CONTESTED 입력 위 겹침) |
| RES-015 | Strength≠水면 `competing` |

**결론:** NEED-022 경계가 CONTESTED면, 그 후보가 만든 RES status의 **신뢰 상한은 Climate 입력 경계**다. RES 라벨이 조습을 VERIFIED로 올리지 않음.

---

## 유지 / 이름변경 / 정책미결정

| Rule | 내부 코드 enum | UX / speakable | 정책미결정? |
|---|---|---|---|
| RES-012 | **유지** (`indeterminate`) | **변경 필요** (필요없음 금지) | 제품 카피만. 명리 미결 아님 |
| RES-013 | **유지** (`single-axis`) | **변경 필요** (승리 금지) | 동일 |
| RES-014 | **유지** (`convergent`) | **변경 필요 (최우선)** (용신/정답 금지) | 동일 |
| RES-015 | **유지** (`competing`) | **변경 필요** (오류/나쁜사주 금지) | 동일 |

**명리 검증이 필요한 rule 수: 0**

Wave 3는 freeze에 이미 있는 의미 경계를 **제품 정책으로 문서 고정**하면 추가 전문가 없이 검증 경계를 닫을 수 있다. (엔진 enum 강제 rename은 필수가 아님.)

---

## Wave 3 CLOSE 가능성 (감사 결론)

| 질문 | 답 |
|---|---|
| 추가 전문가 설문 필요? | **아니오** |
| 신규 문헌 검증 필요? | **아니오** |
| 명리 이론 검증 대상? | **아니오** (4개 모두 product/semantic) |
| 전문가 없이 Wave 3 닫을 수 있나? | **예** — status 의미 경계·UX 금지 번역을 정책으로 고정하면 됨 |
| 남는 것 (Wave 3 밖) | NEED-015 POLICY-UNRESOLVED; NEED-022 CONTESTED 상속; 실제 UI 카피 적용은 제품 작업 |

---

## 하지 않은 것

- 엔진·STATUS_BY_PATTERN 변경
- VERIFIED · NEED-015 해결 · Wave 1/2 재검증
- 전문가 설문 · 신규 문헌
- Wave 3 본 closure 문서 (본 파일은 **prep audit만**)
