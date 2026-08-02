import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE_NAME,
  uiLocaleToAppLocale,
  type AppLocale,
} from "@/i18n/config";
import { A11Y_COOKIE_NAME, parseA11yCookie } from "@/lib/accessibility";

async function resolveLocale(): Promise<AppLocale> {
  const jar = await cookies();
  const fromLocaleCookie = jar.get(LOCALE_COOKIE_NAME)?.value;
  if (isAppLocale(fromLocaleCookie)) return fromLocaleCookie;

  const a11y = parseA11yCookie(jar.get(A11Y_COOKIE_NAME)?.value);
  if (a11y?.uiLocale) return uiLocaleToAppLocale(a11y.uiLocale);

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
