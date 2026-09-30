/**
 * 관리자 화면으로 내보내는 회원 정보.
 *
 * 저장된 User는 그대로 두고, 응답에 싣기 전에 로그인·인증에 쓰는 값만 뺀다.
 * - passwordHash: 비밀번호 해시
 * - kakaoId / naverId: 소셜 로그인 계정 식별값
 * 관리자 화면은 이 값들을 쓰지 않는다. 나머지 필드(이름·연락처·가입일·탈퇴일 등)는 그대로 둔다.
 *
 * import 경로가 상대경로·type 전용인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type { User } from "@/lib/types/app";

export type AdminUserView = Omit<User, "passwordHash" | "kakaoId" | "naverId">;

export function toAdminUserView(user: User): AdminUserView {
  const view: User = { ...user };
  delete view.passwordHash;
  delete view.kakaoId;
  delete view.naverId;
  return view;
}
