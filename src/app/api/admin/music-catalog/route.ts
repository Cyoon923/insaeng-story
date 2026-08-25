import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/server/adminSession";
import { nowId, readData, writeData } from "@/lib/server/store";
import {
  createMusicCatalogRecord,
  deleteMusicCatalogRecord,
  setMusicCatalogActive,
  updateMusicCatalogRecord,
  type MusicCatalogWriteInput,
} from "@/lib/saju/speakable/music/musicCatalogAdmin";

function unauthorized() {
  return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return unauthorized();

  const data = await readData();
  return NextResponse.json({
    items: data.musicCatalog ?? [],
  });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return unauthorized();

  const body = (await request.json()) as MusicCatalogWriteInput;
  const data = await readData();
  const catalog = data.musicCatalog ?? [];
  const nowIso = new Date().toISOString();

  const result = createMusicCatalogRecord({
    catalog,
    body,
    nowIso,
    newId: nowId(),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  data.musicCatalog = result.catalog;
  await writeData(data);
  return NextResponse.json({ ok: true, item: result.record });
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) return unauthorized();

  const body = (await request.json()) as MusicCatalogWriteInput & {
    id?: unknown;
    action?: unknown;
  };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id는 필수입니다." }, { status: 400 });
  }

  const data = await readData();
  const catalog = data.musicCatalog ?? [];
  const nowIso = new Date().toISOString();

  if (body.action === "setActive") {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active는 boolean이어야 합니다." }, { status: 400 });
    }
    const result = setMusicCatalogActive({
      catalog,
      id,
      active: body.active,
      nowIso,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    data.musicCatalog = result.catalog;
    await writeData(data);
    return NextResponse.json({ ok: true, item: result.record });
  }

  const result = updateMusicCatalogRecord({
    catalog,
    id,
    body,
    nowIso,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  data.musicCatalog = result.catalog;
  await writeData(data);
  return NextResponse.json({ ok: true, item: result.record });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) return unauthorized();

  const body = (await request.json()) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id는 필수입니다." }, { status: 400 });
  }

  const data = await readData();
  const catalog = data.musicCatalog ?? [];
  const result = deleteMusicCatalogRecord({ catalog, id });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  data.musicCatalog = result.catalog;
  await writeData(data);
  return NextResponse.json({ ok: true });
}
