# Climate Freeze Boundary

엔진 판단 코드는 이 문서로 바꾸지 않는다.
FROZEN-POLICY = 명리학적 검증 완료가 아니다.

**Climate 종료 상태:** 원재료/구조 감사 완료 + 보수 정책 경계 확정 + 핵심 조후 해석 검증 대기.

**Climate 검증 완료라고 쓰지 않는다.**

adjusted temperature / moisture 값과 Climate Need 火/水를 사용자 최종 명리 결론으로 표시하지 않는다.

근거: `climate-rule-inventory.json`, `climate-rule-audit.md`, `climate-case-trace.json`, `climate-open-questions.md`.
새 Climate 규칙은 만들지 않았다.

---

## 세 주장을 섞지 말 것

| 코드에서 참인 것 | 아직 검증되지 않은 것 |
|---|---|
| 子월 `BASE_CLIMATE` = cold+moist **표가 있다** | 子월을 조후상 cold+moist로 보는 것이 **타당하다** |
| Fire quality = clear **로 분류됐다** | clear Fire가 cold를 balanced까지 **완화한다** |
| adjusted temperature = cold | **그러므로 火가 필요하다** |

AdjustedClimate 진단 ≠ Climate Need 오행 선택 ≠ Needed Element / 용신 / 희신.

---

## A. Frozen Facts (VERIFIED-FACT)

독립 원재료이거나, 엔진이 하는 일을 있는 그대로 서술한 코드 사실만.

| ID | 내용 | 사용자 최종 결론 |
|---|---|---|
| CLI-001 | `monthBranch` = 월지 글자 복사 | 월지 표시는 가능. 조후 단정은 아님 |
| CLI-009 | 丙丁 → 火 천간 라벨 (오행 lookup) | 천간 오행 표시는 가능. 조후 factor 범위는 CLI-013 |
| CLI-010 | 壬癸 → 水 천간 라벨 | 동일 |
| CLI-017 | factor.presence = `analyzeElementPresence` 재사용 | presence 4종 표시는 가능 |
| CLI-020 | Fire/Water factor 0개 → quality `absent` | “없는 재료” 사실. “한난이 없다” 아님 |
| CLI-052 | reasons.length는 점수 아님 | |
| CLI-055 | mitigation/reinforcement 배열은 role 투영. 재보정 입력 아님 | |
| CLI-056 | score / weight / rank / priority / winner / neededElement / yongsin / heesin 없음 | |
| CLI-057 | NeedResolution은 `climateCounterSignals`를 복사만 함. 현재 입력은 항상 `[]` | |

이 9개가 맞다고 해서 子월이 한습이라거나, 火가 필요하다고 검증된 것이 아니다.

---

## B. Frozen Conservative Policies (FROZEN-POLICY)

의도적으로 고정 가능한 **엔진 정책**. 명리 절대 정답이 아니다.

- 木金土는 Climate factor가 되지 않는다. Earth Need 없음. (CLI-013, CLI-048)
- 월지 본기·월지 지장간은 factor에서 뺀다. 월간만 남긴다. 월지 조후는 `baseClimate`로만 반영한다. (CLI-014)
- 시간 미상: hour factor 없음. 후보 시주 / 정오 / 평균 없음. (CLI-015, CLI-016)
- `baseClimate`를 adjusted 값으로 덮어쓰지 않는다. (CLI-027)
- base temperature balanced면 Fire/Water로 한난을 이동시키지 않는다. (CLI-028)
- 양쪽 mit·reinf가 모두 clear|substantial이면 그 축은 unresolved, 값을 고르지 않는다. (CLI-030)
- **substantial mitigation → unresolved.** “substantial의 명리 힘”이 아니라 **애매하면 결정하지 않는다.** (CLI-031)
- **clear mitigation → 한 단계만 balanced.** 반대 극단으로 넘기지 않는다. 조후 이론 사실이 아니라 **엔진 안정성 정책.** (CLI-032)
- weak quality(absent/hidden/shallow/branch-only)는 base를 유지한다. (CLI-033)
- reinforcement만으로 축을 더 극단으로 밀지 않는다. (CLI-034)
- temperature와 moisture는 각각 `adjustPolar`. 한 축 결과를 다른 축 입력으로 재주입하지 않는다. (CLI-038) *같은 quality가 두 축에 쓰이는 해석 효과는 CLI-054.*
- `certainty`는 입력 완전성. 한난/조습 결론이 아니다. (CLI-040)
- hour unknown + substantial이면 경고 노트만. 축 resolved를 취소하지 않는다. (CLI-039)
- Climate Need는 **AdjustedClimate만** 본다. baseClimate로 후보를 만들지 않는다. (CLI-051)
- moist만으로 火/土 후보를 만들지 않는다. (CLI-044)
- balanced 축에서는 그 축 Need를 열지 않는다. 후보 공백 ≠ unresolved. (CLI-045)
- unresolved 축에서는 그 축 Need를 억지로 열지 않는다. (CLI-046)
- 같은 Climate 오행은 한 행으로 합친다. reason 개수 = 점수 아님. (CLI-047)
- climateNeedStatus: 축 unresolved 개수로만 ready / axis-unresolved / unresolved. (CLI-050)
- Climate 후보는 항상 `candidate`. Climate suppressed 없음. (CLI-058)
- quality는 factor 개수가 아니라 존재 여부(boolean). (CLI-053)
- balanced 한난에서 火·水가 둘 다 strong이면 **노트만**. 값을 바꾸지 않는다. (CLI-029)

상/휴 Strength와 같이, 한 단계 이동(CLI-032)은 정책처럼 동작하지만 **조후 검증 완료가 아니다.** 동작은 유지하되 사용자 단정에 쓰지 않는다.

---

## C. Interpretive Rules Not Yet Validated (REQUIRES-INTERPRETIVE-VALIDATION)

| 주제 | ID |
|---|---|
| 12월지 `BASE_CLIMATE` 값 자체 | CLI-002 |
| 寅卯辰 = balanced+moist (寅 balanced, 辰=봄 클러스터) | CLI-003a |
| 巳午未 = warm+dry (未=여름 클러스터) | CLI-003b |
| 申酉戌 = balanced+dry (戌=가을 클러스터) | CLI-003c |
| 亥子丑 = cold+moist (丑=겨울 클러스터) | CLI-003d |
| 토월을 고유 조후가 아니라 인접 계절과 같게 둠 | CLI-004 |
| branch 火 = 巳午만 (寅중丙은 branch 火 아님) | CLI-011 |
| branch 水 = 亥子만 (辰중癸는 branch 水 아님) | CLI-012 |
| 한난에서 火/水 mit·reinf 방향 | CLI-018 |
| 조습에서 火/水 mit·reinf 방향 | CLI-019 |
| quality `clear` 조건 | CLI-021 |
| quality `substantial` 조건 (presence 겹침 포함) | CLI-022 |
| quality `shallow` | CLI-023 |
| quality `hidden` | CLI-024 |
| quality `branch-only` | CLI-025 |
| 습을 火로 완화하는 것 = 한을 火로 완화하는 것과 동일 함수 | CLI-036 |
| 조를 水로 완화하는 것 = 난을 水로 완화하는 것과 동일 함수 | CLI-037 |
| 같은 Fire/Water quality가 한난·조습을 동시에 한 단계씩 이동 | CLI-054 |
| resolved cold → 火 Need | CLI-041 |
| resolved warm → 水 Need | CLI-042 |
| resolved dry → 水 Need | CLI-043 |

---

## D. OPEN

구현이 없거나, 현재 표/표본에서 근거가 비어 있는 것.

| ID | 내용 |
|---|---|
| CLI-026 | quality fallback `hidden`. 도달이 드묾 |
| CLI-035 | moisture `balanced` 보정 분기. **현재 12월지 표에 moisture balanced가 없어 dead** |
| CLI-049 | `climateCounterSignals`는 항상 `[]`. `climate-moisture-already-moist` **미구현**. warm+moist 월지도 표에 없음 |

과거 설계의 warm+moist counterSignal은 구현된 것처럼 적지 않는다. **not implemented.**

---

## E. baseClimate Freeze 경계

**Lookup이 코드에 있다**는 VERIFIED-FACT에 가깝다 (CLI-001 + 표 조회).  
**그 값이 조후상 타당하다**는 REQUIRES-INTERPRETIVE-VALIDATION (CLI-002).

`userConclusionSafe` = 사용자에게 “당신은 한습합니다”류로 바로 말해도 되는가. 12행 모두 **아니오**.

| 월지 | currentCodeValue | freezeStatus | userConclusionSafe | validationNeeded | 비고 |
|---|---|---|---|---|---|
| 寅 | balanced + moist | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | **별도: 寅=balanced.** 한을 인월 시작으로 보는 학파와 충돌 가능 |
| 卯 | balanced + moist | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | |
| 辰 | balanced + moist | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | **별도: 寅卯와 동일. 고유 습토 아님** |
| 巳 | warm + dry | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | |
| 午 | warm + dry | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | |
| 未 | warm + dry | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | **별도: 巳午와 동일. 고유 조토 아님** |
| 申 | balanced + dry | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | |
| 酉 | balanced + dry | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | |
| 戌 | balanced + dry | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | **별도: 申酉와 동일. 고유 조토 아님** |
| 亥 | cold + moist | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | |
| 子 | cold + moist | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | 표 존재 ≠ 한습 확정 |
| 丑 | cold + moist | REQUIRES-INTERPRETIVE-VALIDATION | 아니오 | 예 | **별도: 亥子와 동일. 고유 습토 아님** |

현재 표에 warm+moist, moisture balanced 월지 없음.

---

## F. Fire / Water quality Freeze 경계

라벨은 **엔진 분류 코드**다. 사용자에게 “강한 火 / 약한 火”로 직접 번역하면 안 된다.

| 라벨 | 계산/분류 (코드) | 해석 의미 | freezeStatus |
|---|---|---|---|
| absent | 해당 오행 Climate factor 0 | 재료 없음. 월지 skip 때문에 子월 Water absent일 수 있음 | 분류 절차는 코드 사실. “기후가 없다”는 해석 아님 |
| clear | 투출 천간 ∧ 대표지지(巳午/亥子)가 factors 안 | 조후상 뚜렷한 火/水로 읽히기 쉬움 | 조건·효과 모두 REQUIRES-INTERPRETIVE-VALIDATION |
| substantial | 투출 천간 ∧ (hiddenStem 또는 presence RV/hidden-only) | “꽤 있다”로 오역하기 쉬움 | 조건 INTERPRETIVE. 효과는 CLI-031 정책(unresolved) |
| shallow | 투출 천간만 | 나천간 | INTERPRETIVE. 회귀 표본 적음 |
| hidden | hiddenStem, 투출 없음 | 지장간만 | INTERPRETIVE. 효과는 weak=base 유지(정책) |
| branch-only | 지지 火/水만 | 지지뿐 | INTERPRETIVE |

quality 산정 ≠ 축 이동 폭.

---

## G. AdjustedClimate 필드 경계

| 필드 | freeze / 검증 | 사용자 최종 결론 |
|---|---|---|
| baseClimate | 표 lookup 존재는 사실. **값은 INTERPRETIVE** | **아직 불가** (“한습합니다”) |
| fireQuality / waterQuality | 분류 코드는 고정 가능. **명리 강도 아님** | DIAGNOSTIC ONLY |
| temperature.status | 엔진이 resolved/unresolved를 고른 것 | 내부 진단. “정확하다” 아님 |
| temperature.value | CLI-018/032/031 등에 의존 | **아직 불가** |
| moisture.status | 동상 | 내부 진단 |
| moisture.value | CLI-019/036/032 등에 의존 | **아직 불가** |
| conflicts | 진단 문자열. 점수 아님 | DIAGNOSTIC ONLY |
| unresolvedReasons | 진단. 축을 뒤집지 않는 것도 있음(CLI-039) | DIAGNOSTIC ONLY |
| certainty | 입력 완전성 (시주 유무) | SAFE INTERNAL. 한난 정확도와 무관 |
| omittedSlots | hour 생략 여부 | SAFE INTERNAL FACT |

`temperature.value` / `moisture.value`를 “검증된 명리 결론”처럼 노출하지 않는다.

---

## H. 한 단계 이동 정책 (CLI-032)

실제: clear mitigation이면

- cold → balanced
- warm → balanced
- moist → balanced
- dry → balanced

반대 극단으로 한 번에 넘지 않는다.

**조후 이론 사실이 아니다.**  
**엔진 안정성을 위한 FROZEN-POLICY**다.  
사용자에게 “불이 한을 중화했다”고 단정하지 않는다.

---

## I. substantial → unresolved (CLI-031)

**FROZEN-POLICY.**

“substantial 火의 실제 명리 힘”과 섞지 않는다.  
의미는 **애매하면 엔진이 한난/조습 값을 고르지 않는다.**

---

## J. moist 정책 — 현재 실제 구현만

재설계하지 않음. 과거 문서를 구현된 것처럼 적지 않음.

| 조합 | 실제 코드 |
|---|---|
| cold + moist | adjusted **temperature가 cold**이면 火 후보 가능. moist만으로 새 火 없음. 土 없음 |
| CASE 1 己卯丙子戊午戊午 | Fire clear로 T/M이 balanced가 되어 **火 Need도 없음** |
| balanced + moist | Climate Need 없음. 축 resolved면 `climateNeedStatus=ready` |
| warm + moist | **월지 표에 없음.** counterSignal 생성 코드 **없음** |

`climateCounterSignals`는 항상 `[]`.  
`climate-moisture-already-moist`는 **not implemented** (CLI-049 OPEN).

Need 억제(moist로 火/土를 안 만듦)는 FROZEN-POLICY.  
cold→火 후보는 INTERPRETIVE.

---

## K. Climate Need 경계

| 규칙 | freezeStatus | 사용자 최종 |
|---|---|---|
| resolved cold → 火 | REQUIRES-INTERPRETIVE-VALIDATION | **불가.** Needed Element 아님. 용신/희신 아님 |
| resolved warm → 水 | 동일 | **불가** |
| resolved dry → 水 | 동일 | **불가** |

AdjustedClimate 진단 ≠ Climate Need 오행 선택.  
Climate Need 후보는 최종 Needed Element가 아니다.

---

## L. 시간 미상 한계

- `certainty = partial`
- hour Climate factor 없음
- 가짜 시주 없음
- **partial이어도** hidden/weak mit이면 T/M이 **resolved**될 수 있다

이것을 “시간 미상이어도 정확하다”고 번역하지 않는다.  
**년·월·일 3주 기준 결과**다. 시주가 생기면 Fire/Water quality와 축 값이 바뀔 수 있다.

---

## M. Evidence 중복 (점수 없음)

가산점 구조는 없다 (`qualityOf`는 boolean 1회).

다만 **같은 Fire clear가 temperature와 moisture를 각각 한 단계 balanced로 옮길 수 있다** (CASE 1, CLI-054).

- 점수 중복은 아님
- 동일 Evidence가 **두 조후 축에 동시에 영향**
- **외부 검증 대상** (REQUIRES-INTERPRETIVE-VALIDATION)

---

## N. Climate 사용자 노출 경계

### SAFE INTERNAL FACTS

- monthBranch
- factor source (slot, layer, stem/branch)
- hour omitted / omittedSlots
- presence (4종)
- certainty (시주 유무)
- 점수 필드가 없다는 사실

### DIAGNOSTIC ONLY

- fireQuality, waterQuality
- conflicts, unresolvedReasons
- climateNeedStatus, axis unresolved
- mitigationFactors / reinforcementFactors 목록
- Climate Need **후보 목록** (최종 오행이 아님)

### NOT YET VALIDATED AS FINAL USER CONCLUSION

- adjusted cold / warm / dry / moist를 명리적으로 확정하는 말
- Climate Need 火 / 水를 “필요한 오행”으로 제시
- “당신에게 火가 필요합니다”
- “당신은 한습합니다”
- quality를 신강·용신으로 번역
- 寅월 “중립 기후” 단정
- 辰未戌丑을 습토/조토 확정으로 말하기

---

## O. High-risk 해석 규칙 (삭제·수정 금지)

전문가/문헌 검증 대상. 제품 단정 금지.

- 12월지 baseClimate
- 寅 balanced
- 辰未戌丑 조후 성격
- clear Fire/Water 이동폭 (한 단계 balanced)
- substantial 처리 (unresolved 정책 vs 명리 힘)
- 한난과 조습에 동일 quality / 동일 `adjustPolar`
- cold → 火 Need
- warm → 水 Need
- dry → 水 Need
- 같은 clear 火의 두 축 동시 이동 (CLI-054)

상세: `climate-open-questions.md`.

---

## P. Needed Element / 용신 금지

다음으로는 최종 오행 / 용신 / 희신을 만들지 않는다.

- fireQuality / waterQuality
- adjusted temperature / moisture
- Climate Need 火/水 후보
- climateNeedStatus
- conflicts / unresolvedReasons
- 빈 climateCounterSignals
- moist에서 후보가 없는 상태 (공백을 최종 오행으로 채우지 않음)

---

## Q. Climate에서 동결 가능한 범위

동결 가능:

- 월지·presence·시주 생략 등 사실층
- 火/水만 factor, 월지 중복 제거, 가짜 시주 없음
- 한 단계만 이동, 반대 극단 금지
- substantial mit → 값을 고르지 않음
- moist로 火/土 Need를 만들지 않음
- Need는 Adjusted만 사용
- 비점수, 비병합 Strength/Climate 후보

동결이 **검증 완료가 아닌 것:**

- 12월지 조후 값
- quality의 명리 의미
- adjusted 한난/조습 값
- Climate Need 오행

---

## Climate 단계 종료 상태

Climate 상태:

원재료/구조 감사 완료  
+ 보수 정책 경계 확정  
+ 핵심 조후 해석 검증 대기

Climate 검증 완료가 아니다.
