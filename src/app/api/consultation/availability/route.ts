import { NextResponse } from "next/server";
import { DEFAULT_TEACHER, listSlotStatuses, upcomingConsultDates } from "@/lib/server/consultationSlots";
import { readData } from "@/lib/server/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const teacher = searchParams.get("teacher") ?? DEFAULT_TEACHER;

  if (!date) {
    return NextResponse.json({
      dates: upcomingConsultDates(),
      teacher,
    });
  }

  const data = await readData();
  const slots = listSlotStatuses(data, teacher, date);
  return NextResponse.json({ date, teacher, slots });
}
