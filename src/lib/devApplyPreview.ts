/**
 * localhost(`next dev`) 전용 신청 화면 미리보기 스위치.
 *
 * 사주 인생곡 신청 1→4단계를 입력 없이 넘겨 보고, 10/04 전에도 OPEN EVENT 화면을 보기 위한 값이다.
 * Production·Vercel Preview 빌드는 NODE_ENV가 "production"이라 언제나 false이고,
 * 서버 검증·가격·결제는 이 값을 보지 않는다.
 */
export const DEV_APPLY_PREVIEW = process.env.NODE_ENV === "development";

/** 미리보기를 적용하는 신청 플로우. 다른 플로우는 dev에서도 기존과 같다. */
export const DEV_APPLY_PREVIEW_FLOW = "saju-song";
