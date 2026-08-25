import { describe, expect, it } from "vitest";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import {
  createMusicCatalogRecord,
  deleteMusicCatalogRecord,
  setMusicCatalogActive,
  updateMusicCatalogRecord,
} from "@/lib/saju/speakable/music/musicCatalogAdmin";

const NOW = "2026-08-25T10:00:00.000Z";
const LATER = "2026-08-25T12:00:00.000Z";

function baseBody(partial: Record<string, unknown> = {}) {
  return {
    title: "기대는 하루",
    youtubeUrl: "https://www.youtube.com/watch?v=abc",
    primaryElement: "木",
    message: "서로 기대며 가는 이야기",
    ...partial,
  };
}

function assertNoRanking(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/"winner"/);
  expect(serialized).not.toMatch(/"score"/);
  expect(serialized).not.toMatch(/"rank"/);
  expect(serialized).not.toMatch(/"priority"/);
}

describe("musicCatalogAdmin", () => {
  it("create: builds a record with defaults and timestamps", () => {
    const result = createMusicCatalogRecord({
      catalog: [],
      body: baseBody(),
      nowIso: NOW,
      newId: "id-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.record).toMatchObject({
      id: "id-1",
      title: "기대는 하루",
      youtubeUrl: "https://www.youtube.com/watch?v=abc",
      primaryElement: "木",
      secondaryElements: [],
      moodTags: [],
      situationTags: [],
      energyTags: [],
      lyricKeywords: [],
      message: "서로 기대며 가는 이야기",
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.catalog).toHaveLength(1);
    assertNoRanking(result.record);
  });

  it("list surface: catalog array is returned after create", () => {
    const created = createMusicCatalogRecord({
      catalog: [],
      body: baseBody({ secondaryElements: ["水", "火"], moodTags: ["따뜻한"] }),
      nowIso: NOW,
      newId: "id-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.catalog.map((item) => item.id)).toEqual(["id-1"]);
    expect(created.record.secondaryElements).toEqual(["水", "火"]);
  });

  it("update: keeps createdAt and refreshes updatedAt", () => {
    const created = createMusicCatalogRecord({
      catalog: [],
      body: baseBody(),
      nowIso: NOW,
      newId: "id-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = updateMusicCatalogRecord({
      catalog: created.catalog,
      id: "id-1",
      body: { title: "새 제목", message: "새 메시지" },
      nowIso: LATER,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(updated.record.title).toBe("새 제목");
    expect(updated.record.message).toBe("새 메시지");
    expect(updated.record.createdAt).toBe(NOW);
    expect(updated.record.updatedAt).toBe(LATER);
    assertNoRanking(updated.record);
  });

  it("active toggle: flips active and updates updatedAt only", () => {
    const created = createMusicCatalogRecord({
      catalog: [],
      body: baseBody({ active: true }),
      nowIso: NOW,
      newId: "id-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const toggled = setMusicCatalogActive({
      catalog: created.catalog,
      id: "id-1",
      active: false,
      nowIso: LATER,
    });
    expect(toggled.ok).toBe(true);
    if (!toggled.ok) return;
    expect(toggled.record.active).toBe(false);
    expect(toggled.record.createdAt).toBe(NOW);
    expect(toggled.record.updatedAt).toBe(LATER);
  });

  it("delete: removes the item", () => {
    const created = createMusicCatalogRecord({
      catalog: [],
      body: baseBody(),
      nowIso: NOW,
      newId: "id-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deleted = deleteMusicCatalogRecord({ catalog: created.catalog, id: "id-1" });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.catalog).toEqual([]);
  });

  it("rejects invalid primaryElement and secondaryElements", () => {
    const badPrimary = createMusicCatalogRecord({
      catalog: [],
      body: baseBody({ primaryElement: "용신" }),
      nowIso: NOW,
      newId: "id-1",
    });
    expect(badPrimary).toEqual({
      ok: false,
      error: "primaryElement는 木火土金水만 허용합니다.",
      status: 400,
    });

    const badSecondary = createMusicCatalogRecord({
      catalog: [],
      body: baseBody({ secondaryElements: ["水", "winner"] }),
      nowIso: NOW,
      newId: "id-1",
    });
    expect(badSecondary).toEqual({
      ok: false,
      error: "secondaryElements는 木火土金水만 허용합니다.",
      status: 400,
    });
  });

  it("rejects duplicate id", () => {
    const first = createMusicCatalogRecord({
      catalog: [],
      body: baseBody({ id: "dup" }),
      nowIso: NOW,
      newId: "ignored",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = createMusicCatalogRecord({
      catalog: first.catalog,
      body: baseBody({ id: "dup", title: "다른 곡" }),
      nowIso: LATER,
      newId: "other",
    });
    expect(second).toEqual({
      ok: false,
      error: "이미 존재하는 id입니다.",
      status: 409,
    });
  });

  it("rejects missing required fields", () => {
    const result = createMusicCatalogRecord({
      catalog: [],
      body: { primaryElement: "木" },
      nowIso: NOW,
      newId: "id-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toContain("필수");
  });
});

describe("musicCatalogAdmin ranking guard", () => {
  it("never invents winner/score/rank fields on records", () => {
    const catalog: MusicCatalogRecord[] = [];
    const created = createMusicCatalogRecord({
      catalog,
      body: baseBody({ secondaryElements: ["金", "水"] }),
      nowIso: NOW,
      newId: "id-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    assertNoRanking(created.record);
    expect(created.record).not.toHaveProperty("winner");
    expect(created.record).not.toHaveProperty("score");
    expect(created.record).not.toHaveProperty("rank");
  });
});
