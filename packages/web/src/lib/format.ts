export function formatDate(
  date: string | Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(
    locale,
    options ?? { year: "numeric", month: "short", day: "numeric" },
  ).format(new Date(date));
}

export function formatNumber(num: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(num);
}

export function formatCurrency(
  amount: number,
  locale: string,
  currency = "USD",
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amount,
  );
}
