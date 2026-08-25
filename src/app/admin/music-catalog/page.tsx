"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import type { MusicCatalogRecord } from "@/lib/saju/speakable/music/catalogTypes";
import { ELEMENTS, type Element } from "@/lib/saju/types";

type FormState = {
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  primaryElement: Element;
  secondaryElements: Element[];
  moodTags: string[];
  situationTags: string[];
  energyTags: string[];
  message: string;
  lyricKeywords: string[];
  active: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  youtubeUrl: "",
  thumbnailUrl: "",
  primaryElement: "木",
  secondaryElements: [],
  moodTags: [],
  situationTags: [],
  energyTags: [],
  message: "",
  lyricKeywords: [],
  active: true,
};

function recordToForm(record: MusicCatalogRecord): FormState {
  return {
    title: record.title,
    youtubeUrl: record.youtubeUrl,
    thumbnailUrl: record.thumbnailUrl ?? "",
    primaryElement: record.primaryElement,
    secondaryElements: [...record.secondaryElements],
    moodTags: [...record.moodTags],
    situationTags: [...record.situationTags],
    energyTags: [...record.energyTags],
    message: record.message,
    lyricKeywords: [...record.lyricKeywords],
    active: record.active,
  };
}

function parseChipInput(raw: string): string[] {
  return raw
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ChipField(props: {
  id: string;
  label: string;
  values: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const added = parseChipInput(draft);
    if (!added.length) return;
    const merged = [...props.values];
    for (const item of added) {
      if (!merged.includes(item)) merged.push(item);
    }
    props.onChange(merged);
    setDraft("");
  }

  return (
    <div>
      <label htmlFor={props.id} className="mb-2 block text-[14px] font-semibold text-[#3d2b1f]">
        {props.label}
      </label>
      <div className="flex flex-wrap gap-2">
        {props.values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onChange(props.values.filter((item) => item !== value))}
            className="inline-flex h-9 items-center rounded-full border border-[#d4c8ba] bg-white px-3 text-[13px] text-[#5c3d2e]"
          >
            {value} ×
          </button>
        ))}
      </div>
      <input
        id={props.id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commitDraft();
          }
        }}
        onBlur={commitDraft}
        className="mt-2 h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
        placeholder={props.placeholder}
      />
      <p className="mt-1 text-[12px] text-[#8b6f5c]">쉼표 또는 Enter로 추가 · 칩을 누르면 삭제</p>
    </div>
  );
}

export default function AdminMusicCatalogPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [items, setItems] = useState<MusicCatalogRecord[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/admin/music-catalog", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return false;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(String(data.error ?? "목록을 불러오지 못했습니다."));
      setLoading(false);
      return false;
    }
    setItems((data.items ?? []) as MusicCatalogRecord[]);
    setAuthed(true);
    setLoading(false);
    return true;
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginError(String(data.error ?? "로그인에 실패했습니다."));
      return;
    }
    setPassword("");
    setLoading(true);
    await loadItems();
  }

  async function handleLogout() {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setAuthed(false);
    setItems([]);
    resetForm();
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(record: MusicCatalogRecord) {
    setEditingId(record.id);
    setForm(recordToForm(record));
    setFeedback("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleSecondary(element: Element) {
    setForm((prev) => {
      const exists = prev.secondaryElements.includes(element);
      return {
        ...prev,
        secondaryElements: exists
          ? prev.secondaryElements.filter((item) => item !== element)
          : [...prev.secondaryElements, element],
      };
    });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    setError("");

    const payload = {
      title: form.title.trim(),
      youtubeUrl: form.youtubeUrl.trim(),
      thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      primaryElement: form.primaryElement,
      secondaryElements: form.secondaryElements,
      moodTags: form.moodTags,
      situationTags: form.situationTags,
      energyTags: form.energyTags,
      message: form.message.trim(),
      lyricKeywords: form.lyricKeywords,
      active: form.active,
    };

    const res = await fetch("/api/admin/music-catalog", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(String(data.error ?? "저장에 실패했습니다."));
      return;
    }

    const next = data.item as MusicCatalogRecord;
    setItems((list) => {
      const index = list.findIndex((item) => item.id === next.id);
      if (index < 0) return [next, ...list];
      const copy = [...list];
      copy[index] = next;
      return copy;
    });
    setFeedback(editingId ? "수정했습니다." : "등록했습니다.");
    resetForm();
  }

  async function handleToggleActive(record: MusicCatalogRecord) {
    setFeedback("");
    setError("");
    const res = await fetch("/api/admin/music-catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: record.id,
        action: "setActive",
        active: !record.active,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(String(data.error ?? "상태 변경에 실패했습니다."));
      return;
    }
    const next = data.item as MusicCatalogRecord;
    setItems((list) => list.map((item) => (item.id === next.id ? next : item)));
    setFeedback(next.active ? "활성화했습니다." : "비활성화했습니다.");
  }

  async function handleDelete(record: MusicCatalogRecord) {
    if (!window.confirm(`「${record.title}」을(를) 삭제할까요?`)) return;
    setFeedback("");
    setError("");
    const res = await fetch("/api/admin/music-catalog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: record.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(String(data.error ?? "삭제에 실패했습니다."));
      return;
    }
    setItems((list) => list.filter((item) => item.id !== record.id));
    if (editingId === record.id) resetForm();
    setFeedback("삭제했습니다.");
  }

  if (loading) {
    return (
      <MobileShell hideBottomNav>
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-[15px] text-[#8b6f5c]">
          불러오는 중...
        </div>
      </MobileShell>
    );
  }

  if (!authed) {
    return (
      <MobileShell hideBottomNav>
        <div className="px-4 py-8">
          <h1 className="font-serif text-[26px] font-bold text-[#3d2b1f]">음악 카탈로그</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
            운율 추천용 곡을 등록하려면 관리자 로그인이 필요합니다.
          </p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label htmlFor="music-admin-password" className="mb-2 block text-[14px] font-semibold text-[#3d2b1f]">
                관리자 비밀번호
              </label>
              <input
                id="music-admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
                placeholder="비밀번호 입력"
                autoComplete="current-password"
              />
            </div>
            {loginError ? <p className="text-[14px] text-[#b42318]">{loginError}</p> : null}
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#5c3d2e] text-[15px] font-semibold text-white"
            >
              로그인
            </button>
          </form>
          <Link href="/admin" className="mt-6 block text-center text-[14px] font-medium text-[#5c3d2e] underline">
            관리자 홈으로
          </Link>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell hideBottomNav>
      <header className="sticky top-0 z-40 border-b border-[#ebe3d8] bg-[#fffdf9]/95 px-4 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold text-[#3d2b1f]">음악 카탈로그</h1>
            <p className="text-[12px] text-[#8b6f5c]">운율 추천용 곡 관리 · {items.length}곡</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin"
              className="inline-flex h-10 items-center rounded-full border border-[#d4c8ba] px-3 text-[13px] font-medium text-[#5c3d2e]"
            >
              관리자
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="h-10 rounded-full border border-[#d4c8ba] px-4 text-[13px] font-medium text-[#5c3d2e]"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 py-5">
        {feedback ? (
          <p className="rounded-xl bg-[#eef6ee] px-4 py-3 text-[14px] font-medium text-[#2f6b3a]">{feedback}</p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-[#fdecec] px-4 py-3 text-[14px] font-medium text-[#b42318]">{error}</p>
        ) : null}

        <form onSubmit={handleSave} className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-bold text-[#3d2b1f]">
              {editingId ? "곡 수정" : "곡 등록"}
            </h2>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="h-9 rounded-full border border-[#d4c8ba] px-3 text-[13px] font-medium text-[#5c3d2e]"
              >
                새로 등록
              </button>
            ) : null}
          </div>
          <p className="text-[12px] text-[#8b6f5c]">
            대표 오행은 관리 메타입니다. 추천 1등·용신으로 쓰이지 않습니다.
          </p>

          <div>
            <label htmlFor="music-title" className="mb-2 block text-[14px] font-semibold text-[#3d2b1f]">
              제목
            </label>
            <input
              id="music-title"
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
            />
          </div>

          <div>
            <label htmlFor="music-youtube" className="mb-2 block text-[14px] font-semibold text-[#3d2b1f]">
              YouTube URL
            </label>
            <input
              id="music-youtube"
              required
              type="url"
              value={form.youtubeUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, youtubeUrl: event.target.value }))}
              className="h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>

          <div>
            <label htmlFor="music-thumb" className="mb-2 block text-[14px] font-semibold text-[#3d2b1f]">
              썸네일 URL <span className="font-normal text-[#8b6f5c]">(선택)</span>
            </label>
            <input
              id="music-thumb"
              type="url"
              value={form.thumbnailUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, thumbnailUrl: event.target.value }))}
              className="h-12 w-full rounded-xl border border-[#d4c8ba] bg-white px-4 text-[16px] text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-[14px] font-semibold text-[#3d2b1f]">대표 오행</legend>
            <div className="grid grid-cols-5 gap-2">
              {ELEMENTS.map((element) => {
                const selected = form.primaryElement === element;
                return (
                  <button
                    key={element}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, primaryElement: element }))}
                    className={`h-11 rounded-xl text-[15px] font-semibold ${
                      selected ? "bg-[#5c3d2e] text-white" : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                    }`}
                  >
                    {element}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[14px] font-semibold text-[#3d2b1f]">보조 오행</legend>
            <div className="grid grid-cols-5 gap-2">
              {ELEMENTS.map((element) => {
                const selected = form.secondaryElements.includes(element);
                return (
                  <button
                    key={element}
                    type="button"
                    onClick={() => toggleSecondary(element)}
                    className={`h-11 rounded-xl text-[15px] font-semibold ${
                      selected ? "bg-[#5c3d2e] text-white" : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                    }`}
                  >
                    {element}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <ChipField
            id="music-moods"
            label="분위기 태그"
            values={form.moodTags}
            placeholder="예: 따뜻한, 잔잔한"
            onChange={(moodTags) => setForm((prev) => ({ ...prev, moodTags }))}
          />
          <ChipField
            id="music-situations"
            label="상황 태그"
            values={form.situationTags}
            placeholder="예: 응원, 가족, 이별"
            onChange={(situationTags) => setForm((prev) => ({ ...prev, situationTags }))}
          />
          <ChipField
            id="music-energy"
            label="에너지 태그"
            values={form.energyTags}
            placeholder="예: 힘있는, 부드러운"
            onChange={(energyTags) => setForm((prev) => ({ ...prev, energyTags }))}
          />
          <ChipField
            id="music-lyrics"
            label="가사 키워드"
            values={form.lyricKeywords}
            placeholder="예: 기대, 하루"
            onChange={(lyricKeywords) => setForm((prev) => ({ ...prev, lyricKeywords }))}
          />

          <div>
            <label htmlFor="music-message" className="mb-2 block text-[14px] font-semibold text-[#3d2b1f]">
              메시지
            </label>
            <textarea
              id="music-message"
              required
              rows={4}
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              className="w-full rounded-xl border border-[#d4c8ba] bg-white px-4 py-3 text-[16px] leading-relaxed text-[#3d2b1f] outline-none focus:border-[#5c3d2e]"
            />
          </div>

          <label className="flex h-12 items-center gap-3 rounded-xl border border-[#d4c8ba] bg-white px-4 text-[15px] text-[#3d2b1f]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              className="h-5 w-5 accent-[#5c3d2e]"
            />
            추천 후보로 활성
          </label>

          <button
            type="submit"
            disabled={saving}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#5c3d2e] text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? "저장 중..." : editingId ? "수정 저장" : "등록하기"}
          </button>
        </form>

        <section className="space-y-3">
          <h2 className="text-[16px] font-bold text-[#3d2b1f]">등록된 곡</h2>
          {items.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-[14px] text-[#8b6f5c] ring-1 ring-[#ebe3d8]">
              아직 등록된 곡이 없습니다.
            </p>
          ) : null}
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[16px] font-bold text-[#3d2b1f]">{item.title}</p>
                  <p className="mt-1 text-[13px] text-[#5c3d2e]">
                    대표 {item.primaryElement}
                    {item.secondaryElements.length
                      ? ` · 보조 ${item.secondaryElements.join(" ")}`
                      : " · 보조 없음"}
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-[#8b6f5c]">
                    {item.active ? "활성" : "비활성"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="h-11 rounded-xl border border-[#d4c8ba] bg-white text-[13px] font-semibold text-[#5c3d2e]"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleActive(item)}
                  className="h-11 rounded-xl border border-[#d4c8ba] bg-white text-[13px] font-semibold text-[#5c3d2e]"
                >
                  {item.active ? "비활성" : "활성"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item)}
                  className="h-11 rounded-xl border border-[#e8b4b0] bg-[#fff7f6] text-[13px] font-semibold text-[#b42318]"
                >
                  삭제
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </MobileShell>
  );
}
