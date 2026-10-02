/**
 * 인증번호 발송: 카카오 알림톡 우선 → 실패 시 같은 인증번호 SMS.
 *
 * 실행: npx tsx --experimental-test-module-mocks --test src/lib/server/smsAlimtalkFallback.test.ts
 *
 * solapi SDK(SolapiMessageService)를 메모리 대역으로 바꿔 실제 발송 없이 send 요청만 기록한다.
 * 환경변수는 테스트용 가짜 값이다.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

type Sent = Record<string, unknown> & { kakaoOptions?: Record<string, unknown> };
const sent: Sent[] = [];
/** send 호출 순서대로의 결과. true면 성공, false면 throw. 비어 있으면 성공. */
let outcomes: boolean[] = [];

mock.module("solapi", {
  namedExports: {
    SolapiMessageService: class {
      async send(message: Sent) {
        sent.push(message);
        if (outcomes.shift() === false) throw new Error("SolapiError");
        return {};
      }
    },
  },
});

process.env.SOLAPI_API_KEY = "test-key";
process.env.SOLAPI_API_SECRET = "test-secret";
process.env.SOLAPI_SENDER_NUMBER = "02-000-0000";

function setAlimtalk(on: boolean) {
  if (on) {
    process.env.SOLAPI_KAKAO_PF_ID = "test-pf";
    process.env.SOLAPI_KAKAO_VERIFY_TEMPLATE_ID = "test-template";
  } else {
    delete process.env.SOLAPI_KAKAO_PF_ID;
    delete process.env.SOLAPI_KAKAO_VERIFY_TEMPLATE_ID;
  }
}

async function send(results: boolean[]) {
  sent.length = 0;
  outcomes = [...results];
  const { sendVerificationSms } = await import("./sms.ts");
  return sendVerificationSms("010-1234-5678", "482913");
}

// 실패 로그는 기대된 동작이라 출력만 막는다. 로그 인자에 번호·코드가 없는지도 본다.
const warnings: unknown[][] = [];
console.warn = (...args: unknown[]) => {
  warnings.push(args);
};

test("알림톡 설정 + 성공: 알림톡 1회만 보낸다", async () => {
  setAlimtalk(true);
  await send([true]);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], {
    to: "01012345678",
    from: "020000000",
    type: "ATA",
    kakaoOptions: {
      pfId: "test-pf",
      templateId: "test-template",
      variables: { "#{인증번호}": "482913" },
      disableSms: false,
    },
  });
});

test("알림톡 요청이 throw하면 같은 인증번호로 SMS를 1회 보낸다", async () => {
  setAlimtalk(true);
  warnings.length = 0;
  await send([false, true]);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].type, "ATA");
  assert.deepEqual(sent[1], {
    to: "01012345678",
    from: "020000000",
    text: "[사주로그] 인증번호는 482913입니다.",
  });
  // 재생성 없음: 알림톡 변수와 SMS 본문이 같은 code다.
  assert.equal(sent[0].kakaoOptions?.variables && (sent[0].kakaoOptions.variables as Record<string, string>)["#{인증번호}"], "482913");
  const logged = JSON.stringify(warnings);
  assert.equal(logged.includes("482913"), false);
  assert.equal(logged.includes("1234"), false);
});

test("알림톡과 SMS가 모두 실패하면 throw한다(호출부의 코드 삭제·502 경로)", async () => {
  setAlimtalk(true);
  await assert.rejects(send([false, false]), /SolapiError/);
  assert.equal(sent.length, 2);
});

test("PF ID 또는 템플릿 ID가 없으면 기존 SMS만 보낸다", async () => {
  setAlimtalk(false);
  await send([true]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kakaoOptions, undefined);
  assert.equal(sent[0].text, "[사주로그] 인증번호는 482913입니다.");

  process.env.SOLAPI_KAKAO_PF_ID = "test-pf";
  delete process.env.SOLAPI_KAKAO_VERIFY_TEMPLATE_ID;
  await send([true]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kakaoOptions, undefined);
});

test("알림톡 미설정에서 SMS가 실패하면 기존처럼 throw한다", async () => {
  setAlimtalk(false);
  await assert.rejects(send([false]), /SolapiError/);
  assert.equal(sent.length, 1);
});
