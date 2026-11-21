import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const languages = [
  ["az", "Azərbaycan"],
  ["en", "English"],
  ["el", "Ελληνικά"],
  ["am", "Հայերեն"],
  ["es", "Español"],
  ["it", "Italiano"],
  ["ge", "ქართული"],
  ["de", "Deutsch"],
  ["de_ch", "Schweizerdeutsch"],
  ["fr", "Français"],
  ["pl", "Polski"],
  ["nl", "Nederlands"],
  ["vi", "Tiếng Việt"],
  ["ru", "Русский"],
  ["uk", "Українська"],
  ["ro", "Română"],
  ["ar", "العربية"],
  ["tr", "Türkçe"],
  ["zh_tw", "Traditional Chinese （繁體中文)"],
  ["zh_cn", "Simplified Chinese （简体中文)"],
  ["ko", "한국어"],
  ["zh_hk", "Cantonese （粵語)"],
  ["ja", "日本語"],
  ["cs_cz", "Čeština"],
  ["sv", "Svenska"],
  ["hu", "Magyar"],
  ["kh", "ភាសាខ្មែរ"],
  ["id", "Bahasa Indonesia"],
  ["pt_br", "Português (Brasileiro)"],
] as const;

export const sortedLanguages = [...languages].sort((a, b) =>
  a[0].localeCompare(b[0]),
);

type TranslationResource = Record<string, unknown>;

const localeModules = import.meta.glob<{ default: TranslationResource }>(
  "./locales/*.json",
  {
    eager: true,
  },
);

const resources = Object.fromEntries(
  Object.entries(localeModules).flatMap(([path, module]) => {
    const lang = path.match(/\/([\w-]+)\.json$/)?.[1];
    if (!lang) return [];

    return [[lang, { translation: module.default }]];
  }),
);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: "en",
    fallbackLng: "en",
    detection: { order: [], caches: [] },
    interpolation: {
      escapeValue: false,
    },
    resources,
  });

function patchBundle(val: unknown): unknown {
  if (typeof val === "string") {
    return val.replace(/spanani Store/g, "LiveContainer + spanani Store");
  }
  if (Array.isArray(val)) {
    return val.map(patchBundle);
  }
  if (val && typeof val === "object") {
    const res: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(val)) {
      res[key] = patchBundle(value);
    }
    return res;
  }
  return val;
}

if (import.meta.env.VITE_LC) {
  const enBundle = i18n.getResourceBundle("en", "translation") as unknown;
  const patched = patchBundle(enBundle) as Record<string, unknown>;
  const flow = patched.flow as Record<string, unknown> | undefined;
  if (flow) {
    flow.step3_next_step_3 =
      "3. Open LiveContainer, then spanani Store inside it.";
  }
  i18n.addResourceBundle("en", "translation", patched, true, true);
}

export default i18n;
