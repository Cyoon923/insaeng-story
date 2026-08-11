import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { HeroSection } from "@/components/home/HeroSection";
import { ProgramGrid } from "@/components/home/ProgramGrid";
import { YouTubeSection } from "@/components/home/YouTubeSection";
import { QuickLinks } from "@/components/home/QuickLinks";

export default function HomePage() {
  return (
    <MobileShell>
      <AppHeader variant="home" />
      <HeroSection />
      <ProgramGrid />
      <YouTubeSection />
      <QuickLinks />
    </MobileShell>
  );
}
