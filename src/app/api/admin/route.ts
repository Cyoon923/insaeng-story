import { NextResponse } from "next/server";
import {
  clearAdminSession,
  getAdminPassword,
  isAdminAuthenticated,
  setAdminAuthenticated,
} from "@/lib/server/adminSession";
import { readData } from "@/lib/server/store";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const data = await readData();
  return NextResponse.json({
    users: data.users,
    orders: data.orders,
    consultations: data.consultations,
    inquiries: data.inquiries ?? [],
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "login") {
    const password = String(body.password ?? "");
    if (password !== getAdminPassword()) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    await setAdminAuthenticated();
    return NextResponse.json({ ok: true });
  }

  if (action === "logout") {
    await clearAdminSession();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
