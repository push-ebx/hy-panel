"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { locales, type Locale } from "@/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const labels: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
};

export function LocaleSwitcher() {
  const router = useRouter();
  const locale = useLocale() as Locale;

  const handleChange = (value: string) => {
    document.cookie = `locale=${value};path=/;max-age=31536000`;
    router.refresh();
  };

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-[120px] h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {labels[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
