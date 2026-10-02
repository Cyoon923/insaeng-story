/**
 * SOLAPI SMS 발송 모듈. 서버에서만 사용하며 API Key/Secret을 클라이언트로 내보내지 않는다.
 * 이 단계에서는 발송 함수만 제공하고, sendCode API와는 아직 연결하지 않는다.
 */
import { SolapiMessageService } from "solapi";

// 번들러 실수로 클라이언트에 포함되는 것을 막는다.
if (typeof window !== "undefined") {
  throw new Error("sms.ts는 서버에서만 사용할 수 있습니다.");
}

interface SolapiConfig {
  apiKey: string;
  apiSecret: string;
  senderNumber: string;
}

/** 하이픈·공백 등을 제거해 숫자만 남긴다. SOLAPI는 숫자만 받는다. */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * 필수 환경변수를 읽는다. 하나라도 비어 있으면 어떤 값이 빠졌는지 알려주며 throw한다.
 * 값 자체는 메시지에 담지 않는다.
 */
function solapiConfig(): SolapiConfig {
  const apiKey = process.env.SOLAPI_API_KEY?.trim() ?? "";
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim() ?? "";
  const senderNumber = onlyDigits(process.env.SOLAPI_SENDER_NUMBER ?? "");

  const missing: string[] = [];
  if (!apiKey) missing.push("SOLAPI_API_KEY");
  if (!apiSecret) missing.push("SOLAPI_API_SECRET");
  if (!senderNumber) missing.push("SOLAPI_SENDER_NUMBER");
  if (missing.length > 0) {
    throw new Error(`SMS 환경변수가 설정되지 않았습니다: ${missing.join(", ")}`);
  }

  return { apiKey, apiSecret, senderNumber };
}

/**
 * 인증번호 알림톡 설정. 채널(pfId)과 승인 템플릿 ID가 둘 다 있을 때만 쓴다.
 * 하나라도 없으면 null이고, 그때는 기존 SMS만 보낸다.
 */
function alimtalkConfig(): { pfId: string; templateId: string } | null {
  const pfId = process.env.SOLAPI_KAKAO_PF_ID?.trim() ?? "";
  const templateId = process.env.SOLAPI_KAKAO_VERIFY_TEMPLATE_ID?.trim() ?? "";
  return pfId && templateId ? { pfId, templateId } : null;
}

/** 인증번호 안내 문구. SMS 90바이트 안에 들어가는 짧은 형식으로 유지한다. */
export function verificationMessage(code: string): string {
  return `[사주로그] 인증번호는 ${code}입니다.`;
}

/**
 * 인증번호를 발송한다. 알림톡 설정이 있으면 알림톡을 먼저, 없으면 기존 SMS를 보낸다.
 *
 * 알림톡은 SOLAPI 대체발송(kakaoOptions.disableSms: false)을 켠다. 접수 뒤 카카오 쪽에서
 * 실패하면 SOLAPI가 같은 요청 내용으로 문자를 대신 보낸다.
 * 알림톡 요청 자체가 실패(throw)하면 같은 code로 기존 SMS를 한 번 보낸다.
 * 둘 다 실패하면 그 에러를 그대로 올린다(호출부가 저장한 코드를 지우고 502를 준다).
 * code는 인자로 받은 값만 쓴다. 여기서 새로 만들지 않는다.
 * @param phone 수신번호. 하이픈이 있어도 되며 내부에서 제거한다.
 * @param code 6자리 인증번호.
 */
export async function sendVerificationSms(phone: string, code: string): Promise<void> {
  const to = onlyDigits(phone);
  if (to.length < 10) {
    throw new Error("수신번호가 올바르지 않습니다.");
  }
  if (!/^\d{4,8}$/.test(code)) {
    throw new Error("인증번호가 올바르지 않습니다.");
  }

  const { apiKey, apiSecret, senderNumber } = solapiConfig();
  const service = new SolapiMessageService(apiKey, apiSecret);

  const alimtalk = alimtalkConfig();
  if (alimtalk) {
    try {
      await service.send({
        to,
        from: senderNumber,
        type: "ATA",
        kakaoOptions: {
          pfId: alimtalk.pfId,
          templateId: alimtalk.templateId,
          // 승인 템플릿 변수. SDK가 "#{...}" 형식 그대로 받는다.
          variables: { "#{인증번호}": code },
          // 카카오 발송 실패 시 SOLAPI가 문자로 대체 발송한다.
          disableSms: false,
        },
      });
      return;
    } catch (error) {
      // 원인 종류만 남긴다. 수신번호·인증번호는 남기지 않는다.
      console.warn("[sms] 알림톡 요청 실패, SMS로 다시 보냅니다", error instanceof Error ? error.name : "unknown");
    }
  }

  // 실패 시 SDK가 던지는 에러를 그대로 올린다. 인증번호는 로그에 남기지 않는다.
  await service.send({
    to,
    from: senderNumber,
    text: verificationMessage(code),
  });
}
