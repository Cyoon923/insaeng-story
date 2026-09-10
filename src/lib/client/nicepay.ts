/**
 * NICEPAY 결제창 호출 준비. 이 파일은 브라우저에서만 동작하며
 * 서버 승인(secretKey)과는 완전히 분리된다. NICEPAY_SECRET_KEY는 여기서 절대 쓰지 않는다.
 *
 * 이번 단계에서는 아직 어떤 화면도 이 helper를 호출하지 않는다.
 * PaySubmit 연결은 다음 단계에서 한다.
 */

/** 공식 결제창 SDK. 규격: https://pay.nicepay.co.kr/v1/js/ */
const SDK_URL = "https://pay.nicepay.co.kr/v1/js/";

/** 승인 결과를 받을 서버 경로. 라우트는 다음 단계에서 만든다. */
export const NICEPAY_RETURN_PATH = "/api/payments/nicepay/return";

/** 이번 범위에서 지원하는 결제수단. 카드 외에는 아직 열지 않는다. */
export type NicepayMethod = "card";

/** 결제창에 넘기는 값. 현재 사용하는 필드만 선언한다. */
export interface NicepayRequestPayOptions {
  clientId: string;
  method: NicepayMethod;
  /** 서버가 만든 merchantOrderId. NICEPAY orderId 규격(64byte 이내)을 지킨다. */
  orderId: string;
  /** 서버가 확정한 결제금액. 클라이언트에서 다시 계산하지 않는다. */
  amount: number;
  goodsName: string;
  /** 승인 결과를 POST로 받을 절대 URL. */
  returnUrl: string;
  /**
   * 결제창을 띄우지 못했을 때 SDK가 부르는 콜백.
   * 없으면 실패가 조용히 묻히므로 호출부에서 넣을 수 있게 열어 둔다.
   */
  fnError?: (result: NicepayErrorResult) => void;
}

/** fnError로 들어오는 값 중 우리가 실제로 읽는 필드만 선언한다. */
export interface NicepayErrorResult {
  errorMsg?: string;
  resultMsg?: string;
  resultCode?: string;
}

interface NicepaySdk {
  requestPay: (options: NicepayRequestPayOptions) => void;
}

declare global {
  interface Window {
    AUTHNICE?: NicepaySdk;
  }
}

/**
 * clientKey. 결제창 호출에만 쓰이는 공개키라 NEXT_PUBLIC_ 접두사를 쓴다.
 * 값이 없으면 잘못된 결제창을 띄우지 않고 즉시 실패시킨다.
 * next build가 이 표현식을 그대로 치환하므로 process.env를 동적으로 읽지 않는다.
 */
export function getNicepayClientKey(): string {
  const key = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY?.trim();
  if (!key) {
    throw new Error("결제 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.");
  }
  return key;
}

/**
 * 승인 결과를 받을 절대 URL. 브라우저 origin을 그대로 쓴다.
 * origin은 지금 페이지를 내려준 주소라 배포 환경마다 따로 설정할 필요가 없고,
 * 서버는 다음 단계에서 어차피 merchantOrderId로 결제 건을 다시 확인한다.
 * proxy(src/proxy.ts) matcher는 /apply/* 만 보므로 이 경로는 로그인 가드에 걸리지 않는다.
 */
export function buildNicepayReturnUrl(): string {
  if (typeof window === "undefined") {
    throw new Error("결제는 브라우저에서만 진행할 수 있습니다.");
  }
  return `${window.location.origin}${NICEPAY_RETURN_PATH}`;
}

let sdkPromise: Promise<NicepaySdk> | null = null;

/**
 * SDK를 필요한 순간에만 붙인다. 모든 화면에 스크립트를 두지 않으므로
 * 기존 신청 흐름과 다른 페이지의 동작에는 아무 영향이 없다.
 * 실패한 로드는 캐시하지 않아 다시 시도할 수 있다.
 */
export function loadNicepaySdk(): Promise<NicepaySdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("결제는 브라우저에서만 진행할 수 있습니다."));
  }
  if (window.AUTHNICE) return Promise.resolve(window.AUTHNICE);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<NicepaySdk>((resolve, reject) => {
    const fail = () => reject(new Error("결제 모듈을 불러오지 못했습니다. 다시 시도해 주세요."));
    const done = () => {
      if (window.AUTHNICE) resolve(window.AUTHNICE);
      else fail();
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", done, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    sdkPromise = null;
    throw error;
  });

  return sdkPromise;
}

/**
 * 결제창 호출. amount와 orderId는 서버(preparePayment)가 준 값을 그대로 넘긴다.
 * 여기서 금액을 만들거나 고치지 않는다.
 */
export async function openNicepayCard(input: {
  merchantOrderId: string;
  amount: number;
  goodsName: string;
  onError?: (message: string) => void;
}): Promise<void> {
  if (!input.merchantOrderId) {
    throw new Error("결제 정보를 확인할 수 없습니다. 다시 시도해 주세요.");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("결제 금액을 확인할 수 없습니다. 다시 시도해 주세요.");
  }

  const clientId = getNicepayClientKey();
  const returnUrl = buildNicepayReturnUrl();
  const sdk = await loadNicepaySdk();

  sdk.requestPay({
    clientId,
    method: "card",
    orderId: input.merchantOrderId,
    amount: input.amount,
    goodsName: input.goodsName,
    returnUrl,
    fnError: (result) => {
      input.onError?.(result.errorMsg ?? result.resultMsg ?? "결제를 진행하지 못했습니다.");
    },
  });
}
