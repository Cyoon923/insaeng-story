"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";
import type { SocialProvider } from "@/lib/server/socialLink";

/**
 * 카카오·네이버 간편가입의 필수 동의 화면.
 *
 * 휴대폰 번호를 받지 않는다. 약관·개인정보 수집 [필수] 동의만 받고 가입을 끝낸다.
 * 본인확인은 실제 신청을 시작할 때 한 번 한다.
 *
 * 동의 UI는 기존 가입 화면(social-link/verify-phone, signup)과 같은 모양을 쓴다.
 * 고객이 보는 동의 화면이 경로마다 달라 보이지 않게 하려는 것이다.
 */
const PROVIDER_LABEL: Record<SocialProvider, string> = {
  kakao: "카카오 간편가입",
  naver: "네이버 간편가입",
};

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
      {/* 약관은 새 탭으로 연다. 이 화면을 떠나면 동의 상태가 사라진다. */}
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

export function SocialSignupAgreeForm({ provider }: { provider: SocialProvider }) {
  const router = useRouter();
  const title = PROVIDER_LABEL[provider];

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 필수 2종이 동의 항목 전부이므로 "전체 동의" 체크 상태와 같다.
  const requiredAgreed = agreeTerms && agreePrivacy;

  const toggleAll = (next: boolean) => {
    setAgreeTerms(next);
    setAgreePrivacy(next);
  };

  const submit = async () => {
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
      // 소셜 정보(provider/providerUserId)는 서버 대기 상태에만 있으므로 보내지 않는다.
      // 버전과 동의 시각도 서버가 채운다.
      const result = await postApp({
        action: "completeSocialSignup",
        termsAgreed: agreeTerms,
        privacyAgreed: agreePrivacy,
      });
      // 서버가 safeNextPath로 검사해 돌려준 경로로만 이동한다.
      router.replace(typeof result.redirect === "string" ? result.redirect : "/my");
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입에 실패했습니다.");
      setLoading(false);
    }
  };

  return (
    <MobileShell bgClass="bg-[#FFFFFF]">
      <AppHeader
        variant="page"
        title={title}
        showActions={false}
        onBack={() => router.push("/login")}
      />

      <section className="px-4 pb-2 pt-6">
        <h2 className="font-serif text-[24px] font-bold leading-snug text-[#403A49]">
          약관에 동의해 주세요
        </h2>
        <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
          동의하시면 바로 가입이 끝납니다.
          <br />
          휴대폰 인증은 나중에 신청하실 때 한 번만 하시면 됩니다.
        </p>
      </section>

      <div className="space-y-5 px-4 pb-8">
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
          onClick={submit}
          disabled={loading || !requiredAgreed}
          className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
        >
          동의하고 가입하기
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
