import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './en/translation.json'
import zhCN from './zh-CN/translation.json'

export const supportedLanguages = ['en', 'zh-CN'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

export const languageOptions: Array<{ value: SupportedLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '中文' },
]

const normalizeLanguage = (lng: string | undefined | null): SupportedLanguage => {
  if (!lng) return 'en'
  if (lng.toLowerCase().startsWith('zh')) return 'zh-CN'
  return 'en'
}

const setDocumentLanguage = (lng: string) => {
  document.documentElement.lang = normalizeLanguage(lng) === 'zh-CN' ? 'zh' : 'en'
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
    },
    supportedLngs: [...supportedLanguages],
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    returnNull: false,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'webhmi_lang',
    },
  })

i18n.on('languageChanged', (lng) => setDocumentLanguage(lng))
setDocumentLanguage(i18n.resolvedLanguage || i18n.language)

export default i18n
