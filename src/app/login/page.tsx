"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";
import { LOGIN_DEFAULT_PATH, safeNextPath } from "@/lib/loginRedirect";

/**
 * 로그인은 아이디 + 비밀번호로 진행한다.
 * SMS 인증은 회원가입(/signup)과 아래 아이디 찾기·비밀번호 재설정·아이디 설정에서만 쓴다.
 */
type Mode = "login" | "reset" | "setId" | "findId";
type ResetStep = "phone" | "code" | "password" | "done";
/** 아이디 설정 단계. 비밀번호 찾기와 같은 모양으로 진행한다. */
type SetIdStep = "phone" | "code" | "loginId" | "done";
/** 아이디 찾기 단계. 입력받을 값이 없어 설정보다 한 단계 적다. */
type FindIdStep = "phone" | "code" | "done";

/** 아이디 형식. 서버(store.ts의 isValidLoginId) 및 회원가입 화면과 같은 규칙이다. */
const LOGIN_ID_RULE = /^[a-z][a-z0-9_]{3,19}$/;
const LOGIN_ID_HELP = "영문자로 시작하는 4~20자의 영문, 숫자, 밑줄(_)을 사용할 수 있습니다.";

/**
 * 이 브라우저에서 마지막에 고른 로그인 방식. 안내 표시에만 쓰고 서버로 보내지 않는다.
 * 로그아웃이나 탈퇴 때 지우지 않는다. 다음 방문에서 같은 방식을 알려주는 것이 목적이다.
 */
const RECENT_LOGIN_KEY = "sajulog_recent_login_method";
type RecentLoginMethod = "kakao" | "naver" | "password";

/** 저장소를 쓸 수 없는 브라우저(프라이빗 모드 등)에서도 로그인은 그대로 되어야 한다. */
function readRecentLogin(): RecentLoginMethod | null {
  try {
    const value = localStorage.getItem(RECENT_LOGIN_KEY);
    return value === "kakao" || value === "naver" || value === "password" ? value : null;
  } catch {
    return null;
  }
}

function saveRecentLogin(method: RecentLoginMethod) {
  try {
    localStorage.setItem(RECENT_LOGIN_KEY, method);
  } catch {
    // 저장하지 못해도 안내만 없을 뿐이라 그대로 진행한다.
  }
}

const inputClass =
  "h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#403A49]";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const [resetStep, setResetStep] = useState<ResetStep>("phone");
  const [resetPhone, setResetPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  // 운영에서는 인증번호를 받을 수 없으므로 발송 여부만 안내한다.
  const [codeSent, setCodeSent] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [findIdStep, setFindIdStep] = useState<FindIdStep>("phone");
  const [findIdPhone, setFindIdPhone] = useState("");
  const [foundLoginId, setFoundLoginId] = useState("");
  /** 아이디가 없는 기존 회원인지. 결과 화면에서 아이디 설정으로 보낸다. */
  const [findIdNeedsSetup, setFindIdNeedsSetup] = useState(false);

  const [setIdStep, setSetIdStep] = useState<SetIdStep>("phone");
  const [setIdPhone, setSetIdPhone] = useState("");
  const [loginIdToken, setLoginIdToken] = useState("");
  const [newLoginId, setNewLoginId] = useState("");

  const [error, setError] = useState("");
  const [recentLogin, setRecentLogin] = useState<RecentLoginMethod | null>(null);

  /**
   * 소셜 로그인 실패 시 callback이 /login?error=... 으로 되돌려 보낸다.
   * useSearchParams 대신 주소를 직접 읽어 Suspense 경계를 늘리지 않는다.
   */
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (!reason) return;
    const label = reason.startsWith("naver_") ? "네이버" : "카카오";
    // 최초 진입 시 1회만 실행되며 되돌아온 실패 사유를 그대로 보여준다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(
      reason.endsWith("_cancelled")
        ? `${label} 로그인을 취소했습니다.`
        : `${label} 로그인에 실패했습니다. 다시 시도해 주세요.`,
    );
    window.history.replaceState(null, "", "/login");
  }, []);
  const [loading, setLoading] = useState(false);
  /** 신청 화면에서 넘어온 경우의 복귀 주소. 없으면 빈 문자열이다. */
  const [nextPath, setNextPath] = useState("");

  useEffect(() => {
    const value = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    if (!value) return;
    // 주소에서 한 번만 읽어 둔다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNextPath(value);
  }, []);

  useEffect(() => {
    // localStorage는 브라우저에만 있으므로 마운트 후 한 번만 읽는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentLogin(readRecentLogin());
  }, []);

  const openReset = () => {
    setMode("reset");
    setResetStep("phone");
    setResetPhone("");
    setCode("");
    setSentCode("");
    setResetToken("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setError("");
  };

  const openFindId = () => {
    setMode("findId");
    setFindIdStep("phone");
    setFindIdPhone("");
    setCode("");
    setSentCode("");
    setCodeSent(false);
    setFoundLoginId("");
    setFindIdNeedsSetup(false);
    setError("");
  };

  const openSetId = () => {
    setMode("setId");
    setSetIdStep("phone");
    setSetIdPhone("");
    setCode("");
    setSentCode("");
    setCodeSent(false);
    setLoginIdToken("");
    setNewLoginId("");
    setError("");
  };

  const backToLogin = () => {
    setMode("login");
    setError("");
  };

  /** 회원가입으로 갈 때도 돌아갈 주소를 함께 넘겨 복귀 흐름을 잇는다. */
  const signupHref = nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup";

  /** 비밀번호 입력 후 Enter와 로그인 버튼이 같은 경로를 타게 한다. */
  const handleLoginSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // 진행 중에는 버튼이 잠기지만, Enter로 한 번 더 들어오는 경우를 막는다.
    if (loading) return;
    login();
  };

  const login = async () => {
    setError("");
    setLoading(true);
    try {
      await postApp({
        action: "passwordLogin",
        loginId: loginId.trim().toLowerCase(),
        password,
      });
      saveRecentLogin("password");
      // 신청 화면에서 넘어왔다면 그 자리로 되돌려 보낸다.
      router.push(nextPath || LOGIN_DEFAULT_PATH);
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
      const result = await postApp({ action: "sendCode", purpose: "reset", phone: resetPhone });
      setSentCode(result.devCode ?? "");
      setCodeSent(true);
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

  const sendFindIdCode = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await postApp({ action: "sendCode", purpose: "findid", phone: findIdPhone });
      setSentCode(result.devCode ?? "");
      setCodeSent(true);
      setFindIdStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호를 보내지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verifyFindIdCode = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await postApp({
        action: "verifyCode",
        purpose: "findid",
        phone: findIdPhone,
        code,
      });
      setFoundLoginId(result.loginId ?? "");
      setFindIdNeedsSetup(Boolean(result.needsSetup));
      setFindIdStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 아이디 찾기 뒤로가기: 직전 단계로만 이동하고 입력값은 유지한다.
  const goBackFindId = () => {
    setError("");
    if (findIdStep === "done") {
      setFindIdStep("code");
      return;
    }
    if (findIdStep === "code") {
      setFindIdStep("phone");
      return;
    }
    backToLogin();
  };

  const sendSetIdCode = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await postApp({ action: "sendCode", purpose: "setid", phone: setIdPhone });
      setSentCode(result.devCode ?? "");
      setCodeSent(true);
      setSetIdStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호를 보내지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verifySetIdCode = async () => {
    setError("");
    // 뒤로 왔다가 다시 진행하는 경우: 이미 받은 토큰을 그대로 쓴다.
    if (loginIdToken) {
      setSetIdStep("loginId");
      return;
    }
    setLoading(true);
    try {
      const result = await postApp({
        action: "verifyCode",
        purpose: "setid",
        phone: setIdPhone,
        code,
      });
      setLoginIdToken(result.loginIdToken);
      setSetIdStep("loginId");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const submitLoginId = async () => {
    setError("");
    const trimmedLoginId = newLoginId.trim().toLowerCase();
    if (!trimmedLoginId) {
      setError("아이디를 입력해 주세요.");
      return;
    }
    if (!LOGIN_ID_RULE.test(trimmedLoginId)) {
      setError("아이디는 영문자로 시작하는 4~20자의 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
      return;
    }
    setLoading(true);
    try {
      await postApp({
        action: "setLoginId",
        phone: setIdPhone,
        loginIdToken,
        loginId: trimmedLoginId,
      });
      setSetIdStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "아이디를 설정하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 아이디 설정 뒤로가기: 직전 단계로만 이동하고 입력값은 유지한다.
  const goBackSetId = () => {
    setError("");
    if (setIdStep === "done") {
      setSetIdStep("loginId");
      return;
    }
    if (setIdStep === "loginId") {
      setSetIdStep("code");
      return;
    }
    if (setIdStep === "code") {
      setSetIdStep("phone");
      return;
    }
    backToLogin();
  };

  const startKakao = () => {
    // 카카오 인가 화면(외부 도메인)으로 넘어가는 서버 리다이렉트라
    // 클라이언트 라우터가 아니라 문서 전체를 이동시켜야 한다.
    saveRecentLogin("kakao");
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/api/auth/kakao/start";
  };

  const startNaver = () => {
    // 네이버 인가 화면(외부 도메인)으로 넘어가는 서버 리다이렉트라
    // 클라이언트 라우터가 아니라 문서 전체를 이동시켜야 한다.
    saveRecentLogin("naver");
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/api/auth/naver/start";
  };

  if (mode === "findId") {
    return (
      <MobileShell bgClass="bg-[#FFFFFF]">
        <AppHeader variant="page" title="아이디 찾기" showActions={false} onBack={goBackFindId} />

        {findIdStep === "done" ? (
          <section className="px-4 py-10 text-center">
            {findIdNeedsSetup ? (
              <>
                <h2 className="font-serif text-[24px] font-bold text-[#403A49]">
                  아직 아이디를 설정하지 않으셨습니다
                </h2>
                <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
                  아이디를 새로 만들면 아이디와 비밀번호로 로그인할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={openSetId}
                  className="mt-8 flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white"
                >
                  아이디 설정하기
                </button>
              </>
            ) : (
              <>
                <h2 className="font-serif text-[24px] font-bold text-[#403A49]">
                  회원님의 아이디입니다
                </h2>
                <p className="mt-6 break-all rounded-2xl bg-[#f5efe6] px-4 py-6 text-[26px] font-bold text-[#403A49]">
                  {foundLoginId}
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-[#6B6570]">
                  이 화면은 다른 사람에게 보이지 않게 해주세요.
                </p>
                <button
                  type="button"
                  onClick={backToLogin}
                  className="mt-8 flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white"
                >
                  로그인하러 가기
                </button>
              </>
            )}
          </section>
        ) : (
          <>
            <section className="px-4 pb-2 pt-6">
              <h2 className="font-serif text-[24px] font-bold leading-snug text-[#403A49]">
                {findIdStep === "phone" ? "휴대폰 인증이 필요합니다" : "인증번호를 입력해 주세요"}
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
                {findIdStep === "phone"
                  ? "가입하신 번호로 인증번호를 보내드립니다."
                  : `${findIdPhone} 로 보낸 인증번호를 입력해 주세요.`}
              </p>
            </section>

            <div className="space-y-5 px-4 pb-8">
              {findIdStep === "phone" ? (
                <>
                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
                      휴대폰 번호 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={findIdPhone}
                        onChange={(e) => setFindIdPhone(e.target.value)}
                        placeholder="예) 010-1234-5678"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={sendFindIdCode}
                        disabled={loading}
                        className="h-14 shrink-0 rounded-xl bg-[#403A49] px-4 text-[15px] font-semibold text-white disabled:opacity-40"
                      >
                        인증번호
                      </button>
                    </div>
                  </div>

                  {error ? <p className="text-[15px] text-red-600">{error}</p> : null}
                </>
              ) : (
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
                    ) : codeSent ? (
                      <p className="mt-2 text-[14px] text-[#403A49]">
                        인증번호를 문자로 보냈습니다.
                      </p>
                    ) : null}
                  </div>

                  {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

                  <button
                    type="button"
                    onClick={verifyFindIdCode}
                    disabled={loading}
                    className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
                  >
                    인증하고 아이디 확인
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={goBackFindId}
                className="flex h-14 w-full items-center justify-center rounded-xl border border-[#403A49] bg-[#FFFFFF] text-[16px] font-semibold text-[#403A49]"
              >
                {findIdStep === "phone" ? "로그인으로 돌아가기" : "이전"}
              </button>
            </div>
          </>
        )}
      </MobileShell>
    );
  }

  if (mode === "setId") {
    return (
      <MobileShell bgClass="bg-[#FFFFFF]">
        <AppHeader variant="page" title="아이디 설정" showActions={false} onBack={goBackSetId} />

        {setIdStep === "done" ? (
          <section className="px-4 py-10 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#403A49] text-[36px] text-white">
              ✓
            </div>
            <h2 className="mt-6 font-serif text-[24px] font-bold text-[#403A49]">
              아이디를 설정했습니다
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
              이제 설정한 아이디로 로그인해 주세요.
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
                {setIdStep === "phone"
                  ? "휴대폰 인증이 필요합니다"
                  : setIdStep === "code"
                    ? "인증번호를 입력해 주세요"
                    : "사용할 아이디를 정해주세요"}
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
                {setIdStep === "phone"
                  ? "이전에 가입하신 분은 아이디를 새로 설정해 주세요."
                  : setIdStep === "code"
                    ? `${setIdPhone} 로 보낸 인증번호를 입력해 주세요.`
                    : "앞으로 이 아이디로 로그인합니다."}
              </p>
            </section>

            <div className="space-y-5 px-4 pb-8">
              {setIdStep === "phone" ? (
                <>
                  <div>
                    <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
                      휴대폰 번호 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={setIdPhone}
                        onChange={(e) => setSetIdPhone(e.target.value)}
                        placeholder="예) 010-1234-5678"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={sendSetIdCode}
                        disabled={loading}
                        className="h-14 shrink-0 rounded-xl bg-[#403A49] px-4 text-[15px] font-semibold text-white disabled:opacity-40"
                      >
                        인증번호
                      </button>
                    </div>
                  </div>

                  {error ? <p className="text-[15px] text-red-600">{error}</p> : null}
                </>
              ) : setIdStep === "code" ? (
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
                    ) : codeSent ? (
                      <p className="mt-2 text-[14px] text-[#403A49]">
                        인증번호를 문자로 보냈습니다.
                      </p>
                    ) : null}
                  </div>

                  {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

                  <button
                    type="button"
                    onClick={verifySetIdCode}
                    disabled={loading}
                    className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
                  >
                    인증하고 계속하기
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="login-set-id"
                      className="mb-2 block text-[16px] font-medium text-[#3d2b1f]"
                    >
                      아이디 <span className="text-red-500">*</span>
                    </label>
                    {/* autoCapitalize·autoCorrect는 휴대폰 자판이 첫 글자를 대문자로 바꾸거나
                        철자를 고치지 않게 한다. 대문자 입력 자체는 막지 않고 서버가 소문자로 맞춘다. */}
                    <input
                      id="login-set-id"
                      type="text"
                      value={newLoginId}
                      onChange={(e) => setNewLoginId(e.target.value)}
                      placeholder="아이디를 입력해 주세요"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="username"
                      inputMode="text"
                      className={inputClass}
                    />
                    <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
                      {LOGIN_ID_HELP}
                    </p>
                  </div>

                  {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

                  <button
                    type="button"
                    onClick={submitLoginId}
                    disabled={loading}
                    className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
                  >
                    아이디 설정하기
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={goBackSetId}
                className="flex h-14 w-full items-center justify-center rounded-xl border border-[#403A49] bg-[#FFFFFF] text-[16px] font-semibold text-[#403A49]"
              >
                {setIdStep === "phone" ? "로그인으로 돌아가기" : "이전"}
              </button>
            </div>
          </>
        )}
      </MobileShell>
    );
  }

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
                    ) : codeSent ? (
                      <p className="mt-2 text-[14px] text-[#403A49]">
                        인증번호를 문자로 보냈습니다.
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
          아이디와 비밀번호로 로그인해 주세요.
        </p>
      </section>

      <div className="space-y-5 px-4 pb-8">
        <form onSubmit={handleLoginSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="login-id"
              className="mb-2 block text-[16px] font-medium text-[#3d2b1f]"
            >
              아이디 <span className="text-red-500">*</span>
            </label>
            {/* 휴대폰 자판이 첫 글자를 대문자로 바꾸지 않게 한다.
                대문자 입력 자체는 막지 않고 보낼 때 소문자로 맞춘다. */}
            <input
              id="login-id"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="아이디를 입력해 주세요"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
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
            type="submit"
            disabled={loading}
            className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
          >
            로그인
            {recentLogin === "password" ? (
              <span className="ml-2 text-[15px] font-medium text-white/80">· 최근 로그인</span>
            ) : null}
          </button>
        </form>

        <div className="flex items-center justify-center gap-4 text-[16px]">
          <button
            type="button"
            onClick={openFindId}
            className="font-semibold text-[#6B6570] underline underline-offset-4"
          >
            아이디 찾기
          </button>
          <span className="text-[#e8dfd4]">|</span>
          <button
            type="button"
            onClick={openReset}
            className="font-semibold text-[#6B6570] underline underline-offset-4"
          >
            비밀번호 찾기
          </button>
          <span className="text-[#e8dfd4]">|</span>
          <Link
            href={signupHref}
            className="font-semibold text-[#403A49] underline underline-offset-4"
          >
            회원가입
          </Link>
        </div>

        <div className="h-px bg-[#F7F6F8]" />

        <button
          type="button"
          onClick={startKakao}
          disabled={loading}
          className="flex h-16 w-full items-center justify-center rounded-full bg-[#fee500] text-[17px] font-semibold text-[#3d2b1f] disabled:opacity-40"
        >
          카카오톡으로 시작하기
          {recentLogin === "kakao" ? (
            <span className="ml-2 text-[15px] font-medium text-[#3d2b1f]/70">· 최근 로그인</span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={startNaver}
          disabled={loading}
          className="flex h-16 w-full items-center justify-center rounded-full bg-[#03c75a] text-[17px] font-semibold text-white disabled:opacity-40"
        >
          네이버 시작하기
          {recentLogin === "naver" ? (
            <span className="ml-2 text-[15px] font-medium text-white/80">· 최근 로그인</span>
          ) : null}
        </button>

        <p className="text-center text-[13px] leading-relaxed text-[#6B6570]">
          카카오·네이버 간편 로그인은 연결 준비 중입니다.
        </p>
      </div>
    </MobileShell>
  );
}
