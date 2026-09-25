"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";

/**
 * 로그인한 회원의 최초 휴대폰 본인확인.
 *
 * 인증번호 발급·검증은 신규 소셜 가입 화면과 같은 호출을 그대로 쓴다
 * (sendCode / verifyCode purpose="link"). 마지막 확정만 로그인 회원용 action이다.
 *
 * 약관 동의는 받지 않는다. 이미 가입할 때 받았고, 여기서 다시 받으면 같은 동의가
 * 두 번 기록된다.
 */
type Step = "phone" | "done";

const inputClass =
  "h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#403A49]";

export function MyVerifyPhoneForm({ next }: { next: string | null }) {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const [step, setStep] = useState<Step>("phone");
  // 기존 계정으로 연결됐는지. 끝 화면 문구가 달라진다.
  const [absorbed, setAbsorbed] = useState(false);
  // 자동 연결이 불가능한 경우. 이때는 다시 시도해도 같으므로 안내만 남긴다.
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (loading) return;
    setLoading(true);
    try {
      // 이미 가입된 번호도 인증할 수 있는 기존 목적을 그대로 쓴다.
      const verified = await postApp({ action: "verifyCode", purpose: "link", phone, code });
      // 보내는 값은 번호와 토큰뿐이다. 어느 계정에 붙일지는 서버가 정한다.
      const result = await postApp({
        action: "completeMyPhoneVerification",
        phone,
        linkToken: verified.linkToken,
      });
      setAbsorbed(Boolean(result.absorbed));
      setStep("done");
      // 서버가 돌려준 복귀 경로를 먼저 쓰고, 없으면 이 화면에 들어올 때 받은 경로를 쓴다.
      const target =
        (typeof result.redirect === "string" ? result.redirect : null) ?? next ?? "/my";
      router.replace(target);
    } catch (err) {
      const message = err instanceof Error ? err.message : "인증에 실패했습니다.";
      // 자동 연결 불가는 다시 눌러도 같은 결과다. 버튼을 숨기고 안내만 남긴다.
      if (message.includes("고객센터")) setBlocked(true);
      setError(message);
      setLoading(false);
    }
  };

  const header = (
    <AppHeader
      variant="page"
      title="휴대폰 본인확인"
      showActions={false}
      onBack={() => router.push("/my")}
    />
  );

  if (step === "done") {
    return (
      <MobileShell bgClass="bg-[#FFFFFF]">
        {header}
        <section className="px-4 py-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#403A49] text-[36px] text-white">
            ✓
          </div>
          <h2 className="mt-6 font-serif text-[24px] font-bold text-[#403A49]">
            {absorbed ? "기존 계정으로 연결되었습니다" : "휴대폰 인증이 끝났습니다"}
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
          신청과 상담 진행을 위해 본인 확인이 한 번 필요합니다.
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
              disabled={loading || blocked}
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

        {error ? <p className="text-[15px] text-red-600">{error}</p> : null}

        {blocked ? (
          <div className="rounded-xl bg-[#F7F6F8] p-4">
            <p className="text-[16px] leading-relaxed text-[#3d2b1f]">
              이 번호로 가입된 계정이 따로 있어 자동으로 합쳐 드릴 수 없습니다.
              고객센터로 문의해 주시면 확인해 드리겠습니다.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={verify}
            disabled={loading}
            className="flex h-16 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-bold text-white disabled:opacity-40"
          >
            인증하고 계속하기
          </button>
        )}
      </div>
    </MobileShell>
  );
}
