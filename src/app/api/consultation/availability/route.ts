import { NextResponse } from "next/server";
import {
  DEFAULT_TEACHER,
  listSlotStatuses,
  upcomingConsultDateOptions,
} from "@/lib/server/consultationSlots";
import { readData } from "@/lib/server/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const teacher = searchParams.get("teacher") ?? DEFAULT_TEACHER;

  if (!date) {
    const options = upcomingConsultDateOptions();
    return NextResponse.json({
      // 기존 형식. 표시 문구만 필요한 화면이 그대로 쓴다.
      dates: options.map((option) => option.label),
      // 표시 문구와 짝이 되는 한국 날짜("YYYY-MM-DD").
      // 화면이 이 값을 함께 들고 다녀 표시 문구에서 연도를 역추론하지 않는다.
      dateOptions: options,
      teacher,
    });
  }

  const data = await readData();
  const slots = listSlotStatuses(data, teacher, date);
  return NextResponse.json({ date, teacher, slots });
}
