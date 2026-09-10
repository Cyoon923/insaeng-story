import type { AppData, BlockedSlot } from "@/lib/types/app";

function formatConsultTime(hour: number): string {
  if (hour < 12) return `오전 ${hour}:00`;
  if (hour === 12) return "오후 12:00";
  return `오후 ${hour - 12}:00`;
}

export const CONSULT_TIMES = Array.from({ length: 9 }, (_, index) => formatConsultTime(10 + index));

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

export function formatConsultDate(date: Date): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${days[date.getDay()]})`;
}

export function upcomingConsultDates(count = 14): string[] {
  const dates: string[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 1; i <= count; i++) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    dates.push(formatConsultDate(next));
  }
  return dates;
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
