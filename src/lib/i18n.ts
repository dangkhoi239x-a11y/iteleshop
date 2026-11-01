import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en";
import vi from "@/locales/vi";
import ru from "@/locales/ru";
import zh from "@/locales/zh";

export const LANGUAGES = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文" },
] as const;
export type Lang = (typeof LANGUAGES)[number]["code"];

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, vi: { translation: vi }, ru: { translation: ru }, zh: { translation: zh } },
    lng: "vi",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export default i18n;
