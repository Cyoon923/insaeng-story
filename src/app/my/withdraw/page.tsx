"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";
import type { WithdrawBlocker } from "@/lib/server/withdrawAccount";

/** 서버가 내려주는 로그인 수단. 실제 비밀번호 해시나 소셜 id는 담기지 않는다. */
interface AuthMethods {
  password: boolean;
  kakao: boolean;
  naver: boolean;
}

const primaryButton =
  "flex h-14 w-full items-center justify-center rounded-lg bg-[#403A49] text-[16px] font-bold text-white disabled:opacity-40";
const subButton =
  "flex h-14 w-full items-center justify-center rounded-lg border border-[#e8dfd4] bg-white text-[16px] font-semibold text-[#403A49]";
const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#403A49]";

/** 어떤 사유로 실패했는지는 알려주지 않는다. 화면에는 늘 같은 문구를 쓴다. */
const VERIFY_FAILED = "본인 확인에 실패했습니다. 다시 시도해 주세요.";

function WithdrawPage() {
  const router = useRouter();
  const params = useSearchParams();
  const verified = params.get("verified") === "1";
  const oauthFailed = Boolean(params.get("error"));

  // 소셜 재인증을 마치고(또는 실패하고) 돌아온 경우에는 마지막 단계에서 이어서 진행한다.
  const [step, setStep] = useState(verified || oauthFailed ? 3 : 1);
  const [auth, setAuth] = useState<AuthMethods | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(oauthFailed ? VERIFY_FAILED : "");
  const [blockers, setBlockers] = useState<WithdrawBlocker[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setLoggedIn(Boolean(data.user));
        setAuth((data.authMethods ?? null) as AuthMethods | null);
      })
      .catch(() => {
        setLoggedIn(false);
      });
  }, []);

  const usePassword = auth?.password === true;
  // 소셜 전용 회원은 재인증을 마쳐야 최종 버튼을 누를 수 있다.
  const canSubmit = usePassword ? password.length > 0 : verified;

  const submit = async () => {
    if (loading) return;
    setError("");
    setBlockers([]);
    setLoading(true);
    try {
      const res = await fetch("/api/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          usePassword ? { action: "withdrawAccount", password } : { action: "withdrawAccount" },
        ),
      });
      const data = (await res.json()) as {
        error?: string;
        blockers?: WithdrawBlocker[];
      };

      if (res.status === 409) {
        // 진행 중인 주문·상담·결제가 있는 경우. 사유를 그대로 보여준다.
        setBlockers(data.blockers ?? []);
        setLoading(false);
        return;
      }
      if (res.status === 400) {
        setError(VERIFY_FAILED);
        setPassword("");
        setLoading(false);
        return;
      }
      if (res.status === 401) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setLoading(false);
        return;
      }

      // 결제 스냅샷 정리 결과(paymentSnapshotScrubbed)는 회원에게 알리지 않는다.
      // 탈퇴 자체는 끝났기 때문이다.
      setDone(true);
    } catch {
      setError("탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <MobileShell>
        <AppHeader variant="page" title="회원탈퇴" />
        <section className="px-4 py-10 text-center">
          <p className="text-[20px] font-bold text-[#403A49]">탈퇴가 완료되었습니다</p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6B6570]">
            그동안 인생스토리를 이용해 주셔서 감사합니다.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className={`mt-8 ${primaryButton}`}
          >
            홈으로
          </button>
        </section>
      </MobileShell>
    );
  }

  if (loggedIn === false) {
    return (
      <MobileShell>
        <AppHeader variant="page" title="회원탈퇴" backHref="/my" />
        <section className="px-4 py-10 text-center">
          <p className="text-[15px] leading-relaxed text-[#6B6570]">
            로그인 후 이용할 수 있습니다.
          </p>
          <Link href="/login" className={`mt-6 ${primaryButton}`}>
            로그인하러 가기
          </Link>
        </section>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <AppHeader variant="page" title="회원탈퇴" backHref="/my" />

      <section className="px-4 py-6">
        <p className="text-[13px] font-semibold text-[#6B6570]">{step} / 3 단계</p>

        {step === 1 ? (
          <>
            <h2 className="mt-2 text-[22px] font-bold leading-relaxed text-[#403A49]">
              회원탈퇴
            </h2>
            <div className="mt-5 rounded-2xl bg-white p-5">
              <p className="text-[16px] leading-relaxed text-[#3d2b1f]">
                보유하신 포인트와 쿠폰은 회원탈퇴 즉시 소멸되며 복구되지 않습니다.
              </p>
              <p className="mt-3 text-[16px] leading-relaxed text-[#3d2b1f]">
                계속 진행하시겠습니까?
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <button type="button" onClick={() => setStep(2)} className={primaryButton}>
                계속하기
              </button>
              <Link href="/my" className={subButton}>
                취소
              </Link>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="mt-2 text-[22px] font-bold leading-relaxed text-[#403A49]">
              탈퇴 전에 확인해 주세요
            </h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-white p-5">
                <p className="text-[16px] font-semibold text-[#403A49]">작성하신 리뷰</p>
                <p className="mt-2 text-[15px] leading-relaxed text-[#3d2b1f]">
                  작성한 리뷰는 탈퇴 후에도 기존 작성자명으로 유지됩니다.
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
                  리뷰가 남는 것을 원하지 않으시면, 탈퇴하기 전에 먼저 리뷰를 삭제해 주세요.
                </p>
                <Link
                  href="/my/reviews"
                  className="mt-3 inline-flex h-12 items-center justify-center rounded-full border border-[#e8dfd4] bg-white px-5 text-[15px] font-semibold text-[#403A49]"
                >
                  내 리뷰 보러 가기
                </Link>
              </div>
              <div className="rounded-2xl bg-white p-5">
                <p className="text-[16px] font-semibold text-[#403A49]">주문·결제 기록</p>
                <p className="mt-2 text-[15px] leading-relaxed text-[#3d2b1f]">
                  관련 법령에 따라 주문·결제 기록은 일정 기간 보관될 수 있습니다.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <button type="button" onClick={() => setStep(3)} className={primaryButton}>
                계속하기
              </button>
              <button type="button" onClick={() => setStep(1)} className={subButton}>
                이전
              </button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="mt-2 text-[22px] font-bold leading-relaxed text-[#403A49]">
              정말 회원탈퇴하시겠습니까?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B6570]">
              탈퇴한 회원정보와 소멸된 포인트·쿠폰은 복구할 수 없습니다.
            </p>

            {auth === null ? (
              <p className="mt-6 text-[15px] text-[#6B6570]">회원 정보를 불러오는 중입니다...</p>
            ) : usePassword ? (
              <div className="mt-6 rounded-2xl bg-white p-5">
                <label
                  htmlFor="withdraw-password"
                  className="block text-[16px] font-semibold text-[#403A49]"
                >
                  본인 확인
                </label>
                <p className="mt-1 text-[14px] leading-relaxed text-[#6B6570]">
                  현재 비밀번호를 입력해 주세요.
                </p>
                <input
                  id="withdraw-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="현재 비밀번호"
                  className={`mt-3 ${inputClass}`}
                />
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-white p-5">
                <p className="text-[16px] font-semibold text-[#403A49]">본인 확인</p>
                {verified ? (
                  <p className="mt-2 text-[15px] leading-relaxed text-[#3d2b1f]">
                    본인 확인이 완료되었습니다. 아래에서 탈퇴를 진행해 주세요.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
                      가입하신 계정으로 본인 확인을 먼저 해 주세요.
                    </p>
                    <div className="mt-3 space-y-3">
                      {auth.kakao ? (
                        <a
                          href="/api/auth/kakao/start?purpose=withdraw"
                          className={subButton}
                        >
                          카카오로 본인 확인
                        </a>
                      ) : null}
                      {auth.naver ? (
                        <a
                          href="/api/auth/naver/start?purpose=withdraw"
                          className={subButton}
                        >
                          네이버로 본인 확인
                        </a>
                      ) : null}
                      {!auth.kakao && !auth.naver ? (
                        <p className="text-[15px] leading-relaxed text-[#6B6570]">
                          본인 확인 수단이 없습니다. 고객센터로 문의해 주세요.
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}

            {blockers.length > 0 ? (
              <div className="mt-4 rounded-2xl bg-[#F7F6F8] p-5">
                <p className="text-[16px] font-semibold text-[#403A49]">
                  진행 중인 서비스가 있어 탈퇴할 수 없습니다
                </p>
                <ul className="mt-3 space-y-2">
                  {blockers.map((item) => (
                    <li key={item.kind} className="text-[15px] leading-relaxed text-[#3d2b1f]">
                      {item.reason} ({item.count}건)
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[14px] leading-relaxed text-[#6B6570]">
                  모두 완료된 뒤에 다시 시도해 주세요.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 text-center text-[15px] leading-relaxed text-[#8a5a4a]">
                {error}
              </p>
            ) : null}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={submit}
                disabled={loading || !canSubmit}
                className={primaryButton}
              >
                {loading ? "처리 중..." : "회원탈퇴"}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={loading}
                className={subButton}
              >
                이전
              </button>
            </div>
            <p className="mt-3 text-center text-[13px] leading-relaxed text-[#6B6570]">
              위 버튼을 누르면 탈퇴가 바로 진행됩니다.
            </p>
          </>
        ) : null}
      </section>
    </MobileShell>
  );
}

export default function WithdrawRoute() {
  // useSearchParams는 Suspense 경계가 필요하다. 기다리는 동안 머리말만 보여준다.
  return (
    <Suspense
      fallback={
        <MobileShell>
          <AppHeader variant="page" title="회원탈퇴" backHref="/my" />
        </MobileShell>
      }
    >
      <WithdrawPage />
    </Suspense>
  );
}
