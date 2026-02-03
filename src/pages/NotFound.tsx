import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white antialiased">
      <div className="flex items-center">
        <h1 className="inline-block border-r border-white/30 mr-5 pr-5 text-2xl font-medium align-top leading-[49px]">
          404
        </h1>
        <div className="inline-block text-left align-middle">
          <h2 className="text-sm font-normal leading-[49px] m-0 p-0">{t('notFound.message')}</h2>
        </div>
      </div>
    </div>
  )
}
