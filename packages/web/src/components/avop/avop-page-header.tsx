import type { ReactNode } from "react";

interface AvopPageHeaderProps {
  title: string;
  description?: ReactNode;
  className?: string;
}

/** Stitch-aligned page title (Space Grotesk via --font-avop-heading). */
export function AvopPageHeader({
  title,
  description,
  className = "",
}: AvopPageHeaderProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <h2
        className="text-2xl font-bold tracking-tight text-foreground md:text-3xl"
        style={{ fontFamily: "var(--font-avop-heading, var(--font-sans))" }}
      >
        {title}
      </h2>
      {description ? (
        <p className="text-sm text-muted-foreground md:text-base">{description}</p>
      ) : null}
    </div>
  );
}
