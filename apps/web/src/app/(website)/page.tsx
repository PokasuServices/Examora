import { Suspense } from "react";
import { HomeGate } from "@/components/home-gate";
import { Audience } from "@/components/website/Audience";
import { CtaBand } from "@/components/website/CtaBand";
import { Features } from "@/components/website/Features";
import { Hero } from "@/components/website/Hero";
import { HomepageBanner } from "@/components/website/HomepageBanner";
import { HowItWorks } from "@/components/website/HowItWorks";

/**
 * Website home page for signed-out visitors. Signed-in visitors are sent
 * straight to their dashboard by HomeGate.
 */
export default function HomePage() {
  return (
    <HomeGate>
      <main>
        <Hero
          banner={
            <Suspense fallback={null}>
              <HomepageBanner />
            </Suspense>
          }
        />
        <Features />
        <HowItWorks />
        <Audience />
        <CtaBand />
      </main>
    </HomeGate>
  );
}
