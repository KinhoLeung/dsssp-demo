import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { hasBoolean, hasNumber, type SelectOption } from './dspUtils'
import { NumberControl } from './NumberControl'
import { ParameterCard } from './ParameterCard'
import { ToggleControl } from './ToggleControl'
import type { ImportValidation } from './useConfigImportExport'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { RangeConfig } from '@/configs/parameterRanges'
import { clampToRange } from '@/configs/parameterRanges'
import type { webhmi } from '@/device/proto/generated/webhmi'
import { cn } from '@/lib/utils'

type SystemActions = {
  queueSystem: (patch: webhmi.ISetSystemRequest) => void
  flushNow: () => void | Promise<void>
  switchCurrentMode: (index: number) => void | Promise<void>
  saveMode: (index: number) => void | Promise<void>
}

export type SystemPanelProps = {
  ns: string
  uiText: (text: string) => string
  systemDb: webhmi.ISystemDb
  systemRanges: {
    micDetectionThreshold: RangeConfig
    micDetectionTime: RangeConfig
  }
  disabled: boolean
  systemModeValue?: string
  systemModeOptions: SelectOption[]
  showDanceModeCard: boolean
  showSystemDefaultsCard: boolean
  showSystemLimitsCard: boolean
  systemMusicDefaultVolumeRange: RangeConfig
  systemMicDefaultVolumeRange: RangeConfig
  systemEffectDefaultVolumeRange: RangeConfig
  systemMusicMaxVolumeRange: RangeConfig
  systemMicMaxVolumeRange: RangeConfig
  systemEffectMaxVolumeRange: RangeConfig
  isBleRenameDialogOpen: boolean
  setIsBleRenameDialogOpen: Dispatch<SetStateAction<boolean>>
  bleNameDraft: string
  setBleNameDraft: Dispatch<SetStateAction<string>>
  isModeRenameDialogOpen: boolean
  setIsModeRenameDialogOpen: Dispatch<SetStateAction<boolean>>
  modeNamesDraft: string[]
  setModeNamesDraft: Dispatch<SetStateAction<string[]>>
  isSaveModeDialogOpen: boolean
  setIsSaveModeDialogOpen: Dispatch<SetStateAction<boolean>>
  saveTargetModeIndex: number
  setSaveTargetModeIndex: Dispatch<SetStateAction<number>>
  isExportDialogOpen: boolean
  setIsExportDialogOpen: Dispatch<SetStateAction<boolean>>
  exportFilename: string
  setExportFilename: Dispatch<SetStateAction<string>>
  performExport: () => void
  handleExport: () => void
  isImportConfirmOpen: boolean
  setIsImportConfirmOpen: Dispatch<SetStateAction<boolean>>
  pendingImportData: webhmi.IDeviceConfig | null
  importValidation: ImportValidation | null
  confirmPendingImport: () => void | Promise<void>
  handleImport: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
  fileInputRef: RefObject<HTMLInputElement>
  actions: SystemActions
}


export function SystemPanel({
  ns,
  uiText,
  systemDb,
  systemRanges,
  disabled,
  systemModeValue,
  systemModeOptions,
  showDanceModeCard,
  showSystemDefaultsCard,
  showSystemLimitsCard,
  systemMusicDefaultVolumeRange,
  systemMicDefaultVolumeRange,
  systemEffectDefaultVolumeRange,
  systemMusicMaxVolumeRange,
  systemMicMaxVolumeRange,
  systemEffectMaxVolumeRange,
  isBleRenameDialogOpen,
  setIsBleRenameDialogOpen,
  bleNameDraft,
  setBleNameDraft,
  isModeRenameDialogOpen,
  setIsModeRenameDialogOpen,
  modeNamesDraft,
  setModeNamesDraft,
  isSaveModeDialogOpen,
  setIsSaveModeDialogOpen,
  saveTargetModeIndex,
  setSaveTargetModeIndex,
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
  fileInputRef,
  actions,
}: SystemPanelProps) {
  const { t } = useTranslation()


  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ParameterCard contentClassName="sm:grid-cols-2">
          <div className="grid gap-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">{uiText('BLE Name')}</Label>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{systemDb.bleName || '-'}</Label>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  setBleNameDraft(systemDb.bleName || '')
                  setIsBleRenameDialogOpen(true)
                }}
              >
                {uiText('Rename')}
              </Button>
            </div>
          </div>

          <ToggleControl
            label="Panel Lock"
            pressed={systemDb.panelLock ?? undefined}
            disabled={disabled}
            onChange={(pressed) => actions.queueSystem({ panelLock: pressed })}
          />
        </ParameterCard>

        <Dialog open={isBleRenameDialogOpen} onOpenChange={setIsBleRenameDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{uiText('Rename Bluetooth Device')}</DialogTitle>
              <DialogDescription>
                {uiText('Enter a new name for the BLE device.')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="ble-name">{uiText('New BLE Name')}</Label>
                <Input
                  id="ble-name"
                  value={bleNameDraft}
                  maxLength={64}
                  onChange={(e) => {
                    const val = e.target.value
                    if (new TextEncoder().encode(val).length <= 64) {
                      setBleNameDraft(val)
                    }
                  }}
                  placeholder={uiText('Enter BLE name')}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    const next = bleNameDraft.trim()
                    if (disabled || !next || next === (systemDb.bleName ?? '')) return
                    actions.queueSystem({ bleName: next })
                    void actions.flushNow()
                    setIsBleRenameDialogOpen(false)
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBleRenameDialogOpen(false)}>
                {uiText('Cancel')}
              </Button>
              <Button
                disabled={disabled || !bleNameDraft.trim() || bleNameDraft.trim() === (systemDb.bleName ?? '')}
                onClick={() => {
                  const next = bleNameDraft.trim()
                  if (!next) return
                  actions.queueSystem({ bleName: next })
                  void actions.flushNow()
                  setIsBleRenameDialogOpen(false)
                }}
              >
                {uiText('Modify')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{uiText('Export Configuration')}</DialogTitle>
              <DialogDescription>
                {uiText('Specify a name for your configuration file.')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="filename">{uiText('File Name')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="filename"
                    value={exportFilename}
                    onChange={(e) => setExportFilename(e.target.value)}
                    placeholder={uiText('Enter filename')}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">.webhmi</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                {uiText('Cancel')}
              </Button>
              <Button onClick={performExport}>{uiText('Export')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ParameterCard title="Mode" contentClassName="sm:grid-cols-2">
          {systemModeOptions.length > 0 && (
            <>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">
                  {uiText('Current Mode')}
                </Label>
                <Select
                  value={systemModeValue}
                  onValueChange={(value) => {
                    void actions.switchCurrentMode(Number(value))
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={uiText('Select mode')} />
                  </SelectTrigger>
                  <SelectContent>
                    {systemModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1 sm:col-span-2">
                <Button
                  variant="outline"
                  className="text-xs h-9"
                  disabled={disabled || !systemDb.modeList?.length}
                  onClick={() => {
                    if (typeof systemDb.currentModeIndex === 'number') setSaveTargetModeIndex(systemDb.currentModeIndex)
                    setIsSaveModeDialogOpen(true)
                  }}
                >
                  {uiText('Save')}
                </Button>
                <Button
                  variant="outline"
                  className="text-xs h-9"
                  disabled={disabled || !systemDb.modeList?.length}
                  onClick={() => {
                    setModeNamesDraft(systemDb.modeList ?? [])
                    setIsModeRenameDialogOpen(true)
                  }}
                >
                  {uiText('Rename')}
                </Button>
              </div>
            </>
          )}

          <Dialog open={isSaveModeDialogOpen} onOpenChange={setIsSaveModeDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{uiText('Save Current to Mode')}</DialogTitle>
                <DialogDescription>
                  {uiText(
                    'This will overwrite the selected mode with your current parameters. This action cannot be undone.',
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>{uiText('Target Mode')}</Label>
                  <Select
                    value={String(saveTargetModeIndex)}
                    onValueChange={(v) => setSaveTargetModeIndex(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={uiText('Select mode')} />
                    </SelectTrigger>
                    <SelectContent>
                      {systemModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSaveModeDialogOpen(false)}>
                  {uiText('Cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    void actions.saveMode(saveTargetModeIndex)
                    setIsSaveModeDialogOpen(false)
                  }}
                >
                  {uiText('Confirm Save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isModeRenameDialogOpen} onOpenChange={setIsModeRenameDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{uiText('Rename Modes')}</DialogTitle>
                <DialogDescription>
                  {uiText('Enter new names for all available modes.')}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                {modeNamesDraft.map((name, index) => (
                  <div key={index} className="grid gap-2">
                    <Label htmlFor={`mode-name-${index}`}>
                      {uiText('Mode')} {index + 1}
                    </Label>
                    <Input
                      id={`mode-name-${index}`}
                      value={name}
                      maxLength={64}
                      onChange={(e) => {
                        const val = e.target.value
                        if (new TextEncoder().encode(val).length <= 64) {
                          const next = [...modeNamesDraft]
                          next[index] = val
                          setModeNamesDraft(next)
                        }
                      }}
                      placeholder={t(`${ns}.mode.enterName`, {
                        index: index + 1,
                        defaultValue: 'Enter mode {{index}} name',
                      })}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModeRenameDialogOpen(false)}>
                  {uiText('Cancel')}
                </Button>
                <Button
                  disabled={
                    disabled ||
                    modeNamesDraft.some((name) => !name.trim()) ||
                    JSON.stringify(modeNamesDraft.map((name) => name.trim())) === JSON.stringify(systemDb.modeList ?? [])
                  }
                  onClick={() => {
                    const nextModes = modeNamesDraft.map((name) => name.trim())
                    actions.queueSystem({ modeList: nextModes })
                    void actions.flushNow()
                    setIsModeRenameDialogOpen(false)
                  }}
                >
                  {uiText('Save Changes')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className={cn(importValidation?.type === 'error' ? 'text-destructive' : 'text-warning')}>
                  {importValidation?.title}
                </DialogTitle>
                <DialogDescription>
                  {importValidation?.message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                {importValidation?.type === 'error' ? (
                  <Button onClick={() => setIsImportConfirmOpen(false)}>{uiText('Close')}</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setIsImportConfirmOpen(false)}>
                      {uiText('Cancel')}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!pendingImportData}
                      onClick={confirmPendingImport}
                    >
                      {uiText('Import Anyway')}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Separator className="sm:col-span-2 my-2" />
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              {uiText('Import')}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={disabled}>
              {uiText('Export')}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".webhmi"
              onChange={handleImport}
            />
          </div>
        </ParameterCard>

        {showDanceModeCard && (
          <ParameterCard title="Dance Mode" contentClassName="sm:grid-cols-2">
            {hasNumber(systemDb.micDetectionThreshold) && (
              <NumberControl
                label="Mic Detection Threshold"
                value={systemDb.micDetectionThreshold ?? undefined}
                {...systemRanges.micDetectionThreshold}
                disabled={disabled}
                onChange={(value) => {
                  actions.queueSystem({
                    micDetectionThreshold: clampToRange(Math.round(value), systemRanges.micDetectionThreshold),
                  })
                }}
              />
            )}
            {hasNumber(systemDb.micDetectionTime) && (
              <NumberControl
                label="Mic Detection Time"
                value={systemDb.micDetectionTime ?? undefined}
                {...systemRanges.micDetectionTime}
                disabled={disabled}
                onChange={(value) => {
                  actions.queueSystem({
                    micDetectionTime: clampToRange(Math.round(value), systemRanges.micDetectionTime),
                  })
                }}
              />
            )}
          </ParameterCard>
        )}

        {showSystemDefaultsCard && (
          <ParameterCard title="Defaults" contentClassName="sm:grid-cols-2">
            {hasBoolean(systemDb.useDefaultVolume) && (
              <ToggleControl
                label="Use Default Volume"
                pressed={systemDb.useDefaultVolume ?? undefined}
                disabled={disabled}
                onChange={(pressed) => actions.queueSystem({ useDefaultVolume: pressed })}
              />
            )}
            {hasNumber(systemDb.musicDefaultVolume) && (
              <NumberControl
                label="Music Default"
                value={systemDb.musicDefaultVolume ?? undefined}
                {...systemMusicDefaultVolumeRange}
                disabled={disabled}
                onChange={(value) => {
                  actions.queueSystem({ musicDefaultVolume: clampToRange(Math.round(value), systemMusicDefaultVolumeRange) })
                }}
              />
            )}
            {hasNumber(systemDb.micDefaultVolume) && (
              <NumberControl
                label="Mic Default"
                value={systemDb.micDefaultVolume ?? undefined}
                {...systemMicDefaultVolumeRange}
                disabled={disabled}
                onChange={(value) => {
                  actions.queueSystem({ micDefaultVolume: clampToRange(Math.round(value), systemMicDefaultVolumeRange) })
                }}
              />
            )}
            {hasNumber(systemDb.effectDefaultVolume) && (
              <NumberControl
                label="Effect Default"
                value={systemDb.effectDefaultVolume ?? undefined}
                {...systemEffectDefaultVolumeRange}
                disabled={disabled}
                onChange={(value) => {
                  actions.queueSystem({ effectDefaultVolume: clampToRange(Math.round(value), systemEffectDefaultVolumeRange) })
                }}
              />
            )}
          </ParameterCard>
        )}

        {showSystemLimitsCard && (
          <ParameterCard title="Limits" contentClassName="sm:grid-cols-2">
            {hasNumber(systemDb.musicMaxVolume) && (
              <NumberControl
                label="Music Max"
                value={systemDb.musicMaxVolume ?? undefined}
                {...systemMusicMaxVolumeRange}
                disabled={disabled}
                onChange={(value) => {
                  const rounded = clampToRange(Math.round(value), systemMusicMaxVolumeRange)
                  const def = systemDb.musicDefaultVolume ?? 0
                  const cur = systemDb.musicVolume ?? 0
                  const validMax = Math.max(rounded, def)
                  const updates: webhmi.ISetSystemRequest = { musicMaxVolume: validMax }
                  if (validMax < cur) {
                    updates.musicVolume = validMax
                  }
                  actions.queueSystem(updates)
                }}
              />
            )}
            {hasNumber(systemDb.micMaxVolume) && (
              <NumberControl
                label="Mic Max"
                value={systemDb.micMaxVolume ?? undefined}
                {...systemMicMaxVolumeRange}
                disabled={disabled}
                onChange={(value) => {
                  const rounded = clampToRange(Math.round(value), systemMicMaxVolumeRange)
                  const def = systemDb.micDefaultVolume ?? 0
                  const cur = systemDb.micVolume ?? 0
                  const validMax = Math.max(rounded, def)
                  const updates: webhmi.ISetSystemRequest = { micMaxVolume: validMax }
                  if (validMax < cur) {
                    updates.micVolume = validMax
                  }
                  actions.queueSystem(updates)
                }}
              />
            )}
            {hasNumber(systemDb.effectMaxVolume) && (
              <NumberControl
                label="Effect Max"
                value={systemDb.effectMaxVolume ?? undefined}
                {...systemEffectMaxVolumeRange}
                disabled={disabled}
                onChange={(value) => {
                  const rounded = clampToRange(Math.round(value), systemEffectMaxVolumeRange)
                  const def = systemDb.effectDefaultVolume ?? 0
                  const cur = systemDb.effectVolume ?? 0
                  const validMax = Math.max(rounded, def)
                  const updates: webhmi.ISetSystemRequest = { effectMaxVolume: validMax }
                  if (validMax < cur) {
                    updates.effectVolume = validMax
                  }
                  actions.queueSystem(updates)
                }}
              />
            )}
          </ParameterCard>
        )}
      </div>
    </div>
  )
}
