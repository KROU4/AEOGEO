/** 7-point citation counts across recent runs — compact bar sparkline. */
export function CitationTrendMini({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div
      className="flex h-8 max-w-[5.5rem] items-end justify-end gap-px"
      title={values.join(" · ")}
    >
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm bg-primary/80"
          style={{
            height: `${Math.max(v > 0 ? 3 : 1, (v / max) * 28)}px`,
            opacity: v > 0 ? 1 : 0.2,
          }}
        />
      ))}
    </div>
  );
}
