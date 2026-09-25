"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/lib/client/api";
import { phoneDigits } from "@/lib/phoneVerification";

/**
 * 신청 화면에 들어온 회원이 휴대폰 본인확인을 마쳤는지 보고, 아니면 인증 화면으로 보낸다.
 *
 * ── 왜 여기인가 ──
 *
 * 신청 20개 화면이 모두 ApplyLayout을 쓴다. 그 한 곳에 이 컴포넌트를 두면 네 상품의
 * 신청 진입이 한 번에 덮인다. 상품 상세의 "신청하기" 버튼을 가로채는 방식은
 * 버튼이 세 곳에 흩어져 있고(상품 상세 공통 + 상담 화면 둘), 주소를 직접 열거나
 * 챗봇·북마크로 들어오는 길을 막지 못한다. 여기가 실제 흐름의 경계다.
 *
 * ── 서버 관문을 대신하지 않는다 ──
 *
 * 주문·상담·결제는 서버가 막는다(api/app의 verifiedPhoneGate 3곳). 이 컴포넌트는
 * 막힐 것을 알면서 신청서를 다 쓰게 두지 않으려는 안내다. 화면을 우회해도 서버가 막는다.
 *
 * ── 판정 ──
 *
 *   로그인 안 됨        아무것도 하지 않는다. 기존 로그인 관문(proxy.ts)이 맡는다.
 *                       로컬·Preview에서는 비로그인으로 화면을 열어 보는 흐름이 있어
 *                       여기서 가로채면 그 흐름이 막힌다.
 *   본인확인 마침       아무것도 하지 않는다.
 *   본인확인 전         /my/verify-phone?next=<지금 주소>로 보낸다.
 *
 * 확인이 끝나기 전에는 아무것도 하지 않는다. 신청서를 먼저 보여 주고, 보낼 곳이
 * 정해지면 그때 옮긴다. 확인 중에 화면을 비우면 정상 회원도 매번 빈 화면을 보게 된다.
 */
export function ApplyPhoneGate() {
  const router = useRouter();
  // 보낼 곳이 정해진 뒤에는 신청 내용을 지운다. 사라질 화면을 계속 보여 주지 않는다.
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        const user = data.user as { phone?: string } | null | undefined;
        // 비로그인은 기존 관문이 맡는다.
        if (!user) return;
        if (phoneDigits(String(user.phone ?? "")).length >= 10) return;

        /**
         * 돌아올 주소. useSearchParams 대신 이 자리에서 직접 읽는다.
         * 그 훅은 정적으로 만들어지는 화면에서 Suspense 경계를 요구해, 신청 20개 화면에
         * 경계를 넣게 만든다. 이 코드는 브라우저에서만 도는 effect 안이라 필요하지 않다.
         * 서버가 safeNextPath로 다시 검사하므로 여기서 만든 값이 그대로 쓰이지는 않는다.
         */
        const back = `${window.location.pathname}${window.location.search}`;
        setLeaving(true);
        router.replace(`/my/verify-phone?next=${encodeURIComponent(back)}`);
      })
      // 확인에 실패하면 막지 않는다. 서버 관문이 여전히 남아 있다.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!leaving) return null;
  // 이동하는 동안 신청 내용을 덮는다.
  return <div className="fixed inset-0 z-50 bg-[#FFFDF9]" aria-hidden />;
}
