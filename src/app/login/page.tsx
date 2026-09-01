"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";

/**
 * 로그인은 휴대폰 번호 + 비밀번호로 진행한다.
 * SMS 인증은 회원가입(/signup)과 아래 비밀번호 재설정에서만 사용한다.
 */
type Mode = "login" | "reset";
type ResetStep = "phone" | "code" | "password" | "done";

const inputClass =
  "h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#403A49]";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [resetStep, setResetStep] = useState<ResetStep>("phone");
  const [resetPhone, setResetPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const openReset = () => {
    setMode("reset");
    setResetStep("phone");
    setResetPhone(phone);
    setCode("");
    setSentCode("");
    setResetToken("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setError("");
  };

  const backToLogin = () => {
    setMode("login");
    setError("");
  };

  const login = async () => {
    setError("");
    setLoading(true);
    try {
      await postApp({ action: "passwordLogin", phone, password });
      router.push("/my");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const sendResetCode = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await postApp({ action: "sendCode", channel: "phone", phone: resetPhone });
      setSentCode(result.code);
      setResetStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호를 보내지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verifyResetCode = async () => {
    setError("");
    // 뒤로 왔다가 다시 진행하는 경우: 이미 받은 토큰을 그대로 쓴다.
    if (resetToken) {
      setResetStep("password");
      return;
    }
    setLoading(true);
    try {
      const result = await postApp({
        action: "verifyCode",
        purpose: "reset",
        phone: resetPhone,
        code,
      });
      setResetToken(result.resetToken);
      setResetStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async () => {
    setError("");
    if (newPassword.length < 6) {
      setError("비밀번호는 6자 이상으로 입력해 주세요.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("비밀번호가 서로 다릅니다.");
      return;
    }
    setLoading(true);
    try {
      await postApp({
        action: "resetPassword",
        phone: resetPhone,
        resetToken,
        password: newPassword,
      });
      setResetStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "비밀번호를 바꾸지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 비밀번호 찾기 뒤로가기: 직전 단계로만 이동하고 입력값은 유지한다.
  const goBackReset = () => {
    setError("");
    if (resetStep === "done") {
      setResetStep("password");
      return;
    }
    if (resetStep === "password") {
      setResetStep("code");
      return;
    }
    if (resetStep === "code") {
      setResetStep("phone");
      return;
    }
    backToLogin();
  };

  const social = (name: string) => {
    setError(`${name} 로그인은 연결 준비 중입니다. 지금은 연락처로 로그인해 주세요.`);
  };

  if (mode === "reset") {
    return (
      <MobileShell bgClass="bg-[#FFFFFF]">
        <AppHeader variant="page" title="비밀번호 찾기" showActions={false} onBack={goBackReset} />

        {resetStep === "done" ? (
          <section className="px-4 py-10 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#403A49] text-[36px] text-white">
              ✓
            </div>
            <h2 className="mt-6 font-serif text-[24px] font-bold text-[#403A49]">
              비밀번호를 바꿨습니다
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
              새 비밀번호로 로그인해 주세요.
            </p>
            <button
              type="button"
              onClick={backToLogin}
              className="mt-8 flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white"
            >
              로그인하러 가기
            </button>
          </section>
        ) : (
          <>
            <section className="px-4 pb-2 pt-6">
              <h2 className="font-serif text-[24px] font-bold leading-snug text-[#403A49]">
                {resetStep === "phone"
                  ? "휴대폰 인증이 필요합니다"
                  : resetStep === "code"
                    ? "인증번호를 입력해 주세요"
                    : "새 비밀번호를 정해주세요"}
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
                {resetStep === "phone"
                  ? "가입하신 번호로 인증번호를 보내드립니다."
                  : resetStep === "code"
                    ? `${resetPhone} 로 보낸 인증번호를 입력해 주세요.`
                    : `${resetPhone} 계정의 비밀번호를 새로 정합니다.`}
              </p>
            </section>

            <div className="space-y-5 px-4 pb-8">
              {resetStep === "phone" ? (
                <>
                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
                      휴대폰 번호 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={resetPhone}
                        onChange={(e) => setResetPhone(e.target.value)}
                        placeholder="예) 010-1234-5678"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={sendResetCode}
                        disabled={loading}
                        className="h-14 shrink-0 rounded-xl bg-[#403A49] px-4 text-[15px] font-semibold text-white disabled:opacity-40"
                      >
                        인증번호
                      </button>
                    </div>
                  </div>

                  {error ? <p className="text-[15px] text-red-600">{error}</p> : null}
                </>
              ) : resetStep === "code" ? (
                <>
                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
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
                      <p className="mt-2 text-[14px] text-[#403A49]">
                        인증번호 {sentCode} 를 입력해 주세요.
                      </p>
                    ) : null}
                  </div>

                  {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

                  <button
                    type="button"
                    onClick={verifyResetCode}
                    disabled={loading}
                    className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
                  >
                    인증하고 계속하기
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
                      새 비밀번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="6자 이상"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
                      새 비밀번호 확인 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="한 번 더 입력해 주세요"
                      className={inputClass}
                    />
                  </div>

                  {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

                  <button
                    type="button"
                    onClick={submitNewPassword}
                    disabled={loading}
                    className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
                  >
                    비밀번호 바꾸기
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={goBackReset}
                className="flex h-14 w-full items-center justify-center rounded-xl border border-[#403A49] bg-[#FFFFFF] text-[16px] font-semibold text-[#403A49]"
              >
                {resetStep === "phone" ? "로그인으로 돌아가기" : "이전"}
              </button>
            </div>
          </>
        )}
      </MobileShell>
    );
  }

  return (
    <MobileShell bgClass="bg-[#FFFFFF]">
      <AppHeader variant="page" title="로그인" backHref="/" showActions={false} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold leading-snug text-[#403A49]">
          사주로그에
          <br />
          오신 것을 환영합니다
        </h2>
        <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
          휴대폰 번호와 비밀번호로 로그인해 주세요.
        </p>
      </section>

      <div className="space-y-5 px-4 pb-8">
        <div>
          <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            휴대폰 번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="예) 010-1234-5678"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            비밀번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력해 주세요"
            className={inputClass}
          />
        </div>

        {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={login}
          disabled={loading}
          className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
        >
          로그인
        </button>

        <div className="flex items-center justify-center gap-4 text-[16px]">
          <button
            type="button"
            onClick={openReset}
            className="font-semibold text-[#6B6570] underline underline-offset-4"
          >
            비밀번호 찾기
          </button>
          <span className="text-[#e8dfd4]">|</span>
          <Link
            href="/signup"
            className="font-semibold text-[#403A49] underline underline-offset-4"
          >
            회원가입
          </Link>
        </div>

        <div className="h-px bg-[#F7F6F8]" />

        <button
          type="button"
          onClick={() => social("카카오")}
          disabled={loading}
          className="flex h-16 w-full items-center justify-center rounded-full bg-[#fee500] text-[17px] font-semibold text-[#3d2b1f] disabled:opacity-40"
        >
          카카오톡으로 시작하기
        </button>

        <button
          type="button"
          onClick={() => social("네이버")}
          disabled={loading}
          className="flex h-16 w-full items-center justify-center rounded-full bg-[#03c75a] text-[17px] font-semibold text-white disabled:opacity-40"
        >
          네이버 시작하기
        </button>

        <p className="text-center text-[13px] leading-relaxed text-[#6B6570]">
          카카오·네이버 간편 로그인은 연결 준비 중입니다.
        </p>
      </div>
    </MobileShell>
  );
}
