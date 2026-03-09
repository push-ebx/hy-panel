import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { locales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("locale")?.value as Locale) || "en";
  const validLocale = locales.includes(locale) ? locale : "en";

  return {
    locale: validLocale,
    messages: (await import(`../../messages/${validLocale}.json`)).default,
  };
});
