import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";

type LocaleSegmentToggleProps = {
  className?: string;
  /** Landing: стеклянный тёмный трек как в Stitch; app: для топбара дашборда */
  variant?: "landing" | "app";
};

/**
 * Сегментный «слайдер» RU ↔ EN (как iOS / Stitch), без отдельной кнопки в меню.
 */
export function LocaleSegmentToggle({
  className,
  variant = "app",
}: LocaleSegmentToggleProps) {
  const { locale, setLocale } = useLocale();
  const isRu = locale === "ru";

  return (
    <div
      className={cn(
        "relative inline-flex h-9 shrink-0 items-stretch rounded-md border p-1",
        variant === "landing"
          ? "border-white/15 bg-black/40"
          : "border-border bg-muted/40 dark:border-white/10 dark:bg-white/5",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <div
        className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded bg-gradient-to-br from-primary to-[#06b6d4] shadow-sm transition-[left] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ left: isRu ? "4px" : "calc(50% + 2px)" }}
      />
      <button
        type="button"
        onClick={() => setLocale("ru")}
        className={cn(
          "relative z-[1] min-w-[2.5rem] rounded px-2 py-1 text-xs font-bold transition-colors",
          isRu
            ? "text-[#003640]"
            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-300",
        )}
      >
        RU
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "relative z-[1] min-w-[2.5rem] rounded px-2 py-1 text-xs font-bold transition-colors",
          !isRu
            ? "text-[#003640]"
            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-300",
        )}
      >
        EN
      </button>
    </div>
  );
}
