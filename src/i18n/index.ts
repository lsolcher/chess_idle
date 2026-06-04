import de from '@/locales/de.json'
import en from '@/locales/en.json'

export type AppLocale = 'en' | 'de'

const STORAGE_KEY = 'idle-chess-rpg-locale'

const catalogs: Record<AppLocale, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  de: de as Record<string, unknown>,
}

export function getAppLocale(): AppLocale {
  if (typeof localStorage === 'undefined') return 'en'
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'de' ? 'de' : 'en'
}

export function setAppLocale(locale: AppLocale): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale)
  }
}

function lookup(path: string, locale: AppLocale): string | undefined {
  const parts = path.split('.')
  let node: unknown = catalogs[locale]
  for (const part of parts) {
    if (!node || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

/** Resolves a dotted i18n key; falls back to English then the key itself. */
export function t(
  key: string,
  params?: Record<string, string | number>,
  locale: AppLocale = getAppLocale(),
): string {
  let text = lookup(key, locale) ?? lookup(key, 'en') ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}
