import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, BarChart3, Globe2, Sparkles } from "lucide-react";
import { QuickAuditHero } from "@/components/marketing/quick-audit-hero";
import { Button } from "@/components/ui/button";

/**
 * Marketing landing aligned with design/stitch-avop/screens/01-landing (structure + AVOP palette).
 * Renders inside a local `.dark` wrapper so Stitch colors apply even if the user prefers light elsewhere.
 */
export function AvopLanding() {
  const { t } = useTranslation("marketing");

  return (
    <div
      className="dark min-h-screen bg-background text-foreground"
      data-brand="avop"
    >
      <header className="border-b border-border/60 bg-card/30 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <span
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-avop-heading, var(--font-sans))" }}
          >
            AVOP
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">{t("signIn")}</Link>
            </Button>
            <Button asChild>
              <Link to="/register">{t("getStarted")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-3xl space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t("badge")}
            </p>
            <h1
              className="text-4xl font-bold leading-tight tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-avop-heading, var(--font-sans))" }}
            >
              {t("heroTitle")}
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              {t("heroSubtitle")}
            </p>
            <QuickAuditHero />
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link to="/register">
                  {t("ctaPrimary")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">{t("ctaSecondary")}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/20 py-16 md:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-3 md:px-6">
            <Feature
              icon={BarChart3}
              title={t("feature1Title")}
              body={t("feature1Body")}
            />
            <Feature
              icon={Globe2}
              title={t("feature2Title")}
              body={t("feature2Body")}
            />
            <Feature
              icon={Sparkles}
              title={t("feature3Title")}
              body={t("feature3Body")}
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        {t("footer")}
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-6">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3
        className="mb-2 font-semibold text-foreground"
        style={{ fontFamily: "var(--font-avop-heading, var(--font-sans))" }}
      >
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
