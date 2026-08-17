import type { AppData, BlockedSlot } from "@/lib/types/app";

function formatConsultTime(hour: number): string {
  if (hour < 12) return `오전 ${hour}:00`;
  if (hour === 12) return "오후 12:00";
  return `오후 ${hour - 12}:00`;
}

export const CONSULT_TIMES = Array.from({ length: 9 }, (_, index) => formatConsultTime(10 + index));
export const DEFAULT_TEACHER = "유비 선생";

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
