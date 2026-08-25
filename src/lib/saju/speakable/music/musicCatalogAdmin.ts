import { ELEMENTS, type Element } from "@/lib/saju/types";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";

export type MusicCatalogAdminError = {
  ok: false;
  error: string;
  status: 400 | 404 | 409;
};

export type MusicCatalogWriteInput = {
  id?: string;
  title?: unknown;
  youtubeUrl?: unknown;
  thumbnailUrl?: unknown;
  primaryElement?: unknown;
  secondaryElements?: unknown;
  moodTags?: unknown;
  situationTags?: unknown;
  energyTags?: unknown;
  message?: unknown;
  lyricKeywords?: unknown;
  active?: unknown;
};

function isElement(value: unknown): value is Element {
  return typeof value === "string" && (ELEMENTS as readonly string[]).includes(value);
}

function asStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asElementArray(value: unknown): { ok: true; value: Element[] } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "secondaryElements는 배열이어야 합니다." };
  }
  const out: Element[] = [];
  for (const item of value) {
    if (!isElement(item)) {
      return { ok: false, error: "secondaryElements는 木火土金水만 허용합니다." };
    }
    if (!out.includes(item)) out.push(item);
  }
  return { ok: true, value: out };
}

function requiredTrimmed(value: unknown, label: string): { ok: true; value: string } | { ok: false; error: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, error: `${label}은(는) 필수입니다.` };
  return { ok: true, value: text };
}

function parseCoreFields(
  input: MusicCatalogWriteInput,
):
  | {
      ok: true;
      title: string;
      youtubeUrl: string;
      thumbnailUrl?: string;
      primaryElement: Element;
      secondaryElements: Element[];
      moodTags: string[];
      situationTags: string[];
      energyTags: string[];
      message: string;
      lyricKeywords: string[];
      active: boolean;
    }
  | { ok: false; error: string } {
  const title = requiredTrimmed(input.title, "title");
  if (!title.ok) return title;
  const youtubeUrl = requiredTrimmed(input.youtubeUrl, "youtubeUrl");
  if (!youtubeUrl.ok) return youtubeUrl;
  const message = requiredTrimmed(input.message, "message");
  if (!message.ok) return message;

  if (!isElement(input.primaryElement)) {
    return { ok: false, error: "primaryElement는 木火土金水만 허용합니다." };
  }

  const secondary = asElementArray(input.secondaryElements);
  if (!secondary.ok) return secondary;

  const thumbnailRaw =
    typeof input.thumbnailUrl === "string" ? input.thumbnailUrl.trim() : "";

  return {
    ok: true,
    title: title.value,
    youtubeUrl: youtubeUrl.value,
    ...(thumbnailRaw ? { thumbnailUrl: thumbnailRaw } : {}),
    primaryElement: input.primaryElement,
    secondaryElements: secondary.value,
    moodTags: asStringArray(input.moodTags),
    situationTags: asStringArray(input.situationTags),
    energyTags: asStringArray(input.energyTags),
    message: message.value,
    lyricKeywords: asStringArray(input.lyricKeywords),
    active: input.active === undefined ? true : Boolean(input.active),
  };
}

export function createMusicCatalogRecord(input: {
  catalog: MusicCatalogRecord[];
  body: MusicCatalogWriteInput;
  nowIso: string;
  newId: string;
}): { ok: true; record: MusicCatalogRecord; catalog: MusicCatalogRecord[] } | MusicCatalogAdminError {
  const id = typeof input.body.id === "string" && input.body.id.trim()
    ? input.body.id.trim()
    : input.newId;

  if (input.catalog.some((item) => item.id === id)) {
    return { ok: false, error: "이미 존재하는 id입니다.", status: 409 };
  }

  const parsed = parseCoreFields(input.body);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const record: MusicCatalogRecord = {
    id,
    title: parsed.title,
    youtubeUrl: parsed.youtubeUrl,
    ...(parsed.thumbnailUrl ? { thumbnailUrl: parsed.thumbnailUrl } : {}),
    primaryElement: parsed.primaryElement,
    secondaryElements: parsed.secondaryElements,
    moodTags: parsed.moodTags,
    situationTags: parsed.situationTags,
    energyTags: parsed.energyTags,
    message: parsed.message,
    lyricKeywords: parsed.lyricKeywords,
    active: parsed.active,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  };

  return { ok: true, record, catalog: [...input.catalog, record] };
}

export function updateMusicCatalogRecord(input: {
  catalog: MusicCatalogRecord[];
  id: string;
  body: MusicCatalogWriteInput;
  nowIso: string;
}): { ok: true; record: MusicCatalogRecord; catalog: MusicCatalogRecord[] } | MusicCatalogAdminError {
  const index = input.catalog.findIndex((item) => item.id === input.id);
  if (index < 0) {
    return { ok: false, error: "항목을 찾을 수 없습니다.", status: 404 };
  }

  const current = input.catalog[index]!;
  const parsed = parseCoreFields({
    title: input.body.title ?? current.title,
    youtubeUrl: input.body.youtubeUrl ?? current.youtubeUrl,
    thumbnailUrl:
      input.body.thumbnailUrl !== undefined ? input.body.thumbnailUrl : current.thumbnailUrl,
    primaryElement: input.body.primaryElement ?? current.primaryElement,
    secondaryElements:
      input.body.secondaryElements !== undefined
        ? input.body.secondaryElements
        : current.secondaryElements,
    moodTags: input.body.moodTags !== undefined ? input.body.moodTags : current.moodTags,
    situationTags:
      input.body.situationTags !== undefined ? input.body.situationTags : current.situationTags,
    energyTags: input.body.energyTags !== undefined ? input.body.energyTags : current.energyTags,
    message: input.body.message ?? current.message,
    lyricKeywords:
      input.body.lyricKeywords !== undefined ? input.body.lyricKeywords : current.lyricKeywords,
    active: input.body.active !== undefined ? input.body.active : current.active,
  });
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const record: MusicCatalogRecord = {
    id: current.id,
    title: parsed.title,
    youtubeUrl: parsed.youtubeUrl,
    ...(parsed.thumbnailUrl ? { thumbnailUrl: parsed.thumbnailUrl } : {}),
    primaryElement: parsed.primaryElement,
    secondaryElements: parsed.secondaryElements,
    moodTags: parsed.moodTags,
    situationTags: parsed.situationTags,
    energyTags: parsed.energyTags,
    message: parsed.message,
    lyricKeywords: parsed.lyricKeywords,
    active: parsed.active,
    createdAt: current.createdAt,
    updatedAt: input.nowIso,
  };

  const catalog = [...input.catalog];
  catalog[index] = record;
  return { ok: true, record, catalog };
}

export function setMusicCatalogActive(input: {
  catalog: MusicCatalogRecord[];
  id: string;
  active: boolean;
  nowIso: string;
}): { ok: true; record: MusicCatalogRecord; catalog: MusicCatalogRecord[] } | MusicCatalogAdminError {
  const index = input.catalog.findIndex((item) => item.id === input.id);
  if (index < 0) {
    return { ok: false, error: "항목을 찾을 수 없습니다.", status: 404 };
  }

  const current = input.catalog[index]!;
  const record: MusicCatalogRecord = {
    ...current,
    active: input.active,
    updatedAt: input.nowIso,
  };
  const catalog = [...input.catalog];
  catalog[index] = record;
  return { ok: true, record, catalog };
}

export function deleteMusicCatalogRecord(input: {
  catalog: MusicCatalogRecord[];
  id: string;
}): { ok: true; catalog: MusicCatalogRecord[] } | MusicCatalogAdminError {
  if (!input.catalog.some((item) => item.id === input.id)) {
    return { ok: false, error: "항목을 찾을 수 없습니다.", status: 404 };
  }
  return {
    ok: true,
    catalog: input.catalog.filter((item) => item.id !== input.id),
  };
}
