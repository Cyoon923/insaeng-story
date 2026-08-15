"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";

type AuthChannel = "phone" | "email";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]";

export default function LoginPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<AuthChannel>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchChannel = (next: AuthChannel) => {
    setChannel(next);
    setCode("");
    setSentCode("");
    setError("");
  };

  const sendCode = async () => {
    setError("");
    setLoading(true);
    try {
      const payload =
        channel === "phone"
          ? { action: "sendCode", channel: "phone", phone }
          : { action: "sendCode", channel: "email", email };
      const result = await postApp(payload);
      setSentCode(result.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호를 보내지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setError("");
    setLoading(true);
    try {
      const payload =
        channel === "phone"
          ? { action: "login", channel: "phone", phone, code }
          : { action: "login", channel: "email", email, code };
      await postApp(payload);
      router.push("/my");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const kakao = async () => {
    setError("");
    setLoading(true);
    try {
      await postApp({ action: "kakao", phone });
      router.push("/my");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "카카오 로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const naver = async () => {
    setError("");
    setLoading(true);
    try {
      await postApp({ action: "naver", phone });
      router.push("/my");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "네이버 로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <AppHeader variant="page" title="로그인" backHref="/" showActions={false} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold leading-snug text-[#3d2b1f]">
          인생스토리에
          <br />
          오신 것을 환영합니다
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#8b6f5c]">
          {channel === "phone"
            ? "연락처로 로그인하면 주문과 상담 진행을 확인할 수 있습니다."
            : "해외 거주자는 이메일로도 로그인할 수 있습니다."}
        </p>
      </section>

      <div className="space-y-5 px-4 pb-8">
        <div className="flex rounded-xl bg-[#f5efe6] p-1">
          <button
            type="button"
            onClick={() => switchChannel("phone")}
            className={`h-11 flex-1 rounded-lg text-[14px] font-semibold ${
              channel === "phone" ? "bg-white text-[#3d2b1f] shadow-sm" : "text-[#8b6f5c]"
            }`}
          >
            연락처
          </button>
          <button
            type="button"
            onClick={() => switchChannel("email")}
            className={`h-11 flex-1 rounded-lg text-[14px] font-semibold ${
              channel === "email" ? "bg-white text-[#3d2b1f] shadow-sm" : "text-[#8b6f5c]"
            }`}
          >
            이메일
          </button>
        </div>

        {channel === "phone" ? (
          <div>
            <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
              연락처 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="예) 010-1234-5678"
                className={inputClass}
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={loading}
                className="h-12 shrink-0 rounded-xl bg-[#5c3d2e] px-4 text-[14px] font-semibold text-white disabled:opacity-40"
              >
                인증번호
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
              이메일 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="예) name@email.com"
                className={inputClass}
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={loading}
                className="h-12 shrink-0 rounded-xl bg-[#5c3d2e] px-4 text-[14px] font-semibold text-white disabled:opacity-40"
              >
                인증번호
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            인증번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="숫자 6자리"
            className={inputClass}
          />
          {sentCode ? (
            <p className="mt-2 text-[13px] text-[#5c3d2e]">
              인증번호 {sentCode} 를 입력해 주세요.
              {channel === "email" ? " (데모: 실제 이메일은 발송되지 않습니다)" : null}
            </p>
          ) : null}
        </div>

        {error ? <p className="text-[14px] text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={login}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center rounded-lg bg-[#5c3d2e] text-[16px] font-bold text-white disabled:opacity-40"
        >
          로그인
        </button>

        {channel === "phone" ? (
          <>
            <button
              type="button"
              onClick={kakao}
              disabled={loading}
              className="flex h-14 w-full items-center justify-center rounded-full bg-[#fee500] text-[16px] font-semibold text-[#3d2b1f] disabled:opacity-40"
            >
              카카오톡으로 시작하기
            </button>

            <button
              type="button"
              onClick={naver}
              disabled={loading}
              className="flex h-14 w-full items-center justify-center rounded-full bg-[#03c75a] text-[16px] font-semibold text-white disabled:opacity-40"
            >
              네이버 시작하기
            </button>
            <p className="text-center text-[12px] leading-relaxed text-[#8b6f5c]">
              문자 발송 대신 화면에 인증번호를 보여 드립니다. 카카오·네이버는 연락처만 있으면 바로 시작할 수
              있습니다.
            </p>
          </>
        ) : (
          <p className="text-center text-[12px] leading-relaxed text-[#8b6f5c]">
            이메일 발송 대신 화면에 인증번호를 보여 드립니다.
          </p>
        )}

        <p className="text-center text-[14px] text-[#8b6f5c]">
          아직 회원이 아니신가요?{" "}
          <Link href="/signup" className="font-semibold text-[#5c3d2e] underline underline-offset-2">
            회원가입
          </Link>
        </p>
      </div>
    </MobileShell>
  );
}
