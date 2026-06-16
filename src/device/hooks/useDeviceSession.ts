import { useCallback, useEffect, useRef, useState } from 'react'

import { MsgId } from '@/device/proto/msgId'
import { getWebhmiNamespace } from '@/device/proto/webhmi'
import type { webhmi } from '@/device/proto/generated/webhmi'
import type { WebhmiClient } from '@/device'
import { applyEqBypassPatch, applyEqPointPatch, applySectionPatch } from '@/device/utils/dbHelpers'

import { useDeviceConnection } from './useDeviceConnection'
import { useDeviceAuth } from './useDeviceAuth'
import { useTuningQueue } from './useTuningQueue'

export type DeviceSessionState = {
  connected: boolean
  transport: 'hid' | 'ble' | null
  busy: boolean
  error: string
  authOk: boolean | null
  authError: string
  db: webhmi.IDeviceConfig | null
  dbJson: string
  dbFetchId: number
  dirty: boolean
  flushing: boolean
  flushError: string
}

export function useDeviceSession(
  options: { preferredTransport?: 'hid' | 'ble' | null; onTransportDisconnected?: () => void } = {},
) {
  const [localBusy, setLocalBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  // 1. Connection sub-hook
  const connection = useDeviceConnection({
    onTransportDisconnected: options.onTransportDisconnected,
  })

  // 2. Auth sub-hook
  const auth = useDeviceAuth()

  // 3. Parameters / queue sub-hook
  const queue = useTuningQueue({ authOk: auth.authOk })

  // Synchronous State mapping for public API compatibility
  const state: DeviceSessionState = {
    connected: connection.connected,
    transport: connection.transportKind,
    busy: connection.busy || queue.flushing || localBusy,
    error: connection.error || queue.flushError || localError,
    authOk: auth.authOk,
    authError: auth.authError,
    db: queue.db,
    dbJson: queue.dbJson,
    dbFetchId: queue.dbFetchId,
    dirty: queue.dirty,
    flushing: queue.flushing,
    flushError: queue.flushError,
  }

  const disconnect = useCallback(async () => {
    setLocalBusy(true)
    setLocalError('')
    try {
      queue.resetPending()
      queue.clearDb()
      auth.resetAuth()
      await connection.disconnect()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setLocalBusy(false)
    }
  }, [connection.disconnect, auth.resetAuth, queue.resetPending, queue.clearDb])

  // Setup client listeners when connected
  const setConnectedClient = useCallback(
    (nextClient: WebhmiClient, _transport: 'hid' | 'ble') => {
      const pb = getWebhmiNamespace()

      const unsub = nextClient.onEvent(({ msgId, payload }) => {
        if (msgId === MsgId.SwitchCurrentMode) {
          try {
            // Trigger database refresh upon mode switch event
            void queue.refreshDb(nextClient)
          } catch (e) {
            console.error(`[web:rx] failed to decode EVENT msgId=0x${msgId.toString(16)}:`, e)
          }
          return
        }

        queue.updateDbDraft((db) => {
          if (!db.db) return db
          try {
            switch (msgId) {
              case MsgId.SetMusic: {
                const msg = pb.SetMusicRequest.decode(payload)
                const patch = pb.SetMusicRequest.toObject(msg, { defaults: false })
                db.db.music = applySectionPatch(db.db.music, patch) ?? db.db.music
                break
              }
              case MsgId.SetEq: {
                const msg = pb.SetEqRequest.decode(payload)
                const patch = pb.SetEqRequest.toObject(msg, { defaults: false })
                if (patch.eq) {
                  for (const eqPatch of patch.eq) {
                    if (typeof eqPatch.target !== 'number') continue
                    const sceneMode = typeof eqPatch.sceneMode === 'number' ? eqPatch.sceneMode as webhmi.OutputSceneMode : undefined
                    if (typeof eqPatch.bypass === 'boolean') {
                      applyEqBypassPatch(db, eqPatch.target as webhmi.EqTarget, eqPatch.bypass, sceneMode)
                    }
                    for (const pointPatch of eqPatch.point ?? []) {
                      applyEqPointPatch(db, eqPatch.target as webhmi.EqTarget, pointPatch, sceneMode)
                    }
                  }
                }
                break
              }
              case MsgId.SetSystem: {
                const msg = pb.SetSystemRequest.decode(payload)
                const patch = pb.SetSystemRequest.toObject(msg, { defaults: false })
                db.db.system = applySectionPatch(db.db.system, patch) ?? db.db.system
                break
              }
              case MsgId.SetMic: {
                const msg = pb.SetMicRequest.decode(payload)
                const patch = pb.SetMicRequest.toObject(msg, { defaults: false })
                db.db.mic = applySectionPatch(db.db.mic, patch) ?? db.db.mic
                break
              }
              case MsgId.SetReverb: {
                const msg = pb.SetReverbRequest.decode(payload)
                const patch = pb.SetReverbRequest.toObject(msg, { defaults: false })
                db.db.reverb = applySectionPatch(db.db.reverb, patch) ?? db.db.reverb
                break
              }
              case MsgId.SetEcho: {
                const msg = pb.SetEchoRequest.decode(payload)
                const patch = pb.SetEchoRequest.toObject(msg, { defaults: false })
                db.db.echo = applySectionPatch(db.db.echo, patch) ?? db.db.echo
                break
              }
              case MsgId.SetMainOutput: {
                const msg = pb.SetMainOutputRequest.decode(payload)
                const patch = pb.SetMainOutputRequest.toObject(msg, { defaults: false })
                db.db.mainOutput = applySectionPatch(db.db.mainOutput, patch) ?? db.db.mainOutput
                break
              }
              case MsgId.SetSubOutput: {
                const msg = pb.SetSubOutputRequest.decode(payload)
                const patch = pb.SetSubOutputRequest.toObject(msg, { defaults: false })
                db.db.subOutput = applySectionPatch(db.db.subOutput, patch) ?? db.db.subOutput
                break
              }
              case MsgId.SetCenter: {
                const msg = pb.SetCenterRequest.decode(payload)
                const patch = pb.SetCenterRequest.toObject(msg, { defaults: false })
                db.db.center = applySectionPatch(db.db.center, patch) ?? db.db.center
                break
              }
              case MsgId.SetSurround: {
                const msg = pb.SetSurroundRequest.decode(payload)
                const patch = pb.SetSurroundRequest.toObject(msg, { defaults: false })
                db.db.surround = applySectionPatch(db.db.surround, patch) ?? db.db.surround
                break
              }
              case MsgId.SaveMode: {
                const msg = pb.SaveModeRequest.decode(payload)
                const patch = pb.SaveModeRequest.toObject(msg, { defaults: false })
                if (patch.currentModeIndex !== undefined) {
                  if (!db.db.system) db.db.system = {}
                  db.db.system.currentModeIndex = patch.currentModeIndex
                }
                break
              }
            }
          } catch (e) {
            console.error(`[web:rx] failed to decode EVENT msgId=0x${msgId.toString(16)}:`, e)
          }
          return db
        })
      })

      connection.setCleanup(() => {
        unsub()
      })
    },
    [queue.refreshDb, queue.updateDbDraft, connection.setCleanup],
  )

  const connectHid = useCallback(
    async (options: { interactive?: boolean } = {}): Promise<boolean> => {
      setLocalBusy(true)
      setLocalError('')
      try {
        const nextClient = await connection.connectHid(options)
        if (!nextClient) return false

        const ok = await auth.doAuth(nextClient)
        if (!ok) {
          await disconnect()
          return false
        }

        setConnectedClient(nextClient, 'hid')
        await queue.refreshDb(nextClient)
        return true
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : String(e))
        return false
      } finally {
        setLocalBusy(false)
      }
    },
    [connection.connectHid, auth.doAuth, queue.refreshDb, setConnectedClient, disconnect],
  )

  const connectBle = useCallback(
    async (options: { interactive?: boolean } = {}): Promise<boolean> => {
      setLocalBusy(true)
      setLocalError('')
      try {
        const nextClient = await connection.connectBle(options)
        if (!nextClient) return false

        const ok = await auth.doAuth(nextClient)
        if (!ok) {
          await disconnect()
          return false
        }

        setConnectedClient(nextClient, 'ble')
        await queue.refreshDb(nextClient)
        return true
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : String(e))
        return false
      } finally {
        setLocalBusy(false)
      }
    },
    [connection.connectBle, auth.doAuth, queue.refreshDb, setConnectedClient, disconnect],
  )

  const refreshDb = useCallback(async () => {
    if (!connection.client) return
    setLocalBusy(true)
    setLocalError('')
    try {
      await queue.refreshDb(connection.client)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setLocalBusy(false)
    }
  }, [connection.client, queue.refreshDb])

  const resetEq = useCallback(
    async (target: webhmi.EqTarget, indices?: number[], sceneMode?: webhmi.OutputSceneMode) => {
      if (!connection.client) return
      setLocalBusy(true)
      setLocalError('')
      try {
        await queue.resetEq(connection.client, target, indices, sceneMode)
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : String(e))
      } finally {
        setLocalBusy(false)
      }
    },
    [connection.client, queue.resetEq],
  )

  const resetEqPointToDefault = useCallback(
    async (target: webhmi.EqTarget, index: number, sceneMode?: webhmi.OutputSceneMode) => {
      if (!connection.client) return
      setLocalBusy(true)
      setLocalError('')
      try {
        await queue.resetEqPointToDefault(connection.client, target, index, sceneMode)
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : String(e))
      } finally {
        setLocalBusy(false)
      }
    },
    [connection.client, queue.resetEqPointToDefault],
  )

  const switchCurrentMode = useCallback(
    async (index: number) => {
      if (!connection.client) return
      setLocalBusy(true)
      setLocalError('')
      try {
        await queue.switchCurrentMode(connection.client, index)
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : String(e))
      } finally {
        setLocalBusy(false)
      }
    },
    [connection.client, queue.switchCurrentMode],
  )

  const saveMode = useCallback(
    async (index: number) => {
      if (!connection.client) return
      setLocalBusy(true)
      setLocalError('')
      try {
        await queue.saveMode(connection.client, index)
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : String(e))
      } finally {
        setLocalBusy(false)
      }
    },
    [connection.client, queue.saveMode],
  )

  const flushNow = useCallback(async () => {
    if (!connection.client) return
    await queue.flushNow(connection.client)
  }, [connection.client, queue.flushNow])

  // Queue Operations
  const queueSystem = useCallback(
    (patch: webhmi.ISetSystemRequest) => {
      if (!connection.client) return
      queue.queueSystem(connection.client, patch)
    },
    [connection.client, queue.queueSystem],
  )

  const queueMusic = useCallback(
    (patch: webhmi.ISetMusicRequest) => {
      if (!connection.client) return
      queue.queueMusic(connection.client, patch)
    },
    [connection.client, queue.queueMusic],
  )

  const queueMic = useCallback(
    (patch: webhmi.ISetMicRequest) => {
      if (!connection.client) return
      queue.queueMic(connection.client, patch)
    },
    [connection.client, queue.queueMic],
  )

  const queueReverb = useCallback(
    (patch: webhmi.ISetReverbRequest) => {
      if (!connection.client) return
      queue.queueReverb(connection.client, patch)
    },
    [connection.client, queue.queueReverb],
  )

  const queueEcho = useCallback(
    (patch: webhmi.ISetEchoRequest) => {
      if (!connection.client) return
      queue.queueEcho(connection.client, patch)
    },
    [connection.client, queue.queueEcho],
  )

  const queueMainOutput = useCallback(
    (patch: webhmi.ISetMainOutputRequest) => {
      if (!connection.client) return
      queue.queueMainOutput(connection.client, patch)
    },
    [connection.client, queue.queueMainOutput],
  )

  const queueSubOutput = useCallback(
    (patch: webhmi.ISetSubOutputRequest) => {
      if (!connection.client) return
      queue.queueSubOutput(connection.client, patch)
    },
    [connection.client, queue.queueSubOutput],
  )

  const queueCenter = useCallback(
    (patch: webhmi.ISetCenterRequest) => {
      if (!connection.client) return
      queue.queueCenter(connection.client, patch)
    },
    [connection.client, queue.queueCenter],
  )

  const queueSurround = useCallback(
    (patch: webhmi.ISetSurroundRequest) => {
      if (!connection.client) return
      queue.queueSurround(connection.client, patch)
    },
    [connection.client, queue.queueSurround],
  )

  const queueEqBypass = useCallback(
    (target: webhmi.EqTarget, bypass: boolean, sceneMode?: webhmi.OutputSceneMode) => {
      if (!connection.client) return
      queue.queueEqBypass(connection.client, target, bypass, sceneMode)
    },
    [connection.client, queue.queueEqBypass],
  )

  const queueEqPoint = useCallback(
    (target: webhmi.EqTarget, patch: webhmi.IEqPointPatch, sceneMode?: webhmi.OutputSceneMode) => {
      if (!connection.client) return
      queue.queueEqPoint(connection.client, target, patch, sceneMode)
    },
    [connection.client, queue.queueEqPoint],
  )

  const didAutoConnect = useRef(false)
  useEffect(() => {
    if (didAutoConnect.current) return
    didAutoConnect.current = true
    if (options.preferredTransport === 'hid') void connectHid({ interactive: false })
    if (options.preferredTransport === 'ble') void connectBle({ interactive: false })
  }, [connectBle, connectHid, options.preferredTransport])

  return {
    state,
    actions: {
      connectHid,
      connectBle,
      disconnect,
      refreshDb,
      resetEq,
      resetEqPointToDefault,
      flushNow,
      queueSystem,
      queueMusic,
      queueMic,
      queueReverb,
      queueEcho,
      queueMainOutput,
      queueSubOutput,
      queueCenter,
      queueSurround,
      queueEqBypass,
      queueEqPoint,
      switchCurrentMode,
      saveMode,
      resetPending: queue.resetPending,
    },
  }
}
