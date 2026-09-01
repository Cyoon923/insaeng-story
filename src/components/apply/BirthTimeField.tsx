"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * 태어난 시간 한 칸(시 또는 분).
 * 입력칸은 그냥 숫자 입력이고, 오른쪽 ▼ 버튼을 눌렀을 때만 목록이 열린다.
 */
export function BirthTimeField({
  label,
  value,
  onChange,
  max,
  options,
  placeholder,
  disabled = false,
  inputClass,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  max: number;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  inputClass: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const handleInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (!digits) {
      onChange("");
      return;
    }
    // 범위를 넘으면 직전 값을 지켜 24, 60 같은 값이 남지 않게 한다.
    if (Number(digits) > max) return;
    onChange(digits);
  };

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        className={`${inputClass} pr-11`}
      />
      <button
        type="button"
        aria-label={`${label} 목록 열기`}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-[#6B6570] disabled:opacity-40"
      >
        <ChevronDown className="h-5 w-5" />
      </button>

      {open && !disabled ? (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-xl border border-[#e8dfd4] bg-white py-1 shadow-lg">
          {options.map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className={`flex h-11 w-full items-center px-4 text-[16px] ${
                  value === item ? "bg-[#F7F6F8] font-bold text-[#403A49]" : "text-[#3d2b1f]"
                }`}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
