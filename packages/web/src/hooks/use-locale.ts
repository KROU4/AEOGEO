import { useTranslation } from "react-i18next";

export type Locale = "en" | "ru";

export function useLocale() {
  const { i18n } = useTranslation();

  const locale = (i18n.language as Locale) || "en";

  const setLocale = (newLocale: Locale) => {
    i18n.changeLanguage(newLocale);
  };

  return { locale, setLocale };
}
