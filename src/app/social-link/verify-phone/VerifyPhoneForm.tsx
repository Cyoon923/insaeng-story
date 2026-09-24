"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";
import type { SocialProvider } from "@/lib/server/socialLink";

/**
 * 소셜 계정 연결 화면. 휴대폰 SMS 인증을 마치면 곧바로 서버에서 연결까지 끝낸다.
 * 이름·이메일·비밀번호는 받지 않는다. 인증한 번호의 회원이 있으면 그 회원에 연결되고,
 * 없을 때만 서버가 그 번호로 회원을 하나 만든다.
 */
type Step = "phone" | "verified";

const inputClass =
  "h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#403A49]";

/** 필수 동의 한 줄. 이 화면에서만 쓰므로 별도 파일로 두지 않는다. */
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
      {/* 약관은 새 탭으로 연다. 이 화면을 떠나면 입력한 번호와 인증 상태가 사라진다. */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-[14px] text-[#6B6570] underline underline-offset-2"
      >
        보기
      </a>
    </label>
  );
}

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  kakao: "카카오 계정 연결",
  naver: "네이버 계정 연결",
};

export function VerifyPhoneForm({ provider }: { provider: SocialProvider }) {
  const router = useRouter();
  const title = PROVIDER_LABEL[provider];

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  // 운영에서는 인증번호를 받을 수 없으므로 발송 여부만 안내한다.
  const [codeSent, setCodeSent] = useState(false);

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const [step, setStep] = useState<Step>("phone");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 필수 2종이 동의 항목 전부이므로 "전체 동의" 체크 상태와 같다.
  const requiredAgreed = agreeTerms && agreePrivacy;

  const toggleAll = (next: boolean) => {
    setAgreeTerms(next);
    setAgreePrivacy(next);
  };

  const sendCode = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await postApp({ action: "sendCode", purpose: "link", phone });
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
    // 진행 중에는 버튼이 잠기지만, 중복 호출을 한 번 더 막는다.
    if (loading) return;
    // 버튼도 잠기지만, 필수 동의 없이 진행되지 않도록 한 번 더 막는다.
    if (!requiredAgreed) {
      setError("필수 약관에 동의해 주세요.");
      return;
    }
    setLoading(true);
    try {
      // 소셜 연결용 인증. 이미 가입된 번호도 통과한다.
      const verified = await postApp({ action: "verifyCode", purpose: "link", phone, code });
      // 소셜 정보(provider/providerUserId)는 서버 대기 상태에만 있으므로 보내지 않는다.
      const linked = await postApp({
        action: "completeSocialLink",
        phone,
        linkToken: verified.linkToken,
        // 처음 보는 소셜 계정으로 회원이 새로 만들어지는 경우에만 서버가 쓴다.
        // 버전과 동의 시각은 서버가 채우므로 클라이언트가 보내지 않는다.
        termsAgreed: agreeTerms,
        privacyAgreed: agreePrivacy,
      });
      setStep("verified");
      // 서버가 safeNextPath로 검사해 돌려준 경로로만 이동한다.
      router.replace(typeof linked.redirect === "string" ? linked.redirect : "/my");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증에 실패했습니다.");
      setLoading(false);
    }
  };

  const header = (
    <AppHeader
      variant="page"
      title={title}
      showActions={false}
      onBack={() => router.push("/login")}
    />
  );

  if (step === "verified") {
    return (
      <MobileShell bgClass="bg-[#FFFFFF]">
        {header}
        <section className="px-4 py-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#403A49] text-[36px] text-white">
            ✓
          </div>
          <h2 className="mt-6 font-serif text-[24px] font-bold text-[#403A49]">
            {title}이 끝났습니다
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
            잠시만 기다려 주세요.
          </p>
        </section>
      </MobileShell>
    );
  }

  return (
    <MobileShell bgClass="bg-[#FFFFFF]">
      {header}
      <section className="px-4 pb-2 pt-6">
        <h2 className="font-serif text-[24px] font-bold leading-snug text-[#403A49]">
          휴대폰 인증을 해주세요
        </h2>
        <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
          {title}을 위해 본인 확인이 필요합니다.
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
            <p className="mt-2 text-[14px] text-[#403A49]">인증번호를 문자로 보냈습니다.</p>
          ) : null}
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
              href="/terms?from=social"
            />
            <AgreeRow
              checked={agreePrivacy}
              onChange={setAgreePrivacy}
              label="개인정보 수집·이용 동의"
              href="/privacy/collection?from=social"
            />
          </div>
        </div>

        {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={verify}
          disabled={loading || !requiredAgreed}
          className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
        >
          인증하고 계속하기
        </button>

        <p className="text-center text-[16px] text-[#6B6570]">
          <Link href="/login" className="font-semibold text-[#403A49] underline underline-offset-4">
            로그인 화면으로 돌아가기
          </Link>
        </p>
      </div>
    </MobileShell>
  );
}
