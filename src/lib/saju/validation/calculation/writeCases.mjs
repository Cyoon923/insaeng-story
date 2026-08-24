import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Official constants only. Do not import the saju engine or copy solarTermInstant.

const KASI_2020 = {
  입춘: { year: 2020, month: 2, day: 4, hour: 18, minute: 3 },
  경칩: { year: 2020, month: 3, day: 5, hour: 11, minute: 57 },
  입하: { year: 2020, month: 5, day: 5, hour: 9, minute: 51 },
  입추: { year: 2020, month: 8, day: 7, hour: 10, minute: 6 },
  입동: { year: 2020, month: 11, day: 7, hour: 8, minute: 14 },
  대설: { year: 2020, month: 12, day: 7, hour: 1, minute: 9 },
};

const JIE_PILLARS_2020 = {
  입춘: {
    before: { year: { stem: "己", branch: "亥" }, month: { stem: "丁", branch: "丑" }, jie: "소한" },
    after: { year: { stem: "庚", branch: "子" }, month: { stem: "戊", branch: "寅" }, jie: "입춘" },
  },
  경칩: {
    before: { year: { stem: "庚", branch: "子" }, month: { stem: "戊", branch: "寅" }, jie: "입춘" },
    after: { year: { stem: "庚", branch: "子" }, month: { stem: "己", branch: "卯" }, jie: "경칩" },
  },
  입하: {
    before: { year: { stem: "庚", branch: "子" }, month: { stem: "庚", branch: "辰" }, jie: "청명" },
    after: { year: { stem: "庚", branch: "子" }, month: { stem: "辛", branch: "巳" }, jie: "입하" },
  },
  입추: {
    before: { year: { stem: "庚", branch: "子" }, month: { stem: "癸", branch: "未" }, jie: "소서" },
    after: { year: { stem: "庚", branch: "子" }, month: { stem: "甲", branch: "申" }, jie: "입추" },
  },
  입동: {
    before: { year: { stem: "庚", branch: "子" }, month: { stem: "丙", branch: "戌" }, jie: "한로" },
    after: { year: { stem: "庚", branch: "子" }, month: { stem: "丁", branch: "亥" }, jie: "입동" },
  },
  대설: {
    before: { year: { stem: "庚", branch: "子" }, month: { stem: "丁", branch: "亥" }, jie: "입동" },
    after: { year: { stem: "庚", branch: "子" }, month: { stem: "戊", branch: "子" }, jie: "대설" },
  },
};

function shiftMinute(instant, delta) {
  const shifted = new Date(Date.UTC(instant.year, instant.month - 1, instant.day, instant.hour, instant.minute + delta));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function solarInput(year, month, day, hour, minute, extra = {}) {
  return {
    calendar: "solar",
    year,
    month,
    day,
    isLeapMonth: false,
    time: { hour, minute },
    timezone: "Asia/Seoul",
    ...extra,
  };
}

function lunarInput(year, month, day, isLeapMonth = false) {
  return {
    calendar: "lunar",
    year,
    month,
    day,
    isLeapMonth,
    time: { hour: 12, minute: 0 },
    timezone: "Asia/Seoul",
  };
}

const kasi2020Source = {
  publisher: "KASI",
  documentId: "2020 월력요항/역서 24절기",
  url: "https://astro.kasi.re.kr/life/post/almanac",
  note: "한국표준시 절입 시각. 엔진 solarTermInstant을 expected에 복사하지 않음. 년주·월주는 세차(경자/기해)+오기월법.",
};

const cases = [];

for (const [name, instant] of Object.entries(KASI_2020)) {
  const pillars = JIE_PILLARS_2020[name];
  const rows = [
    { offset: -1, side: "before", label: "1분전" },
    { offset: 0, side: "after", label: "절입" },
    { offset: 1, side: "after", label: "1분후" },
  ];
  for (const row of rows) {
    const at = shiftMinute(instant, row.offset);
    const expected = pillars[row.side];
    cases.push({
      id: `calc-jie-2020-${name}-${row.label}`,
      status: "unreviewed",
      group: "jie-boundary",
      topic: "solar-term",
      input: solarInput(at.year, at.month, at.day, at.hour, at.minute),
      sourceReference: kasi2020Source,
      officialTermInstant: instant,
      expected: {
        yearPillar: expected.year,
        monthPillar: expected.month,
        appliedJie: expected.jie,
      },
    });
  }
}

const lichun2024 = { year: 2024, month: 2, day: 4, hour: 17, minute: 27 };
const kasi2024Source = {
  publisher: "KASI",
  documentId: "2024 달력자료 24절기",
  url: "https://astro.kasi.re.kr/life/post/calendarData",
  note: "2024년 달력자료 입춘 2월 4일 17시 27분. 엔진 시각 비복사. 갑진/계묘 + 오기월법.",
};
for (const row of [
  { offset: -1, label: "1분전", year: { stem: "癸", branch: "卯" }, month: { stem: "乙", branch: "丑" }, jie: "소한" },
  { offset: 0, label: "절입", year: { stem: "甲", branch: "辰" }, month: { stem: "丙", branch: "寅" }, jie: "입춘" },
  { offset: 1, label: "1분후", year: { stem: "甲", branch: "辰" }, month: { stem: "丙", branch: "寅" }, jie: "입춘" },
]) {
  const at = shiftMinute(lichun2024, row.offset);
  cases.push({
    id: `calc-lichun-2024-${row.label}`,
    status: "unreviewed",
    group: "lichun",
    topic: "solar-term",
    input: solarInput(at.year, at.month, at.day, at.hour, at.minute),
    sourceReference: kasi2024Source,
    officialTermInstant: lichun2024,
    expected: { yearPillar: row.year, monthPillar: row.month, appliedJie: row.jie },
  });
}

cases.push(
  {
    id: "calc-lichun-1984-before-noon",
    status: "unreviewed",
    group: "lichun",
    topic: "solar-term",
    input: solarInput(1984, 2, 3, 12, 0),
    sourceReference: {
      publisher: "KASI/역서 범위",
      documentId: null,
      note: "1984 입춘은 2월 4~5일 범위. 2월 3일 정오는 절입 전. 원문 시각은 미확인이라 절입 시각 expected 없음.",
    },
    officialTermInstant: null,
    expected: {
      yearPillar: { stem: "癸", branch: "亥" },
      monthPillar: { stem: "乙", branch: "丑" },
    },
  },
  {
    id: "calc-lichun-1984-after-noon",
    status: "unreviewed",
    group: "lichun",
    topic: "solar-term",
    input: solarInput(1984, 2, 6, 12, 0),
    sourceReference: {
      publisher: "KASI/역서 범위",
      documentId: null,
      note: "1984 입춘은 2월 4~5일 범위. 2월 6일 정오는 절입 후. 원문 시각은 미확인이라 절입 시각 expected 없음.",
    },
    officialTermInstant: null,
    expected: {
      yearPillar: { stem: "甲", branch: "子" },
      monthPillar: { stem: "丙", branch: "寅" },
    },
  },
);

const dayPillars = [
  { id: "2000-01-01", y: 2000, m: 1, d: 1, stem: "戊", branch: "午", direct: true, src: "KASI 2000 월력요항 1월 1일 일진 무오" },
  { id: "2000-02-01", y: 2000, m: 2, d: 1, stem: "己", branch: "丑", direct: true, src: "KASI 2000 월력요항 2월 1일 일진 기축" },
  { id: "2000-03-01", y: 2000, m: 3, d: 1, stem: "戊", branch: "午", direct: true, src: "KASI 2000 월력요항 3월 1일 일진 무오" },
  { id: "2000-12-01", y: 2000, m: 12, d: 1, stem: "癸", branch: "巳", direct: true, src: "KASI 2000 월력요항 12월 1일 일진 계사" },
  { id: "2021-02-12", y: 2021, m: 2, d: 12, stem: "辛", branch: "卯", direct: true, src: "KASI 달력자료 2021 설날 일진 신묘" },
  { id: "2022-02-01", y: 2022, m: 2, d: 1, stem: "乙", branch: "酉", direct: true, src: "KASI 달력자료 2022 설날 일진 을유" },
  { id: "2023-01-22", y: 2023, m: 1, d: 22, stem: "庚", branch: "辰", direct: true, src: "KASI 달력자료 2023 음력 1/1 일진 경진" },
  { id: "2024-02-10", y: 2024, m: 2, d: 10, stem: "甲", branch: "辰", direct: true, src: "KASI 2024 달력자료 음력 1/1 일진 갑진" },
  { id: "2024-12-31", y: 2024, m: 12, d: 31, stem: "己", branch: "巳", direct: true, src: "KASI 2024 달력자료 음력 12/1 일진 기사" },
  { id: "2025-01-29", y: 2025, m: 1, d: 29, stem: "戊", branch: "戌", direct: true, src: "KASI 달력자료 2025 설날 일진 무술" },
  { id: "2028-01-27", y: 2028, m: 1, d: 27, stem: "辛", branch: "亥", direct: true, src: "KASI 2028 달력자료 음력 1/1 일진 신해" },
  { id: "1900-01-01", y: 1900, m: 1, d: 1, stem: "甲", branch: "戌", direct: false, src: "KASI 2000-01-01 戊午 + 그레고리 일수" },
  { id: "1945-08-15", y: 1945, m: 8, d: 15, stem: "丙", branch: "辰", direct: false, src: "KASI 2000-01-01 戊午 + 그레고리 일수" },
  { id: "1960-04-19", y: 1960, m: 4, d: 19, stem: "丁", branch: "丑", direct: false, src: "KASI 2000-01-01 戊午 + 그레고리 일수" },
  { id: "1984-02-02", y: 1984, m: 2, d: 2, stem: "丙", branch: "寅", direct: false, src: "KASI 2000-01-01 戊午 + 그레고리 일수. 설날 양력은 별도 음력 case." },
  { id: "1988-09-17", y: 1988, m: 9, d: 17, stem: "乙", branch: "亥", direct: false, src: "KASI 2000-01-01 戊午 + 그레고리 일수" },
  { id: "2020-01-01", y: 2020, m: 1, d: 1, stem: "癸", branch: "卯", direct: false, src: "KASI 2000-01-01 戊午 + 그레고리 일수" },
  { id: "2024-01-01", y: 2024, m: 1, d: 1, stem: "甲", branch: "子", direct: false, src: "KASI 2000-01-01 戊午 + 그레고리 일수" },
  { id: "2099-12-31", y: 2099, m: 12, d: 31, stem: "壬", branch: "寅", direct: false, src: "KASI 2000-01-01 戊午 + 그레고리 일수" },
  { id: "2100-01-01", y: 2100, m: 1, d: 1, stem: "癸", branch: "卯", direct: false, src: "KASI 2000-01-01 戊午 + 그레고리 일수" },
];

for (const item of dayPillars) {
  cases.push({
    id: `calc-day-${item.id}`,
    status: "unreviewed",
    group: "day-pillar",
    topic: "day-pillar",
    input: solarInput(item.y, item.m, item.d, 12, 0),
    sourceReference: {
      publisher: "KASI",
      documentId: item.src,
      note: item.direct ? "원문 일진." : "원문 직접값이 아니라 2000-01-01 戊午 + 일수.",
    },
    directOfficial: item.direct,
    expected: { dayPillar: { stem: item.stem, branch: item.branch } },
  });
}

cases.push(
  {
    id: "calc-lunar-1984-0101",
    status: "unreviewed",
    group: "lunar",
    topic: "lunar-solar",
    input: lunarInput(1984, 1, 1),
    sourceReference: { publisher: "KASI/대한민국 공휴일", documentId: "1984 설날", note: "1984년 설날 양력 2월 2일." },
    expected: { solarDate: { year: 1984, month: 2, day: 2 } },
  },
  {
    id: "calc-lunar-2020-0101",
    status: "unreviewed",
    group: "lunar",
    topic: "lunar-solar",
    input: lunarInput(2020, 1, 1),
    sourceReference: { publisher: "KASI", documentId: "2020 설날", note: "2020년 설날 양력 1월 25일." },
    expected: { solarDate: { year: 2020, month: 1, day: 25 } },
  },
  {
    id: "calc-lunar-2020-0401",
    status: "unreviewed",
    group: "lunar",
    topic: "lunar-solar",
    input: lunarInput(2020, 4, 1, false),
    sourceReference: { publisher: "KASI", documentId: "2020 월력요항 윤4월", note: "2020 평4월 1일 = 양력 4월 23일. 엔진 표 비복사." },
    expected: { solarDate: { year: 2020, month: 4, day: 23 } },
  },
  {
    id: "calc-lunar-2020-leap0401",
    status: "unreviewed",
    group: "lunar",
    topic: "leap-month",
    input: lunarInput(2020, 4, 1, true),
    sourceReference: { publisher: "KASI", documentId: "2020 월력요항 윤4월", note: "2020 윤4월 1일 = 양력 5월 23일." },
    expected: { solarDate: { year: 2020, month: 5, day: 23 } },
  },
  {
    id: "calc-lunar-2023-0101",
    status: "unreviewed",
    group: "lunar",
    topic: "lunar-solar",
    input: lunarInput(2023, 1, 1),
    sourceReference: {
      publisher: "KASI",
      documentId: "2023 달력자료 음력 1/1",
      url: "https://astro.kasi.re.kr/life/post/calendarData",
      note: "음력 1월 1일 = 양력 2023-01-22.",
    },
    expected: { solarDate: { year: 2023, month: 1, day: 22 } },
  },
  {
    id: "calc-lunar-2100-0101",
    status: "unreviewed",
    group: "lunar",
    topic: "lunar-solar",
    input: lunarInput(2100, 1, 1),
    sourceReference: {
      publisher: "HKO",
      documentId: "T2100c.txt",
      url: "https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2100c.txt",
      note: "KASI 2100 월력요항 원문을 이번 단계에서 확인하지 못해 홍콩천문대 음양력 대조표를 사용. 2100-02-09 正月.",
    },
    expected: { solarDate: { year: 2100, month: 2, day: 9 } },
  },
  {
    id: "calc-lunar-2024-leap4-reject",
    status: "unreviewed",
    group: "lunar",
    topic: "leap-month",
    input: lunarInput(2024, 4, 1, true),
    sourceReference: {
      publisher: "KASI",
      documentId: "2024 달력자료 음력",
      note: "2024년 음력 표에 윤달이 없음. 윤4월 입력 거부.",
    },
    expectRejection: { messageIncludes: "윤달" },
    expected: { accepted: false },
  },
);

const gregorianAllow = [
  [2024, 1, 31],
  [2024, 2, 29],
  [2024, 3, 31],
  [2024, 12, 31],
  [2100, 12, 31],
];
for (const [y, m, d] of gregorianAllow) {
  cases.push({
    id: `calc-gregorian-allow-${y}-${m}-${d}`,
    status: "unreviewed",
    group: "gregorian",
    topic: "day-boundary",
    input: solarInput(y, m, d, 8, 0),
    sourceReference: { publisher: "Gregorian", documentId: "ISO 8601 / 그레고리력", note: "존재하는 양력 날짜. 원국 expected 없음." },
    expected: { accepted: true, solarDate: { year: y, month: m, day: d } },
  });
}

const gregorianReject = [
  { id: "2023-02-29", input: solarInput(2023, 2, 29, 8, 0), message: "없는 양력 날짜" },
  { id: "2100-02-29", input: solarInput(2100, 2, 29, 8, 0), message: "없는 양력 날짜" },
  { id: "2024-04-31", input: solarInput(2024, 4, 31, 8, 0), message: "없는 양력 날짜" },
  { id: "month-0", input: solarInput(2024, 0, 1, 8, 0), message: "월은 1–12" },
  { id: "month-13", input: solarInput(2024, 13, 1, 8, 0), message: "월은 1–12" },
];
for (const item of gregorianReject) {
  cases.push({
    id: `calc-gregorian-reject-${item.id}`,
    status: "unreviewed",
    group: "gregorian",
    topic: "day-boundary",
    input: item.input,
    sourceReference: { publisher: "Gregorian", documentId: "ISO 8601 / 그레고리력", note: "존재하지 않는 양력 날짜 거부." },
    expectRejection: { messageIncludes: item.message },
    expected: { accepted: false },
  });
}

const hourClocks = [
  { hour: 22, minute: 59, night: { day: { stem: "戊", branch: "午" }, hour: { stem: "癸", branch: "亥" } }, early: { day: { stem: "戊", branch: "午" }, hour: { stem: "癸", branch: "亥" } } },
  { hour: 23, minute: 0, night: { day: { stem: "己", branch: "未" }, hour: { stem: "甲", branch: "子" } }, early: { day: { stem: "戊", branch: "午" }, hour: { stem: "壬", branch: "子" } } },
  { hour: 23, minute: 30, night: { day: { stem: "己", branch: "未" }, hour: { stem: "甲", branch: "子" } }, early: { day: { stem: "戊", branch: "午" }, hour: { stem: "壬", branch: "子" } } },
  { hour: 23, minute: 59, night: { day: { stem: "己", branch: "未" }, hour: { stem: "甲", branch: "子" } }, early: { day: { stem: "戊", branch: "午" }, hour: { stem: "壬", branch: "子" } } },
  { hour: 0, minute: 0, night: { day: { stem: "戊", branch: "午" }, hour: { stem: "壬", branch: "子" } }, early: { day: { stem: "戊", branch: "午" }, hour: { stem: "壬", branch: "子" } } },
  { hour: 0, minute: 59, night: { day: { stem: "戊", branch: "午" }, hour: { stem: "壬", branch: "子" } }, early: { day: { stem: "戊", branch: "午" }, hour: { stem: "壬", branch: "子" } } },
  { hour: 1, minute: 0, night: { day: { stem: "戊", branch: "午" }, hour: { stem: "癸", branch: "丑" } }, early: { day: { stem: "戊", branch: "午" }, hour: { stem: "癸", branch: "丑" } } },
];

for (const clock of hourClocks) {
  cases.push({
    id: `calc-hour-${String(clock.hour).padStart(2, "0")}${String(clock.minute).padStart(2, "0")}`,
    status: "unreviewed",
    group: "hour-boundary",
    topic: "hour-pillar",
    input: solarInput(2000, 1, 1, clock.hour, clock.minute),
    sourceReference: {
      publisher: "KASI + 오자시법",
      documentId: "2000-01-01 戊午 / 오기월법이 아닌 오자시법 표",
      note: "정책 A/B 결과 비교. 어느 쪽이 명리 정답인지 선언하지 않음. 일주 기준은 KASI 무오, 시주는 오자시법.",
    },
    expected: {
      policyOutcomes: {
        night_ja: { dayPillar: clock.night.day, hourPillar: clock.night.hour },
        early_ja: { dayPillar: clock.early.day, hourPillar: clock.early.hour },
      },
    },
  });
}

for (const [year, month, day] of [
  [1948, 6, 15],
  [1955, 6, 15],
  [1960, 4, 19],
  [1987, 6, 15],
  [1988, 9, 17],
]) {
  cases.push({
    id: `calc-dst-${year}`,
    status: "unreviewed",
    group: "dst",
    topic: "dst",
    input: solarInput(year, month, day, 12, 0),
    sourceReference: {
      publisher: "KASI/한국 서머타임 연혁",
      documentId: `${year} DST year`,
      note: "벽시계 보정 expected 없음. 현재 엔진 warning만 확인.",
    },
    historicalTimeWarningExpected: true,
    expected: {},
  });
}

const doc = {
  set: "calculation",
  validationKind: "astronomical-calendar",
  description: "절기·음양력·원국·날짜 경계. expected는 공식/신뢰 자료. 엔진 출력을 복사하지 않음. 야자시 한 정책을 정답으로 선언하지 않음.",
  sourceType: "external-calendar",
  expertReviewRequired: false,
  cases,
};

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "cases.json");
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`wrote ${cases.length} cases to ${out}`);
