# 운율 명리 판단 규칙표 초안 v0

상태: **초안 (문서만)**  
범위: 명리 엔진 구현 전 판단 기준 정리  
제외: 코드 구현 · 임의 가중치 · UI · Strength/Need/Core/Supplement/만세력 수정

관련 문서:

- `docs/unyul-element-strength-rules-v1.md` — Strength Level 확정 문서
- `docs/unyul-hour-time-standards.md` — 시주 시각 기준
- Climate / Need audit 문서 (`src/lib/saju/validation/…`)

---

## 0. 공통 원칙

1. **Strength**와 **Need**는 별도 판단축이다. 한쪽 결과가 다른 쪽을 자동 결정하지 않는다.
2. **Core / Supplement**는 구조·표현 결과물이지, 본 표의 “원재료 판단”과 동일하지 않다. (본 초안은 원재료·관계·운 레이어 중심)
3. 수치·가점·감점 계수는 확정 전까지 전부 **TBD**로 둔다. 임의 숫자를 넣지 않는다.
4. 합·충·형·파·해는 “관계 성립”과 “화기·손상·개고 성립”을 **분리**한다.
5. 대운·세운·월운·일운은 원국 Strength를 **덮어쓰지 않는다**. 원국 위에 얹는 **운 레이어**로만 본다.

축 표기:

| 축 | 의미 |
|----|------|
| Strength | 원국(또는 지정 범위)에서 오행이 실제로 가진 세력 |
| Need | 균형·조후·구조상 “필요한” 기운 (세력 ≠ 필요) |
| Luck | 대/세/월/일운이 원국에 가하는 일시·주기 영향 |

---

## 1. 항목별 판단 기준표

### 1.1 월령 (月令)

| 필드 | 내용 |
|------|------|
| 판단 대상 | 각 오행(또는 일간 오행)의 계절 위상: 왕 / 상 / 휴 / 수 / 사 |
| 입력값 | 월지(`month.branch`), 대상 오행(`Element`) 또는 일간→오행 |
| 판단 조건 | 월지 → 계절 → `seasonPhaseOf(element, monthBranch)` 매핑. 월지만 사용. 합국·충으로 월령 테이블 자체를 바꾸지 않음(관계는 별도 레이어). |
| 결과에 미치는 영향 | Strength의 **기반 축**. 월령이 약하면 천간·지장간이 많아도 상위 Strength로 올리지 않는 방향(기존 Strength v1과 정합). |
| Strength 영향 여부 | **예** (기반) |
| Need 영향 여부 | **간접만**. 월령 자체가 Need 후보가 되지 않음. 조후·결핍 판단의 배경. |
| 다른 규칙과 충돌 시 우선순위 | Strength 내부: **1순위(기반)**. 합·충보다 앞선 “계절 배경”. 화기 성립 시에도 월령 테이블 재작성 금지 → 화기는 modifier로만. |

확정 가능: 월지 기준 5단 위상 사용, Strength 기반 역할.  
TBD: 일간 전용 “득령/실령” 이진 판정을 Strength와 별도로 둘지; 토월(辰戌丑未) 세부 가중.

---

### 1.2 통근 (通根)

| 필드 | 내용 |
|------|------|
| 판단 대상 | 천간(또는 동계 오행)이 지지 지장간에 뿌리를 갖는지, 깊이(정기/중기/여기) |
| 입력값 | 四柱, 대상 천간/오행, 지장간 테이블(`hiddenStems`), 시주 확정 여부 |
| 판단 조건 | 지지 지장간에 동계(또는 동일 글자) 천간이 있으면 hit. 최심 role로 `root-absent` / `root-shallow`(여기) / `root-present`(중기) / `root-clear`(정기). 시주 unknown이면 hour 슬롯 제외. |
| 결과에 미치는 영향 | Strength의 깊이·상한. 통근 없으면 월령 왕·상이어도 very-strong 금지 방향(Strength v1). |
| Strength 영향 여부 | **예** |
| Need 영향 여부 | **아니오(직접)**. 통근 없음 ≠ 자동 Need. Need는 별도 축. |
| 다른 규칙과 충돌 시 우선순위 | Strength 내부: 월령 다음 **2순위**. 충에 의한 근 동요는 **§1.6 TBD-03** 상태 모델. 감쇠 계수는 **§1.6.8 확정(δ=4, 엔진 미적용)**, 위치 가중·개고 수치는 TBD(TBD-01c-position·TBD-03a). |

확정 가능: 지장간 role 깊이 구분; Strength 입력으로 사용.  
TBD: 동계만 vs 동일 글자만; 타간 오행 통근을 일간 통근과 동일 가중할지 (TBD-05). 충 상태 계약은 §1.6.

---

### 1.3 투간 (透干)

| 필드 | 내용 |
|------|------|
| 판단 대상 | 지지 지장간(특히 월지)의 글자·오행이 천간에 드러나는지 |
| 입력값 | 四柱 천간, 지장간, `exactStemVisible` / `monthOutletSlots`류 evidence |
| 판단 조건 | (A) 동일 글자 천간 노출 = exact stem visible. (B) 월지 지장간이 천간에 나온 슬롯 = month outlet. “투간 있음”만으로 화기·국 성립을 선언하지 않음. |
| 결과에 미치는 영향 | Strength 표면 세력 보강. hidden-only → 한 단계 상향 등(Strength v1 절차). 조후에서는 火/水 투간이 한난·조습 **조절 후보**가 될 수 있음(Climate 축). |
| Strength 영향 여부 | **예** (보강; 단독 very-strong 금지) |
| Need 영향 여부 | **Climate/Need 간접**. Strength Need와 합산 금지. |
| 다른 규칙과 충돌 시 우선순위 | Strength 내부: 통근·존재 다음. 합화 성립 판정에서는 투간을 **화기 성립 조건의 일부(TBD)** 로 둘 수 있음. |

확정 가능: exact stem / month outlet 개념 분리; Strength 단독 확정 금지.  
TBD: 투간을 합화 필요조건으로 할지; 여러 투간 중복 시 가산 여부(가산 금지 권고 vs TBD).

---

### 1.4 조후 (調候) — Climate

| 필드 | 내용 |
|------|------|
| 판단 대상 | 원국의 한난(寒暖)·조습(燥濕) 및 그에 따른 **Climate Need** 후보 |
| 입력값 | 월지 기본 기후, 火/水 재료(본기·투간·factor), (향후) 합국·충 개고 등 |
| 판단 조건 | 월령을 **배경(base)** 으로 두고, 火·水 재료로 완화/강화. Strength Level과 **합산·동일시 금지**. Climate 후보와 Strength Need 후보는 축 분리. |
| 결과에 미치는 영향 | Need의 climate 축. 음악/표현 게이트·Annual 등과 연결될 수 있으나 Core Strength를 바꾸지 않음. |
| Strength 영향 여부 | **아니오** (Strength v1 명시 제외) |
| Need 영향 여부 | **예** (climate Need) |
| 다른 규칙과 충돌 시 우선순위 | Need 내부: climate vs strength-need 충돌 시 **축별 상태 유지**, 단일 Need로 강제 병합하지 않음(기존 Need resolution 방향과 정합). Structure(Core) vs Climate는 별도 resolver. |

확정 가능: Strength에 조후 점수 합산 금지; 월령 base + 火水 재료.  
TBD: 토월 고유 조습 세부; 삼합 성국 시 조후 환산 공식; 일간별 조후용신 차이 테이블; 수치 threshold.

---

### 1.5 합 (合)

#### 1.5.0 공통 필드 요약

| 필드 | 내용 |
|------|------|
| 판단 대상 | **천간합**과 **지지합**을 구분한 뒤, 각각에 대해 관계 hit와 화기(合化)·국 성립을 **별도 판정** |
| 입력값 | 四柱 천간·지지, 합 쌍/국 테이블, 월지·계절, 통근·투간 evidence, 충·형 등 방해 관계, 슬롯 인접/거리 |
| 판단 조건 | 아래 **상태 모델(4단)** + **화기 조건 후보**. 수치 가중치는 두지 않음. |
| 결과에 미치는 영향 | hit만: 관계·해석 기록. 화기 성립 후에만 Strength **modifier**(v2+)·조후 환산 후보. |
| Strength 영향 여부 | **화기 성립 전: 아니오** (임의 변경 금지). 성립 후: modifier만 (v1 본선 미포함). |
| Need 영향 여부 | **화기 성립 전: 아니오**. 성립 후 재평가 가능(TBD-12). hit만으로 Need 확정 금지. |
| 다른 규칙과 충돌 시 우선순위 | 충이 화기 성립을 방해(초안). 미성립 합 < 화기 성립 합. 월령 테이블 자체는 합으로 재작성하지 않음. |

---

#### 1.5.1 천간합 vs 지지합

| 구분 | 종류(초안 목록) | 판단 단위 | 비고 |
|------|-----------------|-----------|------|
| **천간합** | 天干五合 (甲己·乙庚·丙辛·丁壬·戊癸) | 두 천간 슬롯 쌍 | 합화 목표 오행은 전통 오합 화기 표(TBD로 표만 확정). |
| **지지합** | 六合 · 方合 · 三合 · (半合) | 지지 슬롯 2~3자 | 반합 인정 범위는 TBD-02b. 삼합 완합 vs 반합을 상태·화기에서 구분. |

원칙: 천간합과 지지합은 **같은 상태 enum**을 쓴다. 화기 C-* 역할은 종류별로 §1.5.4.2 매트릭스(TBD-02c)를 따른다.

---

#### 1.5.2 합 상태 모델 (4단) — 천간합·지지합 공통

각 후보 합(쌍 또는 국)마다 **정확히 하나**의 상태를 부여한다.

| 상태 ID | 이름 | 정의 |
|---------|------|------|
| `none` | 합 관계 없음 | 합 테이블상 쌍/국이 원국(또는 지정 범위)에 성립하지 않음. |
| `relation-hit` | 합 관계 hit | 글자 조합으로 합 관계는 성립. **화기 판정은 아직이거나**, 화기를 시도하지 않는 합 유형(해석-only)일 수 있음. |
| `hit-no-transform` | 합 관계는 있으나 화기 불성립 | relation hit는 유지. 화기 조건 후보를 평가한 결과 **합화·국 화기 불성립**. |
| `transform-ok` | 화기 성립 | relation hit + 화기 판정 통과. 이때만 Strength/Need **modifier 후보**로 승격. |

상태 전이(논리):

```
none
  └─(쌍/국 글자 성립)→ relation-hit
                          ├─(화기 평가 실패 또는 화기 비대상)→ hit-no-transform
                          └─(화기 평가 통과)→ transform-ok
```

기록 규칙:

- `relation-hit`은 **중간/미평가**에도 쓸 수 있다. 파이프라인이 화기 평가를 끝낸 뒤에는 `hit-no-transform` 또는 `transform-ok`로만 남기는 것을 권고(미평가는 `relation-hit` + `transformEval: pending`).
- 한 슬롯이 여러 합에 겹치면 **합마다** relation 상태를 따로 두고, Effective modifier는 §1.5.10 게이트로 고른다.

---

#### 1.5.3 확정 원칙 (수치 없음)

1. **합 관계 hit ≠ 화기 성립.** (`relation-hit` / `hit-no-transform` ≠ `transform-ok`)
2. **hit만으로 원래 오행을 제거·치환·변환하지 않는다.** 본기·통근·Strength Level·Need 후보를 hit 이유로 바꾸지 않음.
3. **화기 성립 전에는 Strength / Need 값을 임의 변경하지 않는다.** 합 레이어는 기록·해석만.
4. **화기 성립(`transform-ok`) 후에만** Strength modifier · (조건부) Need/Climate 재평가 후보가 열린다. v1 Strength 본선 산식에는 여전히 넣지 않음(v2+).
5. 화기 성립 후 원래 오행 처리: **안 C 채택** (§1.5.7 TBD-02f). 원국 데이터는 mutate하지 않고 화기는 modifier layer로만 반영한다. 수치·비율은 TBD-01b.
6. 월령 `seasonPhase` **테이블 자체를 합으로 다시 쓰지 않는다.** 화기는 modifier·환산 레이어.

---

#### 1.5.4 화기 조건 역할 정의 (TBD-02c)

각 C-* 평가는 `pass` / `fail` / `unknown` / `not-applicable` 중 하나이다. **점수·가중치 없음.**

| 역할 | 의미 |
|------|------|
| **required** | `fail`이면 해당 합은 **`transform-ok` 불가**. |
| **supporting** | `pass`면 화기에 **유리한 기록**만. **supporting만으로 `transform-ok` 금지**. |
| **blocking** | 방해가 **성립(`pass` = 방해 있음)** 이면 아래 §1.5.4.3 종류별 규칙에 따라 처리. |
| **not-applicable** | 해당 합 종류의 화기 판정에 **사용하지 않음** (평가 생략). |
| **TBD** | 학파·근거 부족으로 **역할 미확정**. 확정 전까지 보수적으로 `unknown`과 동일하게 **`transform-ok` 자동 부여 금지**. |

---

#### 1.5.4.1 `transform-ok` 판정 계약 (확정)

전제: `relation-hit`(또는 동등한 글자 성립)이 있어야 화기 평가를 시작한다.

1. **required 하나라도 `fail`** → `transform-ok` **불가** → 평가 종료 후 `hit-no-transform`.
2. **supporting은 단독으로 화기 성립을 만들지 못한다.** required가 모두 `pass`(또는 해당 종류에 required가 없음 — 아래 육합·반합)여도, supporting만으로 승격하지 않음.  
   - required가 모두 충족되고 blocking이 없으며, unknown이 없을 때만 `transform-ok` 후보.  
   - supporting `fail`은 **기각 사유가 아님**(불리 기록만). 단, 종류별로 supporting을 사실상 필수로 격상하는 변경은 별도 개정.
3. **blocking**  
   - 방해 성립 시 → 기본 **`hit-no-transform`** (종류별 예외는 §1.5.4.3).  
   - blocking을 `required`의 역으로 중복 기재하지 않음: “충이 있으면 실패”는 blocking 열로만 둔다.
4. **`unknown` 보수 원칙**  
   - required 또는 blocking 평가가 `unknown`이면 **자동 `transform-ok` 금지**.  
   - 상태는 `relation-hit` + `transformEval: pending|blocked-unknown` 또는 보수적으로 `hit-no-transform`(`reason: unknown-conservative`).  
   - TBD 역할인 C-*가 아직 역할 미확정이면, 그 항목을 평가에 넣지 않거나 `unknown`으로 두고 **동일하게 `transform-ok` 금지**.
5. **Strength / Need / 점수**는 본 매트릭스에서 **정의·변경하지 않는다.** (`transform-ok` 선언만.)

---

#### 1.5.4.2 C-* 매트릭스 초안 (TBD-02c) — 확정

표기: `R` = required · `S` = supporting · `B` = blocking · `N` = not-applicable · `TBD` = 역할 미확정.

| C-* | 천간 五合 | 지지 육합 | 지지 삼합(완합) | 지지 방합 | 지지 반합 |
|-----|-----------|-----------|-----------------|-----------|-----------|
| C-월령 | **R** | N† | **R** | **R** | N‡ |
| C-세력 | S | N† | S | S | N‡ |
| C-통근 | **R** | N† | S | S | N‡ |
| C-투간 | **R** | N† | **R** | **R** | N‡ |
| C-방해 | **B** | N† / B§ | **B** | **B** | N‡ / B§ |
| C-거리 | **R** | TBD | N | N | TBD |
| C-중복 | 게이트 | 게이트 | 게이트 | 게이트 | 게이트 |
| C-경쟁 | S | N† | S | S | N‡ |

† **육합**: 화기(`transform-ok`) **스코프 자체가 TBD-02a**. 초안 정책 — 화기 **비대상**: 위 C-*는 화기 판정에 **N**. 관계는 `relation-hit`까지 인정 후, 화기 평가 시 **`hit-no-transform`** (`reason: transform-not-in-scope`). TBD-02a에서 화기를 열면 매트릭스를 개정한다.  
‡ **반합**: 완합 삼합과 **동일 화기 조건 금지**. 초안 — **`transform-ok` 비허용**. 별도 hit 기록(§1.5.4.4). C-* 화기 열은 **N**.  
§ 육합·반합에서도 **충 등 관계 파괴**는 해석·hit 안정성에 쓸 수 있으나, 화기가 비대상이면 blocking은 “화기 실패”가 아니라 **관계 동요 플래그**로만 둔다(Strength 변경 없음).  
C-중복 **게이트** = 슬롯 공유 탐지 → §1.5.10 S1 (R/S/B 점수 아님).

**이번 단계에서 확정한 required (화기 허용 종류만)**

| 합 종류 | required |
|---------|----------|
| 천간 五合 | C-월령, C-통근, C-투간, C-거리 |
| 지지 삼합(완합) | C-월령, C-투간 |
| 지지 방합 | C-월령, C-투간 |
| 지지 육합 | *(화기 required 없음 — 화기 비대상 초안)* |
| 지지 반합 | *(화기 required 없음 — transform-ok 비허용)* |

---

#### 1.5.4.3 blocking 처리 원칙 (종류별)

| 합 종류 | blocking 성립 시 | 비고 |
|---------|------------------|------|
| 천간 五合 | → **`hit-no-transform`** | C-방해 = 참여 천간/연계 지지의 **충** 1선. 형·파·해는 TBD(당분간 blocking 미편입). |
| 지지 삼합(완합) | → **`hit-no-transform`** | 합국 구성 지지가 충으로 깨지면 화기 불가. |
| 지지 방합 | → **`hit-no-transform`** | 동방 구성 지지 충 시 동일. |
| 지지 육합 | 화기 N → 상태는 **`hit-no-transform`(비대상)** 유지. 충은 `relation-unstable` 플래그만(TBD 명칭). | 화기 경로 없음. |
| 지지 반합 | transform-ok 없음 → **`hit-no-transform`** 또는 `half-combine-hit`(아래). 충 시 반합 hit 자체를 무효화할지는 **TBD-02b**. | |

blocking `unknown` → §1.5.4.1.4 보수 원칙 → **`transform-ok` 금지**.

---

#### 1.5.4.4 반합 — 별도 상태 / 판정

- 반합은 삼합 완합의 **축소판이 아니다.** 완합용 required(C-월령·C-투간)를 **그대로 적용해 `transform-ok`를 주지 않는다.**
- hit 인정 범위(생-왕 / 왕-묘, 월지 포함 여부)는 **TBD-02b**.
- 권고 상태:
  - 글자 성립 → `relation-hit` 또는 전용 태그 `half-combine-hit`
  - 화기 평가 → **항상** `hit-no-transform` (`reason: half-combine-no-transform`)  
  - 향후 반합 전용 약화 화기를 열려면 **별도 매트릭스 개정** + TBD-02b 종료 필요.

---

#### 1.5.4.5 C-* 정의 요약 (역할 판정용)

| 후보 ID | 평가 요지 (pass 기준 스케치, 수치 없음) |
|---------|----------------------------------------|
| C-월령 | 화 목표 오행이 월지 기준 왕·상 등 **득시**, 또는 월지가 해당 합국 구성원. 월령 **테이블 값은 변경하지 않음**. |
| C-세력 | 결과 오행(化神)의 존재·본기 밀도 등 — **라벨만**, Strength Level 재기입 금지. |
| C-통근 | 참여/결과 관련 천간의 rootStatus가 absent가 아님 등(세부 TBD-05와 정합). |
| C-투간 | 化神(또는 합화 결과 오행)이 천간에 투출. |
| C-방해 | 참여 글자에 대한 **충** 성립(형·파·해 편입은 TBD). |
| C-거리 | 지정 슬롯 쌍이 인접 기둥(연-월·월-일·일-시) 등 — 五合에서 R. |
| C-중복 | 타 transform-ok와 슬롯 공유 → S1 경합 집합 (§1.5.10). 점수 아님. |
| C-경쟁 | 화기를 깨는 극·설 재료 — 현재 S(불리 기록); 격상 시 개정. |

---

#### 1.5.5 Strength / Need 연결 (축 유지)

| 합 상태 | Strength | Need |
|---------|----------|------|
| `none` | 영향 없음 | 영향 없음 |
| `relation-hit` | **변경 금지** (기록만) | **변경 금지** |
| `hit-no-transform` | **변경 금지** | **변경 금지** |
| `transform-ok` | **Natal Strength 불변** + Transform modifier → Effective Strength (§1.5.7) | **별도 축 유지**. 화기 modifier가 Need를 자동 기입하지 않음(TBD-12) |

본 절은 축 분리만 말한다. 잔존/삭제 정책은 §1.5.7.

---

#### 1.5.6 종류별 요약

| 종류 | relation hit | `transform-ok` |
|------|--------------|----------------|
| 천간 五合 | 두 천간 쌍 (+C-거리 R) | R: 월령·통근·투간·거리 / B: 방해 / S: 세력·경쟁 |
| 六合 | 두 지지 쌍 | **초안 비대상** → `hit-no-transform` (TBD-02a) |
| 三合 완합 | 생·왕·묘 3자 | R: 월령·투간 / B: 방해 / S: 세력·통근·경쟁 |
| 方合 | 동방 3지 | R: 월령·투간 / B: 방해 / S: 세력·통근·경쟁 |
| 半合 | TBD-02b 범위 | **transform-ok 비허용** — 완합 매트릭스 비적용 |

확정: TBD-02c 매트릭스 · TBD-02f 안 C(§1.5.7).  
미개방: TBD-02a·02b. TBD-01b 수치 **확정**(엔진 미구현).

---

#### 1.5.8 TBD-02d — 화기 결과 오행 표 (확정)

범위: **五合 · 삼합(완합) · 방합**.  
육합·반합은 `transform-ok` 비대상/비허용 → **목표 오행 표를 만들지 않음**(§1.5.8.4).

공통 필드:

| 필드 | 의미 |
|------|------|
| 합 ID | 문서·향후 엔진 식별자 |
| 구성 | 참여 글자 |
| 목표 오행 | 전통 합화/합국이 가리키는 오행 (표 데이터) |
| relation-hit 시 변환 | **항상 아니오** — hit만으로 오행·modifier 변경 없음 |
| transform-ok 시 modifier 대상 | **목표 오행** — 이때만 Transform modifier의 `targetElement` |

계약 (확정):

1. **`relation-hit` / `hit-no-transform`:** 목표 오행이 표에 있어도 **modifier 미적용**. Natal 불변.  
2. **`transform-ok`:** 해당 행의 **목표 오행**만 Transform modifier 대상 (§1.5.7 안 C).  
3. 목표 오행 ≠ Natal 삭제. Effective에만 반영(강도 TBD-01b).  
4. 본 표는 **오행 라벨만** 확정. 수치·비율·Level 이동 없음.

##### 1.5.8.1 천간 五合

| 합 ID | 구성 | 목표 오행 | relation-hit 시 변환 | transform-ok 시 modifier 대상 |
|-------|------|-----------|----------------------|-------------------------------|
| stem-合-甲己 | 甲 · 己 | 土 | 아니오 | 土 |
| stem-合-乙庚 | 乙 · 庚 | 金 | 아니오 | 金 |
| stem-合-丙辛 | 丙 · 辛 | 水 | 아니오 | 水 |
| stem-合-丁壬 | 丁 · 壬 | 木 | 아니오 | 木 |
| stem-合-戊癸 | 戊 · 癸 | 火 | 아니오 | 火 |

##### 1.5.8.2 지지 삼합 (완합)

| 합 ID | 구성 | 목표 오행 | relation-hit 시 변환 | transform-ok 시 modifier 대상 |
|-------|------|-----------|----------------------|-------------------------------|
| branch-三合-申子辰 | 申 · 子 · 辰 | 水 | 아니오 | 水 |
| branch-三合-亥卯未 | 亥 · 卯 · 未 | 木 | 아니오 | 木 |
| branch-三合-寅午戌 | 寅 · 午 · 戌 | 火 | 아니오 | 火 |
| branch-三合-巳酉丑 | 巳 · 酉 · 丑 | 金 | 아니오 | 金 |

##### 1.5.8.3 지지 방합

| 합 ID | 구성 | 목표 오행 | relation-hit 시 변환 | transform-ok 시 modifier 대상 |
|-------|------|-----------|----------------------|-------------------------------|
| branch-方合-寅卯辰 | 寅 · 卯 · 辰 | 木 | 아니오 | 木 |
| branch-方合-巳午未 | 巳 · 午 · 未 | 火 | 아니오 | 火 |
| branch-方合-申酉戌 | 申 · 酉 · 戌 | 金 | 아니오 | 金 |
| branch-方合-亥子丑 | 亥 · 子 · 丑 | 水 | 아니오 | 水 |

방합은 “합화”보다 **합국(방위 오행)** 용어가 흔하나, 운율에서는 `transform-ok` 시 modifier **목표 오행**을 위 표와 같이 둔다. Natal 本气 삭제는 하지 않는다(안 C).

##### 1.5.8.4 육합 · 반합 (결과 오행 표 없음)

| 종류 | 정책 | 목표 오행 표 | 비고 |
|------|------|--------------|------|
| 지지 육合 | `transform-ok` **비대상**(TBD-02a) | **작성하지 않음** | 학파별 화기 인정 차이 → 임의 표 금지. hit만 기록. |
| 지지 반合 | `transform-ok` **비허용** | **작성하지 않음** | 완합 표로 승격 금지. hit 범위는 TBD-02b. |

향후 TBD-02a/02b에서 화기 경로를 열면 **별도 표 개정**으로만 추가한다.

##### 1.5.8.5 TBD-02d 상태

| 항목 | 상태 |
|------|------|
| 五合 목표 오행 | **확정** |
| 삼합 완합 목표 오행 | **확정** |
| 방합 목표 오행 | **확정** |
| 육합·반합 표 | **해당 없음** (비허용/비대상) |
| hit 시 modifier | **적용 안 함** (확정) |
| transform-ok 시 대상 | **표의 목표 오행** (확정) |
| 학파 충돌로 보류한 셀 | 없음 (위 표준 매핑). 육합 화기만 TBD-02a로 분리 |

**TBD-02d = 완료.**

---

#### 1.5.9 TBD-01b — Transform modifier (구조·수치 **확정**; 엔진 미구현)

범위: `transform-ok`인 五合·삼합·방합만. Need·Natal Strength 본선·점수는 다루지 않음.

##### 1.5.9.1 기본 구조 (확정)

```
Natal Strength          ← 불변. v1 본선 완료본.
Transform modifiers[]   ← transform-ok마다 0..n (안 C)
Effective Strength      ← 합성 결과. 소비층이 화기 반영 세력을 볼 때 사용.
```

Need에는 Transform modifier를 **직접 합산하지 않는다** (기존 원칙 유지).

##### 1.5.9.2 적용 방식 비교

| 방식 | 요지 | Natal 불변 | 제거 시 복원 | 총량 폭증 | 복수 합 | Luck 결합 |
|------|------|------------|--------------|-----------|---------|-----------|
| **M1. 목표 오행 가산형** | 목표만 +Δ | ○ | ○ | 위험 (가산만) | 쉬움 | 쉬움 |
| **M2. 참여 감쇠 + 목표 가산** | 참여 −δ, 목표 +Δ (이관형 modifier) | ○ | ○ | **통제 용이** | 가능 | **동형 스택 가능** |
| **M3. 비율 재배분형** | 관련 오행 합을 1로 두고 재분배 | △(Effective만이면 ○) | △ 복잡 | 총량 고정에 유리 | 스택·Luck과 충돌 많음 | 어려움 |

##### 1.5.9.3 선택: **M2 (참여 감쇠 + 목표 가산형)**

**채택:** 각 Transform modifier는 Effective 층에서

- **참여 오행(들)** 에 감쇠 항(−)  
- **목표 오행**(§1.5.8) 에 가산 항(+)  

을 남긴다. Natal·rawEvidence는 변경하지 않는다.

근거:

1. Natal 불변·modifier 제거 시 **완전 복원** — A안(mutate) 없이도 화기 “이동” 감각을 표현.  
2. M1보다 **오행 총량 폭증**을 구조적으로 완화(가산만 쌓이지 않음). 구체 δ·Δ·상한은 TBD.  
3. M3는 닫힌 비율이라 복수 합·Luck modifier와 **결합 계약이  непро**해지기 쉬움.  
4. 향후 Luck modifier도 같은 “가감 항 스택” 형태로 얹기 쉬움.

금지:

- Natal Strength Level/score를 M2로 **재기입**하지 않음.  
- M2 결과를 Need 축에 **가산하지 않음**.

##### 1.5.9.4 적용 순서 (확정)

```
1. Natal 계산 완료          (四柱·월령·통근·투간 → Natal Strength)
2. 합 관계 판정              (relation-hit / none …)
3. transform-ok 확정         (TBD-02c; hit만으로는 여기 미도달)
4. Transform modifier 생성   (합 ID · 참여 오행 · 목표 오행 §1.5.8)
5. 경쟁·중복 게이트          (**§1.5.10 TBD-02e**)
6. modifier 합성             (M2 항 합산 → 클램프; 숫자는 TBD)
7. Effective Strength 산출
```

`relation-hit` / `hit-no-transform`에서는 **4~7을 수행하지 않는다** (modifier 없음).  
`transform-ok`이어도 게이트에서 `modifierActive: false`이면 **6에 넣지 않는다**.

##### 1.5.9.5 Effective 계산 구조 (형태만 확정)

기호(숫자는 모두 TBD-01b-magnitude):

- `N(e)` = Natal Strength의 오행 `e` 표현량(Level 매핑·score 등 — 스케일 TBD)  
- 각 활성 modifier `m`: 참여 집합 `P(m)`, 목표 `T(m)`  
- `atten(m,e)` = e∈P(m)이면 감쇠량(TBD), 아니면 0  
- `boost(m,T(m))` = 가산량(TBD)

```
rawEffective(e) = N(e)
                − Σ_m atten(m, e)
                + Σ_m [e = T(m) ? boost(m) : 0]

Effective(e) = clamp( rawEffective(e) ; 하한·상한 TBD )
```

- `atten`/`boost`의 **값·비율·Level 단수** = **TBD** (본 절에서 확정하지 않음).  
- `boost`와 `Σ atten`의 관계(보존·부분 보존·비보존)도 **TBD**.  
- clamp는 폭증·음수 폭주 방지용 **구조만** 확정.

##### 1.5.9.6 복수 modifier 합성 원칙 (확정)

**동일 목표 오행**으로 향하는 복수 modifier:

- 각 m의 `boost`·관련 `atten`을 **항 단위로 합산**(스택).  
- 합산 후 오행별·전역 **상한(TBD)** 으로 clamp.  
- “최댓값만 채택” 등은 채택하지 않음(상한으로 폭증 제어).

**서로 다른 목표 오행**으로 향하는 modifier 동시 존재:

- **병존 허용** — 오행별로 독립 가감 후 각각 clamp.  
- 전역 총량 상한(TBD)이 있으면 그다음에 적용.  
- 한 modifier가 다른 목표를 “취소”하지 않음(슬롯 경쟁은 §1.5.10).

##### 1.5.9.7 M2 ↔ 경쟁 게이트 연결

- **동일 글자 슬롯을 공유**하는 복수 합: Effective에 modifier를 **중복 적용하지 않는다** (§1.5.10).  
- 게이트 통과분(`modifierActive: true`)만 §1.5.9.5 합산에 들어간다.  
- 탈락·보류분은 Natal·relation evidence에 **영향 없음**.

##### 1.5.9.8 TBD-01b 상태

| 항목 | 상태 |
|------|------|
| Natal / modifiers / Effective 구조 | **확정** |
| 방식 M2 (감쇠+가산) | **확정** |
| 적용 순서 | **확정** |
| 동·이목표 복수 합성 원칙 | **확정** (상한 숫자는 TBD) |
| 슬롯 경쟁 | **§1.5.10 TBD-02e 확정** |
| atten·boost·clamp **수치** | **확정 B** (§1.5.9.10) |
| Need 직접 합산 | **금지** (확정) |

##### 1.5.9.10 TBD-01b 수치 (확정 · 엔진 미적용)

**스케일 전제:** Natal 판단 Strength는 **Level(5단)** 이 본선이며 단일 연속 score는 없다.  
Effective M2 시뮬은 기존 **Display Score** 좌표를 빌려 쓴다 (`toElementStrengthDisplayProfiles`).

| 항목 | 값 |
|------|-----|
| Display 대역 | very-weak 8–20 · weak 24–40 · balanced 44–60 · strong 64–80 · very-strong 84–96 |
| 사용 가능 구간 | **8–96** (0·100 미사용) |
| 대역 폭 | 대체로 **12–16점** |
| 시뮬 Natal 예 | 丁酉형 金72 土60 火52 木44 水32; 균등 52; 극단 金92 / 木12 |

엔진 본선 `buildElementStrengthProfiles` **미변경**. Need/Core/Supplement **미적용**.

###### 후보 정의 → **B 확정 (TBD-01b 수치)**

| 항목 | 확정 값 |
|------|---------|
| 五合 transform pool | **12** |
| 삼합·방합 transform pool | **16** |
| atten | 참여 슬롯에 **균등** 분배 (§1.5.9.10.1) |
| boost | **= Σatten** |
| Internal Effective | **비clamp** (정책 D) |
| Display | **8–96 clamp만** |
| Level | Internal + **nearest**, midpoint tie → **upper**, 갭=**(bandHi, nextLo)** 연속 개구간 |

A(8/12)·C(16/20)는 비교용으로만 유지. **채택은 B.**

###### 1.5.9.10.0 최종 sweep 결과 (B)

- 단일 五合·삼합·방합 × Natal 7종: **63케이스**, Internal 보존·복원·목표 상승 OK, **max Level jump = 1**, hard fail 0.  
- 슬롯 비공유 이중 modifier: max jump 1, fail 0.  
- 동일 목표 중첩(2×triple→火): 보존 OK, Level **jump 2** (soft — 2개 pool 합산; 단일 한도 ±1과 별도).  
- `modifierActive: false`(competition-unresolved): Effective 미반영 OK.  
- Internal &gt;96 / &lt;8 → Level 정책 OK.  
- A/B/C 평균 \|Δtarget\|: A≈6.2 · **B≈8.9** · C≈11.6 (B 중간).

###### 1.5.9.10.4–6 clamp D · Level 입력 (요약, 기확정)

clamp **D**, Level=**Internal**, 갭 **nearest / mid→upper**, 범위 밖 very-weak/very-strong.

갭 정의 정정: 정수 21–23만이 아니라 **(hi, nextLo) 연속 개구간** (소수 Internal 포함).

###### 1.5.9.10.7 TBD-01b 상태

| 항목 | 상태 |
|------|------|
| 수치 B (12/16) | **확정** |
| M2·clamp D·Level | **확정** |
| 엔진 Transform 구현 | **미착수** |
| UI 동점 | **미결정** |

**실패 hard case: 없음.** soft: 동일 목표 다중 modifier 시 ±2 Level 가능(문서화).

---

###### 1.5.9.10.1 기부 오행 atten 분배 (확정)

| 합 | atten 슬롯 수 | 슬롯 구성 | 분배 |
|----|---------------|-----------|------|
| 五合 | **항상 2** | 두 천간 오행 (목표 포함) 예: 甲己→土 ⇒ `[木, 土]` | pool/2 |
| 삼합·방합 | **항상 3** | 세 지지 본기 (중복 유지) 예: 寅卯辰→木 ⇒ `[木, 木, 土]` | pool/3 |

boost = Σatten. 목표 글자 오행도 기부 슬롯에 포함.

###### 1.5.9.10.2 clamp 정책 D (확정)

Internal Effective **비clamp**. Display만 [8, 96].  
(A 버림·B 재분배·C 축소는 기각 — 비교 기록은 이전 개정에 있음.)

###### 1.5.9.10.3 Level = Internal + nearest (확정)

- 판단 입력: **Internal** (Display 기각)  
- &lt;8 → very-weak · &gt;96 → very-strong · band 안 → 해당 Level  
- 갭: 연속 개구간 **(bandHi, nextLo)** · **nearest** · 중점 동거리 → **upper**  
- 정수 21–23만 갭으로 보면 소수 Internal이 fall-through 하는 버그가 있으므로 **연속 갭 필수**

###### 1.5.9.10.4 TBD-01b 수치 **B 확정**

위 표(五合 12 / 삼합·방합 16) 및 sweep §1.5.9.10.3 결과로 **잠금**.  
엔진 Transform 구현은 별도 착수. UI 동점 미결정.

시뮬: `src/lib/saju/__tests__/m2TransformModifierSim.test.ts`

---

#### 1.5.10 TBD-02e — 합 중복·경쟁 해결 (확정)

##### 1.5.10.1 두 레이어 분리 (확정)

| 레이어 | 복수 허용 | 역할 |
|--------|-----------|------|
| **Relation** | **예** — 합마다 `none` / `relation-hit` / `hit-no-transform` / `transform-ok` 기록 | 사실·해석 evidence. **삭제하지 않음**. |
| **Modifier 게이트** | 슬롯 공유 시 **최대 제한** | Effective에 넣을 Transform modifier만 고름 |

원칙:

- 경쟁에서 탈락해도 **relation-hit / transform-ok 판정 evidence는 보존**.  
- 탈락 = `modifierActive: false` (+ reason). Natal Strength 불변.

##### 1.5.10.2 경쟁 상황 구분

| 상황 ID | 정의 | modifier 게이트 |
|---------|------|-----------------|
| S1 | **동일 글자 슬롯**이 2+ 합 후보에 참여 | **경합** — 중복 적용 금지 (§1.5.10.4~) |
| S2 | 동일 목표 오행 · **슬롯 비공유** 복수 합 | **병존** — M2 스택 (§1.5.9.6) |
| S3 | 서로 다른 목표 · **슬롯 비공유** | **병존** |
| S4 | 천간합끼리 · 슬롯 공유 | **경합** (S1) |
| S5 | 지지합끼리 · 슬롯 공유 | **경합** (S1) |
| S6 | 천간합 + 지지합 **동시** | **기본 병존** (참여 영역 다름). 경합으로 올리지 않음 |

S6 예외를 두어 천·지를 묶으려면 별도 개정. **초안·확정: 독립 병존.**

##### 1.5.10.3 상태 모델 (게이트 출력)

각 `transform-ok` 합에 대해:

| 필드 | 값 |
|------|-----|
| `modifierActive` | `true` \| `false` |
| `contentionStatus` | `uncontested` \| `won` \| `lost` \| `competition-unresolved` \| `n/a`(화기 비대상) |

| contentionStatus | 의미 |
|------------------|------|
| `uncontested` | S1 경합 없음 → 적용 가능 |
| `won` | S1에서 우선순위 승리 → 적용 |
| `lost` | S1에서 탈락 → **미적용**, relation 보존 |
| `competition-unresolved` | 동률·결정 불가 → **전원 미적용** (임의 선택 금지) |

`modifierActive === true` ⇔ Effective 합성 입력.  
`lost` / `competition-unresolved` ⇒ `modifierActive: false`.

##### 1.5.10.4 중복 적용 금지 (확정)

- S1 경합 집합 안에서는 Effective modifier를 **동시에 둘 이상 적용하지 않는다**.  
- 승자 0 또는 1명(또는 unresolved 시 0).  
- “지분 분할 적용”은 **채택하지 않음** (수치 TBD-01b와 무관하게 구조 금지).

##### 1.5.10.5 독립 합 병존 (확정)

- **공유 슬롯이 없는** 합들은 목표 오행이 같든 다르든 modifier **동시 적용 가능** (S2·S3·S6).  
- 이후 M2 합산·clamp(수치 TBD).

##### 1.5.10.6 경합 선택 — 점수 없는 우선순위 (확정)

대상: 동일 경합 집합(서로 슬롯을 하나라도 공유하는 `transform-ok` 합들; 연결 요소로 묶음).

**전제 필터 (이미 transform-ok 경로):** required 전부 pass · blocking 없음 · unknown 없음.  
필터를 통과하지 못한 합은 경합 집합에 넣지 않음.

남은 후보에 **아래 키를 앞에서부터** 비교한다. 한쪽이 우위면 즉시 승자. **임의 추첨 금지.**

| 순위 | 키 | 우위 |
|------|-----|------|
| P1 | **완전 구조** | 지지 **완합**(삼합 3/3 · 방합 3/3) ≻ 천간 五合(쌍). 반합은 transform-ok 자체가 없으므로 불참. |
| P2 | **월령 지지** | 월지(`month.branch`)가 해당 합 **구성에 포함** ≻ 미포함. (천간합은 월간 천간이 쌍에 있으면 충족으로 본다.) |
| P3 | **C-투간** | 이미 required pass이므로 동률 시 — *추가 신호 없음*이면 P4로. (품질 등급은 두지 않음.) |
| P4 | **C-통근** | pass(또는 해당 종류에서 R/S로 평가해 pass) ≻ fail/N/A·unknown. unknown이면 이 키로 우위 주장 불가. |
| P5 | **C-거리** | 五合 등 거리 R인 종류: 인접 충족이 더 좁은 쌍… — 둘 다 R pass면 동률. 지지 완합은 N → 스킵. |
| P6 | **종류 타이브레이크** | 삼합 완합 ≻ 방합 ≻ 五合 |

P1에서 **완전 구조 우선**: 삼합·방합 완합이 五合과 슬롯을 공유하면(실제로는 글자 종류가 달라 S6) — 지지끼리만 S1.  
**삼합 완합 vs 방합 완합**이 가지를 공유하면 P1 동률 → P2(월지 포함) → … → P6에서 **삼합 ≻ 방합**.

##### 1.5.10.7 동률 · unresolved (확정)

- P1–P6으로도 단수 승자가 없으면 → 집합 전체 `competition-unresolved`.  
- **임의 선택·해시·입력 순서 승자 금지.**  
- 전원 `modifierActive: false`. relation·`transform-ok` 기록은 유지.  
- 해석 레이어에 “화기 경합 미해소” 플래그만 남길 수 있음.

##### 1.5.10.8 C-중복 역할

매트릭스의 C-중복(TBD였던 열)은 본 절에서 **게이트 입력**으로 닫는다:

- C-중복 = “타 transform-ok와 슬롯 공유 여부” 탐지 → S1 경합 집합 구성.  
- pass/fail 점수가 아니라 **경합 집합 멤버십** 신호.

##### 1.5.10.9 TBD-02e 상태

| 항목 | 상태 |
|------|------|
| hit vs modifier 레이어 분리 | **확정** |
| S1 중복 적용 금지 | **확정** |
| S2·S3·S6 병존 | **확정** |
| 우선순위 P1–P6 | **확정** (점수 없음) |
| 동률 → unresolved | **확정** |
| 탈락 hit 보존 | **확정** |
| atten/boost 수치 | 비범위 (TBD-01b) |

**TBD-02e = 완료.** → TBD-01b **수치 설계로 진행 가능.**

---

#### 1.5.7 TBD-02f — `transform-ok` 이후 원래 오행 (확정: 안 C)

적용 범위: **五合 · 삼합(완합) · 방합**의 `transform-ok` 이후.  
(육합·반합은 화기/`transform-ok` 비대상·비허용 → 본 정책 적용 없음.)

##### 1.5.7.1 세 안 비교

| 기준 | A. 완전 삭제 후 화기 오행으로 대체 | B. 일부 잔존 + 화기 반영 | C. 원국 보존 + 화기 modifier/layer |
|------|-----------------------------------|---------------------------|-------------------------------------|
| 원국 정보 보존 | 나쁨 — 본기·글자 evidence가 사라지거나 덮임 | 중간 — 비율·잔기 정의가 원국과 섞임 | **좋음** — Natal 사실층 불변 |
| Strength 계산 안정성 | 나쁨 — v1 본선 입력이 mutate되어 재현·감사 어려움 | 중간 — “잔존 비율”이 Level 산식에 침투 | **좋음** — Natal Strength와 Effective 분리 |
| Need와 분리 | 나쁨 — 삭제된 오행이 Need 입력까지 오염하기 쉬움 | 중간 — 잔존/화기 이중 계산 유혹 | **좋음** — Need는 Natal 또는 별도 재평가만(자동 병합 금지) |
| 합 해제·충 시 복원 | 나쁨 — 삭제분 복원 트랜잭션 필요 | 중간 — 잔기 비율 롤백 복잡 | **좋음** — modifier 제거만으로 Natal 복귀 |
| 대/세/월/일운 적용 | 나쁨 — 운이 원국 mutate본과 충돌 | 중간 — 운마다 잔기 재계산 | **좋음** — 원국 고정 + 운·합 modifier 스택 |
| 중복 계산 위험 | 높음 — 화기 오행을 본선·modifier에 이중 가산하기 쉬움 | 높음 — 잔존+화기+본선 삼중 | **낮음** — Natal 1회 + modifier만 가감(강도 TBD) |

##### 1.5.7.2 선택: **안 C**

**채택 정책:** 원국 오행·Natal Strength·四柱 evidence는 **보존**한다. `transform-ok`는 **Transform modifier**만 추가하고, 소비층은 필요 시 **Effective Strength**를 읽는다.

근거:

1. 운율은 이미 Strength / Need / Luck / 표현을 **레이어로 분리**한다. 원국 mutate(A)는 이 구조와 충돌한다.  
2. Strength v1·감사가 **사실층(四柱·월령·통근)** 에 묶여 있다. A/B는 본선 입력을 바꿔 회귀·감사를 깨기 쉽다.  
3. 충·합 해제·운 변화 시 **복원 가능성**이 제품 필수에 가깝다 → modifier on/off가 가장 단순하다.  
4. B의 “일부 잔존”은 결국 **비율(TBD-01b)** 없이 구현 불가하며, 사실상 C의 변형을 본선에 섞은 형태라 중복 위험이 크다.

##### 1.5.7.3 레이어 구조 (확정)

```
Natal (원국, immutable)
  ├─ 四柱 · 월령 · 통근 · 투간 · Strength v1 …
  └─ mutate 금지

Transform modifiers (transform-ok인 합마다 0..n; M2 §1.5.9)
  ├─ source: 五合 | 삼합 | 방합
  ├─ targetElement: 화기 오행 (**§1.5.8 표**)
  ├─ participantElements: 감쇠 대상 (구성 오행 — 세부 집합 TBD)
  ├─ effect: Internal Effective에서 참여 − / 목표 + (수치 TBD-01b)
  └─ Need에 자동 기입 금지

Internal Effective = Natal − Σatten + Σboost   ← **clamp 없음** (정책 D)
Display Score = clamp(Internal, 8..96)       ← 표시만
  └─ 형태 §1.5.9; 수치 TBD
```

원칙:

- **`transform-ok`는 원국 데이터를 mutate하지 않는다.**  
- Natal Strength Level / rawEvidence는 합화 전후 **동일**해야 한다.  
- UI·Core·Supplement·Luck가 “화기 반영 세력”이 필요하면 **Effective**를 참조한다(연결 계약은 각 모듈 TBD).

##### 1.5.7.4 modifier 적용 / 해제 계약 (확정)

| 사건 | 동작 |
|------|------|
| 합이 `transform-ok`로 승격 | 해당 합 ID로 Transform modifier **추가**(또는 갱신). Natal 불변. |
| required 상실 · blocking 성립 · 합 글자 해체 · 충으로 화기 불가 | 해당 합의 modifier **제거** → Effective는 Natal(+남은 modifier)로 **복귀**. |
| 동일 합이 다시 `transform-ok` | modifier 재적용. Natal 재작성 없음. |
| 여러 합이 동시 `transform-ok` | §1.5.10 게이트 후 `modifierActive`만 스택. |

해제 시 **원국 스냅샷 복원 연산이 필요 없다** — Natal이 항상 진실이다.

##### 1.5.7.5 Need · 수치

- Need는 화기 modifier와 **별도 축**. modifier 적용 ≠ Need 자동 변경.  
- Climate/Need가 Effective를 참고할지, Natal만 볼지는 **TBD-12** (기본 권고: Natal 우선, Effective 참고는 명시적 게이트만).  
- **화기 modifier 강도·비율·Level 이동폭 = TBD-01b** (본 TBD-02f에서 확정하지 않음).

##### 1.5.7.6 TBD-02f 상태

| 항목 | 상태 |
|------|------|
| 정책 선택 (A/B/C) | **확정: C** |
| 원국 mutate 금지 | **확정** |
| Natal → Transform modifier → Effective | **구조 확정** |
| 적용/해제(복귀) | **확정** |
| 수치·비율 | **미정 → TBD-01b** |
| Need 자동 연동 | **금지** (세부 TBD-12) |

---

#### 1.5.11 TBD-02g — Transform production wiring 조사 (**설계 조사 · 구현 없음**)

목표: 확정된 M2 설계(§1.5.7~§1.5.10)를 production에 옮기기 전, **현재 코드 상태**를 조사하고
wiring의 최소 아키텍처·경계를 확정한다. **본 절은 설계만 다룬다** — M2 수치·정책을 다시 서술하지 않는다.

##### 1.5.11.1 현재 production 조사 결과

| 조사 항목 | 실제 상태 |
|-----------|----------|
| 천간합 / 지지합 relation 계산 | **없음.** production 전체에 五合·삼합·방합·육합·반합 코드 0건 |
| `transform-ok` 판정 | **없음** |
| 합 종류·결과 타입 | **없음** |
| 합 관련 테이블 | **없음.** 지지 쌍/삼자 테이블은 `luck/clash/branchClashPairs.ts`(육충)와 `constants/ganzhi.ts`(60갑자)뿐 |
| `BranchRelationEvidence` | **합과 무관.** 지장간 각각의 **십신(support/pressure)** evidence다. 이름만 relation |
| Strength 결과 타입 | `ElementStrengthProfile { element, strengthLevel, reasons, rawEvidence }` — **Level 기반, 연속 score 없음** |
| Natal / Display 경계 | `buildElementStrengthProfiles` → `toElementStrengthDisplayProfiles`. Display는 **표시 전용 좌표** |
| 경쟁 판정용 기존 정보 | **없음.** 슬롯 공유를 판정할 합 참여 구조 자체가 없음 |

**Q1 답: `transform-ok` production 판정은 존재하지 않는다.** 합 relation 탐지부터 전무하다.
따라서 **Q2는 해당 없음**(소비할 결과가 없다).

##### 1.5.11.2 Q3 — 계층 분리 (§1.5.9.4 확정 순서에 정렬)

확정 순서가 이미 modifier 생성을 **경합 게이트보다 앞**에 둔다. 이를 그대로 계층으로 옮긴다.

| 계층 | 입력 → 출력 | 수치 인지 |
|------|-----------|----------|
| **L1 detect** | 四柱 → `TransformRelation[]` (**hit만**, 판정 없음) | 없음 |
| **L2 evaluate** | relation + C-* 조건(§1.5.4.2) → `transform-ok` / `hit-no-transform` | 없음 |
| **L3 modifier build** | `transform-ok` → `TransformModifier[]` (`modifierActive` 초기값 포함) | **pool 12/16** |
| **L4 competition** | 슬롯 공유 경합 집합 → P1–P6(§1.5.10.6) → `contentionStatus` · `modifierActive` 갱신 | 없음 |
| (후단) compose | active modifier만 → Effective | — |

- **L4는 modifier를 삭제하지 않는다.** `modifierActive`만 뒤집고 relation·`transform-ok` 기록은 보존한다(§1.5.10.7).
- 동률이면 집합 전체 `competition-unresolved` · 전원 비활성. **임의 승자 금지.**
- 六合·반합은 **L2에서 종료**(transform path 없음) — L3에 도달하지 않는다.

##### 1.5.11.3 Q4·Q5 — 최소 타입과 identity

**핵심 발견:** 기존 M2 시뮬의 참여 표현은 `attenSlots: Element[]`(예: 申子辰 → `["金","水","土"]`)로
**오행만 있고 슬롯이 없다.** 이대로는 ① 경합 집합(슬롯 공유, §1.5.10.8 C-중복)을 판정할 수 없고
② clash의 `(element × natal slot)` 키와 대조할 수 없다. ⇒ **시뮬 타입을 그대로 승격하면 안 된다.**

production 참여 단위는 **3요소**가 필요하다:

```
participant = { slot: PillarSlot, layer: "stem" | "branch", element: Element }
```

`layer`가 필수인 이유: 五合은 **천간**, 삼합·방합은 **지지**에서 성립하므로
같은 `slot`이라도 층이 다르면 **슬롯 비공유**(S6 병존)다. layer 없이는 오탐한다.

**경합 identity =** `layer:slot` 집합의 교집합 여부. (글자·오행이 아니라 **자리**로 판정 — §1.6.6 계열 원칙과 동일)

최소 타입 골격(형태만, 구현 아님):

| 타입 | 최소 필드 |
|------|----------|
| `TransformRelation` | `combineId` · `kind` · `participants[]` — **판정·목표 없음** |
| `TransformCandidate` | relation + `status`(`transform-ok`/`hit-no-transform`) + `targetElement` |
| `TransformModifier` | `combineId` · `attenuations[] {participant, amount}` · `boost {element, amount}` · `modifierActive` |
| 경합 결과 | `contentionStatus`: `uncontested` / `won` / `lost` / `competition-unresolved` |

`targetElement`는 **relation이 아니라 candidate**에 붙인다 — 화기 목표는 판정 결과이지 관계 사실이 아니다.

##### 1.5.11.4 Q6 — 배치 후보 3안

| 안 | 요지 | Natal 불변 | hit÷ok 분리 | 경합 독립 | clash 합성 | Luck 재사용 | 판정 |
|----|------|:---:|:---:|:---:|:---:|:---:|------|
| **T1** | `elements/` 안에 추가 | ✗ Strength와 동거 | △ | ✗ | △ | ✗ | **기각** |
| **T2** | `luck/clash/`를 `luck/relations/`로 확장 | ○ | ○ | ○ | ○ | △ | **기각** — 합은 **원국 1차** 현상인데 `luck/` 아래로 들어간다 |
| **T3** | **`src/lib/saju/transform/` 신설 (L1–L4 파일 분리)** | **○** | **○** | **○** | **○** | **○** | **권고** |

**T3 권고 근거:** ① 합은 natal 우선 현상이라 `luck/` 종속이 부적절 ② L1–L4를 파일 경계로 강제해
“hit ≠ transform ≠ modifier ≠ 경합”이 규율이 아닌 **타입 경계**가 된다 ③ Luck 합은 나중에 동일
detect에 target만 추가해 재사용 ④ Natal Strength를 import하지 않으므로 불변이 구조적으로 보장.

##### 1.5.11.5 Q7 — 시뮬에서 승격 가능한 것 / 불가능한 것

| 항목 | 승격 |
|------|------|
| pool 12 / 16 | **가능** — 확정 수치. `transform/constants.ts`로 (clash의 `CLASH_ATTENUATION_DELTA` 선례) |
| 五合 목표표 · 삼합/방합 목표표 | **가능** — §1.5.8 확정 표 |
| 분배식 `per = pool / 참여수`, `boost = Σatten` | **가능** — 확정 규칙 |
| `attenSlots: Element[]` 형태 | **불가** — 슬롯 identity 손실(§1.5.11.3) |
| `synthesize()` 합성 함수 | **불가** — Natal score 직접 가감. 후단 Effective 계층으로 대체 |
| A(8/12)·C(16/20) 후보 | **불가** — 기각된 비교 기록 |

##### 1.5.11.6 Q8 — clash와의 공통 Effective 이음매

두 층은 **오행별 부호 있는 델타**로 환원된다. 이것이 공통 좌표계다.

| 층 | 델타 | Σ 보존 |
|----|------|:---:|
| clash | 오행별 **음수만** (`−4 × 피격 슬롯 수`) | ✗ 순손실 |
| transform | 참여 오행 **음수** + 목표 오행 **양수** | ○ 보존 |

합성은 **오행별 단순 합**이며, 비관련 오행은 키가 없다(전역 패널티 금지가 양쪽에서 유지).
현행 `buildClashEffectiveScores`는 `ClashAttenuationModifier[]`를 직접 받으므로,
합성 시점에 **“오행별 델타 목록”을 받는 형태로 일반화**하면 두 층이 같은 파이프라인을 탄다.
(clamp·Level 재판정은 `clash/resolveEffectiveStrengthLevel.ts`를 **그대로 재사용** — 층과 무관하다.)

##### 1.5.11.7 TBD-02g 상태

| 항목 | 상태 |
|------|------|
| 계층 L1–L4 분리 (§1.5.9.4 정렬) | **설계 확정 가능** |
| 참여 단위 `{slot, layer, element}` | **설계 확정 가능** |
| 경합 identity = `layer:slot` 교집합 | **설계 확정 가능** |
| 배치 T3 `src/lib/saju/transform/` | **권고** |
| 승격 가능 상수·표 (pool 12/16, 목표표, 분배식) | **설계 확정 가능** |
| clash 합성 이음매 = 오행별 델타 | **설계 확정 가능** |
| **L1 relation detection** | **구현 완료** — `transform/{types,combinationTables,detectTransformRelations}.ts` |
| **L2 조건 평가 · `transform-ok` 판정** | **구현 완료** — `transform/{conditionRoles,transformTargetTables,evaluateTransformCandidates}.ts` |
| **L3 raw modifier 생성** | **구현 완료** — `transform/{constants,buildTransformRawModifiers}.ts` |
| **L4 경합 게이트** | **구현 완료** — `transform/resolveTransformCompetition.ts` |
| 六合·반합 | **L1 범위 제외** — transform path 없음(TBD-02b). 표에도 넣지 않음 |
| 반합(2자) · 미완성 삼합/방합 | **L1 미탐지** — 완성형 3자만 |
| Opening과의 상호작용 | **범위 밖** (TBD-03a) |

###### 1.5.11.8 L1 구현 메모 (구현 완료분만)

| 항목 | 결정 |
|------|------|
| 탐지 범위 | 五合 5 · 삼합 완성형 4 · 방합 완성형 4 = **13종**. 六合·반합 제외 |
| `combineId` | 표 순서 기반 canonical (예: `삼합-申子辰`). 자리 배치·순서와 무관하게 동일 |
| multiplicity | **자리 조합마다 별개 relation**. 같은 `combineId`가 여러 건일 수 있고, 인스턴스 식별은 `combineId` + 참여 자리 |
| branch participant element | **본기(정기) 오행**. `BRANCH_ELEMENT`가 12지지 전부에서 정기 지장간 오행과 **일치**함을 테스트로 잠금 → 기존 헬퍼 재사용, 값 복제 없음 |
| hour unknown | `confirmedSlots` 경유로 시주 자동 제외 → 참여·relation 모두 생성 안 됨 |
| 의존성 | `constants/elements` · `elements/slots`만. **Strength/Need/Core/Supplement/clash import 없음** |
| 결정론 | 표 순서 → 자리 순서(year→month→day→hour). 정렬 없이 순회만으로 고정 |


###### 1.5.11.9 L2 구현 메모 — C-* 항목별 production 가능 여부

각 조건이 **확정 정의(§1.5.4.5)만으로** 평가 가능한지 분류했다. **새 명리 규칙은 추가하지 않았다.**

| C-* | 키 | production 상태 | 근거 |
|-----|-----|----------------|------|
| C-월령 | `monthCommand` | **구현 가능** · 기존 evidence 재사용 | "월지가 합국 구성원" = participants에 month/branch 포함. "득시"는 문서가 명시한 **왕·상**으로 읽고 기존 `seasonPhaseOf` 테이블을 **그대로** 사용(값 변경 없음) |
| C-투간 | `stemExposure` | **구현 가능** | "化神이 천간에 투출" — `confirmedSlots` + `stemElement`로 직접 판정 |
| C-방해 | `obstruction` | **부분 구현** | 지지 참여(삼합·방합)는 육충 표(§1.6.1)로 판정 가능. **五合은 unknown** — 천간 충이 TBD-03 범위 밖(§1.6.1)이고 §1.5.4.3의 "연계 지지"에 확정 정의가 없음 |
| C-거리 | `distance` | **구현 가능**(五合만 R) | "인접 기둥(연-월·월-일·일-시)" 열거가 확정적 → 슬롯 인접 판정 |
| C-세력 | `force` | **unknown** | "본기 밀도 등 — 라벨만". 임계값 없음. S라 차단하지 않음 |
| C-통근 | `root` | **unknown** | "참여/결과 관련 천간의 rootStatus" — 대상 천간이 참여인지 결과인지 미확정, 세부는 **TBD-05** |
| C-경쟁 | `competition` | **unknown** | "화기를 깨는 극·설 재료" — 판정 기준 없음. S라 차단하지 않음 |
| C-중복 | `duplicate` | **게이트 · L2 미평가** | R/S/B가 아니라 §1.5.10.8 경합 집합 입력. `not-applicable`로 기록만 하고 **차단하지 않음** |

**기존 Strength evidence와의 관계 (억지 재사용 금지 확인):**

- `seasonPhaseOf` = C-월령의 득시 판정과 **의미 일치** → 재사용
- `rootStatus`/`rootedSlots` ≠ C-통근 — Strength의 root는 *해당 오행*의 통근이고, C-통근은 *참여/결과 천간* 기준이라 **대상이 다르다**. 이름이 비슷하다는 이유로 쓰지 않고 `unknown` 유지
- `hasMonthOutlet` ≠ C-투간 — 전자는 *월지 지장간*의 투출, 후자는 *화신*의 투출. **다른 개념** → 별도 판정
- `presence`/`exactStemVisible` ≠ C-세력 — 세력은 "밀도 등"으로 임계가 없어 매핑 불가

###### 1.5.11.10 현재 `transform-ok` 도달 가능성 (측정)

| 합 종류 | required | 도달 | 막는 조건 |
|---------|----------|------|-----------|
| **삼합(완합)** | C-월령 · C-투간 | **가능** | — (blocking C-방해도 지지 육충으로 판정 가능) |
| **방합** | C-월령 · C-투간 | **가능** | — |
| **五合** | C-월령 · C-통근 · C-투간 · C-거리 | **불가(닫힘)** | `root` **required unknown** + `obstruction` **blocking unknown** → §1.5.4.1.4 보수 원칙으로 자동 금지 |

⇒ **五合을 열려면** TBD-05(C-통근 대상 확정)와 천간 충/연계 지지 정의가 **선행**되어야 한다.
현재 상태에서 五合에 `transform-ok`를 주려면 임의 규칙이 필요하므로 **열지 않는다.**


###### 1.5.11.11 L3 구현 메모 — raw modifier

**production에 승격된 수치는 五合 12 · 삼합 16 · 방합 16 뿐이다.**
기각된 A(8/12) · C(16/20)는 문서 비교 기록으로만 남고 코드에 없다.
`kind → pool` 매핑은 `transform/constants.ts` **한 곳에만** 존재한다.

| 항목 | 결정 |
|------|------|
| 생성 대상 | `status === "transform-ok"` **만**. `relation-hit` · `hit-no-transform`은 생성 안 함 |
| 분배 | pool ÷ **참여 자리 수**. 반올림하지 않음 (삼합·방합 = 16/3) |
| `boost` | **`attenuations` 합에서 유도**. pool을 하드코딩하지 않는다 |
| 총량 보존 | 합에서 유도하므로 `Σatten === boost`가 **부동소수점과 무관하게 정확히** 성립 |
| participant 보존 | `{slot, layer, element}` identity 유지. **오행별로 합치지 않음** (방합 寅卯辰 → 木 행 2건) |
| `targetElement` | L2 후보 값을 그대로 소비. L3에서 목표 표를 **재조회하지 않음** |
| 입력 | `TransformCandidate[]`만. **`FourPillars` 불필요**, C-* 재평가 없음 |

**타입 계층 분리 (raw / resolved):** §1.5.10.3이 `modifierActive`·`contentionStatus`를
**게이트 출력**으로 정의하므로, L3 산출물 `TransformRawModifier`에는 두 필드를 **넣지 않는다**.
L4가 이 raw를 소비해 resolved 타입을 만든다. 새 상태값(`pending` 등)을 창작하지 않았다.

**예시:**

| 합 | pool | 참여 자리 | 자리당 atten | boost |
|----|------|----------|-------------|-------|
| 五合 甲己→土 | 12 | 2 (天干) | **6** · 6 | **12** |
| 삼합 申子辰→水 | 16 | 3 (地支) | **16/3** ×3 | Σ = 16 (≈15.999999999999998) |
| 방합 寅卯辰→木 | 16 | 3 (地支) | **16/3** ×3 | Σ = 16 |

방합 寅卯辰의 참여 오행은 `[木, 木, 土]`이며 木 두 자리는 **별도 행**으로 남는다 —
오행 합산은 후단 compose의 몫이다.


###### 1.5.11.12 L4 구현 메모 — 경합 게이트

**경합 identity = `(layer × slot)`.** 같은 `slot`이라도 layer가 다르면 공유가 아니다.
경합 집합은 §1.5.10.6대로 **연결 요소**로 묶는다 (A–B 공유, B–C 공유 ⇒ A·B·C 한 집합).

**API:** `resolveTransformCompetition(rawModifiers, candidates)`
`FourPillars`를 받지 않으며 C-*를 **재평가하지 않는다** — P4에 필요한 C-통근 상태는
L2 candidate evidence를 **참조**한다. raw↔candidate 매칭은 `combineId + 자리 서명`
(같은 `combineId`가 여러 자리 조합으로 존재할 수 있으므로 combineId 단독으로는 모호).

**P1–P6 감사 — 구현 가능 / 발동 가능 여부**

| 키 | 구현 | 실제 발동 | 비고 |
|----|------|----------|------|
| **P1** 완전 구조 (지지 완합 ≻ 五合) | 구현 | **발동 불가** | 한 경합 집합은 layer가 동일하므로 지지합·五合이 같은 집합에 들어오지 않는다 (아래 감사) |
| **P2** 월령 자리 포함 | 구현 | **발동** | 지지합=월지 · 천간합=월간, 둘 다 `slot === "month"`로 표현됨 |
| **P3** C-투간 | 스킵 | — | 문서가 "이미 required pass … 추가 신호 없음이면 P4로"로 **설계상 무신호** |
| **P4** C-통근 | 구현 | **현재 미발동** | L2에서 C-통근이 전 종류 `unknown`(§1.5.11.9) → "unknown이면 우위 주장 불가"에 걸림. TBD-05 해소 시 자동 발동 |
| **P5** C-거리 | 부분 | **미발동** | "지지 완합은 N → 스킵" 확정분만 반영. "인접 충족이 **더 좁은 쌍…**"은 문장이 미완이라 **미구현**(동률 처리) |
| **P6** 종류 타이브레이크 (삼합 ≻ 방합 ≻ 五合) | 구현 | **발동** | 지지합 집합의 실질 결정자 |

점수·가중치를 만들지 않았다. **lexicographic 좁히기**만 사용하며, 각 단계에서 아무도
만족하지 않거나 전원 만족이면 좁히지 않는다(동률). 단수 승자가 없으면 §1.5.10.7대로
집합 **전원** `competition-unresolved` · `modifierActive: false`.

###### 1.5.11.13 감사 — 五合(stem) vs 지지합(branch) 직접 경합

**결론: 설계 불일치 없음. 문서가 이미 이 경우를 규정하고 있다.**

- §1.5.10.2 **S6** = "천간합 + 지지합 동시 → **기본 병존**(참여 영역 다름). 경합으로 올리지 않음. 초안·확정: **독립 병존**."
- §1.5.10.6 P1 주석 = "삼합·방합 완합이 五合과 슬롯을 공유하면(**실제로는 글자 종류가 달라 S6**) — **지지끼리만 S1**."

⇒ `(layer × slot)` 공유 원칙과 S6는 **같은 결론**이다. 五合(stem)과 지지합(branch)은
물리적 자리를 공유할 수 없으므로 L4의 shared-slot 경합에서 **절대 같은 집합에 들어오지 않는다.**
따라서 **P1과 P6의 "≻ 五合" 항은 현재 구조에서 발동하지 않는다** — 방어적 잔여 표기다.
문서를 임의로 고치지 않고 이 사실만 기록한다.

(현재는 五合이 L2에서 `transform-ok`에 도달하지도 못하므로(§1.5.11.10) 五合 modifier 자체가 생성되지 않는다.)


###### 1.5.11.14 Clash + Transform 공통 Effective 합성 (구현 완료)

Transform **L1–L4 완료** 이후, clash와 transform을 **오행별 signed delta**라는 하나의
좌표계로 만나게 하는 공통 계층을 `src/lib/saju/effective/`에 두었다.

**합성 공식** (§1.5.9.5 형태 유지):

```
Internal Effective(element) = Natal displayScore + Σ delta     ← unclamped
Display Effective           = clamp(Internal, 8..96)
Effective Strength Level    = nearest band (중점 → upper)
```

| 층 | delta 규칙 | Σ |
|----|-----------|---|
| **clash** | 오행별 총 감쇠를 **음수**로. collapse가 끝난 modifier만 소비하며 relation multiplicity를 다시 세지 않는다 | 순손실 |
| **transform** | **`modifierActive === true`만**. 참여 자리 attenuation 음수 + 목표 boost 양수, 같은 오행 여러 자리는 전부 합산 | 보존(0) |

- `lost` · `competition-unresolved`는 delta **0**. `contentionStatus` 문자열이 아니라
  **`modifierActive`가 최종 게이트**다(§1.5.10.3).
- 전체 delta 합은 **clash 손실만큼만 음수**가 된다(transform은 보존) — 측정 확인.
- **Natal immutable**: Natal Strength profile·Need가 합성 전후 동일함을 통합 테스트로 확인.
- **Opening은 아직 합성하지 않는다**(TBD-03a magnitude 미정).

**계층 소유·경계**

| 모듈 | 책임 |
|------|------|
| `effective/types.ts` | `ElementEffectiveDelta` · `ElementEffectiveScore` · `ElementEffectiveProfile` · `NatalElementScore`(소유 이관) |
| `effective/composeElementEffectiveScores.ts` | delta 합성 → Internal → Display → Level. **clash·transform을 모른다** |
| `effective/resolveEffectiveStrengthLevel.ts` | clamp + nearest band (clash에서 **승격**. 기존 경로는 재수출로 호환 유지) |
| `luck/clash/buildClashElementDeltas.ts` | clash modifier → delta (`sumClashAttenuationByElement` 재사용) |
| `transform/buildTransformElementDeltas.ts` | active transform modifier → delta |

clash와 transform은 **서로를 import하지 않으며**, `effective/`도 두 모듈을 import하지 않는다 —
각 층이 자기 delta를 만들어 공통 계층에 넣는 구조다.

기존 `buildClashEffectiveScores` / `buildClashEffectiveProfiles`는 **그대로 유지**했다
(`attenuation` 필드를 쓰는 clash 고유 계약이고 세운 wiring이 소비 중). 삭제·rename 없음.

> 이 계층은 **Natal Strength 판정을 다시 계산하는 엔진이 아니다.** 표시 좌표를 빌려
> 확정 modifier를 얹는 **파생 Effective 계층**이며, Natal Level·Need·Core·Supplement를 바꾸지 않는다.


###### 1.5.11.15 세운 orchestration 합류 (구현 완료)

`resolveAnnualEffectiveStrength({ pillars, year })` — `luck/annual/`.

**책임 분리 (이름 오해 방지):**

| 층 | 출처 | 이번 범위 |
|----|------|----------|
| **Transform** | **원국(Natal) 전용** | 세운 간지는 합 participant가 **아니다** |
| **Clash** | **세운(annual-year) source** | 세운 지지 ↔ 원국 지지 육충 |

“annual effective”는 *세운 시점의* Effective라는 뜻이지 **세운이 Transform을 일으킨다는 뜻이 아니다.**
세운·원국이 만드는 합(**Luck Transform**)은 **미구현**이다.

**순서:** Natal Display 좌표 1회 산출 → (A) 원국 Transform L1→L4 → delta,
(B) 세운 Clash → modifier → delta → (C) 공통 합성 → Internal / Display / Level.

**중복 계산 제거:** `resolveAnnualClashEffective`가 내부에 갖고 있던 clash 하위 파이프라인을
`buildAnnualClashModifiers`로 **추출**해 두 경로가 공유한다. 기존 함수는 이 헬퍼를 쓰도록만
바뀌었고 **시그니처·반환 의미·테스트는 그대로**다. 상위 orchestrator는 Natal Display를
**한 번만** 만든다(기존 함수를 호출하지 않는다).

**결과 표면 최소화:** `{ target, clashRelations, transformModifiers, effectiveProfiles }`.
transform relation·candidate·raw modifier, clash key·snapshot은 **노출하지 않는다**
(`transformModifiers`의 `contentionStatus`·`modifierActive`가 필요한 진단을 이미 담는다).

**미구현:** Luck Transform · Opening · 대운/월운/일운 · 앱/UI 연결.
Need·Core·Supplement 축 분리는 그대로 유지된다.

---

### 1.6 충 (沖) — TBD-03 규칙 계약 (**구조 확정 · 수치 미정**)

범위: **지지 육충**의 한정 영향·통근 상태·합 Transform modifier와의 계약.  
제외: 감쇠율·위치 가중·개고 수치·Strength/Need/Core 본선·합충 엔진 구현·Luck·UI.  
개고(辰戌·丑未 등)는 일반 충 감쇠와 **별도 이벤트** → **§1.6.7 TBD-03a**.

| 필드 | 내용 |
|------|------|
| 판단 대상 | 지지 육충 hit가 **당사자 지지·그 지지에 묶인 통근 evidence·그 지지가 참여한 합 modifier**에 미치는 영향 |
| 입력값 | 육충 쌍 표(§1.6.1), 지지 슬롯 ID, 통근 evidence ID, 활성/후보 Transform modifier ID |
| 판단 조건 | 충 **relation hit**와 **감쇠·blocking 효과**를 분리. hit만으로 Natal 삭제·전역 감점 금지(§1.6.3). |
| 결과에 미치는 영향 | 통근 충 상태(§1.6.4); C-방해 blocking(§1.5.4); 활성 Transform modifier 해제·재평가(§1.6.5). Strength **한정** modifier는 수치 TBD-01c. |
| Strength 영향 여부 | **예(한정, 향후 modifier)**. v1 본선 미포함. **전역 일괄 감점 금지.** |
| Need 영향 여부 | **직접 합산 금지.** 충 감쇠값을 Need에 넣지 않음(축 분리). 간접 재평가는 TBD-12. |
| 다른 규칙과 충돌 시 우선순위 | 관계 파괴 1선(§2.3). 합화: 성립 전 blocking · 활성 modifier 해제(§1.6.5). 형·파·해보다 앞. 개고는 TBD-03a. |

#### 1.6.1 지지 육충 표 (확정)

| 충 ID | 지지 쌍 | 비고 |
|-------|---------|------|
| clash-zi-wu | **子–午** | |
| clash-chou-wei | **丑–未** | 개고 후보 쌍 — **개고 효과는 TBD-03a** (본 표는 충 hit만) |
| clash-yin-shen | **寅–申** | |
| clash-mao-you | **卯–酉** | |
| clash-chen-xu | **辰–戌** | 개고 후보 쌍 — **개고 효과는 TBD-03a** |
| clash-si-hai | **巳–亥** | |

- 위 6쌍만 **지지 육충** relation hit의 정의다.  
- 천간 충은 본 TBD-03 범위 **밖**(별도 표기 전까지 미편입).  
- 충 **hit** ≠ 감쇠 수치 확정 ≠ 개고 성립.

#### 1.6.2 영향 범위 (확정)

충 hit가 성립해도 **영향은 아래 범위에만** 열린다. 그 밖의 지지·오행·evidence·modifier는 **비관련 = 무영향**.

| 범위 | 영향 | 비영향 |
|------|------|--------|
| **A. 충 당사자 지지** | 해당 두 지지 슬롯(및 동일 글자라도 **슬롯 단위**로 식별) | 비당사자 지지 슬롯 |
| **B. 해당 지지의 통근 evidence** | 그 지지 슬롯을 root 위치로 쓰는 통근 evidence만 상태 전이(§1.6.4) | 다른 지지에만 묶인 통근 |
| **C. 해당 지지가 참여한 합 modifier** | 그 지지 슬롯을 구성에 포함하는 합의 transform 경로·활성 modifier(§1.6.5) | 슬롯 비공유 합 |
| **D. 다른 비관련 지지/오행** | — | **전역 Strength·전 오행 일괄 감점 금지** |

원칙: 영향은 **슬롯 / evidence / modifier ID**로 추적한다. “오행 X가 충당했다”만으로 동계 전 슬롯을 일괄 손상하지 않는다(§1.6.6).

#### 1.6.3 기본 원칙 (확정 · 수치 없음)

1. **충은 Natal 원국을 삭제·치환하지 않는다.** 四柱·Natal Strength·본기 사실은 유지(합 안 C와 동일 철학).  
2. **전역 Strength 일괄 감점 금지.** 충 hit → 전 오행 −N 같은 규칙 금지.  
3. **충 당사자 + 연결된 evidence/modifier만** 영향(§1.6.2).  
4. **relation hit**와 **감쇠 적용**과 **개고**는 서로 다른 층이다.  
5. **Need에 충 감쇠값을 직접 합산하지 않는다.** (Strength/Need 축 분리 · TBD-12는 간접만)  
6. 본 절에는 숫자를 넣지 않는다. 감쇠 기본값은 **§1.6.8에서 확정(evidence 1건당 −4, 엔진 미적용)**이며, **위치(년/월/일/시) 가중·source 차등은 여전히 TBD**다.

#### 1.6.4 통근 충 상태 모델 (확정)

통근 **사실 hit**(지장간 존재·깊이)와 **충으로 인한 유효성 상태**를 분리한다.  
Natal root 계산 결과(role)는 지우지 않고, evidence마다 아래 상태를 붙인다.

| 상태 | 의미 | Natal root 기록 | Strength 한정 modifier | 비고 |
|------|------|-----------------|------------------------|------|
| **unaffected** | 해당 evidence의 root 지지 슬롯이 충 당사자가 아님 | 유지 | 충 경로 감쇠 **없음** | 기본 |
| **conflicted** | root 지지가 충 당사자. 손상·동요 **인정**, 수치 미적용 또는 미확정 | 유지 | 감쇠 **후보** (수치 TBD-01c) | hit만으로 삭제 금지 |
| **attenuated** | conflicted + (향후) 감쇠 규칙이 적용된 상태 | 유지 | 한정 감쇠 **적용 후** | 계수 TBD-01c |
| **opened** | *(통근 충 enum에 넣지 않음)* | — | — | **개고 전용 상태 → §1.6.7 TBD-03a** |

계약:

- `root-absent` / `root-shallow` / … 등 **깊이 enum은 충이 덮어쓰지 않는다.**  
- 동일 천간이 여러 지지에 통근하면 **evidence별로** 상태가 다를 수 있다(§1.6.6).  
- `conflicted` → `attenuated` 전이는 **수치 규칙이 확정된 뒤에만**. 수치 전에도 `conflicted` 기록은 허용.  
- 충 해소(당사자 쌍 소멸·운에서 충 종료 등) 시: 해당 evidence는 `unaffected`(또는 재평가). Natal 재작성 없음.

#### 1.6.5 합 Transform modifier ↔ 충 계약 (확정)

기존 §1.5.4(C-방해) · §1.5.7.4와 정합. 본 절은 **시점별 동작**만 잠근다.

##### 1.6.5.1 합 성립 전 (transform 평가 단계)

| 조건 | 동작 |
|------|------|
| 합 구성 지지(또는 五合 연계 지지, §1.5.4.3)가 육충 당사자 | C-방해 **blocking pass** |
| 五合·삼합·방합 | → **`transform-ok` 불가** → `hit-no-transform` (기존 매트릭스) |
| 육합·반합 | 화기 비대상/비허용 유지. 충은 관계 동요 플래그(§1.5.4.3). 반합 hit 무효화는 **TBD-02b** |

즉: 충은 합화 **성립 전 blocking**이다. hit만으로 Natal·Strength 본선을 바꾸지 않는다.

##### 1.6.5.2 이미 활성인 Transform modifier

| 조건 | 동작 |
|------|------|
| `modifierActive: true`인 합의 **참여 슬롯**이 새로 육충 당사자가 됨 | 해당 합에 대해 C-방해 재평가 → blocking 성립 시 **modifier 제거** (`modifierActive: false` 또는 목록에서 drop) |
| 제거 후 Effective | Natal + **남은** active modifier만 (§1.5.7.4). Natal 스냅샷 복원 불필요 |
| 슬롯을 공유하지 않는 다른 합의 modifier | **유지** |

##### 1.6.5.3 충 해소 시 재평가

| 조건 | 동작 |
|------|------|
| 육충 쌍이 더 이상 성립하지 않음 | 관련 합의 transform 경로 **재평가 허용** |
| required 재충족 · blocking 없음 · unknown 없음 · §1.5.10 게이트 통과 | `transform-ok` 및 modifier **재적용 가능** |
| 이전 unresolved / 경합 탈락 | 충 해소만으로 자동 승자 지정 **금지** — 게이트 재실행 |

#### 1.6.6 슬롯 · evidence 단위 추적 (확정)

동일 지지 글자·동일 오행이 여러 통근·합에 쓰여도 **영향은 ID 단위**로만 전파한다.

| 단위 | 식별 | 충 영향 |
|------|------|---------|
| **지지 슬롯** | year/month/day/hour.branch (궁위) | 당사자 슬롯만 A 범위 |
| **통근 evidence** | stem × rootBranchSlot × (depth role) | rootBranchSlot이 당사자일 때만 B |
| **합 / Transform modifier** | combineId · 참여 슬롯 집합 | 참여 집합 ∩ 당사자 ≠ ∅ 일 때만 C |

금지:

- “未가 충이니 모든 未 통근·모든 土 합을 일괄 무효”처럼 **글자·오행 전역 팬아웃**.  
- 한 evidence의 `attenuated`를 이유로 **비관련** evidence의 rootStatus를 변경.

복수 충: 동일 슬롯이 여러 충 쌍에 걸리면 상태는 **합집합(보수적으로 conflicted 유지)**. 수치 합성은 TBD-01c.

#### 1.6.7 TBD-03a — 丑未·辰戌 개고(開庫) 규칙 계약 (**구조 확정 · 수치 미정**)

범위: **丑↔未 · 辰↔戌** 충에서만 열리는 **개고** 상태·조건 역할·효과 범위·일반 충 감쇠와의 병존.  
제외: boost/atten 수치 · TBD-01c 충 감쇠 수치 · M2 12/16 · Natal/Need/Core 본선 · 엔진 · Luck 구현 · UI.  
전제: 일반 육충 계약(§1.6.1–1.6.6, TBD-03)과 **별도 이벤트**. 개고를 충 감쇠와 **동일 식으로 섞지 않는다.**

| 필드 | 내용 |
|------|------|
| 판단 대상 | 丑未·辰戌 **clash-hit** 이후 庫(장간) **개방 성립 여부**와 Effective 반영 후보 |
| 입력값 | 육충 쌍 ID, 당사자 슬롯, 지장간 표, 월령, 투간·통근 evidence, 타 합/충/형 관계, 충 source(natal\|luck) |
| 판단 조건 | §1.6.7.2 상태 · §1.6.7.3 조건 매트릭스. **`clash-hit` ≠ 자동 `opened`.** |
| 결과에 미치는 영향 | Opening modifier 후보(§1.6.7.4). Natal·지지·장간 **삭제 금지**. |
| Strength 영향 여부 | **예(향후 Opening modifier → Effective만)**. 수치 TBD(본 절 비범위). |
| Need 영향 여부 | **직접 합산 금지.** (TBD-12는 간접만) |
| 다른 규칙과 충돌 시 우선순위 | TBD-03 충 감쇠와 **병존 가능**(§1.6.7.6). 임의 상쇄 금지. 형·파·해 개입은 조건 매트릭스 B/TBD. |

##### 1.6.7.1 개고 대상 충 (확정)

| 개고 대상 ID | 지지 쌍 | 일반 육충 ID (§1.6.1) |
|--------------|---------|----------------------|
| open-chou-wei | **丑 ↔ 未** | clash-chou-wei |
| open-chen-xu | **辰 ↔ 戌** | clash-chen-xu |

- 위 **2쌍만** 개고 평가 대상이다.  
- 子午·寅申·卯酉·巳亥는 육충(TBD-03)만 적용. **개고 경로 없음** (`opening` N/A).  
- 대상 쌍에서도 **충 hit와 개고는 별도 이벤트**다.

##### 1.6.7.2 개고 상태 모델 (확정)

일반 육충의 `conflicted` / `attenuated`(§1.6.4)와 **병기**한다. 개고 enum은 통근 충 상태를 덮어쓰지 않는다.

| 상태 | 의미 | 전이 조건(요지) |
|------|------|-----------------|
| **clash-hit** | 丑未 또는 辰戌 육충 **relation hit** | §1.6.1 쌍 성립. 개고 평가 **전제**일 뿐 |
| **opening-candidate** | 개고 대상 쌍의 clash-hit + 개고 평가 시작 | 대상 2쌍만. 타 육충은 이 상태 없음 |
| **opened** | 개고 **성립** | required 충족 · blocking 없음 · required/blocking에 unknown 없음(§1.6.7.3.1) |
| **opening-blocked** | 개고 **불성립**(평가 완료) | required fail 또는 blocking pass, 또는 보수적 unknown 기각 |

추가 기록(상태가 아님):

| 기록 | 의미 |
|------|------|
| `openingEval: pending` | 후보이나 조건 미평가·부분 평가 |
| `openingEval: unknown-conservative` | TBD/unknown으로 **자동 opened 금지** 후 보수 처리 |

**확정 금지 규칙:**

1. **`clash-hit`만으로 `opened` 금지.**  
2. **`opening-candidate`만으로 Opening modifier 적용 금지.** (`opened`만 modifier 승격)  
3. 子午 등 비대상 충에 `opened` 부여 금지.

흐름:

```
육충 hit
  ├─(비 丑未/辰戌)→ clash만 (TBD-03). 개고 N/A
  └─(丑未|辰戌)→ clash-hit
                    → opening-candidate
                         ├─(평가 실패/blocking/unknown 보수)→ opening-blocked
                         └─(§1.6.7.3.1 통과)→ opened
```

##### 1.6.7.3 성립 조건 후보 · 역할 매트릭스

역할 정의는 §1.5.4와 동일: **R** required · **S** supporting · **B** blocking · **N** N/A · **TBD** 역할 미확정.  
점수·가중치 없음. **supporting만으로 `opened` 금지.**

| 조건 ID | 내용 | 역할 | 비고 |
|---------|------|------|------|
| O-충존재 | 실제 **丑未** 또는 **辰戌** 충 hit | **R** | `clash-hit` 전제. 없으면 개고 경로 없음 |
| O-대상쌍 | 충 쌍이 개고 대상 2쌍 중 하나 | **R** | O-충존재와 함께 대상 게이트 |
| O-장간존재 | 당사자 지지의 **지장간(장간) 테이블**이 정의됨 | **R** | 개방할 재료 식별. 장간 **삭제 아님** |
| O-월령 | 월지·계절이 개고에 유리/불리 | **TBD** | 학파차. 확정 전 unknown → 자동 opened 금지에 기여 가능 |
| O-투출 | 관련 장간의 **투간(투출)** 여부 | **S** (우선 선택 힌트는 §1.6.7.5 **TBD**) | supporting만으로 opened 불가 |
| O-통근 | 장간·관련 천간의 **통근** 관계 | **TBD** | 성립 필수 vs 유리만 — 미확정 |
| O-방해 | 타 **합 / 충 / 형**(및 향후 파·해)이 개고를 방해 | **B** (세부 목록 **TBD**) | 방해 성립 시 → `opening-blocked`. 목록 미정이면 unknown 보수 |
| O-source | 충이 **원국**인지 **Luck**(대/세/월/일)인지 | **TBD** | source **기록은 필수**. Luck 충의 opened 허용 여부는 미확정. 확정 전 Luck→opened 자동 부여 **금지**(보수) |

###### 1.6.7.3.1 `opened` 판정 계약 (확정 · 수치 없음)

1. **required(R) 하나라도 fail** → `opening-blocked`.  
2. **supporting(S)만으로 `opened` 불가.**  
3. **blocking(B) pass(방해 있음)** → `opening-blocked` (종류별 예외는 매트릭스 개정으로만).  
4. **R 또는 B가 unknown** 이거나 역할이 **TBD**로 남아 평가 불가면 → **자동 `opened` 금지** (pending 또는 unknown-conservative / 보수적 `opening-blocked`).  
5. **Strength / Need / 점수**는 본 매트릭스에서 정의·변경하지 않는다. (`opened` 선언만.)  
6. O-월령·O-통근·O-방해 세부·O-source 정책이 TBD인 동안, 제품이 `opened`를 내려면 **명시적 정책 개정**이 필요하다. 초안 엔진은 보수(미개방)가 기본.

##### 1.6.7.4 `opened` 효과 범위 (확정 · 수치 없음)

| 항목 | 계약 |
|------|------|
| 원래 지지 / 장간 | **삭제·치환 금지** |
| Natal Strength · 四柱 사실 | **mutate 금지** (합 안 C와 동일) |
| 통근 depth enum | 개고가 **덮어쓰지 않음** |
| 장간 / evidence **활성도** | **변화 후보** — Opening layer에서만 |
| Effective | **Opening modifier** 후보 추가 (`opened`일 때만) |
| Display / Level | Opening이 Effective에 들어간 뒤에만 간접 영향. 수치는 본 절 비범위 |
| Need | **Opening modifier 직접 합산 금지** |

Opening modifier (형태만):

```
Natal (immutable)
  → Clash attenuation modifiers? (TBD-03 / TBD-01c; 별도)
  → Transform modifiers (합; M2)
  → Opening modifiers (opened만; 수치 TBD)
  → Internal Effective (비clamp 정책은 Strength 측 기존 계약 따름)
```

- modifier 제거만으로 Natal 복귀.  
- boost/atten **숫자 = 미정** (TBD-03a-magnitude; 본 계약과 분리).

##### 1.6.7.5 활성화 대상 장간 선택 (원칙 · 다수 TBD)

`opened`가 “무엇을 활성화하는가”는 **별도 선택 규칙**이다. 성립(`opened`)과 선택(which stems)을 혼동하지 않는다.

| 선택 안 | 요지 | 상태 |
|---------|------|------|
| 전체 장간 | 당사자 지지의 정기·중기·여기 **전부** 활성 후보 | **TBD** |
| 본기/중기/여기 차등 | role별 가중·우선 | **TBD** |
| 투출 장간 우선 | 투간된 장간만 또는 우선 | **TBD** (O-투출=S와 정합 가능) |
| 슬롯·evidence ID 단위 | §1.6.6과 같이 전역 오행 팬아웃 금지 | **확정** |

**확정:**

- 선택 결과가 나와도 Natal 장간 행을 **지우지 않는다.**  
- 근거 부족 항목은 **TBD**로 두고, TBD 동안 **임의 전체 개방 수치를 넣지 않는다.**  
- 구현 전 기본 권고(비확정): 선택이 미정이면 Opening modifier **미적용**(opened를 선언하지 않거나 modifier payload 비움)이 보수적이다.

##### 1.6.7.6 일반 충 감쇠와의 병존 (확정)

| 질문 | 계약 |
|------|------|
| 동일 슬롯에 clash attenuation + Opening modifier | **병존 가능** |
| 서로 상쇄·무효화 | **임의 가정 금지.** 상쇄 규칙이 필요하면 **별도 개정** |
| `conflicted`/`attenuated` vs `opened` | **독립 enum.** 개고가 충 감쇠 상태를 자동 clear하지 않음 |
| 수치 | 충 감쇠 = **TBD-01c** · 개고 = **TBD-03a 수치(미정)** — 서로 다른 항 |

丑未·辰戌도 먼저 TBD-03 한정 감쇠(또는 conflicted 기록) 경로를 탈 수 있고, 그와 **별도로** 개고 평가를 한다.

##### 1.6.7.7 해제 · 재평가 계약 (확정)

| 사건 | 동작 |
|------|------|
| 육충 쌍 해소 (clash-hit 소멸) | 개고 **재평가 필수**. 전제 R 상실 → `opened` 유지 금지 → Opening modifier **제거** |
| O-방해 신규 성립 등 blocking | `opened` → `opening-blocked` · modifier 제거 |
| required 재충족 · blocking 해소 · unknown 해소 | **재평가 허용** → 다시 `opened` 가능 |
| Luck 충 종료 | source=luck인 개고는 **재평가**(허용 정책이 TBD여도, hit 소멸 시 modifier 제거는 확정) |
| Natal 재작성 | **하지 않음** |

##### 1.6.7.8 Need · 수치 (확정 금지 항목)

- Need에 개고 modifier **직접 합산 금지.**  
- Climate/Need가 Effective·Opening을 볼지는 **TBD-12**.  
- 개고 boost/atten · 장간별 분배 수치 → **미정** (본 TBD-03a 구조와 분리).

##### 1.6.7.9 TBD-03a 상태

| 항목 | 상태 |
|------|------|
| 대상 = 丑未 · 辰戌만 | **확정** |
| clash-hit / opening-candidate / opened / opening-blocked | **확정** |
| clash-hit ≠ 자동 opened | **확정** |
| 조건 매트릭스 틀 + O-충존재·O-대상쌍·O-장간존재 = R | **확정** |
| O-월령·O-통근·O-방해 세부·O-source | **역할 일부 TBD** (구조는 잠금) |
| Natal 비mutate · 장간 삭제 금지 · Effective modifier만 | **확정** |
| 장간 선택 안 (전체/차등/투출우선) | **TBD** (ID 추적·삭제 금지만 확정) |
| 충 감쇠와 병존 · 비상쇄 | **확정** |
| 충 해소 시 재평가·modifier 제거 | **확정** |
| Need 직접 합산 금지 | **확정** |
| 개고 수치 | **미정** |
| 엔진 | **없음** |

**TBD-03a 규칙 계약 = 숫자 없이 확정 가능 · 본 절로 잠금.**  
(잔여: 조건 역할 세부 TBD · 장간 선택 TBD · 수치 TBD — 구조·금지 규칙과 분리.)

#### 1.6.8 TBD-01c 수치 — **A안 확정 (δ = 4) · 엔진 미적용**

**스케일 전제:** TBD-01b와 동일. Natal 본선은 **Level(5단)**, 시뮬은 Display Score 좌표를 빌려 쓴다.  
Natal **비mutate**. Opening(TBD-03a) **범위 밖**. Need **직접 반영 없음**.

시뮬: `src/lib/saju/__tests__/clashAttenuationSim.test.ts` (22 test, 전부 green)

##### 1.6.8.0 확정 사항

| 항목 | 확정 값 |
|------|---------|
| **일반 지지 충 root attenuation 기본값** | **슬롯당 δ = 4 (A안)** |
| 적용 단위 | 충 당사자 슬롯에 묶인 **root evidence 1건당 −4** |
| 전역 오행 패널티 | **금지** (비피격 오행 불변) |
| Internal Effective | **unclamped** |
| Display | **8–96 clamp만** (정책 D 계승) |
| Need | **직접 반영 없음** (축 분리) |
| 엔진 | **미구현 — 본 확정은 수치만** |

**확정 사유:**

1. **충은 순손실이다.** M2 합화 modifier는 Σ 보존(atten 합 = boost)이지만 충 감쇠는 보상 boost가 없다. 따라서 같은 숫자라도 충이 더 왜곡되며, M2 per-slot(6)과 동급인 B는 실질적으로 **더 센** 설정이다. δ=4는 M2 五合 per-slot의 **0.667×**로, 이 비대칭을 반영한 값이다.
2. **도달 가능한 모든 구성에서 Level 이동을 최대 1단으로 제한한다.** 단일 충(h≤2) 낙폭 8, 2충 최대 구성(h=4) 낙폭 16 — 둘 다 ±2 임계인 **21 미만**이다 (§1.6.8.1·§1.6.8.3). A는 세 후보 중 유일하게 이 불변식을 만족한다.
3. **향후 위치 가중 설계 여지를 남긴다.** 년/월/일/시 가중이 도입되면 실효 δ가 기본값보다 커질 수 있다. δ=4는 가중 상한 10(§1.6.8.3)까지 **2.5× 여유**를 남기고, δ=6은 1.67×로 여유가 좁다.

**B(6) · C(8)는 비교 기록으로만 유지한다. 채택은 A.**

| 후보 | δ (evidence 1건당) | M2 五合 per-slot(6) 대비 | 판정 |
|------|-------------------|------------------------|------|
| **A** | **4** | 0.667× | **확정** |
| B | 6 | 1.0× (동급) | 기각 (비교 기록) |
| C | 8 | 1.333× | 기각 (비교 기록) |

##### 1.6.8.1 Level 경계 기하 (측정 결과 · 확정 사실)

대역 vw 8–20 · w 24–40 · b 44–60 · s 64–80 · vs 84–96, 갭 4.

| 항목 | 값 |
|------|-----|
| Level ±1에 필요한 최소 낙폭 | **1** |
| Level ±2에 필요한 **최소 낙폭** | **21** (최악 출발점 = 42, 갭 중점 tie→upper) |

⇒ **단일 오행 총 낙폭이 21 미만이면 ±2 이동은 구조적으로 불가능.** 이 값이 이후 모든 판정의 기준선이다.

##### 1.6.8.2 동일 오행 **감쇠 단위** 수의 구조적 상한 (지장간 표에서 유도 · 확정 사실)

`HIDDEN_STEMS` 실표에서 계산했다. 시나리오 가정이 아니라 **데이터에서 나온 상한**이다.

> **용어 주의 (§1.6.8.9.4에서 정정):** 여기서 세는 단위는 **(오행 × 지지 슬롯)** 이지
> 엔진의 `RootHit` **레코드 수가 아니다.** `RootHit`은 같은 물리적 근을 비견/겁재로
> **2건** 담기 때문에(§1.6.8.9.4) 레코드 수로 세면 낙폭이 2배가 되어 δ=4 확정이 깨진다.

| 범위 | 동일 오행 감쇠 단위 상한 | 근거 |
|------|------------------------|------|
| 지지 1개 | **1** | 여기·중기·정기의 오행이 서로 겹치지 않음 (12지지 전부) |
| **단일 충 (2슬롯)** | **2** | 두 당사자가 같은 오행에 root를 주는 쌍만 해당 |
| **2충 동시 (4슬롯 소진)** | **4** | 서로소 충 쌍은 최대 2개 |

**단일 충 hit=2는 土 전용이며, 3쌍뿐이다.**

| 충 쌍 | 공유 오행 | 개고 대상 |
|-------|----------|----------|
| 丑–未 | **土** | 예 (TBD-03a) |
| **寅–申** | **土** | **아니오** ← 순수 TBD-01c 경로에서 hit=2가 나오는 유일한 쌍 |
| 辰–戌 | **土** | 예 (TBD-03a) |
| 子–午 · 卯–酉 · 巳–亥 | 없음 | — (오행당 최대 1 hit) |

2충 hit=4도 **土 전용**이다 (예: year 寅 · month 申 + day 丑 · hour 未).  
⇒ TBD-01c의 최악 케이스는 전 오행 공통이 아니라 **土에 편중**된다. 이 비대칭 자체가 기록 대상이다.

##### 1.6.8.3 후보 sweep 결과 (전 구간 8–96 완전 탐색)

hit 수 h에 대한 **최대 Level 이동**:

| 후보 | δ | h=1 | h=2 (**단일 충 상한**) | h=3 | h=4 (**2충 상한**) | ±2 최초 도달 h |
|------|---|-----|----------------------|-----|-------------------|---------------|
| **A** | 4 | 1 | 1 | 1 | **1** | h=6 (**구조적 도달 불가**) |
| **B** | 6 | 1 | 1 | 1 | **2** | h=4 (최대 구성에서만) |
| **C** | 8 | 1 | 1 | **2** | **2** | h=3 (**도달 가능**) |

**하드 룰 판정 — “단일 충으로 ±2 이상이면 제외”:**

단일 충 상한이 h=2로 고정되므로 총 낙폭은 A 8 · B 12 · C 16 이고 **모두 21 미만**이다.  
⇒ **A/B/C 누구도 이 룰로는 탈락하지 않는다.** 단일 충으로 ±2가 나오려면 **δ ≥ 11**이어야 한다.

> **파생 확정 후보: δ 상한 = 10.** (δ ≥ 11은 단일 충만으로 Level 2단 이동 → 하드 룰 위반)

**최대 구성 실측** (natal 土 = 42, 寅申 + 丑未, 土 4 hit):

| 후보 | Internal 土 | Level | jump | 비피격 오행 |
|------|------------|-------|------|------------|
| A | 42 → **26** | weak | **1** | 전부 불변 |
| B | 42 → **18** | very-weak | **2** | 전부 불변 |
| C | 42 → **10** | very-weak | **2** | 전부 불변 |

전역 패널티 없음(비피격 오행 불변)은 세 후보 모두에서 확인됐다.

##### 1.6.8.4 M2(TBD-01b) 대비 강도 · **비보존 비대칭**

| 기준 | 값 |
|------|-----|
| M2 五合 pool | 12 → per-slot **6** |
| M2 삼합·방합 pool | 16 → per-slot **≈5.33** |

**핵심 비대칭 (측정 확인):**

- **M2는 Σ 보존**이다. atten 합 = boost, 총합 불변.  
- **충 감쇠는 순손실**이다. 보상 boost가 없어 총합이 δ만큼 줄어든다.

⇒ **같은 숫자라도 충 감쇠가 M2 atten보다 왜곡이 크다.**  
따라서 “M2 per-slot과 동급” 자체가 중립이 아니라 **실질적으로 더 센 설정**이다.  
보수적으로는 **δ ≤ 6**이 타당하며, 이 조건을 만족하는 후보는 **A · B**뿐이다.

##### 1.6.8.5 후보 판정 → **A 확정**

| 후보 | 판정 | 사유 |
|------|------|------|
| **A (4)** | **확정** | **구조적으로 도달 가능한 모든 구성에서 Level 이동 ≤ 1** (h=4에서도 낙폭 16 < 21). 순손실 특성을 반영한 보수 설정. 위치 가중 여지 최대 |
| B (6) | **기각** | M2 per-slot 동급이나, 충은 Σ 비보존이라 동급 숫자가 실질적으로 더 세다. 최대 구성(h=4)에서 ±2 발생 |
| C (8) | **기각** | ① M2 per-slot 1.333× ② 2충 h=3에서 ±2 도달, h=3은 구조적으로 도달 가능 |

**정책 결정 (해소됨):**

> **질문이었던 것:** 4개 지지가 전부 土 root이면서 2충을 이루는 최대 구성에서, 土 Level이 **2단** 내려가는 것이 옳은가?  
> **결정:** **과하다.** 단일 modifier 층이 Level을 2단 움직여서는 안 된다. → **A (4) 채택.**

이 결정으로 TBD-01c의 **기본 감쇠 수치는 잠금**이다. 잔여 항목(§1.6.8.6)은 별도 TBD로 유지된다.

##### 1.6.8.5.1 A 확정 하에서의 불변식 (엔진 구현 시 회귀 기준)

| 불변식 | 값 |
|--------|-----|
| **감쇠 단위** | **(오행 × natal 지지 슬롯) 1건** — `RootHit` 레코드 수 아님(§1.6.8.9.4) |
| 감쇠 단위 1건당 | **−4** |
| 단일 충 최대 낙폭 (동일 오행) | **8** (h≤2) |
| 2충 최대 낙폭 (동일 오행, 구조 상한) | **16** (h≤4) |
| **모든 도달 가능 구성의 최대 Level 이동** | **1** |
| 비피격 오행 | **불변** |
| Σ 보존 여부 | **비보존** (순손실 −4×hit) |

±2가 발생하려면 낙폭 21이 필요하고, 이는 h≥6(δ=4 기준)이라 **현재 구조에서 도달 불가**하다.  
⇒ 위치 가중을 도입할 때 이 불변식이 깨지지 않는지 **반드시 재검증**한다(§1.6.8.6).

##### 1.6.8.6 잔여 TBD (**본 확정에 포함되지 않음 — 별도 유지**)

기본값 δ=4는 잠겼으나, 아래는 **여전히 미정**이며 각각 별도 개정으로만 확정한다.

| 항목 | ID | 상태 | 비고 |
|------|-----|------|------|
| 년/월/일/시 **위치 가중** | **TBD-01c-position** | **시뮬 완료 · 미도입 유지** | **§1.6.8.8** 참조. 전 슬롯 **균등(δ=4)** 유지 권고 — 이중 반영 및 근거 부족 |
| 충 source (natal vs luck) 차등 | **TBD-01c-source** | **설계 조사 완료 · 전면 TBD** | **§1.6.8.9** 참조. 구조 3건(modifier only·source 기록·복귀 계약) 확정 가능, **δ 동일 적용·중복 붕괴·source 가중은 TBD**. Luck 배선 미착수 |
| 개고 병존 시 총 감쇠량 상한 | TBD-01c × TBD-03a | **미정** | 丑未·辰戌은 감쇠 + Opening 병존(§1.6.7.6). 합산 상한 미설계. **임의 상쇄 금지** 유지 |
| 실제 명식 분포 검증 | **TBD-01c** | **미착수** | h=3·h=4 구성의 실제 출현 빈도 미측정. 최악 케이스만 확인함 |
| **엔진 구현** | **TBD-01c-engine** | **미착수** | 본 절은 수치 확정만. `buildElementStrengthProfiles` 등 본선 **미변경** |
| 개고 **규칙 계약** | **TBD-03a** | **§1.6.7 확정** | |
| 개고 boost/atten · 장간 분배 수치 | **TBD-03a-magnitude** | 미정 | |
| 충·개고 → Need 직접 기입 | — | **금지** (TBD-12는 간접만) | |

##### 1.6.8.7 이중 패널티 금지 재확인 (측정 확인)

active transform modifier의 **참여 슬롯이 충하면 modifier 제거**(§1.6.5.2)이며, 이는 감쇠와 **다른 층**이다.

확정값 **δ=4** 기준 (natal 52, 五合 甲己 활성, day 슬롯 충):

| 경로 | 木 결과 | 土 결과 |
|------|--------|--------|
| M2 활성만 | 46 (−6 M2 atten) | 58 (−6 +12) |
| **정상: 해제 → 감쇠** | **48** (−4 **충 감쇠만**) | 52 (Natal 복귀) |
| **금지: modifier 유지 + 감쇠** | **42** (−6 M2 −4 충 = **−10**) | 58 |

⇒ 정상 경로 **−4**, 금지 경로 **−10**. **항상 해제를 먼저** 하고, 참여 슬롯 충 상태에서 `modifierActive: true`를 남기지 않는다.  
(Level 단위로는 42·46·48·52·58이 모두 `balanced`라 이 차이가 보이지 않는다 — **Internal 기준으로만 검증 가능**하다.)

##### 1.6.8.8 TBD-01c-position — 위치 가중 시뮬레이션 (**미도입 유지 · TBD**)

질문: **같은 root evidence가 충을 받아도 년/월/일/시 위치에 따라 δ를 달리해야 하는가?**

전제: δ=4 불변 · Natal 비mutate · 전역 패널티 금지 · Internal unclamped/Display만 clamp ·
Need 미반영 · 개고(丑未·辰戌) 제외 · natal/luck source 차등 제외 · **엔진 미연결**.

###### 1.6.8.8.1 현행 Strength의 슬롯별 처리 (코드 조사 결과)

`buildElementStrengthProfiles`가 Level 판정에 쓰는 입력은 **6개**뿐이며, 슬롯 유래는 다음과 같다.

| Level 입력 | 출처 | 위치 의존 |
|-----------|------|----------|
| `seasonPhase` | **월지** (`seasonPhaseOf(element, pillars.month.branch)`) | **월지 전용** |
| `hasMonthOutlet` | **월지** 지장간의 투출 여부 | **월지 전용** |
| `presence` | 전 슬롯 무차별 (`visibleSlots` / `rootedSlots` 목록) | 없음 |
| `rootStatus` | **role(정기>중기>여기)만** (`resolveElementRootStatus`) | **없음** |
| `hasBranchMain` | cluster anchor의 layer | 없음 |
| `exactStemVisible` | branch relation evidence | 없음 |

**핵심 조사 결과 3가지:**

1. **월지는 이미 전용 채널 2개**(`seasonPhase`·`hasMonthOutlet`)를 갖는다. 그중 `seasonPhase`는 §5의 모든 Level 규칙(V/S/B/W)의 **1차 게이트**다.
2. **년지·일지·시지의 전용 채널은 0개**다. 세 슬롯은 `presence`/`rootStatus`에 **무차별로** 기여한다.
3. **root evidence의 위계는 깊이(role)로만 표현되고 위치(slot)로는 표현되지 않는다.** `RootHit.slot`은 `dedupeRootHits`의 **키로만** 쓰이고 가중치로는 쓰이지 않는다. 이는 v1의 명시적 설계이며 Guardrail 1(“개수 count 금지”)과 같은 계열이다.
   - 예외적 위치 처리는 `hourUnknown` 하나뿐인데, 이는 **가중이 아니라 슬롯 제외**(partial evidence)다.

###### 1.6.8.8.2 후보 (3개)

| 후보 | 정의 | 근거 |
|------|------|------|
| **P0** | **전 슬롯 동일 (δ=4)** — 현행 | v1 root 모델에 위치 축이 없음. 깊이(role)로만 위계 표현 |
| **P1** | **월지 6 · 나머지 4** | 월지=제강(提綱), 통근 1순위. **6은 M2 五合 per-slot 상한 재사용**(신규 창작 아님) |
| **P2** | **월령 왕/상 오행의 월지 root만 8 · 그 외 4** | “월지 근이 강하다”의 실질은 “**월령을 받은** 근이 강하다”. `seasonPhase`를 감쇠에 재사용하는 안 — **이중 반영 검증용** |

숫자는 기존 확정 앵커(δ=4 · M2 per-slot 6 · 월지 상한 8)에서만 가져왔다. 보간값을 새로 만들지 않았다.

###### 1.6.8.8.3 8개 사례 비교 결과

natal 木=42(±2 최악 출발점) 기준. **Δ = 木 낙폭 · jump = Level 이동.**

| 사례 | P0 Δ/jump | P1 Δ/jump | P2 Δ/jump |
|------|-----------|-----------|-----------|
| 1 · 년지 단독충 | 4 / **1** | 4 / **1** | 4 / **1** |
| 2 · **월지** 단독충 | 4 / **1** | 6 / **1** | 4 / **1** |
| 3 · 일지 단독충 | 4 / **1** | 4 / **1** | 4 / **1** |
| 4 · 시지 단독충 | 4 / **1** | 4 / **1** | 4 / **1** |
| 5 · 월지+타지지 동시충 | 8 / **1** | 10 / **1** | 8 / **1** |
| 6 · 다중 root 중 일부만 충 | 4 / **0** | 4 / **0** | 4 / **0** |
| 7 · 약한 오행 유일 root 월지충 | 4 / **1** | 6 / **1** | 4 / **1** |
| 8 · 강한 오행 다중 root 중 월지만 충 | 4 / **1** | 6 / **1** | 8 / **1** |

**결정적 관찰: 8개 사례 전부에서 세 후보의 Level 이동이 동일하다.**
Internal 점수는 갈리지만(예: 사례 8에서 80 / 78 / 76) **Level은 한 번도 갈리지 않는다.**

- 단일 충 ±2 배제 룰: **세 후보 모두 통과**(배제 근거 없음).
- 비피격 오행: 세 후보 모두 **불변**(전역 패널티 없음).
- Natal: 세 후보 모두 **비mutate**.

###### 1.6.8.8.4 위치 가중은 Level 해상도에서 거의 관측되지 않는다

전 구간(8–96) sweep으로 P0와 Level이 갈리는 점수를 셌다.

| 비교쌍 | 가중 차이 | 발산 점수 개수 | 구간 대비 |
|--------|----------|---------------|----------|
| P1 vs P0 | 2 | **8** | 9.0% |
| P2 vs P0 | 4 | **16** | 18.0% |
| P2 vs P1 | 2 | **8** | 9.0% |

발산은 흩어지지 않고 **대역 경계 4곳에만** 몰린다 (예: 26·27 / 46·47 / 66·67 — 각 대역 lo 직상단).

> **발산 점수 개수 = (가중 차이) × (대역 경계 수 4)** — 측정으로 확인된 관계.

즉 위치 가중의 효과는 **대역 경계에 우연히 걸린 명식에서만** 나타난다. 대역 폭이 12–16인데 가중 차이가 2–4이므로, 가중은 Strength가 실제로 소비되는 해상도(**Level 5단**) 아래에 머문다. **가중을 넣어도 대부분의 명식에서 결과가 같다.**

###### 1.6.8.8.5 월령·통근 이중 반영 분석 (**핵심**)

**P2는 이중 반영이 측정으로 확인된다.** 동일 명식(木 84, 월지 root, 월지 충)에서 `seasonPhase`만 바꾸면:

| seasonPhase | P2 낙폭 | P0/P1 낙폭 |
|-------------|--------|-----------|
| **왕** | **8** | 4 / 6 |
| 수 | 4 | 4 / 6 |

⇒ **월령 왕이라는 하나의 사실이 base Level을 올리는 동시에 감쇠를 2배로 키운다.** 같은 입력이 같은 층에서 두 번 쓰이므로 **축 분리 위반**이다. P0·P1은 `seasonPhase`를 읽지 않아 이 문제가 없다.

**P1도 약한 형태의 중복이다.** 월지의 중요성은 이미 `seasonPhase`(모든 Level 규칙의 1차 게이트) + `hasMonthOutlet`으로 **두 번** 반영돼 있다. 여기에 감쇠 가중을 더하면 **세 번째** 반영이 된다.

**“월령은 충으로 감쇠되지 않으니 월지 가중으로 보정해야 한다”는 반론에 대해:**
그 주장이 옳더라도 처방이 틀렸다. 그것은 **“충이 월령 자체를 손상시키는가”**라는 **별개의 구조 질문**이며, 답이 ‘그렇다’라면 `seasonPhase`를 다루는 규칙을 새로 만들어야 한다. root attenuation의 δ를 그 대리물로 쓰면 **엉뚱한 양에 패널티가 걸리고**(오행의 root evidence), 월령 관계가 멀쩡한 경우에도 발동한다. → **TBD-03 별도 항목**으로 남긴다.

###### 1.6.8.8.6 권고 → **P0 유지 (전 슬롯 동일 δ=4) · 위치 가중 미도입**

| 판정 | 근거 |
|------|------|
| **P0 채택 (현행 유지)** | ① 기반 root 모델에 위치 축이 **없다** — 위치 가중을 감쇠 층에만 넣으면 **같은 evidence를 셀 때는 위치 무시, 깎을 때는 위치 반영**이라는 비대칭이 생긴다 ② 8개 사례 전부에서 Level 결과가 P1·P2와 **동일** — 도입 이득이 관측되지 않는다 ③ 월지 중요성은 이미 채널 2개로 반영돼 있다 |
| **P1 보류** | ±2 룰은 통과하나(월지 상한 8 이내) 이득이 관측되지 않고, 월지 3중 반영이 된다 |
| **P2 기각** | `seasonPhase` 재사용 = **이중 반영 측정 확인**. 축 분리 위반 |

**확정 여부: 확정하지 않는다.** 본 시뮬은 “**현재 근거로는 위치 가중을 도입할 이유가 없다**”를 보였을 뿐, “위치 가중이 명리적으로 틀렸다”를 보인 것이 아니다. 따라서 **TBD-01c-position은 TBD로 유지**하되, 기본 동작은 **P0(전 슬롯 동일)**로 잠근다.

**재검토 선행조건 (이것들이 충족되기 전에는 위치 가중을 넣지 않는다):**

1. **기반 root 모델이 먼저 위치 축을 가져야 한다.** v1이 role만으로 위계를 정하는 한, 감쇠 층에만 위치를 넣는 것은 모델 불일치다. (→ Strength v2 범위)
2. **Level보다 높은 해상도가 필요해져야 한다.** 현재는 가중 차이 2–4가 대역 폭 12–16 아래라 대부분 관측되지 않는다.
3. **실제 명식 분포 근거.** 위치별 충 빈도·영향이 실측돼야 한다 (미측정).

시뮬: `src/lib/saju/__tests__/clashAttenuationSim.test.ts` (TBD-01c-position describe 3개, 30 test 전부 green)

##### 1.6.8.9 TBD-01c-source — Natal 충 vs Luck 충 (**설계 조사 · 전면 TBD**)

질문: 원국 내부 충과 **대운·세운·월운·일운에서 들어와 원국 지지를 충하는 경우**에
generic root clash attenuation **δ=4**를 동일하게 적용해도 되는가?

고정 전제: δ=4 불변 · Natal immutable · Strength ≠ Need · Luck이 Natal Strength를 덮어쓰지 않음 ·
관련 branch/root evidence만 감쇠(전역 패널티 금지) · 개고 제외 · 위치 가중 미사용(P0) ·
transform modifier 제거와 root attenuation 분리 · **엔진 미구현**.

###### 1.6.8.9.1 현행 코드 조사 결과 (Luck 레이어)

| 조사 항목 | 실제 상태 |
|-----------|----------|
| 구현된 Luck 레이어 | **세운(annual) 1개뿐**. `AnnualLuckKind = "annual-year"` 단일 리터럴 |
| 대운 · 월운 · 일운 | **엔진 없음** (§1.10과 일치: 월운·일운 “엔진 미구현”) |
| Luck의 Natal 접근 범위 | `BuildAnnualLuckEvidenceInput = { target, natalCoreElement, natalSupplementElement }` — **Element 2개뿐** |
| Luck이 `FourPillars`를 보는가 | **아니오.** 지지 슬롯·지장간·root evidence에 **접근 경로 없음** |
| Luck 지지의 표현 | `branchMainElement = branchElement(branch)` — **본기 오행 1개로 축약**, 지장간 폐기 |
| Luck 레이어의 충 처리 | **전혀 없음.** `luck/` 전체에 육충 코드 0건 (grep의 `conflict`는 Supplement goal 충돌로 무관) |
| Luck ↔ Strength 결합 | **없음.** `luck/`에서 `ElementStrength*` import 0건 — 축 분리가 코드로 이미 지켜짐 |
| 시간 창 | `AnnualTarget.windowStart` / `windowEnd` (`lichun-kst`, 시작 포함·끝 배타) **이미 존재** |

**핵심 함의 2가지**

1. **Luck↔Natal 육충은 현재 아키텍처에서 탐지 자체가 불가능하다.** TBD-01c의 감쇠 단위는 “지지 슬롯에 묶인 root evidence”인데, Luck 레이어는 natal 지지 슬롯도 지장간도 보지 못한다. 즉 본 항목은 **수치 문제 이전에 배선(plumbing) 문제**다.
2. **반면 되돌림(Q5)에 필요한 구조는 이미 있다.** `windowStart/windowEnd`가 modifier의 유효 구간을 그대로 표현한다.

###### 1.6.8.9.2 핵심 질문 5개에 대한 답

| # | 질문 | 답 | 상태 |
|---|------|-----|------|
| 1 | Natal↔Natal과 Luck↔Natal에 **같은 δ=4**가 논리적으로 가능한가 | **가능하다** — L1-S collapse가 상한을 natal 슬롯 수로 고정 (§1.6.8.9.5에서 해소) | **확정(수치층)** |
| 2 | Luck 충은 Natal evidence 수정이 아니라 **일시적 Effective modifier**여야 하는가 | **그렇다** | **확정 가능(구조)** |
| 3 | 대/세/월/일운 **source 가중** 근거가 존재하는가 | **없다** | **TBD (수치 금지)** |
| 4 | 동일 natal 지지가 **여러 Luck layer와 동시 충**일 때 중복 감쇠 | **L1-S collapse** (§1.6.8.9.4에서 해소) | **확정(구조·수치)** |
| 5 | Luck 소멸 시 **Natal 완전 복귀** 보장 | 파생 전용 + 시간 창으로 보장 | **확정 가능(구조)** |

**Q1 상세 — δ=4의 안전성 근거는 Luck에 이전되지 않는다.**

δ=4는 §1.6.8.5.1에서 **natal 전용 구조 상한** 위에서 증명됐다: 단일 충 h≤2 · 2충 h≤4 → 최대 낙폭 16 < 21(±2 임계). 그런데 Luck을 허용하면 이 상한이 깨진다.

- Luck 지지 **하나**가 natal의 **여러** 슬롯을 동시에 충할 수 있다 (예: 세운 子 ↔ natal 午 in month·day).
- Luck 레이어가 4개이므로 같은 오행에 대한 hit가 **4 layer × natal 슬롯 수**까지 늘어난다.

**측정 결과** (natal 火=42, 午 root가 month·day, 대/세/월/일운 전부 子):

| 정책 | 계수된 hit | 낙폭 | Internal | Level 이동 |
|------|-----------|------|----------|-----------|
| **L0** (per-hit 누적) | **8** | **32** | 10 | **2 — 불변식 파괴** |
| **L1** (natal 슬롯당 1회) | **2** | **8** | 34 | **1 — 유지** |

⇒ **δ=4를 그대로 쓰되 중복 붕괴 규칙 없이 Luck을 허용하면 ±1 불변식이 깨진다.** 따라서 Q1의 답은 “δ를 바꿔야 한다”가 아니라 **“Q4의 붕괴 규칙이 먼저 정해져야 한다”**이다.

> **[해소됨]** Q4는 §1.6.8.9.4에서 **L1-S collapse**로 확정됐고, 그 위에서 Q1은 §1.6.8.9.5에서 **δ=4 동일 적용 가능**으로 해소됐다. 위 L0 수치(낙폭 32)는 **붕괴 규칙이 없을 때의 반례 기록**으로만 유효하다.

**Q2 상세 — 이미 잠긴 계약들에서 연역된다 (새 근거 불필요).**

- §1.6.3-1 충은 Natal을 삭제·치환하지 않는다
- §2.1 축 우선순위: Luck(5)는 Strength(2)를 덮어쓰지 못한다
- §1.10 “원국 Strength 재계산으로 대체하지 않음”
- §1.5.7.4 modifier 제거만으로 Natal 복귀
- 코드: `luck/annual/types.ts` 주석 “natal FourPillars are never mutated”

⇒ Luck 충은 **반드시** Effective modifier로만 표현한다. **Natal evidence(`RootHit`·`rootStatus`·깊이 enum)에 쓰기 금지.**

**Q3 상세 — source 가중 근거는 현재 없다.**

| 근거 후보 | 실제 |
|-----------|------|
| 엔진 | **없음.** 4개 중 3개(대·월·일운) 미구현, 세운도 충 경로 없음 |
| 문서 | §1.10에 **순서만** 존재: “대운 ⊃ 세운 ⊃ 월운 ⊃ 일운 … **가중 TBD**” |
| 명리 | 지속 기간의 위계이지 **감쇠 강도의 위계가 아니다** |

§1.10의 `⊃`는 **포함·지속 관계**다. 이를 감쇠 크기로 번역하면 TBD-01c-position에서 기각한 것과 **같은 종류의 범주 오류**(중요도 축을 다른 축의 수치로 번역)가 된다. 일운 충은 **짧을 뿐 그 순간에 약하다는 근거가 없다.**

⇒ **수치를 만들지 않는다.** source는 **기록만 필수**(§1.6.7.3의 O-source 선례와 동일), 가중은 TBD.

**Q4 상세 — 중복 감쇠 구조 후보.**

| 후보 | 정의 | 판정 |
|------|------|------|
| **L0** | source 무차등 · **per-hit 누적** (현행 규칙 단순 확장) | **기각 권고** — ±1 불변식 파괴(측정) |
| **L1** | source 무차등 · **natal 슬롯당 1회 붕괴** | **잠정 권고** — 아래 근거 |
| L2 | source별 가중 차등 | **평가 불가** — Q3에서 근거 없음. 수치 미생성 |

**L1 권고 근거:**

1. **§1.6.6 선례와 정합.** 이미 “복수 충: 동일 슬롯이 여러 충 쌍에 걸리면 상태는 **합집합**(보수적으로 conflicted 유지)”이 확정돼 있다. L1은 그 상태 규칙을 수치 층에 그대로 옮긴 것이다.
2. **δ=4의 증명 조건을 정확히 복원한다.** 측정: source 5종 × natal 4슬롯 = 20 hit를 L1로 붕괴하면 **4 hit → 낙폭 16**으로, §1.6.8.5.1의 natal 전용 2충 상한과 **정확히 동일**하다. 즉 Luck을 허용해도 δ=4의 ±1 불변식이 그대로 성립한다.
3. **의미론적으로도 자연스럽다.** 감쇠 대상은 **natal의 root evidence**이지 충 이벤트가 아니다. 같은 근이 여러 방향에서 흔들려도 **뽑히는 근은 하나**다.

**단, 확정하지 않는다.** L1은 “한 번 충된 근은 추가로 충해도 더 약해지지 않는다”를 함의하는데, 이것이 명리적으로 옳은지는 **미검증**이다. 반대 견해(중첩 충이 더 심하다)를 배제할 근거가 없다.

**Q5 상세 — 복귀 보장 계약 (구조).**

```
Effective = Natal(immutable) + Σ active modifiers
  └ clash-atten modifier {
       source: natal | daeun | seun | wolun | ilun,
       natalSlot, evidenceId, delta: 4,
       window?: [start, end)      ← luck source일 때 필수
    }
```

보장 조건 3가지:

1. **파생 전용.** modifier는 평가 시점마다 `(natal, 활성 luck 집합)`에서 **다시 계산**한다. 저장하지 않는다.
2. **Natal evidence로의 쓰기 경로 부재.** `RootHit` / `rootStatus` / 깊이 enum에 감쇠를 기록하지 않는다 (§1.6.4 계약 재확인).
3. **시간 창 소유.** luck source modifier는 `window`를 갖고, 창 밖에서는 **집합에서 빠진다**. `AnnualTarget.windowStart/windowEnd`가 이미 이 형태다.

⇒ 창이 끝나면 modifier가 목록에서 사라지고 `Effective = Natal`이 된다. **스냅샷 복원·Natal 재작성 불필요** (§1.5.7.4·§1.6.7.7과 동일 방식). 측정으로 확인함.

###### 1.6.8.9.3 TBD-01c-source 상태

| 항목 | 상태 |
|------|------|
| Luck 충 = Effective modifier only · Natal 비mutate | **확정 가능(구조)** — Q2 |
| Luck source **기록 필수** | **확정 가능(구조)** — O-source 선례 |
| 복귀 계약 (파생 전용 + 시간 창 + 쓰기 경로 부재) | **확정 가능(구조)** — Q5 |
| **중복 감쇠 붕괴 규칙** | **확정 가능 — L1 numeric collapse (구조는 L1-S)** · §1.6.8.9.4 |
| 감쇠 collapse 단위 | **확정 — (오행 × natal 지지 슬롯)**. `RootHit` 레코드 수 금지 · §1.6.8.9.4 |
| **δ=4를 Luck 충에 동일 적용** | **확정 가능 — 동일 δ=4 (수치 계층 한정)** · §1.6.8.9.5 |
| severity 수치화 | **TBD** — L1-S는 source 집합만 보존, 등급·점수 금지 |
| 대/세/월/일 **source 가중** | **TBD** — 근거 없음, **수치 생성 금지** |
| Luck 충 탐지 배선 | **구현 완료 (W3) · 세운만 연결** — §1.6.8.10.9. 대운·월운·일운 미구현 |
| 엔진 구현 | **없음** |

**선행 과제 (순서 고정):**

1. ~~**Q4 붕괴 규칙 확정**~~ → **완료. L1 numeric collapse / 구조 L1-S** (§1.6.8.9.4)
2. ~~**δ 동일 적용 여부**~~ → **완료. δ=4 동일 (수치 계층 한정)** (§1.6.8.9.5)
3. ~~**배선 설계**~~ → **완료. W3 (`luck/clash/`, 최소 snapshot, 3단 분리)** (§1.6.8.10). **구현은 미착수.**
4. source 가중·severity 수치화는 **별도 근거가 생기기 전까지 착수하지 않는다.**

시뮬: `src/lib/saju/__tests__/clashAttenuationSim.test.ts` — `TBD-01c-source` describe (5 test)

###### 1.6.8.9.4 Q4 검증 — 중복 감쇠 collapse (**L1 numeric collapse 잠금 가능**)

질문: 동일 natal root가 여러 Luck 충을 동시에 받을 때 δ를 **몇 번** 적용하는가?

**Q4-1 · 감쇠의 단위는 “충 이벤트”인가 “root evidence의 상태”인가 → 상태다 (기확정)**

문서에 이미 답이 잠겨 있다.

| 근거 | 내용 |
|------|------|
| §1.6.4 | 통근 충 상태는 `unaffected` / `conflicted` / `attenuated` — **evidence에 붙는 상태**이지 카운터가 아니다. `attenuated` = “conflicted + 감쇠 적용된 **상태**” |
| §1.6.6 | “복수 충: 동일 슬롯이 여러 충 쌍에 걸리면 상태는 **합집합**(보수적으로 conflicted 유지). **수치 합성은 TBD-01c**” |

⇒ **상태 모델은 이미 멱등(합집합)으로 확정**돼 있고, **미정이던 것은 수치 합성뿐**이었다.
따라서 **L0(이벤트마다 δ 누적)은 단순히 실측상 나쁜 것이 아니라 §1.6.4·§1.6.6과 구조적으로 모순**이다.
`attenuated`는 단일 상태라 “N회 감쇠됨”을 표현할 자리가 없고, §1.6.6은 합집합을 명시해 그 자리를 막아 뒀다.
**L1은 새 발명이 아니라 이미 확정된 합집합 규칙의 수치 쪽 완성**이다.

**Q4-2 · 동일 natal 지지가 여러 Luck 충을 받는 경우의 구조적 열거**

**육충은 12지지 위의 완전 매칭(perfect matching)이다** — 6쌍이 12지지를 정확히 분할하므로
**모든 지지의 충 상대는 유일**하다(측정 확인).

| 경우 | 성립 여부 | 비고 |
|------|----------|------|
| 한 natal 지지가 **여러 layer**에서 충 | **성립** | 대/세/월/일 최대 4 + natal 내부 최대 3 = 최대 **7 relation** |
| 한 natal 지지가 **서로 다른 충지**에서 충 | **불성립** | 완전 매칭이므로 충 상대가 유일 |
| 한 Luck 지지가 **여러 natal 슬롯**을 동시 충 | **성립** | 같은 글자가 여러 natal 슬롯에 있을 때 |

⇒ **결정적 함의:** 같은 natal 지지에 걸리는 복수 충은 **서로 다른 종류의 손상이 아니라 동일 relation의 반복**이다
(source·시점만 다름). 반복은 **시간축(window)** 의 성질이지 **크기축(δ)** 의 성질이 아니며,
모델에는 이미 시간축이 있다(`windowStart`/`windowEnd`). ⇒ 반복을 δ 팽창으로 표현할 이유가 없다.

**Q4-6 · collapse 단위: `RootHit` 레코드 vs (오행 × 지지 슬롯) → 후자 (중요 정정)**

엔진 실측에서 문제가 드러났다.

`collectRootHitsForElement`는 해당 오행의 **모든 천간**(예: 木 → 甲·乙)에 대해 `analyzeStemRoots`를 돌리고,
`dedupeRootHits`의 키에 **`polarity`가 포함**된다. 그 결과 **같은 물리적 근이 2건**으로 남는다.

```
寅 한 지지, 오행 木 →  {寅, 甲, 정기, 비견}  ·  {寅, 甲, 정기, 겁재}
지장간 사실 = 1개          RootHit 레코드 = 2건
```

(`resolveElementRootStatus`는 `.some(role)`만 보므로 rootStatus에는 무해하다. **감쇠 배수로 쓰면 유해하다.**)

| collapse 단위 | natal 2충(4슬롯) 낙폭 | ±2 임계 21 | Level 이동 |
|--------------|---------------------|-----------|-----------|
| **(오행 × 지지 슬롯)** | **16** | 미만 | **1 — 확정 유지** |
| `RootHit` 레코드 | **32** | 초과 | **2 — δ=4 확정 붕괴** |

⇒ **감쇠 단위는 반드시 (오행 × natal 지지 슬롯)이다.** `RootHit` 레코드 수로 세면
**Luck과 무관하게 natal 단독에서도** §1.6.8.5.1 불변식이 깨진다.
§1.6.8.2·§1.6.8.5.1의 “root hit / evidence 1건” 표현을 이 뜻으로 **정정**했다.

**Q4-3 · Q4-4 · relation multiplicity ≠ attenuation multiplicity**

두 개념을 분리하면 “첫 충 이후 추가 충이 무의미해진다”는 우려가 해소된다.

| 개념 | 정의 | 정책 |
|------|------|------|
| **relation multiplicity** | 실제 존재하는 충 관계의 수 | **전부 기록** (source·window·쌍 ID 포함) |
| **attenuation multiplicity** | 같은 근에 δ를 적용하는 횟수 | **(오행 × 지지 슬롯)당 1회** |

**추가 충이 여전히 갖는 효과 (수치 외):**

1. **Transform modifier 해제** — 서로 다른 충이 **각각 다른** 합의 참여 슬롯을 때릴 수 있다(§1.6.5.2). 측정 확인.
2. **개고 평가** — 丑未·辰戌은 별도 경로(§1.6.7). 감쇠 붕괴와 무관.
3. **상태 지속** — 일부 Luck 창이 끝나도 **남은 충이 있으면 `conflicted` 유지**. 측정 확인.
4. **source 기록** — O-source 계열 정책의 입력으로 보존.
5. **활성화(발동) 표현 자리** — 원국 잠재 충이 운에서 재차 충을 만나는 고전적 해석은 **상태/시점**으로 표현 가능하며, δ 누적을 요구하지 않는다.

⇒ L1은 “추가 충 무시”가 아니라 **“수치만 멱등, 관계는 전량 보존”**이다.

**Q4-5 · 추가 구조 후보 1개 (숫자 없음) → L1-S**

| 후보 | 정의 | 판정 |
|------|------|------|
| L0 | 이벤트마다 δ 누적 | **기각** — §1.6.4·§1.6.6과 구조 모순 + ±1 파괴 |
| L1 | (오행×슬롯)당 δ 1회 | 수치 규칙으로 채택 |
| L2 | source별 차등 | **평가 보류** — 근거 없음(§1.6.8.9.2 Q3) |
| **L1-S** | **L1의 수치 규칙 + `clashRelations[]` 전량 기록 + severity를 “기여 source의 집합”으로만 보존(점수·등급 없음)** | **구조 형태로 채택** |

L1-S는 L1의 상위집합이며 **비용 0**이다. 숫자를 만들지 않으면서,
훗날 명리 근거가 생기면 severity를 수치화할 **자리만** 남긴다.
**단계·점수·가중치는 만들지 않는다.**

**Q4-7 · 결정론적 복원 (측정 확인)**

Effective는 **활성 relation 집합만의 함수**다.

- **경로 무관**: 대운만 활성 = 세운만 활성 → 동일 Effective
- **멱등**: 같은 슬롯에 4개 layer가 걸려도 1개일 때와 동일 Effective
- **부분 소멸**: 월운·일운 종료 후에도 대운·세운이 남으면 감쇠 1회 유지
- **전량 소멸**: `Effective = Natal` 복귀, Natal은 한 번도 변하지 않음
- **재평가 멱등**: 같은 집합을 두 번 평가해도 동일 결과

⇒ 누적값을 “되돌려 빼는” 연산이 없으므로 **드리프트가 원천적으로 불가능**하다.
(L0는 정확히 이 지점에서 취약하다 — 어떤 layer가 얼마를 더했는지 추적해 빼야 한다.)

**결론 → (A) L1 numeric collapse를 v1 정책으로 잠글 수 있다.**

근거는 “구조적으로 편하다”가 아니라 **이미 확정된 계약에서 강제된다**는 점이다:
§1.6.4의 상태 모델(카운터 아님) + §1.6.6의 합집합 규칙이 L0를 배제하고,
육충 완전 매칭이 “복수 충 = 동일 relation의 반복”임을 보장한다.

| 잠금 항목 | 내용 |
|-----------|------|
| **attenuation multiplicity** | **(오행 × natal 지지 슬롯)당 1회** — 활성 충이 몇 개든, source가 무엇이든 |
| **collapse 단위** | **(오행 × natal 지지 슬롯)**. `RootHit` 레코드 수 **금지** |
| **relation 기록** | **전량 보존** (L1-S) — source·window·쌍 ID |
| **평가 방식** | 활성 집합에서 **매번 재계산**(파생 전용), 누적·차감 금지 |

**여전히 TBD (본 잠금에 포함되지 않음):**

- **Luck 충에 δ=4를 쓸지 여부** — 붕괴 규칙과 **독립된 질문**이며 §1.6.8.9.2 Q1대로 미정
- **severity의 수치화** — L1-S는 집합만 보존. 등급·점수는 근거 생길 때까지 금지
- **source 가중(L2)** — 근거 없음, 수치 생성 금지
- **Luck 충 탐지 배선** — **설계 완료 (W3, §1.6.8.10) · 구현 미착수**

시뮬: `clashAttenuationSim.test.ts` — `TBD-01c-source · Q4-*` describe 4개(9 test)

###### 1.6.8.9.5 Q5 검증 — Luck 충 δ=4 동일 적용 (**잠금 가능 · 수치 계층 한정**)

전제: §1.6.8.9.4의 **L1-S collapse 기잠금**. 신규 상수 금지 — δ=4 하나만 사용.

**Q5-1 · Q5-3 · collapse가 hit 상한을 구조적으로 고정한다 (핵심)**

collapse 키는 **natal 지지 슬롯**이다. **Luck 지지는 ‘충 상대’일 뿐 natal 슬롯이 아니므로 키를 늘리지 못한다.**
따라서 한 오행의 감쇠 단위 상한은 **natal 슬롯 수 = 4**로 고정되며, **Luck layer를 몇 개 켜든 변하지 않는다.**

| 항목 | 값 |
|------|-----|
| 감쇠 단위 상한 (오행 1개) | **4** = \|{year, month, day, hour}\| |
| 최대 낙폭 | **4 × 4 = 16** |
| ±2 임계(§1.6.8.1) | **21** |
| 판정 | **16 < 21 → Level 이동 ≤ 1 유지** |

**exhaustive 검증:** (source 5종 × natal 슬롯 4개) = 20개 relation의 **모든 부분집합 2²⁰ = 1,048,576개**를 전수 계산.

| 지표 | 결과 |
|------|------|
| 최대 감쇠 단위 | **4** (초과 조합 0개) |
| 최대 낙폭 | **16** |
| ±2 임계 도달 조합 | **0개** |
| 낙폭 분포 | 0:1 · 4:124 · 8:5,766 · 12:119,164 · 16:923,521 |

낙폭이 취할 수 있는 값은 **{0, 4, 8, 12, 16} 5개뿐**이며, 전 구간(8–96) 교차 검증에서 이 값들의 최대 Level 이동은 **1**이다.

⇒ **Q5-1 답: 유지된다.** 그것도 “시뮬에서 안 깨졌다”가 아니라 **collapse 규칙에 의해 구조적으로 불가능**하다.
Luck 허용은 L1-S 하에서 **수치적으로 무비용(numerically free)** 이다.

**Q5-2 · natal 충 + Luck 충이 같은 슬롯 → 1회로 collapse (예)**

§1.6.8.9.4의 근거가 그대로 적용된다. 육충은 완전 매칭이므로 natal 子와 세운 子가 natal 午를 칠 때
**relation의 종류는 하나**이고 source만 다르다. 다른 종류의 손상이 아니다.

| 사례 | relation 수 | 감쇠 단위 | 낙폭 |
|------|-----------|----------|------|
| luck 충만 (세운, day) | 1 | 1 | **4** |
| **natal + luck 같은 슬롯 (day)** | **2** | **1** | **4** |
| natal + luck 다른 슬롯 (day·month) | 2 | 2 | 8 |

⇒ 같은 슬롯이면 source 조합이 **수치에 전혀 영향을 주지 않는다**(측정 확인).

**Q5-4 · 8개 사례 실측**

natal 木=42 기준.

| 사례 | relation | 단위 | 낙폭 | Internal | Level | jump |
|------|---------|------|------|----------|-------|------|
| 1 · natal 내부 충만 | 1 | 1 | 4 | 38 | weak | 1 |
| 2 · luck 충만 | 1 | 1 | 4 | 38 | weak | 1 |
| 3 · natal+luck **같은** 슬롯 | **2** | **1** | **4** | 38 | weak | 1 |
| 4 · natal+luck **다른** 슬롯 | 2 | 2 | 8 | 34 | weak | 1 |
| 5 · natal 4슬롯 전부 충 | 4 | 4 | 16 | 26 | weak | 1 |
| 6 · **대+세+월+일 동시 활성** | **16** | **4** | **16** | 26 | weak | **1** |
| 7 · 일부 luck window 종료 후 | 2→ | 1 | 4 | 38 | weak | 1 |
| 8 · 모든 luck 종료 | 0 | 0 | **0** | **42** | balanced | **0** |

**사례 5와 6이 동일하다** — natal 단독 4슬롯 충과 4개 Luck layer 전부 활성이 **같은 결과**(낙폭 16)다.
relation은 4건 vs 16건으로 4배지만 감쇠는 동일하다. 이것이 collapse의 핵심 효과다.
사례 8에서 `Effective = Natal` 복귀, Natal은 한 번도 변하지 않는다.

**Q5-5 · “같은 δ” = 명리적 동등이 아니라 수치 계층의 단일 상수 (필수 구분)**

| 해석 | 채택 여부 |
|------|----------|
| “Luck 충의 **명리적 강도**가 natal 충과 같다” | **아니다. 주장하지 않는다.** 근거 없음 |
| “**v1 generic attenuation 수치 계층**에서 동일 상수를 쓴다” | **이것이 확정 내용** |

**별도 δ_luck을 도입할 때의 구조적 비용 (측정 확인):**

collapse가 (오행 × 슬롯) 1회이므로, 한 슬롯이 natal·luck 양쪽에서 충을 받으면
**relation은 2종인데 감쇠 단위는 1개**다. 따라서 δ_luck ≠ δ_natal이면
**“어느 δ를 쓸 것인가”라는 우선순위 규칙이 새로 필요**해진다 — 현재 근거가 없는 신규 규칙이다.
단일 상수를 쓰면 이 선택 자체가 발생하지 않는다.

**severity는 이미 보존돼 있다.** L1-S가 `clashRelations[]`에 기여 source를 전량 기록하므로,
훗날 “세운 충이 대운 충보다 급하다” 같은 근거가 생기면 **수치층을 건드리지 않고** 별도 계층에서 표현할 수 있다.

**결론 → (A) Luck generic clash에도 δ=4를 v1 정책으로 잠글 수 있다.**
**단, 그 의미는 후보 C** — 구조상 동일 δ를 쓰되 **source severity는 별도 미래 계층으로 분리**한다.

| 후보 | 판정 |
|------|------|
| **A · natal/Luck 모두 δ=4 동일** | 수치층 규칙으로 **채택** |
| B · Luck δ 별도 TBD 유지 | **불채택** — 안전성이 구조적으로 증명됐고, 별도 상수는 근거 없는 우선순위 규칙을 요구 |
| **C · 동일 δ + severity 미래 계층 분리** | **채택 — 본 확정의 정확한 의미** |

| 잠금 항목 | 내용 |
|-----------|------|
| Luck generic clash δ | **4** — natal과 동일 상수 |
| 근거 | L1-S collapse가 상한을 natal 슬롯 수(4)로 고정 → 최대 낙폭 16 < 21 (2²⁰ 전수 검증) |
| 의미 범위 | **수치 계층 한정.** 명리적 강도 동등 주장 **아님** |
| source severity | **수치화 금지.** `clashRelations[]` 기록으로만 보존 |

**여전히 TBD:**

- **source severity의 수치화** — 근거 생길 때까지 금지 (L1-S 집합 보존만)
- **source 가중(L2)** — 근거 없음
- **Luck 충 탐지 배선** — **설계 완료 (W3, §1.6.8.10) · 구현 미착수**
- **개고 병존 시 총량 상한** — Opening 별도(§1.6.7.6)
- **엔진 구현** — 없음

시뮬: `clashAttenuationSim.test.ts` — `TBD-01c-source · Q5-*` describe 3개(7 test, 2²⁰ 전수 포함)

##### 1.6.8.10 TBD-01c-wiring — Luck↔Natal clash detection 배선 (**설계 조사 · 미구현**)

목표: Luck layer가 natal 지지와 generic 육충을 탐지하고, 확정된 **L1-S** 정책에 필요한 정보를 얻기 위한
**최소 데이터 계약**을 설계한다. **본선 엔진 미수정 · 프로덕션 타입 미추가 · 구현 없음.**

###### 1.6.8.10.1 코드 조사 결과

| 조사 항목 | 실제 상태 |
|-----------|----------|
| `FourPillars` | `{ year, month, day, hour: Pillar\|"unknown", hourCertainty, dayBoundaryNote?, warnings[] }` |
| `Pillar` | `{ stem, branch }` — 충 판정에는 **branch만** 필요 |
| `PillarSlot` | `"year"\|"month"\|"day"\|"hour"` — 감쇠 키의 슬롯 축과 동일 |
| `RootHit` | `{ slot, branch, hiddenStem, role, polarity }`. dedupe 키에 **polarity 포함** |
| `analyzeElementPresence(...).rootedSlots` | **(오행 × 슬롯) 단위, 중복 없음** — `hiddenStemsOf(branch).some(...)` 기반 |
| `AnnualTarget` | `{ luckKind:"annual-year", year, stem, branch, stemElement, branchMainElement, boundaryBasis:"lichun-kst", windowStart, windowEnd }` |
| Luck의 natal 접근 | `{ target, natalCoreElement, natalSupplementElement }` — **Element 2개뿐** |
| Luck 소비자 | 앱 페이지(`unyul/2026/*` 등)는 호출부에서 **이미 `pillars`를 보유** |
| 확장성 | `luckKind`는 단일 리터럴이나 **union 확장 가능**. `window`/`stem`/`branch`는 kind 무관 generic. `year`·`boundaryBasis`는 annual 전용 |

**결정적 실측 (Q3 답):**

```
네 기둥 모두 甲寅일 때, 오행 木
  analyzeElementPresence(...).rootedSlots → ["year","month","day","hour"]  = 4   ✅ 확정 키와 일치
  RootHit 레코드 수                        → 8 (비견/겁재 중복)              ❌ 2배
  hour unknown  → rootedSlots            → ["year","month","day"]         = 3   ✅ 자동 축소
```

⇒ **`rootedSlots`가 이미 확정 감쇠 키 `(element × natal slot)`와 정확히 같은 모양이다.**
⇒ **`RootHit`을 감쇠 키 생성에 직접 쓰면 안 된다** — δ가 2배가 되어 §1.6.8.9.4 계약이 깨진다.
⇒ **hour unknown 처리도 `confirmedSlots` 경유로 이미 올바르다** (상한이 4→3으로 자동 축소).

###### 1.6.8.10.2 Q1·Q2 — `FourPillars` 전체 vs 최소 snapshot → **최소 snapshot**

`FourPillars`를 Luck 엔진에 넘기면 안 되는 이유:

1. **축 오염.** Luck이 natal 원본을 쥐면 "Luck이 Natal을 덮어쓰지 않는다"(§2.1·§1.10)가 **타입으로 보장되지 않고 규율에 의존**하게 된다. 현재는 Element 2개만 넘겨 **구조적으로 불가능**한 상태다 — 이 성질을 잃지 않아야 한다.
2. **불필요 정보 과다.** `stem` · `hourCertainty` · `warnings` · `dayBoundaryNote`는 충 판정에 **전혀 쓰이지 않는다.**
3. **호출부가 이미 `pillars`를 갖고 있다.** snapshot은 **경계에서 1회 생성**하면 되므로 추가 배관 비용이 없다.

**최소 snapshot 계약 (필요/불필요 구분):**

| 필드 | 필요? | 사유 |
|------|-------|------|
| `slot` (year/month/day/hour) | **필수** | 감쇠 키의 슬롯 축 |
| `branch` | **필수** | 육충 짝 판정의 유일 입력 |
| `rootElements: Element[]` | **필수** | 감쇠 키의 오행 축. **`rootedSlots`의 역방향** |
| hour unknown | **필수(암묵)** | 해당 슬롯을 **배열에서 제외**하는 방식. 별도 플래그 불필요 |
| `stem` | **불필요** | 지지 육충과 무관 (천간 충은 TBD-03 범위 밖, §1.6.1) |
| `hourCertainty` | **불필요** | 슬롯 제외로 이미 표현됨 |
| `warnings` / `dayBoundaryNote` | **불필요** | 판정과 무관 |
| `role`(정기/중기/여기) | **불필요** | 감쇠는 깊이를 쓰지 않는다(δ 단일 상수). **깊이 enum은 충이 덮어쓰지 않음**(§1.6.4) |
| `polarity` | **불필요·유해** | 중복의 원인 |

⇒ snapshot은 **슬롯당 `{ slot, branch, rootElements }`** 3필드, 최대 4개(hour unknown이면 3개).

###### 1.6.8.10.3 Q4 — clash relation record 최소 필드

| 필드 | 채택 | 사유 |
|------|------|------|
| `natalSlot` | **필수** | 감쇠 키 |
| `natalBranch` | **필수** | 근거 표시·검증 |
| `otherBranch` | **필수** | 상대 지지 (luck 또는 natal) |
| `source` | **필수** | L1-S severity 보존(§1.6.8.9.5). 수치엔 미사용 |
| `clashPairId` | **필수** | Opening 라우팅(§1.6.8.10.6)·근거 추적 |
| `window` | **필수(luck만)** | 활성 판정. natal source는 `null` |
| ~~`element`~~ | **불채택** | relation은 지지 관계다. 오행은 collapse 단계에서 snapshot으로 붙인다 — relation에 넣으면 **같은 충이 오행 수만큼 복제**되어 §1.6.8.9.4의 중복 위험이 재발한다 |
| ~~`delta`/severity 점수~~ | **불채택** | 수치는 3단계에서만. severity 수치화 금지 |

> **`element`를 relation에서 뺀 것이 핵심 설계 결정이다.** relation은 **지지 대 지지**,
> 감쇠 키는 **오행 × 슬롯**. 두 축을 한 레코드에 섞으면 collapse 이전에 이미 곱집합이 생긴다.

###### 1.6.8.10.4 Q5 — annual 전용 vs generic luck 계약 → **generic 필요**

현행 `AnnualTarget`은 `year: number` · `boundaryBasis: "lichun-kst"` 등 **annual 전용 필드**를 갖는다.
반면 clash 탐지가 실제로 쓰는 것은 **`branch`와 `window`뿐**이다.

| 필드 | clash 탐지에 필요? |
|------|-------------------|
| `branch` | **필수** |
| `windowStart` / `windowEnd` | **필수** |
| `stem` · `stemElement` · `branchMainElement` | 불필요 (지지 육충과 무관) |
| `year` · `boundaryBasis` | 불필요 (kind 전용 식별자) |

⇒ **detector는 `{ luckKind, branch, window }` 형태의 generic target만 받아야 한다.**
대운(교운 시각) · 월운(절입) · 일운(일 경계)은 **`boundaryBasis`가 서로 다르지만 window 계산 결과는 동일 형태**이므로,
경계 산출은 각 kind가 책임지고 detector는 결과 window만 소비한다.
`AnnualTarget`을 그대로 받으면 대운·월운·일운 추가 시 **detector를 다시 써야 한다.**

###### 1.6.8.10.5 Q6 — 3단 분리 (**detect → collapse → modifier**)

| 단계 | 입력 → 출력 | δ 인지 |
|------|-----------|--------|
| **1. detect** | (natal snapshot, generic luck targets) → `ClashRelation[]` | **모름** |
| **2. collapse** | (snapshot, relations) → `{element, slot}[]` (중복 제거) | **모름** |
| **3. modifier** | keys → `{element, slot, delta}[]` | **여기서만 δ=4** |

**분리해야 하는 이유:** 한 함수에 합치면 §1.6.8.9.4의 "relation multiplicity ≠ attenuation multiplicity" 분리가
**호출 순서에 의존하는 규율**이 된다. 3단 분리는 그 분리를 **타입 경계로 강제**한다.
또한 Opening(2단계 우회)·transform 해제(relation만 소비)가 **1단계 산출물을 공유**할 수 있다.

**측정 확인:** 1·2단계 산출물에 `delta` 필드가 존재하지 않으며,
4개 layer 전부 활성이어도 relation 8건 → key 4건 → 火 낙폭 8로 **단일 세운일 때와 동일**하다.

###### 1.6.8.10.6 Q7 — Opening은 relation 공유 · 효과 분리 (**가능**)

generic detector가 `clashPairId`를 실으므로, 丑未·辰戌도 **동일 경로로 탐지**된다.

```
detect (전 6쌍 공통)
  ├─ collapse → modifier   … generic 감쇠 (δ=4)         ← 본 경로
  └─ clashPairId ∈ {clash-chou-wei, clash-chen-xu}
        → Opening 평가 (TBD-03a)                        ← 별도 경로
```

- **병존**은 §1.6.7.6에서 이미 확정 — 개고 대상 쌍도 generic 감쇠를 **정상적으로 받는다.**
- detector는 **라우팅만** 하고 Opening 효과를 계산하지 않는다 (측정 확인).
- ⇒ Opening 때문에 generic detector를 분기시킬 필요가 **없다.**

###### 1.6.8.10.7 아키텍처 후보 3안

| 안 | 요지 | Natal 불변 타입 보장 | 확장성 | 계약 보존 | 판정 |
|----|------|:---:|:---:|:---:|------|
| **W1** | Luck 엔진에 `FourPillars` 전달 | ✗ 규율 의존 | △ | ✗ `RootHit` 오용 위험 노출 | **기각** |
| **W2** | `annual/` 안에 clash 모듈 추가, `AnnualTarget` 소비 | ○ | ✗ 대운·월운·일운마다 재작성 | △ | **기각** |
| **W3** | **`luck/clash/` 신설 · 최소 snapshot + generic target · 3단 분리** | **○ 타입으로 차단** | **○ kind 추가만** | **○** | **권고** |

**W3 권고 근거 (변경량이 아니라 계약 보존 기준):**

1. **Natal 불변이 타입으로 보장된다.** snapshot에 `stem`·`warnings`가 없어 Luck이 natal을 **되쓸 수단 자체가 없다.**
2. **감쇠 키 오용이 구조적으로 차단된다.** snapshot이 `rootElements`(= `rootedSlots` 역방향)만 노출하므로 `RootHit` polarity 중복에 **접근할 수 없다.**
3. **relation/attenuation 분리가 타입 경계로 강제된다** (§1.6.8.10.5).
4. **대운·월운·일운 확장 시 detector 재작성이 없다** — `luckKind` union과 window 산출만 추가.
5. **Opening 분기 불필요** (§1.6.8.10.6).

**배치안:** `src/lib/saju/luck/clash/` (annual과 형제). `annual/`은 clash를 **소비만** 하고 소유하지 않는다.

###### 1.6.8.10.8 TBD-01c-wiring 상태

| 항목 | 상태 |
|------|------|
| 최소 snapshot = `{slot, branch, rootElements}` | **설계 확정 가능** |
| snapshot 원천 = `rootedSlots` (RootHit **금지**) | **설계 확정 가능** |
| hour unknown = 슬롯 제외 (플래그 불필요) | **설계 확정 가능** |
| relation 필드 6개 (`element` 제외) | **설계 확정 가능** |
| generic luck target `{luckKind, branch, window}` | **설계 확정 가능** |
| 3단 분리 (detect→collapse→modifier) | **설계 확정 가능** |
| Opening = relation 공유 · 효과 분리 | **설계 확정 가능** |
| 아키텍처 W3 (`luck/clash/`) | **채택 · 구현 완료** (§1.6.8.10.9) |
| **엔진 구현 · 타입 추가** | **완료 — 세운(annual-year) 한정** (§1.6.8.10.9). 앱/UI 미연결 |
| 대운·월운·일운 **간지 산출식** | **TBD** — §1.10 그대로. window 계산 주체는 각 kind |
| natal 내부 충 detector와의 통합 | **TBD** — 본 조사는 Luck↔Natal 경로만 |

시뮬: `clashAttenuationSim.test.ts` — `TBD-01c-wiring` describe 3개(6 test)

###### 1.6.8.10.9 W3 구현 상태 — **annual-year production wiring 완료**

설계(§1.6.8.10.7 W3)대로 `src/lib/saju/luck/clash/`를 신설하고 7단계까지 구현했다.
**세운(annual-year)만 연결**했으며 나머지는 미구현이다.

| 단계 | 모듈 | 상태 |
|------|------|------|
| 1 · Natal snapshot | `clash/buildNatalClashSnapshot.ts` · `clash/types.ts` | **완료** |
| 2 · relation 탐지 | `clash/branchClashPairs.ts` · `clash/detectLuckClashRelations.ts` | **완료** |
| 3 · collapse | `clash/collapseClashAttenuationKeys.ts` | **완료** |
| 4 · δ modifier | `clash/constants.ts` · `clash/buildClashAttenuationModifiers.ts` | **완료** |
| 5 · Internal Effective | `clash/buildClashEffectiveScores.ts` | **완료** |
| 6 · Display + Level | `clash/resolveEffectiveStrengthLevel.ts` · `clash/buildClashEffectiveProfiles.ts` | **완료** |
| 7 · **세운 연결** | `annual/resolveAnnualClashEffective.ts` | **완료** |

**연결 경계:** `resolveAnnualClashEffective({ pillars, year })` — `annual/`이 generic `clash/`를
**소비**하는 방향(§1.6.8.10.7)을 지킨다. 기존 `resolveAnnualSupplementFlowV2`에 넣지 **않았다**:
그쪽은 Core/Supplement/Need 축이고 `FourPillars`를 받지 않으며 `coreBlocksAnnual` skip 경로가 있는데,
충 감쇠는 Strength 축이며 Core 해석 성패와 무관하게 계산돼야 하기 때문이다.
결과는 기존 annual evidence를 덮어쓰지 않는 **별도 파생 객체**다.

**구현으로 확인된 계약** (통합 테스트):

- 세운 지지가 원국과 충하지 않음 → relation 0 · 전 오행 attenuation 0
- 원국 1슬롯 충 → 그 슬롯 `rootElements`만 δ=4
- 같은 지지가 원국 여러 슬롯 충 → 슬롯별 key 생성 (예: 子 2슬롯 → 水 8)
- 피격되지 않은 오행 → Natal 좌표·Level 그대로
- **hour unknown** → snapshot에 hour 없음 → hour relation·attenuation 생성 불가
- Natal Strength profile · Need 전후 **동일**
- `FourPillars` · `AnnualTarget` window **비mutate** (Date 복사)
- window 시작 포함 · 끝 배타 (다음 해 `windowStart` = 올해 `windowEnd`)

###### 1.6.8.10.10 미구현 (본 연결에 **포함되지 않음**)

| 항목 | 상태 |
|------|------|
| **대운 · 월운 · 일운** | **미구현** — 간지 산출식 TBD(§1.10). `LuckClashKind`에 자리만 있음 |
| **Transform modifier 합성** | **미구현** — M2와의 합성 순서는 §1.5.9.4, 코드 미연결 |
| **Opening(개고) 효과** | **미구현** — `clashPairId`로 라우팅만 가능. 수치는 TBD-03a-magnitude |
| **source severity 수치화** | **금지 유지** — relation 기록만 (§1.6.8.9.5) |
| **source 가중(L2)** | **근거 없음** — 미착수 |
| **위치 가중** | **P0 유지** (§1.6.8.8) |
| **앱/UI 연결** | **미착수** — lib 경계까지만. 페이지 미변경 |
| **Need/Core/Supplement 연동** | **없음** — 축 분리 유지 |

#### 1.6.9 TBD-03 상태

| 항목 | 상태 |
|------|------|
| 지지 육충 6쌍 표 | **확정** |
| 영향 범위 A–D · 비관련 무영향 | **확정** |
| Natal 비삭제 · 전역 일괄 감점 금지 | **확정** |
| 통근 상태 unaffected / conflicted / attenuated | **확정** |
| opened → 개고 분리 (**TBD-03a = §1.6.7 규칙 확정**) | **확정** |
| 합: 성립 전 blocking · 활성 modifier 해제 · 해소 후 재평가 | **확정** |
| 슬롯/evidence/modifier ID 추적 | **확정** |
| Need 직접 합산 금지 | **확정** |
| 감쇠 숫자 | **확정 — A안 δ=4** (evidence 1건당). §1.6.8 · 엔진 미적용 |
| 감쇠 δ 상한 | **10** (δ≥11은 단일 충만으로 Level ±2 → 하드 룰 위반). §1.6.8.3 |
| 최대 Level 이동 (δ=4) | **1단** — 도달 가능한 모든 구성. §1.6.8.5.1 |
| 위치 가중 (년/월/일/시) | **시뮬 완료 · 미도입 (TBD-01c-position)** — **P0 전 슬롯 균등 유지**. §1.6.8.8 |
| 충 source (natal/luck) 차등 | **δ=4 동일 확정(수치층 한정) · severity·가중은 TBD** — §1.6.8.9.5 |
| 중복 감쇠 붕괴 | **확정 가능 — L1 collapse, 단위 (오행 × 지지슬롯)** · §1.6.8.9.4 |
| 개고 수치 | **미정 (TBD-03a-magnitude)** |
| 엔진 구현 | **없음** |

**TBD-03 규칙 계약 = 숫자 없이 확정 · 잠금.**  
**TBD-03a 규칙 계약 = 숫자 없이 확정 · 잠금** (§1.6.7).  
**TBD-01c 기본 감쇠 수치 = A안 δ=4 확정 · 잠금** (§1.6.8). 엔진·위치 가중·source 차등은 **별도 TBD**.

---


### 1.7 형 (刑)

| 필드 | 내용 |
|------|------|
| 판단 대상 | 삼형·무례형·자형 등 지지 형 관계 |
| 입력값 | 형 테이블, 관련 지지 |
| 판단 조건 | 형 hit 성립. Strength 본선보다 **후순위·약하게**(Strength v1). 형만으로 오행 이동·화기 선언 금지. |
| 결과에 미치는 영향 | 주로 관계·행동·안정성 해석. Strength는 약한 modifier 후보. |
| Strength 영향 여부 | **약함 / 향후** (v1 미포함) |
| Need 영향 여부 | **대체로 아니오**. 해석·운 이벤트 쪽. |
| 다른 규칙과 충돌 시 우선순위 | 충 > 형 > 파·해 (초안). 합화와 동시이면 합화 성립 판정을 재검토(TBD). |

확정 가능: Strength 본선 후순위.  
TBD: 형 종류별 효과 차이; 수치.

---

### 1.8 파 (破)

| 필드 | 내용 |
|------|------|
| 판단 대상 | 지지 파 관계 |
| 입력값 | 파 테이블, 관련 지지 |
| 판단 조건 | 파 hit. 충보다 약하고, Strength 본선 비포함. |
| 결과에 미치는 영향 | 관계·계획 파기 등 해석 중심. Strength 약한 modifier 후보. |
| Strength 영향 여부 | **약함 / 향후** |
| Need 영향 여부 | **대체로 아니오** |
| 다른 규칙과 충돌 시 우선순위 | 충·형 다음. 파·해는 동급으로 두고 세부 TBD. |

확정 가능: Strength 본선 제외.  
TBD: 파 vs 해 우선; 운에서만 쓸지 원국에도 쓸지.

---

### 1.9 해 (害)

| 필드 | 내용 |
|------|------|
| 판단 대상 | 지지 해(六害) 관계 |
| 입력값 | 해 테이블, 관련 지지 |
| 판단 조건 | 해 hit. Strength 본선 비포함. |
| 결과에 미치는 영향 | 관계 불편·잠복 갈등 해석. Strength 약한 modifier 후보. |
| Strength 영향 여부 | **약함 / 향후** |
| Need 영향 여부 | **대체로 아니오** |
| 다른 규칙과 충돌 시 우선순위 | 파와 동급 초안; 충·형보다 아래. |

확정 가능: Strength 본선 제외.  
TBD: 해의 Need/조후 개입 여부(기본 비개입).

---

### 1.10 대운 / 세운 / 월운 / 일운

| 필드 | 내용 |
|------|------|
| 판단 대상 | 운의 천간·지지(및 그 오행·관계)가 원국에 가하는 영향 |
| 입력값 | 원국 四柱, 대운 간지, 세운(연주) 간지, 월운·일운 간지, 기준 시각·절기(연운 경계 TBD) |
| 판단 조건 | 1) 운 간지 산출(만세력·절기 경계). 2) 원국과의 합·충·형·파·해·생극. 3) **원국 Strength 재계산으로 대체하지 않음** — Luck evidence / Annual Supplement 등 별도 레이어. |
| 결과에 미치는 영향 | 시기별 흐름·Annual Supplement·표현 게이트. 원국 Core/Strength 확정을 뒤집지 않는 것을 원칙으로 함(예외 TBD). |
| Strength 영향 여부 | **원국 Strength: 아니오**. 운 레이어 전용 strength-like 지표가 필요하면 별도 이름(TBD). |
| Need 영향 여부 | **예(운 Need / Annual)**. Natal Need와 축·게이트 분리 유지. |
| 다른 규칙과 충돌 시 우선순위 | 대운(장기 배경) ⊃ 세운 ⊃ 월운 ⊃ 일운(단기). 단기 운이 장기 대운의 **방향 자체를 부정하지 않고** 변조(초안). 원국 관계 규칙 테이블을 운에도 재사용하되 가중 TBD. |

| 운 | 확정 가능 | TBD |
|----|-----------|-----|
| 대운 | 원국과 분리된 장기 레이어 | 순행/역행·교운 시각; 대운이 원국 Strength를 재채점할지(권고: 아니오) |
| 세운 | 연 단위 간지 + 원국 관계; Annual 파이프 존재 | 절입 시각 경계; 세운 vs 대운 가중 |
| 월운 | 월 단위 흐름(초안 정의) | **엔진 미구현** — 산출식·절기 기준 TBD |
| 일운 | 일 단위 흐름(초안 정의) | **엔진 미구현** — 산출식 TBD |

---

## 2. 규칙 충돌 우선순위 초안

### 2.1 축 간 (절대)

```
1. 만세력 四柱 (사실층)          ← 글자·절기·반시 등
2. Strength (원국 세력)         ← 월령·통근·투간·존재 …
3. Climate / Need (필요)        ← Strength와 병합 금지
4. Structure (Core 등)          ← Strength/Need 결과를 쓰되 역유입 금지
5. Luck (대/세/월/일)           ← 원국 축을 덮어쓰지 않음
6. 표현 (Supplement·음악 등)    ← 최하위 소비층
```

### 2.2 Strength 내부 (기존 v1과 정합)

```
Natal Strength (immutable)
1. 월령
2. 통근 / 본기
3. 천간 노출·존재
4. 투간
5. 지장간 밀도
─── Transform modifiers (transform-ok만, M2 §1.5.9) ───
6. 합 화기: 참여 감쇠 + 목표 가산   ← 수치·상한 TBD-01b
7. 충(한정 감쇠 · 계약 §1.6; 수치 TBD-01c)
8. 형 · 파 · 해 (약)
→ Internal Effective = Natal − Σatten + Σboost (clamp 없음, D)
→ Display = clamp(Internal, 8..96)
```

### 2.3 관계(합충형파해) 내부 초안

```
1. 충 (합화 방해·근 동요 1선)
2. 합 — 화기 성립 판정 (미성립 합은 기록만)
3. 형
4. 파 · 해
```

### 2.4 Need 내부 초안

```
1. 축 분리: strength-need vs climate-need (병합 금지)
2. 각 축 contested / unresolved면 해당 축만 보류
3. Luck Need는 Natal Need를 대체하지 않고 병기
```

### 2.5 운 레이어 초안

```
대운 배경 > 세운 변조 > 월운 > 일운
원국 합충 테이블 재사용, 가중치는 운 종류별 TBD
```

---

## 3. 기존 구현과의 차이 (코드 변경 없음 — 보고만)

| 항목 | 초안 규칙 | 현재 구현 | 충돌/차이 |
|------|-----------|-----------|-----------|
| 월령 | Strength 기반 | `seasonPhaseOf` / Strength v1 사용 | **정합** |
| 통근 | rootStatus 4단 | `analyzeStemRoots` + Strength v1 | **정합** |
| 투간 | exact / month outlet | evidence 존재, Strength v1 | **정합** |
| 조후 | Strength 합산 금지, Need climate 축 | Climate 모듈·Need 축 분리 | **정합** (세부 조습·삼합 환산은 감사/TBD) |
| 합·충·형·파·해 | v2+ Strength modifier | **엔진 미구현** (Strength v1도 제외) | 초안은 **향후 레이어** — 구현 변경 요구 없음 |
| 대운 | 원국 Strength 비재채점 | 대운 전용 산출 **미확인/부분** | TBD로 분리 |
| 세운 | Luck 레이어 | `luck/annual/*` (Annual Supplement 등) | 세운≈연운 파이프 **부분 구현**. 초안의 “세운 Strength”와는 별개 |
| 월운·일운 | 정의만 | **미구현** | 차이 = 부재. 구현 강제 없음 |
| region / 반시 | 시주 −30 | `buildFourPillars` 반시 | 본 규칙표 범위 외 — **변경 금지** |
| Core / Supplement | 소비층 | 별도 final/annual | Strength↔Need 분리 원칙과 **정합**; 본 초안이 Core 식을 바꾸지 않음 |

**구현을 바꾸지 않고 남기는 차이 요약**

1. 합충형파해: 문서상 향후 modifier vs 코드 부재.  
2. 월운·일운: 문서만.  
3. 대운이 원국 Strength를 재계산하는지: 초안은 금지 권고, 코드에 전면 Strength 재채점 루프 없음(연운은 Supplement 쪽).  
4. 조후 삼합 환산: 전문가/정책 레지스트리에 open item — 초안도 TBD.

---

## 4. TBD 목록 (수치·미확정)

### 4.1 TBD-01 — 가중치·점수 (세부)

기존 “모든 가중치”를 추적용으로 분할. **숫자 확정은 하지 않음.**

| ID | 항목 |
|----|------|
| TBD-01a | Strength Level 내부(월령·통근·투간·밀도) **표시용 score** 사용 여부·스케일 |
| TBD-01b | **확정** — 五合 pool **12** · 삼합/방합 **16** · atten 균등 · boost=Σatten · Internal 비clamp · Display 8–96 · Level=Internal+nearest/mid→upper. 엔진 미구현 |
| TBD-01c | Strength v2+ **충** 한정 감쇠 **수치·위치 가중** (규칙 계약은 §1.6 TBD-03 확정) |
| TBD-01d | Strength v2+ **형·파·해** 개입 강도 (0 포함 여부) |
| TBD-01e | Climate / Need **threshold·점수** (축 분리 유지) |
| TBD-01f | Luck(대/세/월/일) 관계 **가중** (원국과 별도 스케일) |

### 4.2 합 관련 TBD (TBD-02 계열)

| ID | 항목 |
|----|------|
| TBD-02 | *(부모)* 합 **화기 성립** — 자식으로 추적 |
| TBD-02a | 육합을 화기 대상으로 둘지 (**현재 초안: 비대상**, 매트릭스 N) |
| TBD-02b | 반합 hit 인정 범위; 충 시 반합 hit 무효화 여부 |
| TBD-02c | **초안 확정** — §1.5.4.2. 잔여: C-거리(육합)·C-방해에 형·파·해 편입 |
| TBD-02d | **완료** — 五合·삼합·방합 화기 결과 오행 표 (§1.5.8). 육합·반합 표 없음 |
| TBD-02e | **완료** — §1.5.10 경쟁·병존·P1–P6·unresolved |
| TBD-02f | **확정: 안 C** — 원국 보존 + Transform modifier → Effective. 수치·비율은 TBD-01b. (§1.5.7) |

### 4.3 기타 TBD

| ID | 항목 |
|----|------|
| TBD-03 | **규칙 계약 확정** — 육충 표·영향 범위·통근 상태·합 modifier 계약·ID 추적·Need 비합산 (§1.6). **수치 제외** |
| TBD-03a | **규칙 계약 확정** — 丑未·辰戌만 · 상태 모델 · 조건 매트릭스 · Natal 비mutate · 충 감쇠 병존 · 재평가 (§1.6.7). **수치·장간 선택 세부·일부 조건 역할은 TBD** |
| TBD-04 | 형·파·해 Strength 개입 강도 → TBD-01d와 동일 계열로 추적 가능 |
| TBD-05 | 통근: 동계 vs 동일 글자; 타간 가중 |
| TBD-06 | 조후: 토월·삼합 성국 환산식 (`transform-ok` 연동 시) |
| TBD-07 | 일간별 조후용신 테이블 |
| TBD-08 | 대운 교운 시각·순역 |
| TBD-09 | 세운 절입 경계 vs 시민연 |
| TBD-10 | 월운·일운 산출 및 원국 관계 가중 → TBD-01f |
| TBD-11 | Luck용 “일시 Strength” 지표를 둘지 (이름·축) |
| TBD-12 | `transform-ok`(및 충)이 climate Need를 직접 바꾸는지 |

---

## 5. 다음 단계에서 가장 먼저 확정할 규칙

합 레이어·TBD-01b(12/16)·**TBD-03**·**TBD-03a** 규칙 계약 문서 확정. 엔진 미구현.

다음 권고:

1. UI 동점 타이 (별도).  
2. Transform **엔진 구현** (문서 계약 준수).  
3. TBD-02a·02b 등 잔여 합 스코프.  
4. TBD-01c (충 감쇠 수치).  
5. TBD-03a 잔여: O-월령/통근/방해/source 역할 · 장간 선택 · **개고 수치**.

**TBD-01b 수치 · TBD-03 · TBD-03a 규칙 계약 확정 완료.** 엔진·충/개고 수치는 별도 작업.

