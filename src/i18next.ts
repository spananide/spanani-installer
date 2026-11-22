import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

i18n
  .use(initReactI18next)
  .init({
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: en,
      },
    },
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
