"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";
import { LOGIN_DEFAULT_PATH, safeNextPath } from "@/lib/loginRedirect";

/**
 * 신규 회원 전용 흐름. 입력 항목을 한 화면에 모두 두고,
 * 휴대폰 SMS 인증으로 받은 단기 토큰(signupToken)으로 가입을 마친다.
 * (기존처럼 phone/token 쿼리를 들고 들어오면 인증을 마친 상태로 시작한다.)
 */
const inputClass =
  "h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#403A49]";


/**
 * 아이디 형식. 서버(store.ts의 isValidLoginId)와 같은 규칙이다.
 * 대문자로 입력해도 서버가 소문자로 맞추므로 여기서는 소문자로 바꿔서 확인만 한다.
 */
const LOGIN_ID_RULE = /^[a-z][a-z0-9_]{3,19}$/;
const LOGIN_ID_HELP = "영문자로 시작하는 4~20자의 영문, 숫자, 밑줄(_)을 사용할 수 있습니다.";
/**
 * 서버가 회원가입에서 실제로 요구하는 비밀번호 최소 길이.
 * api/app/route.ts signupComplete의 `password.length < 6` 검사와 같은 값이다.
 * 화면 안내와 서버 판정이 갈라지지 않도록 한 곳에 적어 둔다.
 */
const PASSWORD_MIN_LENGTH = 6;

/**
 * 인증한 번호와 지금 입력된 번호가 같은지 비교할 때 쓰는 기준.
 * 서버(store.ts의 normalizePhone)처럼 숫자만 남겨서 본다.
 * 하이픈 유무 같은 표기 차이는 다른 번호로 보지 않는다.
 */
function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function AgreeRow({
  checked,
  onChange,
  label,
  href,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  href: string;
}) {
  return (
    <label className="flex items-start gap-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-6 w-6 shrink-0 accent-[#403A49]"
      />
      <span className="flex-1 text-[16px] leading-relaxed text-[#3d2b1f]">
        <span className="font-semibold text-[#403A49]">[필수]</span>{" "}
        <span className="font-semibold">{label}</span>
      </span>
      <Link
        href={href}
        className="shrink-0 text-[14px] text-[#6B6570] underline underline-offset-2"
      >
        보기
      </Link>
    </label>
  );
}

/**
 * 약관 상세("보기")로 잠깐 나갔다가 돌아왔을 때 인증 상태와 체크 상태를 되살리기 위한 임시 보관.
 * 가입 규칙 자체는 그대로이고, 화면을 떠났다 돌아오는 경우에만 사용한다.
 */
const RESUME_KEY = "insaeng-signup-resume";

type ResumeState = {
  phone: string;
  signupToken: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
};

function readResume(): ResumeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);
    return raw ? (JSON.parse(raw) as ResumeState) : null;
  } catch {
    return null;
  }
}

function writeResume(state: ResumeState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(state));
  } catch {
    // 저장에 실패해도 가입 진행에는 영향을 주지 않는다.
  }
}

function SignupFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const paramPhone = params.get("phone") ?? "";
  const paramToken = params.get("token") ?? "";
  /** 신청 화면에서 로그인을 거쳐 넘어온 경우의 복귀 주소. */
  const nextPath = safeNextPath(params.get("next")) ?? "";
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";

  const resumed = useState(() => readResume())[0];

  const initialPhone = paramPhone || resumed?.phone || "";
  const initialToken = paramToken || resumed?.signupToken || "";

  const [phone, setPhone] = useState(initialPhone);
  /**
   * signupToken을 발급받은 번호. 사용자가 번호를 고치면
   * 이 값과 어긋나므로 인증이 풀린 것으로 본다.
   */
  const [verifiedPhone, setVerifiedPhone] = useState(initialToken ? initialPhone : "");
  const [signupToken, setSignupToken] = useState(initialToken);
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  // 운영에서는 인증번호를 받을 수 없으므로 발송 여부만 안내한다.
  const [codeSent, setCodeSent] = useState(false);

  const [done, setDone] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(resumed?.agreeTerms ?? false);
  const [agreePrivacy, setAgreePrivacy] = useState(resumed?.agreePrivacy ?? false);

  const [loginId, setLoginId] = useState("");
  /**
   * 중복확인을 통과한 아이디. 지금 입력된 값과 정확히 같을 때만 확인된 것으로 본다.
   * 확인 후 한 글자라도 고치면 changeLoginId에서 비워진다.
   */
  const [checkedLoginId, setCheckedLoginId] = useState("");
  const [loginIdMessage, setLoginIdMessage] = useState("");
  /** 안내 문구 색만 고른다. 가입 가능 판정은 checkedLoginId로만 한다. */
  const [loginIdAvailable, setLoginIdAvailable] = useState(false);
  const [loginIdChecking, setLoginIdChecking] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  // 두 칸은 각각 따로 보기/숨기기를 토글한다.
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [phoneError, setPhoneError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 필수 2종이 동의 항목 전부이므로 "전체 동의" 체크 상태와 같다.
  const requiredAgreed = agreeTerms && agreePrivacy;

  /**
   * 토큰이 있고, 그 토큰을 받은 번호가 지금 입력된 번호와 같을 때만 인증된 것으로 본다.
   * 번호를 고치면 아래 changePhone에서 토큰을 지우지만, 저장된 resume 값이
   * 어긋난 경우까지 막기 위해 화면에서도 한 번 더 확인한다.
   */
  const phoneVerified =
    Boolean(signupToken) &&
    phoneDigits(verifiedPhone) !== "" &&
    phoneDigits(verifiedPhone) === phoneDigits(phone);

  const normalizedLoginId = loginId.trim().toLowerCase();
  const loginIdChecked = Boolean(checkedLoginId) && normalizedLoginId === checkedLoginId;

  /**
   * 비밀번호 안내는 서버가 실제로 검사하는 조건만 보여 준다.
   * 지금 서버(signupComplete)가 보는 것은 길이 6자 이상 하나뿐이므로
   * 대소문자·숫자·특수문자 같은 조건을 여기서 지어내지 않는다.
   * 서버 규칙이 바뀌면 이 값도 함께 바꿔야 한다.
   */
  const passwordLongEnough = password.length >= PASSWORD_MIN_LENGTH;
  // 확인칸은 입력이 시작된 뒤에만 일치 여부를 말한다. 빈칸을 오류로 보이게 하지 않는다.
  const passwordConfirmTouched = passwordConfirm.length > 0;
  const passwordMatches = passwordConfirmTouched && password === passwordConfirm;

  /**
   * 아이디를 고치면 이전 중복확인 결과를 즉시 버린다.
   * 확인한 아이디와 실제로 가입하는 아이디가 어긋나지 않게 한다.
   */
  const changeLoginId = (next: string) => {
    setLoginId(next);
    if (next.trim().toLowerCase() === checkedLoginId) return;
    setCheckedLoginId("");
    setLoginIdMessage("");
    setLoginIdAvailable(false);
  };

  /**
   * 중복확인. 빈 값이나 형식 위반은 서버를 부르지 않고 화면에서 바로 안내한다.
   * 최종 판정은 가입 시점에 서버가 다시 한다.
   */
  const checkLoginId = async () => {
    if (loginIdChecking) return;
    setLoginIdAvailable(false);
    setCheckedLoginId("");
    if (!normalizedLoginId) {
      setLoginIdMessage("아이디를 입력해 주세요.");
      return;
    }
    if (!LOGIN_ID_RULE.test(normalizedLoginId)) {
      setLoginIdMessage(
        "아이디는 영문자로 시작하는 4~20자의 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.",
      );
      return;
    }
    setLoginIdChecking(true);
    try {
      const result = await postApp({ action: "checkLoginId", loginId: normalizedLoginId });
      if (result.available) {
        setCheckedLoginId(normalizedLoginId);
        setLoginIdAvailable(true);
        setLoginIdMessage("사용 가능한 아이디입니다.");
      } else {
        setLoginIdMessage(result.message ?? "사용할 수 없는 아이디입니다.");
      }
    } catch (err) {
      setLoginIdMessage(err instanceof Error ? err.message : "아이디를 확인하지 못했습니다.");
    } finally {
      setLoginIdChecking(false);
    }
  };

  const toggleAll = (next: boolean) => {
    setAgreeTerms(next);
    setAgreePrivacy(next);
  };

  /**
   * 번호를 고치면 이전 인증 상태를 모두 버린다.
   * 이전 번호로 받은 signupToken이 새 번호의 가입에 쓰이지 않게 한다.
   */
  const changePhone = (next: string) => {
    setPhone(next);
    if (phoneDigits(next) === phoneDigits(verifiedPhone)) return;
    setSignupToken("");
    setVerifiedPhone("");
    setCode("");
    setSentCode("");
    setCodeSent(false);
  };

  useEffect(() => {
    if (!signupToken) return;
    writeResume({ phone, signupToken, agreeTerms, agreePrivacy });
  }, [phone, signupToken, agreeTerms, agreePrivacy]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(loginHref);
  };

  const header = (
    <AppHeader variant="page" title="회원가입" showActions={false} onBack={goBack} />
  );

  const sendCode = async () => {
    setPhoneError("");
    setLoading(true);
    try {
      const result = await postApp({ action: "sendCode", purpose: "signup", phone });
      setSentCode(result.devCode ?? "");
      setCodeSent(true);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "인증번호를 보내지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setPhoneError("");
    setLoading(true);
    try {
      const result = await postApp({ action: "verifyCode", purpose: "signup", phone, code });
      setSignupToken(result.signupToken);
      // 토큰을 받은 번호를 함께 기억해 둔다.
      setVerifiedPhone(phone);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setError("");
    const trimmedLoginId = normalizedLoginId;
    if (!trimmedLoginId) {
      setError("아이디를 입력해 주세요.");
      return;
    }
    if (!LOGIN_ID_RULE.test(trimmedLoginId)) {
      setError("아이디는 영문자로 시작하는 4~20자의 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
      return;
    }
    // 화면에서 확인한 아이디와 지금 입력된 아이디가 같아야 한다.
    // 서버도 저장 시점에 다시 중복을 검사한다(signupComplete의 isLoginIdTaken).
    if (!loginIdChecked) {
      setError("아이디 중복확인을 해주세요.");
      return;
    }
    if (!passwordLongEnough) {
      setError(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상으로 입력해 주세요.`);
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (!phoneVerified) {
      setError("휴대폰 인증을 완료해 주세요.");
      return;
    }
    if (!requiredAgreed) {
      setError("필수 약관에 동의해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await postApp({
        action: "signupComplete",
        // 인증을 마친 번호로만 가입한다.
        phone: verifiedPhone,
        signupToken,
        loginId: trimmedLoginId,
        name: name.trim(),
        password,
        // 필수 동의 2종. 서버가 이 값으로 동의 증빙(User.consents)을 남긴다.
        // 버전과 동의 시각은 서버가 채우므로 클라이언트가 보내지 않는다.
        termsAgreed: agreeTerms,
        privacyAgreed: agreePrivacy,
      });
      try {
        window.sessionStorage.removeItem(RESUME_KEY);
      } catch {
        // 무시해도 되는 정리 작업이다.
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <>
        {header}
        <section className="px-4 py-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#403A49] text-[36px] text-white">
          ✓
        </div>
        <h2 className="mt-6 font-serif text-[24px] font-bold text-[#403A49]">가입이 완료되었습니다</h2>
        <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
          {name}님, 사주로그에 오신 것을 환영합니다.
        </p>
        <Link
          href={nextPath || LOGIN_DEFAULT_PATH}
          className="mt-8 flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white"
        >
          내 정보 보러가기
        </Link>
        <Link
          href="/"
          className="mt-3 flex h-16 w-full items-center justify-center rounded-xl border border-[#403A49] bg-[#FFFFFF] text-[18px] font-semibold text-[#403A49]"
        >
          홈으로
        </Link>
        </section>
      </>
    );
  }

  return (
    <>
      {header}
      <section className="px-4 pb-2 pt-6">
        <h2 className="font-serif text-[24px] font-bold leading-snug text-[#403A49]">
          회원정보를 입력해 주세요
        </h2>
      </section>

      <div className="space-y-5 px-4 pb-8">
        <div>
          <label htmlFor="signup-login-id" className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            아이디 <span className="text-red-500">*</span>
          </label>
          {/* autoCapitalize·autoCorrect는 휴대폰 자판이 첫 글자를 대문자로 바꾸거나
              철자를 고치지 않게 한다. 대문자 입력 자체는 막지 않고 서버가 소문자로 맞춘다. */}
          <div className="flex gap-2">
            <input
              id="signup-login-id"
              type="text"
              value={loginId}
              onChange={(e) => changeLoginId(e.target.value)}
              placeholder="아이디를 입력해 주세요"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              inputMode="text"
              className={inputClass}
            />
            <button
              type="button"
              onClick={checkLoginId}
              disabled={loginIdChecking}
              className="h-14 shrink-0 rounded-xl bg-[#403A49] px-4 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              중복확인
            </button>
          </div>
          {loginIdMessage ? (
            <p
              className={`mt-2 text-[14px] leading-relaxed ${
                loginIdAvailable ? "font-semibold text-[#403A49]" : "text-red-600"
              }`}
            >
              {loginIdMessage}
            </p>
          ) : null}
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">{LOGIN_ID_HELP}</p>
        </div>

        <div>
          <label htmlFor="signup-password" className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            비밀번호 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              autoComplete="new-password"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              aria-pressed={showPassword}
              className="h-14 shrink-0 rounded-xl border border-[#403A49] bg-white px-4 text-[15px] font-semibold text-[#403A49]"
            >
              {showPassword ? "숨기기" : "보기"}
            </button>
          </div>
          {/* 서버가 검사하는 조건만 적는다. 충족하면 색과 기호가 함께 바뀐다. */}
          <p
            className={`mt-2 text-[14px] leading-relaxed ${
              password.length === 0
                ? "text-[#6B6570]"
                : passwordLongEnough
                  ? "font-semibold text-[#403A49]"
                  : "text-red-600"
            }`}
          >
            {password.length === 0 || !passwordLongEnough ? "○" : "●"} {PASSWORD_MIN_LENGTH}자 이상
            입력해 주세요.
          </p>
        </div>

        <div>
          <label
            htmlFor="signup-password-confirm"
            className="mb-2 block text-[16px] font-medium text-[#3d2b1f]"
          >
            비밀번호 확인 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              id="signup-password-confirm"
              type={showPasswordConfirm ? "text" : "password"}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="한 번 더 입력해 주세요"
              autoComplete="new-password"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowPasswordConfirm((prev) => !prev)}
              aria-label={showPasswordConfirm ? "비밀번호 확인 숨기기" : "비밀번호 확인 보기"}
              aria-pressed={showPasswordConfirm}
              className="h-14 shrink-0 rounded-xl border border-[#403A49] bg-white px-4 text-[15px] font-semibold text-[#403A49]"
            >
              {showPasswordConfirm ? "숨기기" : "보기"}
            </button>
          </div>
          {passwordConfirmTouched ? (
            <p
              className={`mt-2 text-[14px] leading-relaxed ${
                passwordMatches ? "font-semibold text-[#403A49]" : "text-red-600"
              }`}
            >
              {passwordMatches ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다."}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="signup-name" className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 적어주세요"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="signup-phone" className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            휴대폰 번호 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              id="signup-phone"
              type="tel"
              value={phone}
              onChange={(e) => changePhone(e.target.value)}
              placeholder="예) 010-1234-5678"
              autoComplete="tel"
              className={inputClass}
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={loading || phoneVerified}
              className="h-14 shrink-0 rounded-xl bg-[#403A49] px-4 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {codeSent ? "다시 받기" : "인증번호 받기"}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="signup-code" className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            인증번호 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              id="signup-code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="숫자 6자리"
              disabled={phoneVerified}
              autoComplete="one-time-code"
              className={`${inputClass} disabled:bg-[#F7F6F8] disabled:text-[#6B6570]`}
            />
            <button
              type="button"
              onClick={verify}
              disabled={loading || phoneVerified}
              className="h-14 shrink-0 rounded-xl bg-[#403A49] px-4 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              인증 확인
            </button>
          </div>
          {phoneVerified ? (
            <p className="mt-2 text-[14px] font-semibold text-[#403A49]">인증이 완료되었습니다.</p>
          ) : sentCode ? (
            <p className="mt-2 text-[14px] text-[#403A49]">
              인증번호 {sentCode} 를 입력해 주세요.
            </p>
          ) : codeSent ? (
            <p className="mt-2 text-[14px] text-[#403A49]">
              인증번호를 문자로 보냈습니다.
            </p>
          ) : null}
          {phoneError ? <p className="mt-2 text-[15px] text-red-600">{phoneError}</p> : null}
        </div>

        <div className="border-t border-[#e8dfd4] pt-5">
          <label className="flex items-center gap-3 rounded-xl bg-[#F7F6F8] px-4 py-4">
            <input
              type="checkbox"
              checked={requiredAgreed}
              onChange={(e) => toggleAll(e.target.checked)}
              className="h-7 w-7 shrink-0 accent-[#403A49]"
            />
            <span className="text-[18px] font-bold text-[#403A49]">전체 동의</span>
          </label>

          <div className="mt-2 divide-y divide-[#e8dfd4]">
            <AgreeRow
              checked={agreeTerms}
              onChange={setAgreeTerms}
              label="이용약관 동의"
              href="/terms?from=signup"
            />
            <AgreeRow
              checked={agreePrivacy}
              onChange={setAgreePrivacy}
              label="개인정보 수집 및 이용 동의"
              href="/privacy/collection?from=signup"
            />
          </div>
        </div>

        {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={submit}
          disabled={loading || !phoneVerified || !requiredAgreed}
          className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
        >
          회원가입
        </button>

        <p className="text-center text-[16px] text-[#6B6570]">
          이미 회원이신가요?{" "}
          <Link href={loginHref} className="font-semibold text-[#403A49] underline underline-offset-4">
            로그인
          </Link>
        </p>
      </div>
    </>
  );
}

export default function SignupPage() {
  return (
    <MobileShell bgClass="bg-[#FFFFFF]">
      <Suspense
        fallback={
          <>
            <AppHeader variant="page" title="회원가입" backHref="/login" showActions={false} />
            <div className="px-4 py-8 text-[16px] text-[#6B6570]">불러오는 중…</div>
          </>
        }
      >
        <SignupFlow />
      </Suspense>
    </MobileShell>
  );
}
