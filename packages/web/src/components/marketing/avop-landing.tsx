import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  Cpu,
  LayoutGrid,
  MessageSquare,
  Network,
  Rocket,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { QuickAuditHero } from "@/components/marketing/quick-audit-hero";
import { Button } from "@/components/ui/button";
import { LocaleSegmentToggle } from "@/components/ui/locale-segment-toggle";
import { cn } from "@/lib/utils";

/**
 * Full marketing landing from Stitch export (AVOP — Landing Page).
 * Dot-grid background, nav, hero + audit, marquee, shift, methodology, bento, footer.
 */
export function AvopLanding() {
  return (
    <div
      className="dark min-h-screen text-foreground selection:bg-primary/30 selection:text-primary"
      data-brand="avop"
      style={{
        backgroundColor: "#0d0e0f",
        backgroundImage:
          "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0)",
        backgroundSize: "64px 64px",
      }}
    >
      <LandingNav />

      <main>
        <HeroSection />
        <MarqueeSection />
        <SearchShiftSection />
        <GeoMethodologySection />
        <EngineBentoSection />
      </main>

      <LandingFooter />
    </div>
  );
}

function LandingNav() {
  const { t } = useTranslation("marketing");
  const nav = [
    { href: "#product", labelKey: "landing.navProduct" as const },
    { href: "#solutions", labelKey: "landing.navSolutions" as const },
    { href: "#enterprise", labelKey: "landing.navEnterprise" as const },
    { href: "#pricing", labelKey: "landing.navPricing" as const },
  ];

  return (
    <nav className="fixed top-0 z-50 w-full bg-transparent backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
        <span
          className="text-2xl font-bold tracking-tight text-white"
          style={{ fontFamily: "var(--font-avop-display, var(--font-sans))" }}
        >
          {t("landing.logo")}
        </span>
        <div className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors duration-200",
                item.href === "#product"
                  ? "font-bold text-cyan-400"
                  : "text-neutral-400 hover:text-cyan-400",
              )}
            >
              {t(item.labelKey)}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <LocaleSegmentToggle variant="landing" />
          <Button
            asChild
            className="scale-95 rounded-lg bg-gradient-to-br from-primary to-[#06b6d4] px-5 py-2.5 text-sm font-bold text-[#003640] shadow-sm active:scale-90"
          >
            <Link to="/login">{t("signIn")}</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  const { t } = useTranslation("marketing");

  return (
    <section className="relative overflow-hidden px-8 pb-24 pt-32" id="product">
      <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
        <div className="z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold tracking-widest text-primary uppercase">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {t("landing.heroBadge")}
          </div>
          <h1
            className="mb-8 text-6xl leading-[0.9] font-extrabold tracking-tight md:text-8xl"
            style={{ fontFamily: "var(--font-avop-display, var(--font-sans))" }}
          >
            {t("landing.heroTitleLine1")}
            <br />
            {t("landing.heroTitleLine2")}{" "}
            <span className="text-primary italic">{t("landing.heroTitleAccent")}</span>
          </h1>
          <p className="mb-10 max-w-xl text-lg leading-relaxed text-[#bcc9cd] md:text-xl">
            {t("landing.heroSubtitle")}
          </p>
          <QuickAuditHero landingInline />
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-neutral-500">
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              {t("landing.heroCheck1")}
            </span>
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              {t("landing.heroCheck2")}
            </span>
          </div>
        </div>
        <HeroDashboardPreview />
        <div className="pointer-events-none absolute -top-12 -right-12 -z-10 h-64 w-64 rounded-full bg-primary/20 blur-[100px] max-lg:hidden" />
      </div>
    </section>
  );
}

function HeroDashboardPreview() {
  const { t } = useTranslation("marketing");

  return (
    <div className="perspective-[1000px] relative hidden lg:block">
      <div className="transition-transform duration-700 [transform:rotateY(-12deg)_rotateX(4deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)]">
        <div className="glass-panel rounded-xl border border-white/10 p-8 shadow-2xl">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <div className="mb-1 text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
                {t("landing.previewSentimentLabel")}
              </div>
              <div className="font-mono text-2xl text-primary">82.4%</div>
            </div>
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
              style={{ animationDuration: "3s" }}
            />
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg bg-[#0d0e0f] p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-neutral-400" />
                <span className="text-sm font-medium">{t("landing.previewRow1")}</span>
              </div>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full w-[73%] bg-primary" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#0d0e0f] p-4">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-neutral-400" />
                <span className="text-sm font-medium">{t("landing.previewRow2")}</span>
              </div>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full w-[45%] bg-[#4ae176]" />
              </div>
            </div>
            <div className="pt-4">
              <div className="mb-3 text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
                {t("landing.previewChartLabel")}
              </div>
              <svg className="h-24 w-full" viewBox="0 0 400 100" aria-hidden>
                <defs>
                  <linearGradient id="avop-hero-grad" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#4cd7f6" stopOpacity="1" />
                    <stop offset="100%" stopColor="#4cd7f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,80 Q50,70 100,85 T200,40 T300,50 T400,20"
                  fill="none"
                  stroke="#4cd7f6"
                  strokeWidth="3"
                />
                <path
                  d="M0,80 Q50,70 100,85 T200,40 T300,50 T400,20 V100 H0 Z"
                  fill="url(#avop-hero-grad)"
                  opacity="0.1"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarqueeSection() {
  const { t } = useTranslation("marketing");
  const keys = [
    "landing.marquee1",
    "landing.marquee2",
    "landing.marquee3",
    "landing.marquee4",
    "landing.marquee5",
    "landing.marquee6",
  ] as const;
  const icons: ComponentType<{ className?: string }>[] = [
    Cpu,
    Activity,
    LayoutGrid,
    Sparkles,
    LayoutGrid,
    Sparkles,
  ];

  const renderSegment = (suffix: string) =>
    keys.map((k, i) => {
      const Icon = icons[i] ?? Sparkles;
      return (
        <span
          key={`${suffix}-${k}-${i}`}
          className="flex shrink-0 items-center gap-2 text-2xl font-bold whitespace-nowrap"
          style={{ fontFamily: "var(--font-avop-heading, var(--font-sans))" }}
        >
          <Icon className="h-6 w-6 shrink-0" />
          {t(k)}
        </span>
      );
    });

  return (
    <div className="overflow-hidden border-y border-white/5 bg-[#0d0e0f] py-8">
      <div className="avop-landing-marquee flex items-center opacity-40 grayscale transition-all hover:opacity-100 hover:grayscale-0">
        <div className="flex shrink-0 items-center gap-16 pr-16">{renderSegment("a")}</div>
        <div className="flex shrink-0 items-center gap-16 pr-16" aria-hidden>
          {renderSegment("b")}
        </div>
      </div>
    </div>
  );
}

function SearchShiftSection() {
  const { t } = useTranslation("marketing");
  const pillars = [
    { n: "01", titleKey: "landing.pillar1Title", bodyKey: "landing.pillar1Body" },
    { n: "02", titleKey: "landing.pillar2Title", bodyKey: "landing.pillar2Body" },
    { n: "03", titleKey: "landing.pillar3Title", bodyKey: "landing.pillar3Body" },
  ] as const;

  return (
    <section className="mx-auto max-w-7xl px-8 py-24" id="solutions">
      <div className="mb-20 flex flex-col items-end justify-between gap-8 md:flex-row">
        <div className="max-w-2xl">
          <h2
            className="mb-6 text-4xl font-bold md:text-5xl"
            style={{ fontFamily: "var(--font-avop-display, var(--font-sans))" }}
          >
            {t("landing.shiftTitle")}
          </h2>
          <p className="leading-relaxed text-[#bcc9cd]">{t("landing.shiftSubtitle")}</p>
        </div>
        <div className="flex gap-4">
          <div className="rounded-lg border border-white/5 bg-[#1b1c1d] px-6 py-4 text-center">
            <div className="mb-1 font-mono text-3xl text-primary">{t("landing.stat1Value")}</div>
            <div className="text-[10px] font-bold tracking-tighter text-neutral-500 uppercase">
              {t("landing.stat1Label")}
            </div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#1b1c1d] px-6 py-4 text-center">
            <div className="mb-1 font-mono text-3xl text-[#4ae176]">{t("landing.stat2Value")}</div>
            <div className="text-[10px] font-bold tracking-tighter text-neutral-500 uppercase">
              {t("landing.stat2Label")}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
        {pillars.map((p) => (
          <div key={p.n} className="group">
            <div className="mb-6 font-mono text-7xl text-white/10 transition-colors group-hover:text-primary/20">
              {p.n}
            </div>
            <h3 className="mb-4 text-xl font-bold">{t(p.titleKey)}</h3>
            <p className="text-sm leading-relaxed text-neutral-500">{t(p.bodyKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function GeoMethodologySection() {
  const { t } = useTranslation("marketing");
  const cols = [
    {
      icon: "architecture" as const,
      titleKey: "landing.methodMeasureTitle",
      bodyKey: "landing.methodMeasureBody",
      bullets: ["landing.methodMeasureB1", "landing.methodMeasureB2"] as const,
      color: "primary" as const,
    },
    {
      icon: "build" as const,
      titleKey: "landing.methodFixTitle",
      bodyKey: "landing.methodFixBody",
      bullets: ["landing.methodFixB1", "landing.methodFixB2"] as const,
      color: "tertiary" as const,
    },
    {
      icon: "stars" as const,
      titleKey: "landing.methodDominateTitle",
      bodyKey: "landing.methodDominateBody",
      bullets: ["landing.methodDominateB1", "landing.methodDominateB2"] as const,
      color: "white" as const,
    },
  ];

  return (
    <section className="bg-[#0d0e0f] py-32" id="enterprise">
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-24 text-center">
          <h2
            className="mb-4 text-4xl font-bold italic"
            style={{ fontFamily: "var(--font-avop-display, var(--font-sans))" }}
          >
            {t("landing.methodologyTitle")}
          </h2>
          <div className="mx-auto h-1 w-24 bg-primary" />
        </div>
        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/5 md:grid-cols-3">
          {cols.map((col, idx) => (
            <div
              key={col.titleKey}
              className={cn(
                "group border-white/5 p-12 transition-colors hover:bg-[#1b1c1d]",
                idx < 2 ? "border-b md:border-r md:border-b-0" : "",
              )}
            >
              <MethodIcon kind={col.icon} color={col.color} />
              <h4 className="mb-4 text-2xl font-bold">{t(col.titleKey)}</h4>
              <p className="mb-6 text-neutral-500">{t(col.bodyKey)}</p>
              <ul className="space-y-3 font-mono text-xs text-neutral-400">
                {col.bullets.map((bk) => (
                  <li key={bk} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        col.color === "primary" && "bg-primary",
                        col.color === "tertiary" && "bg-[#4ae176]",
                        col.color === "white" && "bg-white",
                      )}
                    />
                    {t(bk)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MethodIcon({
  kind,
  color,
}: {
  kind: "architecture" | "build" | "stars";
  color: "primary" | "tertiary" | "white";
}) {
  const className = cn(
    "mb-8 h-10 w-10",
    color === "primary" && "text-primary",
    color === "tertiary" && "text-[#4ae176]",
    color === "white" && "text-white",
  );
  if (kind === "architecture") {
    return <LayoutGrid className={className} strokeWidth={1.5} />;
  }
  if (kind === "build") {
    return <Wrench className={className} strokeWidth={1.5} />;
  }
  return <Sparkles className={className} strokeWidth={1.5} />;
}

function EngineBentoSection() {
  const { t } = useTranslation("marketing");

  return (
    <section className="mx-auto max-w-7xl px-8 py-24" id="pricing">
      <h2 className="mb-12 flex items-center gap-4 text-3xl font-bold">
        {t("landing.engineTitle")}
        <span className="h-px min-w-[4rem] flex-grow bg-white/5" />
      </h2>
      <div className="grid h-auto grid-cols-1 gap-4 md:h-[600px] md:grid-cols-4 md:grid-rows-2">
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/5 bg-[#1b1c1d] p-10 transition-colors hover:border-primary/30 md:col-span-2 md:row-span-2">
          <div className="relative z-10">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Network className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-4 text-3xl font-bold">{t("landing.bentoLargeTitle")}</h3>
            <p className="max-w-md text-neutral-400">{t("landing.bentoLargeBody")}</p>
          </div>
          <div className="relative z-10 mt-8 flex flex-wrap gap-2">
            {["GPT-5", "PERPLEXITY", "CLAUDE 4.6"].map((tag) => (
              <span
                key={tag}
                className="rounded bg-[#343536] px-3 py-1 font-mono text-[10px]"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-primary/5 blur-[60px] transition-colors group-hover:bg-primary/10" />
        </div>

        <div className="group flex items-center justify-between rounded-xl border border-white/5 bg-[#1b1c1d] p-8 transition-colors hover:border-[#4ae176]/30 md:col-span-2">
          <div>
            <h4 className="mb-2 text-xl font-bold">{t("landing.bentoRagTitle")}</h4>
            <p className="max-w-xs text-sm text-neutral-500">{t("landing.bentoRagBody")}</p>
          </div>
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#4ae176]/30 animate-spin"
            style={{ animationDuration: "10s" }}
          >
            <ArrowRightLeft className="h-8 w-8 text-[#4ae176]" />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-white/5 bg-[#0d0e0f] p-6 transition-colors hover:bg-[#1b1c1d]">
          <Activity className="h-6 w-6 text-neutral-500" />
          <div>
            <div className="mb-1 font-mono text-2xl text-white">{t("landing.bentoStatValue")}</div>
            <div className="text-[10px] font-bold text-neutral-600 uppercase">
              {t("landing.bentoStatLabel")}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-primary p-6 text-[#003640] transition-transform hover:scale-[0.98]">
          <Rocket className="h-8 w-8" />
          <div className="text-lg leading-tight font-bold">{t("landing.bentoCtaCard")}</div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  const { t } = useTranslation("marketing");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 bg-[#0d0e0f] pt-20 pb-10">
      <div className="mx-auto mb-16 grid max-w-7xl grid-cols-1 gap-12 px-12 md:grid-cols-4">
        <div>
          <div
            className="mb-6 text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-avop-display, var(--font-sans))" }}
          >
            {t("landing.logo")}
          </div>
          <p className="text-sm leading-relaxed text-neutral-500">{t("landing.footerTagline")}</p>
        </div>
        <div>
          <h5 className="mb-6 text-xs font-medium tracking-wider text-primary uppercase">
            {t("landing.footerColProduct")}
          </h5>
          <ul className="space-y-4 text-sm text-neutral-400">
            <li>
              <a className="transition-colors hover:text-white" href="#">
                {t("landing.footerLinkAudit")}
              </a>
            </li>
            <li>
              <a className="transition-colors hover:text-white" href="#">
                {t("landing.footerLinkBias")}
              </a>
            </li>
            <li>
              <a className="transition-colors hover:text-white" href="#">
                {t("landing.footerLinkApi")}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h5 className="mb-6 text-xs font-medium tracking-wider text-neutral-400 uppercase">
            {t("landing.footerColCompany")}
          </h5>
          <ul className="space-y-4 text-sm text-neutral-400">
            <li>
              <a className="transition-colors hover:text-white" href="#">
                {t("landing.footerLinkResearch")}
              </a>
            </li>
            <li>
              <a className="transition-colors hover:text-white" href="#">
                {t("landing.footerLinkBrand")}
              </a>
            </li>
            <li>
              <a className="transition-colors hover:text-white" href="#">
                {t("landing.footerLinkGuide")}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h5 className="mb-6 text-xs font-medium tracking-wider text-neutral-400 uppercase">
            {t("landing.footerColSubscribe")}
          </h5>
          <div className="flex border-b border-white/20 pb-2">
            <input
              type="email"
              placeholder={t("landing.footerEmailPlaceholder")}
              className="w-full border-0 bg-transparent p-0 text-sm text-white placeholder:text-neutral-500 focus:ring-0 focus-visible:ring-0"
            />
            <button type="button" className="text-primary" aria-label={t("landing.footerSubscribeAria")}>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 border-t border-white/5 px-12 pt-10 md:flex-row">
        <div className="text-xs tracking-wider text-neutral-600 uppercase">
          {t("landing.footerCopyright", { year })}
        </div>
        <div className="flex gap-8">
          <a className="text-xs tracking-wider text-neutral-600 uppercase transition-colors hover:text-white" href="#">
            {t("landing.footerLegal")}
          </a>
          <a className="text-xs tracking-wider text-neutral-600 uppercase transition-colors hover:text-white" href="#">
            {t("landing.footerPrivacy")}
          </a>
          <a className="text-xs tracking-wider text-neutral-600 uppercase transition-colors hover:text-white" href="#">
            {t("landing.footerLanguage")}
          </a>
        </div>
      </div>
    </footer>
  );
}
