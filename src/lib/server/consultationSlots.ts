import type { AppData, BlockedSlot } from "@/lib/types/app";

function formatConsultTime(hour: number): string {
  if (hour < 12) return `오전 ${hour}:00`;
  if (hour === 12) return "오후 12:00";
  return `오후 ${hour - 12}:00`;
}

/**
 * 상담 가능 시각. 표시 문구와 한국 기준 시(hour)를 한 곳에서 함께 정의한다.
 * 표시 문구만 저장하는 기존 데이터(Consultation.datetime)에서 시각을 되돌릴 때,
 * 문구를 다시 파싱하지 않고 이 표를 그대로 뒤집어 쓰기 위해서다.
 */
const CONSULT_SLOT_HOURS = Array.from({ length: 9 }, (_, index) => 10 + index);

const CONSULT_SLOTS = CONSULT_SLOT_HOURS.map((hour) => ({
  hour,
  label: formatConsultTime(hour),
}));

/** 기존과 같은 값·같은 순서다. 표시 문구 목록만 필요한 곳이 그대로 쓴다. */
export const CONSULT_TIMES = CONSULT_SLOTS.map((slot) => slot.label);

/** 한국 표준시 고정 오프셋. 한국은 현재 서머타임이 없어 상수로 둘 수 있다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_OFFSET_SUFFIX = "+09:00";

/** 한국 날짜 하나. 연도를 함께 들고 다녀 표시 문구에서 역추론하지 않는다. */
export interface KstDateParts {
  year: number;
  month: number;
  day: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** KstDateParts를 "YYYY-MM-DD"로. 이 형식만 저장·전달에 쓴다. */
export function toIsoDate(parts: KstDateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** "YYYY-MM-DD" 형식인지. 값의 실재 여부(2월 30일 등)는 아래 isOfferedDate가 본다. */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * 지금 이 순간의 한국 날짜. 서버 타임존(Vercel은 UTC)과 무관하게 같은 값을 준다.
 * UTC 시각에 +9시간을 더한 뒤 UTC 달력으로 읽는 방식이라 로컬 시간을 타지 않는다.
 */
function kstToday(now: Date = new Date()): KstDateParts {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * 한국 날짜에 일수를 더한다. Date.UTC가 월·연 넘김을 처리하므로
 * 12월 말에서 다음 해 1월로 넘어가는 경우도 그대로 맞는다.
 */
function addKstDays(parts: KstDateParts, days: number): KstDateParts {
  const moved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  };
}

/** 한국 날짜의 요일(0=일). 시각을 끼우지 않으므로 타임존에 흔들리지 않는다. */
function kstWeekday(parts: KstDateParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

/**
 * 상담 선생님 목록. id는 화면 사이에서 주고받는 값이고,
 * name은 화면에 보여 주고 저장 데이터(BlockedSlot.teacher, Consultation.teacher)에 쓰는 값이다.
 * 저장 데이터가 이름 문자열을 쓰고 있으므로 name은 함부로 바꾸지 않는다.
 */
export const CONSULT_TEACHERS = [
  { id: "yubi", name: "유비 선생" },
  { id: "helen", name: "헬렌 선생" },
  { id: "pending", name: "이권기 선생" },
] as const;

export type TeacherId = (typeof CONSULT_TEACHERS)[number]["id"];

/** 기존과 같은 값("유비 선생")이다. 목록의 첫 번째를 기본으로 쓴다. */
export const DEFAULT_TEACHER = CONSULT_TEACHERS[0].name;

/** id가 목록에 없으면 기존 기본값으로 돌려준다. */
export function teacherNameById(id: string): string {
  return CONSULT_TEACHERS.find((item) => item.id === id)?.name ?? DEFAULT_TEACHER;
}

export type SlotStatus = "available" | "booked" | "blocked";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 화면에 보여 주는 날짜 문구. 기존과 같은 "M월 D일(요일)" 형식을 그대로 유지한다.
 * 저장 데이터(Consultation.datetime)가 이 형식을 쓰고 있어 바꾸지 않는다.
 */
export function formatConsultDate(parts: KstDateParts): string {
  return `${parts.month}월 ${parts.day}일(${WEEKDAY_LABELS[kstWeekday(parts)]})`;
}

/** 예약 가능한 날짜 하나. 표시 문구와 "YYYY-MM-DD"를 짝으로 들고 다닌다. */
export interface ConsultDateOption {
  /** 화면·저장 문구. 예) "8월 12일(화)" */
  label: string;
  /** 계산용 한국 날짜. 예) "2026-08-12" */
  date: string;
}

/**
 * 예약 가능한 날짜 목록. 한국 날짜 기준으로 내일부터 count일까지다.
 *
 * 기준일을 한국 날짜로 잡는 것이 중요하다. 예전에는 서버 로컬 시간(UTC)으로
 * 계산해서, 한국에서 자정을 막 넘긴 시각에는 목록이 하루 뒤처졌다.
 */
export function upcomingConsultDateOptions(count = 14, now: Date = new Date()): ConsultDateOption[] {
  const today = kstToday(now);
  const options: ConsultDateOption[] = [];
  for (let i = 1; i <= count; i++) {
    const parts = addKstDays(today, i);
    options.push({ label: formatConsultDate(parts), date: toIsoDate(parts) });
  }
  return options;
}

/** 표시 문구 목록만 필요한 기존 호출부를 위해 남긴다. */
export function upcomingConsultDates(count = 14): string[] {
  return upcomingConsultDateOptions(count).map((option) => option.label);
}

/**
 * 지금 예약을 받고 있는 날짜인지. 클라이언트가 보낸 "YYYY-MM-DD"를 그대로 믿지 않고
 * 서버가 만든 목록에 있는 값만 통과시킨다. 표시 문구와도 짝이 맞아야 한다.
 */
export function isOfferedDate(isoDate: string, label: string, count = 14): boolean {
  if (!isIsoDate(isoDate)) return false;
  return upcomingConsultDateOptions(count).some(
    (option) => option.date === isoDate && option.label === label,
  );
}

/**
 * 선택한 한국 날짜와 시각 문구를 절대시각(UTC ISO)으로 바꾼다.
 *
 * 연도가 인자로 들어오므로 표시 문구에서 연도를 추론하지 않는다.
 * 오프셋을 문자열에 명시(+09:00)해 서버 타임존이 결과에 끼어들지 못하게 한다.
 * 시각 문구가 상담 시간표에 없으면 null이다.
 */
export function toScheduledAt(isoDate: string, timeLabel: string): string | null {
  if (!isIsoDate(isoDate)) return null;
  const slot = CONSULT_SLOTS.find((item) => item.label === timeLabel);
  if (!slot) return null;
  const at = new Date(`${isoDate}T${pad2(slot.hour)}:00:00${KST_OFFSET_SUFFIX}`);
  if (Number.isNaN(at.getTime())) return null;
  return at.toISOString();
}

/**
 * 예약 절대시각을 한 번에 얻는다. 신청 화면이 보낸 한국 날짜가
 * "지금 서버가 내주는 목록에 있고 표시 문구와도 짝이 맞는" 값일 때만 통과시킨다.
 *
 * 결제 준비(preparePayment)와 상담 확정(commitConsultation)이 같은 함수를 써야
 * "결제는 됐는데 확정에서 막히는" 어긋남이 생기지 않는다.
 * 통과하지 못하면 null이며, 호출부는 예약을 만들지 않는다.
 */
export function resolveScheduledAt(
  isoDate: string,
  dateLabel: string,
  timeLabel: string,
): string | null {
  if (!isoDate || !isOfferedDate(isoDate, dateLabel)) return null;
  return toScheduledAt(isoDate, timeLabel);
}

/**
 * "YYYY-MM-DD"를 한국 날짜로 읽는다. 형식이 맞아도 실재하지 않는 날짜
 * (2026-02-30 등)는 null이다. Date는 그런 값을 조용히 다음 달로 넘기므로
 * 만든 뒤 되읽어 같은 값인지 확인한다.
 */
export function parseIsoDate(value: string): KstDateParts | null {
  if (!isIsoDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));
  if (at.getUTCFullYear() !== year || at.getUTCMonth() + 1 !== month || at.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/**
 * **이미 서버가 판매 가능 여부를 확인한** 예약을 절대시각으로 되돌린다.
 *
 * resolveScheduledAt과 딱 한 가지가 다르다. "지금 판매 중인 날짜 목록"
 * (upcomingConsultDateOptions)을 보지 않는다. 그 목록은 부르는 순간의 한국 날짜를
 * 기준으로 매일 앞으로 밀리기 때문에, 결제 준비와 승인 사이에 자정이 지나면
 * 같은 예약이 갑자기 "판매하지 않는 날짜"가 된다. 그 시점에 막으면 돈은 빠져나갔는데
 * 상담이 없는 상태가 된다.
 *
 * 그래서 판매 여부만 빼고 나머지 검증은 그대로 한다.
 *   · "YYYY-MM-DD" 형식과 실재하는 날짜인지
 *   · 그 날짜에서 만든 표시 문구가 함께 저장된 문구와 같은지
 *     (날짜만 바꿔치기한 값은 여기서 걸린다)
 *   · 시각 문구가 상담 시간표에 있는 값인지
 * 슬롯 충돌·중복 예약은 호출부(commitConsultation의 isSlotAvailable)가 그대로 본다.
 *
 * 새 예약에는 절대 쓰지 않는다. 새 예약은 resolveScheduledAt이 맡는다.
 */
export function resolveConfirmedScheduledAt(
  isoDate: string,
  dateLabel: string,
  timeLabel: string,
): string | null {
  const parts = parseIsoDate(isoDate);
  if (!parts) return null;
  if (formatConsultDate(parts) !== dateLabel) return null;
  return toScheduledAt(isoDate, timeLabel);
}

export function buildDatetime(date: string, time: string): string {
  return `${date} ${time}`;
}

export function parseDatetime(datetime: string): { date: string; time: string } | null {
  const sorted = [...CONSULT_TIMES].sort((a, b) => b.length - a.length);
  for (const time of sorted) {
    if (datetime.endsWith(time)) {
      return { date: datetime.slice(0, datetime.length - time.length - 1), time };
    }
  }
  return null;
}

function isBlocked(data: AppData, teacher: string, date: string, time: string): boolean {
  return (data.blockedSlots ?? []).some(
    (slot) => slot.teacher === teacher && slot.date === date && slot.time === time,
  );
}

function isBooked(data: AppData, teacher: string, date: string, time: string): boolean {
  return data.consultations.some((item) => {
    if (item.teacher !== teacher) return false;
    const parsed = parseDatetime(item.datetime);
    return parsed?.date === date && parsed?.time === time;
  });
}

export function getSlotStatus(
  data: AppData,
  teacher: string,
  date: string,
  time: string,
): SlotStatus {
  if (isBooked(data, teacher, date, time)) return "booked";
  if (isBlocked(data, teacher, date, time)) return "blocked";
  return "available";
}

export function listSlotStatuses(
  data: AppData,
  teacher: string,
  date: string,
): { time: string; status: SlotStatus }[] {
  return CONSULT_TIMES.map((time) => ({
    time,
    status: getSlotStatus(data, teacher, date, time),
  }));
}

export function isSlotAvailable(data: AppData, teacher: string, date: string, time: string): boolean {
  return getSlotStatus(data, teacher, date, time) === "available";
}

export function toggleBlockedSlot(
  data: AppData,
  teacher: string,
  date: string,
  time: string,
): BlockedSlot[] {
  const current = data.blockedSlots ?? [];
  if (isBooked(data, teacher, date, time)) {
    return current;
  }
  const exists = current.some(
    (slot) => slot.teacher === teacher && slot.date === date && slot.time === time,
  );
  if (exists) {
    return current.filter(
      (slot) => !(slot.teacher === teacher && slot.date === date && slot.time === time),
    );
  }
  return [...current, { teacher, date, time }];
}
