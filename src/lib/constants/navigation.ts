export type NavTab = "home" | "products" | "consultation" | "cases" | "my";

export const BOTTOM_NAV = [
  { id: "home" as const, label: "홈", href: "/", icon: "home" },
  { id: "products" as const, label: "인생곡", href: "/products", icon: "music" },
  { id: "consultation" as const, label: "사주상담", href: "/consultation", icon: "message" },
  { id: "cases" as const, label: "사례", href: "/cases", icon: "play" },
  { id: "my" as const, label: "MY", href: "/my", icon: "user" },
] as const;

export function getActiveTab(pathname: string): NavTab {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/apply/consultation")) return "consultation";
  if (pathname.startsWith("/products") || pathname.startsWith("/apply")) return "products";
  if (pathname.startsWith("/consultation")) return "consultation";
  if (pathname.startsWith("/cases")) return "cases";
  if (pathname.startsWith("/my")) return "my";
  return "home";
}
