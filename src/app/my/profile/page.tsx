"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe, postApp } from "@/lib/client/api";
import type { User } from "@/lib/types/app";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#403A49]";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [birth, setBirth] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [unknownTime, setUnknownTime] = useState(false);
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [bloodType, setBloodType] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      const next = (data.user ?? null) as User | null;
      setUser(next);
      if (next) {
        setName(next.name);
        setPhone(next.phone);
        setGender(next.gender);
        setBirth(next.birth);
        const [h = "", m = ""] = next.birthTime.split(":");
        setHour(h);
        setMinute(m);
        setUnknownTime(next.unknownTime);
        setCalendar(next.calendar);
        setBloodType(next.bloodType);
      }
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    setError("");
    setSaved(false);
    try {
      await postApp({
        action: "updateProfile",
        profile: {
          name,
          phone,
          gender,
          birth,
          birthTime: unknownTime ? "" : `${hour}:${minute}`,
          unknownTime,
          calendar,
          bloodType,
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    }
  };

  return (
    <MobileShell>
      <AppHeader variant="page" title="개인정보 관리" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">개인정보 관리</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          상담과 제작에 필요한 기본 정보를 관리하세요.
        </p>
      </section>

      {loaded && !user ? (
        <div className="px-4 pb-8 text-center">
          <p className="text-[15px] text-[#6B6570]">로그인하면 개인정보를 관리할 수 있습니다.</p>
          <Link
            href="/login"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
          >
            로그인하기
          </Link>
        </div>
      ) : (
        <div className="space-y-5 px-4 pb-8">
          <div>
            <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">이름</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">연락처</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">성별</label>
            <div className="grid grid-cols-2 gap-3">
              <Toggle active={gender === "male"} onClick={() => setGender("male")} label="남성" />
              <Toggle active={gender === "female"} onClick={() => setGender("female")} label="여성" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">생년월일</label>
            <input
              type="text"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              placeholder="예) 1990-01-01"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">태어난 시간</label>
            <div className="grid grid-cols-2 gap-3">
              <select
                className={inputClass}
                disabled={unknownTime}
                value={hour ? `${hour}시` : ""}
                onChange={(e) => setHour(e.target.value.replace("시", ""))}
              >
                <option value="">시 선택</option>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i}>{`${i}시`}</option>
                ))}
              </select>
              <select
                className={inputClass}
                disabled={unknownTime}
                value={minute ? `${minute}분` : ""}
                onChange={(e) => setMinute(e.target.value.replace("분", ""))}
              >
                <option value="">분 선택</option>
                {["00", "10", "20", "30", "40", "50"].map((m) => (
                  <option key={m}>{`${m}분`}</option>
                ))}
              </select>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[14px] text-[#3d2b1f]">
              <input
                type="checkbox"
                checked={unknownTime}
                onChange={(e) => setUnknownTime(e.target.checked)}
                className="h-5 w-5 accent-[#403A49]"
              />
              태어난 시간을 몰라요
            </label>
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">양력 / 음력</label>
            <div className="grid grid-cols-2 gap-3">
              <Toggle active={calendar === "solar"} onClick={() => setCalendar("solar")} label="양력" />
              <Toggle active={calendar === "lunar"} onClick={() => setCalendar("lunar")} label="음력" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">혈액형</label>
            <select className={inputClass} value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
              <option value="">선택해주세요</option>
              {["A형", "B형", "O형", "AB형"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          {error ? <p className="text-center text-[14px] text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={save}
            className="flex h-14 w-full items-center justify-center rounded-lg bg-[#403A49] text-[16px] font-bold text-white"
          >
            저장하기
          </button>
          {saved ? <p className="text-center text-[14px] text-[#403A49]">저장되었습니다.</p> : null}
        </div>
      )}
    </MobileShell>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-xl text-[15px] font-semibold ${
        active ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"
      }`}
    >
      {label}
    </button>
  );
}
