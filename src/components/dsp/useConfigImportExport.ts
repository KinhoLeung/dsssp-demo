import type { TFunction } from 'i18next'
import { useCallback, useState } from 'react'

import { webhmi } from '@/device/proto/generated/webhmi'

export type ImportValidation = {
  type: 'error' | 'warning'
  message: string
  title: string
}

export type ImportValidationResult =
  | { kind: 'ok'; data: webhmi.IDeviceConfig }
  | { kind: 'error'; validation: ImportValidation }
  | { kind: 'warning'; data: webhmi.IDeviceConfig; validation: ImportValidation }

export const cleanInternalFields = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(cleanInternalFields)
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (!key.startsWith('_')) {
        out[key] = cleanInternalFields(value)
      }
    }
    return out
  }
  return obj
}

export const buildExportConfig = (db: webhmi.IDeviceConfig): webhmi.IDeviceConfig => {
  const cleanDb = cleanInternalFields(db) as webhmi.IDeviceConfig
  if (cleanDb.db) {
    delete (cleanDb.db as Record<string, unknown>).system
  }
  return cleanDb
}

export const defaultExportFilename = (db: webhmi.IDeviceConfig | null | undefined) => {
  const deviceId = db?.deviceId || 'device'
  const firmwareVersion = db?.firmwareVersion || 'v0'
  return `${deviceId}-${firmwareVersion}-`
}

const getMajorVersion = (version: string) => version.replace(/^v/i, '').split('.')[0]

export const validateImportConfig = (
  data: webhmi.IDeviceConfig,
  currentDb: webhmi.IDeviceConfig | null,
  options: {
    t: TFunction
    ns: string
    uiText: (text: string) => string
  },
): ImportValidationResult => {
  if (!data.db) {
    throw new Error(
      options.t(`${options.ns}.import.invalidConfigMissingDb`, {
        defaultValue: 'Invalid configuration file: missing database content.',
      }),
    )
  }

  const currentDeviceId = currentDb?.deviceId
  const currentVersion = currentDb?.firmwareVersion

  if (data.deviceId && currentDeviceId && data.deviceId !== currentDeviceId) {
    return {
      kind: 'error',
      validation: {
        type: 'error',
        title: options.uiText('Device Mismatch'),
        message: options.t(`${options.ns}.import.deviceMismatch`, {
          deviceId: data.deviceId,
          currentDeviceId,
          defaultValue:
            'This configuration file is for "{{deviceId}}", but you are connected to "{{currentDeviceId}}". Importing is not allowed to prevent damage.',
        }),
      },
    }
  }

  const importMajor = data.firmwareVersion ? getMajorVersion(data.firmwareVersion) : null
  const currentMajor = currentVersion ? getMajorVersion(currentVersion) : null

  if (importMajor && currentMajor && importMajor !== currentMajor) {
    return {
      kind: 'error',
      validation: {
        type: 'error',
        title: options.uiText('Critical Version Mismatch'),
        message: options.t(`${options.ns}.import.criticalVersionMismatch`, {
          importMajor,
          currentMajor,
          defaultValue:
            'This configuration (Major v{{importMajor}}) is incompatible with your device (Major v{{currentMajor}}). To prevent damage, importing is not allowed.',
        }),
      },
    }
  }

  if (data.firmwareVersion && currentVersion && data.firmwareVersion !== currentVersion) {
    return {
      kind: 'warning',
      data,
      validation: {
        type: 'warning',
        title: options.uiText('Version Mismatch'),
        message: options.t(`${options.ns}.import.versionMismatch`, {
          firmwareVersion: data.firmwareVersion,
          currentVersion,
          defaultValue:
            'The configuration version ({{firmwareVersion}}) does not match the device version ({{currentVersion}}). Some parameters might behave unexpectedly. Do you want to continue?',
        }),
      },
    }
  }

  return { kind: 'ok', data }
}

export const encodeExportConfig = (db: webhmi.IDeviceConfig) =>
  webhmi.DeviceConfig.encode(buildExportConfig(db)).finish()

export function useConfigImportExport(options: {
  db: webhmi.IDeviceConfig | null
  ns: string
  t: TFunction
  uiText: (text: string) => string
  applyImportData: (data: webhmi.IDeviceConfig) => void | Promise<void>
}) {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportFilename, setExportFilename] = useState('')
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [pendingImportData, setPendingImportData] = useState<webhmi.IDeviceConfig | null>(null)
  const [importValidation, setImportValidation] = useState<ImportValidation | null>(null)

  const performExport = useCallback(() => {
    if (!options.db) return

    const buffer = encodeExportConfig(options.db)
    const blob = new Blob([buffer as BlobPart], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const finalName = exportFilename.trim() || `device_config_${new Date().toISOString().replace(/[:.]/g, '-')}`
    a.download = `${finalName}.webhmi`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setIsExportDialogOpen(false)
  }, [exportFilename, options.db])

  const handleExport = useCallback(() => {
    setExportFilename(defaultExportFilename(options.db))
    setIsExportDialogOpen(true)
  }, [options.db])


  const confirmPendingImport = useCallback(() => {
    if (pendingImportData) {
      void options.applyImportData(pendingImportData)
    }
    setPendingImportData(null)
    setIsImportConfirmOpen(false)
  }, [options, pendingImportData])

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        const buffer = await file.arrayBuffer()
        const data = webhmi.DeviceConfig.decode(new Uint8Array(buffer))
        const result = validateImportConfig(data, options.db, {
          t: options.t,
          ns: options.ns,
          uiText: options.uiText,
        })

        if (result.kind === 'ok') {
          void options.applyImportData(result.data)
        } else {
          setImportValidation(result.validation)
          setPendingImportData(result.kind === 'warning' ? result.data : null)
          setIsImportConfirmOpen(true)
        }
      } catch (err) {
        console.error('Import failed', err)
        alert(
          options.t(`${options.ns}.import.importFailed`, {
            error: err instanceof Error ? err.message : String(err),
            defaultValue: 'Import failed: {{error}}',
          }),
        )
      } finally {
        event.target.value = ''
      }
    },
    [options],
  )

  return {
    isExportDialogOpen,
    setIsExportDialogOpen,
    exportFilename,
    setExportFilename,
    performExport,
    handleExport,
    isImportConfirmOpen,
    setIsImportConfirmOpen,
    pendingImportData,
    importValidation,
    confirmPendingImport,
    handleImport,
  }
}
