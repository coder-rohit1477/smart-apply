import { auth } from "@clerk/nextjs/server";
import { CTASection } from "@/components/landing/cta-section";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { getLandingSnapshot } from "@/services/dashboard-service";
import { routes } from "@/utils/routes";

export default async function HomePage() {
  const { userId } = await auth();
  const snapshot = await getLandingSnapshot();

  const primaryHref = userId ? routes.dashboard : routes.signUp;
  const primaryLabel = userId ? "Open dashboard" : "Start for free";

  return (
    <div className="pb-16 sm:pb-24">
      <Hero
        authenticated={Boolean(userId)}
        primaryCta={{
          href: primaryHref,
          label: primaryLabel,
        }}
        secondaryCta={{
          href: "#platform",
          label: "Explore platform",
        }}
        stats={snapshot.stats}
        topMatch={snapshot.previewMatches[0]}
      />
      <FeatureGrid />
      <DashboardPreview
        metrics={snapshot.previewMetrics}
        matches={snapshot.previewMatches}
      />
      <CTASection authenticated={Boolean(userId)} />
    </div>
  );
}
