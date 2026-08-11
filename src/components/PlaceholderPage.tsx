import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <MobileShell>
      <AppHeader variant="page" title={title} backHref="/" />
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-lg font-bold text-brown-dark">{title}</p>
        <p className="mt-2 text-sm text-brown-light">준비 중입니다.</p>
      </div>
    </MobileShell>
  );
}
