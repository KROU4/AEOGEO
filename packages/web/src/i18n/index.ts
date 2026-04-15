import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enDashboard from "./locales/en/dashboard.json";
import enVisibility from "./locales/en/visibility.json";
import enContent from "./locales/en/content.json";
import enReports from "./locales/en/reports.json";
import enProjects from "./locales/en/projects.json";
import enWidgets from "./locales/en/widgets.json";
import enSettings from "./locales/en/settings.json";
import enAdmin from "./locales/en/admin.json";
import enOnboarding from "./locales/en/onboarding.json";
import enQueries from "./locales/en/queries.json";
import enRuns from "./locales/en/runs.json";
import enAnswers from "./locales/en/answers.json";
import enFunnel from "./locales/en/funnel.json";
import enExplorer from "./locales/en/explorer.json";
import enMarketing from "./locales/en/marketing.json";

import ruCommon from "./locales/ru/common.json";
import ruAuth from "./locales/ru/auth.json";
import ruDashboard from "./locales/ru/dashboard.json";
import ruVisibility from "./locales/ru/visibility.json";
import ruContent from "./locales/ru/content.json";
import ruReports from "./locales/ru/reports.json";
import ruProjects from "./locales/ru/projects.json";
import ruWidgets from "./locales/ru/widgets.json";
import ruSettings from "./locales/ru/settings.json";
import ruAdmin from "./locales/ru/admin.json";
import ruOnboarding from "./locales/ru/onboarding.json";
import ruQueries from "./locales/ru/queries.json";
import ruRuns from "./locales/ru/runs.json";
import ruAnswers from "./locales/ru/answers.json";
import ruFunnel from "./locales/ru/funnel.json";
import ruExplorer from "./locales/ru/explorer.json";
import ruMarketing from "./locales/ru/marketing.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        visibility: enVisibility,
        content: enContent,
        reports: enReports,
        projects: enProjects,
        widgets: enWidgets,
        settings: enSettings,
        admin: enAdmin,
        onboarding: enOnboarding,
        queries: enQueries,
        runs: enRuns,
        answers: enAnswers,
        funnel: enFunnel,
        explorer: enExplorer,
        marketing: enMarketing,
      },
      ru: {
        common: ruCommon,
        auth: ruAuth,
        dashboard: ruDashboard,
        visibility: ruVisibility,
        content: ruContent,
        reports: ruReports,
        projects: ruProjects,
        widgets: ruWidgets,
        settings: ruSettings,
        admin: ruAdmin,
        onboarding: ruOnboarding,
        queries: ruQueries,
        runs: ruRuns,
        answers: ruAnswers,
        funnel: ruFunnel,
        explorer: ruExplorer,
        marketing: ruMarketing,
      },
    },
    defaultNS: "common",
    fallbackLng: "en",
    supportedLngs: ["en", "ru"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "aeogeo_locale",
      caches: ["localStorage"],
    },
  });

export default i18n;
