"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";

/**
 * 신규 회원 전용 흐름. 휴대폰 SMS 인증으로 시작하고,
 * 인증 결과로 받은 단기 토큰(signupToken)으로 가입을 마친다.
 * (기존처럼 phone/token 쿼리를 들고 들어오면 약관 단계부터 시작한다.)
 */
type Step = "phone" | "terms" | "profile" | "done";

const inputClass =
  "h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#403A49]";

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * 생년월일은 YYYY-MM-DD 로만 저장한다.
 * 브라우저 날짜 입력은 연도를 4자리보다 길게 받아 줄 수 있어, 실제 값에서 잘라 준다.
 */
function clampBirth(value: string): string {
  if (!value) return "";
  const [year = "", month = "", day = ""] = value.replace(/^\+/, "").split("-");
  const yyyy = year.replace(/\D/g, "").slice(0, 4);
  const mm = month.replace(/\D/g, "").slice(0, 2);
  const dd = day.replace(/\D/g, "").slice(0, 2);
  if (!yyyy || !mm || !dd) return "";
  return `${yyyy}-${mm}-${dd}`;
}

const EMAIL_DOMAINS = ["naver.com", "gmail.com", "daum.net", "kakao.com", "직접입력"];

function AgreeRow({
  checked,
  onChange,
  label,
  required,
  href,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  required?: boolean;
  href?: string;
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
        <span className={required ? "font-semibold" : ""}>{label}</span>{" "}
        <span className={required ? "text-[#403A49]" : "text-[#6B6570]"}>
          {required ? "(필수)" : "(선택)"}
        </span>
      </span>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-[14px] text-[#6B6570] underline underline-offset-2"
        >
          보기
        </Link>
      ) : null}
    </label>
  );
}

/**
 * 약관 상세("보기")로 잠깐 나갔다가 돌아왔을 때 약관 화면과 체크 상태를 되살리기 위한 임시 보관.
 * 가입 단계 규칙 자체는 그대로이고, 화면을 떠났다 돌아오는 경우에만 사용한다.
 */
const RESUME_KEY = "insaeng-signup-resume";

type ResumeState = {
  phone: string;
  signupToken: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
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

  const resumed = useState(() => readResume())[0];

  const [phone, setPhone] = useState(paramPhone || resumed?.phone || "");
  const [signupToken, setSignupToken] = useState(paramToken || resumed?.signupToken || "");
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  // 운영에서는 인증번호를 받을 수 없으므로 발송 여부만 안내한다.
  const [codeSent, setCodeSent] = useState(false);

  const [step, setStep] = useState<Step>(
    paramPhone && paramToken ? "terms" : resumed?.signupToken ? "terms" : "phone",
  );
  const [agreeTerms, setAgreeTerms] = useState(resumed?.agreeTerms ?? false);
  const [agreePrivacy, setAgreePrivacy] = useState(resumed?.agreePrivacy ?? false);
  const [agreeMarketing, setAgreeMarketing] = useState(resumed?.agreeMarketing ?? false);

  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [emailLocal, setEmailLocal] = useState("");
  const [emailDomain, setEmailDomain] = useState(EMAIL_DOMAINS[0]);
  const [customDomain, setCustomDomain] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const allAgreed = agreeTerms && agreePrivacy && agreeMarketing;
  const requiredAgreed = agreeTerms && agreePrivacy;

  const toggleAll = (next: boolean) => {
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeMarketing(next);
  };

  const domain = emailDomain === "직접입력" ? customDomain.trim() : emailDomain;
  const email = emailLocal.trim() && domain ? `${emailLocal.trim()}@${domain}` : "";

  useEffect(() => {
    if (!signupToken) return;
    writeResume({ phone, signupToken, agreeTerms, agreePrivacy, agreeMarketing });
  }, [phone, signupToken, agreeTerms, agreePrivacy, agreeMarketing]);

  // 뒤로가기는 항상 직전 단계로만 이동한다. 입력값은 그대로 둔다.
  const goBack = () => {
    if (step === "done") {
      setStep("profile");
      return;
    }
    if (step === "profile") {
      setStep("terms");
      return;
    }
    if (step === "terms") {
      setStep("phone");
      return;
    }
    // 첫 단계에서는 직전에 보던 화면으로, 없으면 로그인으로 간다.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/login");
  };

  const header = (
    <AppHeader variant="page" title="회원가입" showActions={false} onBack={goBack} />
  );

  const sendCode = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await postApp({ action: "sendCode", channel: "phone", phone });
      setSentCode(result.devCode ?? "");
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호를 보내지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError("");
    // 뒤로 왔다가 다시 진행하는 경우: 이미 받은 토큰을 그대로 쓴다.
    if (signupToken) {
      setStep("terms");
      return;
    }
    setLoading(true);
    try {
      const result = await postApp({ action: "verifyCode", purpose: "signup", phone, code });
      setSignupToken(result.signupToken);
      setStep("terms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상으로 입력해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 서로 다릅니다.");
      return;
    }
    setLoading(true);
    try {
      await postApp({
        action: "signupComplete",
        phone,
        signupToken,
        name: name.trim(),
        birth,
        email,
        password,
        marketingAgreed: agreeMarketing,
      });
      try {
        window.sessionStorage.removeItem(RESUME_KEY);
      } catch {
        // 무시해도 되는 정리 작업이다.
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 1단계: 휴대폰 SMS 인증. 인증을 마쳐야 약관 단계로 넘어간다.
  if (step === "phone" || !signupToken) {
    return (
      <>
        {header}
        <section className="px-4 pb-2 pt-6">
          <h2 className="font-serif text-[24px] font-bold leading-snug text-[#403A49]">
            휴대폰 인증을 해주세요
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
            회원가입은 휴대폰 인증으로 시작합니다.
          </p>
        </section>

        <div className="space-y-5 px-4 pb-8">
          <div>
            <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
              휴대폰 번호 <span className="text-red-500">*</span>
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
                className="h-14 shrink-0 rounded-xl bg-[#403A49] px-4 text-[15px] font-semibold text-white disabled:opacity-40"
              >
                인증번호
              </button>
            </div>
          </div>

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
            onClick={verify}
            disabled={loading}
            className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
          >
            인증하고 계속하기
          </button>

          <p className="text-center text-[16px] text-[#6B6570]">
            이미 회원이신가요?{" "}
            <Link href="/login" className="font-semibold text-[#403A49] underline underline-offset-4">
              로그인
            </Link>
          </p>
        </div>
      </>
    );
  }

  if (step === "done") {
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
          href="/my"
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

  if (step === "terms") {
    return (
      <>
        {header}
        <section className="px-4 pb-2 pt-6">
          <h2 className="font-serif text-[24px] font-bold leading-snug text-[#403A49]">
            약관에 동의해 주세요
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
            필수 항목만 동의하셔도 가입할 수 있습니다.
          </p>
        </section>

        <div className="px-4 pb-8">
          <label className="flex items-center gap-3 rounded-xl bg-[#F7F6F8] px-4 py-4">
            <input
              type="checkbox"
              checked={allAgreed}
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
              required
              href="/terms?from=signup"
            />
            <AgreeRow
              checked={agreePrivacy}
              onChange={setAgreePrivacy}
              label="개인정보 수집 및 이용 동의"
              required
              href="/privacy?from=signup"
            />
            <AgreeRow
              checked={agreeMarketing}
              onChange={setAgreeMarketing}
              label="마케팅 정보 수신 동의"
            />
          </div>

          <button
            type="button"
            onClick={() => setStep("profile")}
            disabled={!requiredAgreed}
            className="mt-8 flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
          >
            다음
          </button>
        </div>
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
        <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
          인증하신 번호 {phone} 로 가입합니다.
        </p>
      </section>

      <div className="space-y-5 px-4 pb-8">
        <div>
          <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 적어주세요"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">생년월일</label>
          <input
            type="date"
            value={birth}
            onChange={(e) => setBirth(clampBirth(e.target.value))}
            min="1900-01-01"
            max={TODAY}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">이메일</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={emailLocal}
              onChange={(e) => setEmailLocal(e.target.value)}
              placeholder="아이디"
              className={inputClass}
            />
            <span className="shrink-0 text-[17px] text-[#6B6570]">@</span>
            <select
              value={emailDomain}
              onChange={(e) => setEmailDomain(e.target.value)}
              className="h-14 shrink-0 rounded-xl border border-[#e8dfd4] bg-white px-3 text-[16px] outline-none focus:border-[#403A49]"
            >
              {EMAIL_DOMAINS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {emailDomain === "직접입력" ? (
            <input
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="도메인을 직접 입력해 주세요"
              className={`mt-2 ${inputClass}`}
            />
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            비밀번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-2 block text-[16px] font-medium text-[#3d2b1f]">
            비밀번호 확인 <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="한 번 더 입력해 주세요"
            className={inputClass}
          />
        </div>

        {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
        >
          가입 완료
        </button>

        <button
          type="button"
          onClick={() => setStep("terms")}
          className="flex h-14 w-full items-center justify-center rounded-xl border border-[#403A49] bg-[#FFFFFF] text-[16px] font-semibold text-[#403A49]"
        >
          이전
        </button>
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
