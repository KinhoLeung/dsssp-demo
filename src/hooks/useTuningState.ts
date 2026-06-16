import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { webhmi } from '@/device/proto/generated/webhmi'
import { useDeviceSessionContext } from '@/device/session/deviceSessionContext'

const DEFAULT_EQ_POINTS = [
  {
    index: 0,
    type: webhmi.FilterType.HighPass,
    freq: 20,
    gain: 0,
    q: 0.699999988079071,
    defaultType: webhmi.FilterType.HighPass,
    defaultFreq: 20,
    defaultGain: 0,
    defaultQ: 0.699999988079071,
  },
  {
    index: 1,
    type: webhmi.FilterType.Peak,
    freq: 666,
    gain: 6,
    q: 1,
    defaultType: webhmi.FilterType.Peak,
    defaultFreq: 666,
    defaultGain: 6,
    defaultQ: 1,
  },
  {
    index: 2,
    type: webhmi.FilterType.LowPass,
    freq: 20000,
    gain: 0,
    q: 0.699999988079071,
    defaultType: webhmi.FilterType.LowPass,
    defaultFreq: 20000,
    defaultGain: 0,
    defaultQ: 0.699999988079071,
  },
]

const DEFAULT_EQ = {
  point: DEFAULT_EQ_POINTS,
  highPassTypeList: [webhmi.FilterType.HighPass],
  typeList: [webhmi.FilterType.Peak, webhmi.FilterType.LowShelf, webhmi.FilterType.HighShelf],
  lowPassTypeList: [webhmi.FilterType.LowPass],
  bypass: false,
}

const INITIAL_DATA = {
  deviceId: 'device demo',
  firmwareVersion: '1.0.0',
  db: {
    system: {
      modeList: ['mode1', 'mode2', 'mode3'],
      bleName: 'WebHMI',
      panelLock: false,
      mute: false,
      musicMaxVolume: 80,
      micMaxVolume: 80,
      effectMaxVolume: 80,
      musicDefaultVolume: 60,
      micDefaultVolume: 60,
      effectDefaultVolume: 60,
      useDefaultVolume: false,
      currentModeIndex: 1,
      musicVolume: 60,
      micVolume: 60,
      effectVolume: 60,
      controlMode: webhmi.OutputControlMode.OUTPUT_CONTROL_MANUAL,
      sceneMode: webhmi.OutputSceneMode.OUTPUT_SCENE_SING,
      micDetectionThreshold: -60,
      minMicDetectionThreshold: -60,
      maxMicDetectionThreshold: 0,
      stepMicDetectionThreshold: 1,
      micDetectionTime: 5,
      minMicDetectionTime: 1,
      maxMicDetectionTime: 30,
      stepMicDetectionTime: 1,
    },
    music: {
      eq: DEFAULT_EQ,
      inputGain: 0,
      btGain: 0,
      udiskGain: 0,
      musicPitch: 0,
      inputSelect: webhmi.InputSelect.BT,
      bass: 0,
      mid: 0,
      midFreq: 1000,
      treble: 0,
      noise: { gate: -50, frameTime: 2000, atkTime: 500, relTime: 300 },
    },
    mic: {
      micAEq: { eq: DEFAULT_EQ },
      micBEq: { eq: DEFAULT_EQ },
      micEqJointDebugging: false,
      micAVolume: 75,
      micBVolume: 75,
      micFBX: webhmi.FbxMode.Off,
      bass: 0,
      mid: 0,
      midFreq: 1000,
      treble: 0,
      noise: { gate: -50, frameTime: 2000, atkTime: 500, relTime: 300 },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false },
    },
    reverb: {
      eq: DEFAULT_EQ,
      reverbLevel: 100,
      micDirectLevel: 100,
      reverbPredelay: 20,
      reverbDecay: 2625,
      reverbLevelPhaseInversion: false,
      micDirectLevelPhaseInversion: false,
    },
    echo: {
      eq: DEFAULT_EQ,
      echoLevel: 100,
      micDirectLevel: 100,
      echoPredelay: 0,
      echoDelayTime: 200,
      echoRepeat: 60,
      echoRightPredelay: 0,
      echoRightDelay: 0,
      echoLevelPhaseInversion: false,
      micDirectLevelPhaseInversion: false,
    },
    mainOutput: {
      singEq: DEFAULT_EQ,
      danceEq: DEFAULT_EQ,
      output: {
        leftChannelVolume: 0,
        rightChannelVolume: 0,
        leftDelay: 0,
        rightDelay: 0,
        leftMute: false,
        rightMute: false,
        leftChannelVolumePhaseInversion: false,
        rightChannelVolumePhaseInversion: false,
      },
      singMixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false,
      },
      danceMixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false,
      },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false },
    },
    subOutput: {
      singEq: DEFAULT_EQ,
      danceEq: DEFAULT_EQ,
      output: { volume: 0, delay: 0, mute: false, volumePhaseInversion: false },
      singMixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false,
      },
      danceMixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false,
      },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false },
    },
    center: {
      singEq: DEFAULT_EQ,
      danceEq: DEFAULT_EQ,
      output: { volume: 0, delay: 0, mute: false, volumePhaseInversion: false },
      singMixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false,
      },
      danceMixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false,
      },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false },
    },
    surround: {
      singEq: DEFAULT_EQ,
      danceEq: DEFAULT_EQ,
      output: {
        leftChannelVolume: 0,
        rightChannelVolume: 0,
        leftDelay: 0,
        rightDelay: 0,
        leftMute: false,
        rightMute: false,
        leftChannelVolumePhaseInversion: false,
        rightChannelVolumePhaseInversion: false,
      },
      singMixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false,
      },
      danceMixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false,
      },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false },
    },
  },
}

export function useTuningState(isDemoMode: boolean) {
  const onlineSession = useDeviceSessionContext()
  const { t } = useTranslation()


  // Offline State
  const [dbResponse, setDbResponse] = useState<webhmi.IDeviceConfig>(INITIAL_DATA as unknown as webhmi.IDeviceConfig)
  const [dbFetchId, setDbFetchId] = useState(0)

  const mergeDb = useCallback((patch: any, path: string[]) => {
    setDbResponse((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      if (!next.db) next.db = {}
      let current = next.db
      for (const p of path) {
        if (!current[p]) current[p] = {}
        current = current[p]
      }

      const deepMerge = (target: any, source: any) => {
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {}
            deepMerge(target[key], source[key])
          } else {
            target[key] = source[key]
          }
        }
      }
      deepMerge(current, patch)
      return next
    })
    setDbFetchId((id) => id + 1)
  }, [])

  const updateEq = useCallback((target: webhmi.EqTarget, updateFn: (eq: any) => void, sceneMode?: webhmi.OutputSceneMode) => {
    setDbResponse((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      const db = next.db
      if (!db) return next
      const isDance = (sceneMode ?? db.system?.sceneMode) === webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE
      let eq: any = null
      switch (target) {
        case webhmi.EqTarget.MUSIC:
          eq = db.music?.eq
          break
        case webhmi.EqTarget.MIC_A:
          eq = db.mic?.micAEq?.eq
          break
        case webhmi.EqTarget.MIC_B:
          eq = db.mic?.micBEq?.eq
          break
        case webhmi.EqTarget.REVERB:
          eq = db.reverb?.eq
          break
        case webhmi.EqTarget.ECHO:
          eq = db.echo?.eq
          break
        case webhmi.EqTarget.MAIN_OUTPUT:
          eq = isDance ? db.mainOutput?.danceEq : db.mainOutput?.singEq
          break
        case webhmi.EqTarget.SUB_OUTPUT:
          eq = isDance ? db.subOutput?.danceEq : db.subOutput?.singEq
          break
        case webhmi.EqTarget.CENTER:
          eq = isDance ? db.center?.danceEq : db.center?.singEq
          break
        case webhmi.EqTarget.SURROUND:
          eq = isDance ? db.surround?.danceEq : db.surround?.singEq
          break
      }
      if (eq) updateFn(eq)
      return next
    })
    setDbFetchId((id) => id + 1)
  }, [])

  const offlineState = useMemo(
    () => ({
      connected: true,
      transport: null,
      busy: false,
      error: '',
      authOk: true,
      authError: '',
      db: dbResponse,
      dbJson: JSON.stringify(dbResponse),
      dbFetchId,
      dirty: false,
      flushing: false,
      flushError: '',
    }),
    [dbResponse, dbFetchId],
  )

  const offlineActions = useMemo(
    () => ({
      connectHid: async () => true,
      connectBle: async () => true,
      disconnect: async () => {},
      refreshDb: async () => {},
      flushNow: async () => {},
      resetPending: () => {},
      queueSystem: (p: any) => mergeDb(p, ['system']),
      queueMusic: (p: any) => mergeDb(p, ['music']),
      queueMic: (p: any) => mergeDb(p, ['mic']),
      queueReverb: (p: any) => mergeDb(p, ['reverb']),
      queueEcho: (p: any) => mergeDb(p, ['echo']),
      queueMainOutput: (p: any) => mergeDb(p, ['mainOutput']),
      queueSubOutput: (p: any) => mergeDb(p, ['subOutput']),
      queueCenter: (p: any) => mergeDb(p, ['center']),
      queueSurround: (p: any) => mergeDb(p, ['surround']),

      queueEqBypass: (target: webhmi.EqTarget, bypass: boolean, sceneMode?: webhmi.OutputSceneMode) => {
        updateEq(target, (eq) => {
          eq.bypass = bypass
        }, sceneMode)
      },
      queueEqPoint: (target: webhmi.EqTarget, point: any, sceneMode?: webhmi.OutputSceneMode) => {
        updateEq(target, (eq) => {
          if (!eq.point) eq.point = []
          const idx = eq.point.findIndex((p: any) => p.index === point.index)
          if (idx >= 0) {
            eq.point[idx] = { ...eq.point[idx], ...point }
          } else {
            eq.point.push(point)
          }
        }, sceneMode)
      },
      saveMode: async (index: number) => {
        alert(
          t('demoMode.mode.savedToMode', {
            index,
            defaultValue: `Saved to mode ${index}`,
          }),
        )
      },
      switchCurrentMode: async (index: number) => {
        mergeDb({ currentModeIndex: index }, ['system'])
      },
      resetEq: async (target: webhmi.EqTarget, sceneMode?: webhmi.OutputSceneMode) => {
        updateEq(target, (eq) => {
          eq.point = JSON.parse(JSON.stringify(DEFAULT_EQ_POINTS))
          eq.bypass = false
        }, sceneMode)
      },
      resetEqPointToDefault: async (target: webhmi.EqTarget, index: number, sceneMode?: webhmi.OutputSceneMode) => {
        updateEq(target, (eq) => {
          const defPoint = DEFAULT_EQ_POINTS.find((p) => p.index === index)
          if (defPoint && eq.point) {
            const idx = eq.point.findIndex((p: any) => p.index === index)
            if (idx >= 0) {
              eq.point[idx] = { ...defPoint }
            }
          }
        }, sceneMode)
      },
      applyImportData: (data: webhmi.IDeviceConfig) => {
        if (!data.db) return

        setDbResponse((prev: any) => {
          const next = JSON.parse(JSON.stringify(prev))
          if (!next.db) next.db = {}

          // Apply top level fields
          if (data.deviceId) next.deviceId = data.deviceId
          if (data.firmwareVersion) next.firmwareVersion = data.firmwareVersion

          // Apply sections present in the imported data
          Object.keys(data.db!).forEach((key) => {
            const val = (data.db as any)[key]
            if (val !== undefined && val !== null) {
              next.db[key] = JSON.parse(JSON.stringify(val))
            }
          })

          return next
        })
        setDbFetchId((id) => id + 1)
      },
    }),
    [mergeDb, updateEq, t],
  )

  const applyImportDataOnline = useCallback(
    (data: webhmi.IDeviceConfig) => {
      if (!data.db || !onlineSession) return

      // Update basic sections
      if (data.db.system) onlineSession.actions.queueSystem(data.db.system)
      if (data.db.music) onlineSession.actions.queueMusic(data.db.music)
      if (data.db.mic) onlineSession.actions.queueMic(data.db.mic)
      if (data.db.reverb) onlineSession.actions.queueReverb(data.db.reverb)
      if (data.db.echo) onlineSession.actions.queueEcho(data.db.echo)
      if (data.db.mainOutput) onlineSession.actions.queueMainOutput(data.db.mainOutput)
      if (data.db.subOutput) onlineSession.actions.queueSubOutput(data.db.subOutput)
      if (data.db.center) onlineSession.actions.queueCenter(data.db.center)
      if (data.db.surround) onlineSession.actions.queueSurround(data.db.surround)

      // Update EQs
      const eqMap: Array<{ target: webhmi.EqTarget; eq: webhmi.IEq | null | undefined; sceneMode?: webhmi.OutputSceneMode }> = [
        { target: webhmi.EqTarget.MUSIC, eq: data.db.music?.eq },
        { target: webhmi.EqTarget.MIC_A, eq: data.db.mic?.micAEq?.eq },
        { target: webhmi.EqTarget.MIC_B, eq: data.db.mic?.micBEq?.eq },
        { target: webhmi.EqTarget.REVERB, eq: data.db.reverb?.eq },
        { target: webhmi.EqTarget.ECHO, eq: data.db.echo?.eq },
        { target: webhmi.EqTarget.MAIN_OUTPUT, eq: data.db.mainOutput?.singEq, sceneMode: webhmi.OutputSceneMode.OUTPUT_SCENE_SING },
        { target: webhmi.EqTarget.MAIN_OUTPUT, eq: data.db.mainOutput?.danceEq, sceneMode: webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE },
        { target: webhmi.EqTarget.SUB_OUTPUT, eq: data.db.subOutput?.singEq, sceneMode: webhmi.OutputSceneMode.OUTPUT_SCENE_SING },
        { target: webhmi.EqTarget.SUB_OUTPUT, eq: data.db.subOutput?.danceEq, sceneMode: webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE },
        { target: webhmi.EqTarget.CENTER, eq: data.db.center?.singEq, sceneMode: webhmi.OutputSceneMode.OUTPUT_SCENE_SING },
        { target: webhmi.EqTarget.CENTER, eq: data.db.center?.danceEq, sceneMode: webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE },
        { target: webhmi.EqTarget.SURROUND, eq: data.db.surround?.singEq, sceneMode: webhmi.OutputSceneMode.OUTPUT_SCENE_SING },
        { target: webhmi.EqTarget.SURROUND, eq: data.db.surround?.danceEq, sceneMode: webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE },
      ]

      for (const { target, eq, sceneMode } of eqMap) {
        if (!eq) continue
        if (typeof eq.bypass === 'boolean') onlineSession.actions.queueEqBypass(target, eq.bypass, sceneMode)
        if (Array.isArray(eq.point)) {
          for (const point of eq.point) {
            onlineSession.actions.queueEqPoint(target, point, sceneMode)
          }
        }
      }

      void onlineSession.actions.flushNow()
    },
    [onlineSession],
  )

  if (!isDemoMode && onlineSession) {
    const actions = {
      ...onlineSession.actions,
      applyImportData: applyImportDataOnline,
    }
    return {
      state: onlineSession.state,
      actions,
    }
  }

  return {
    state: offlineState,
    actions: offlineActions,
  }
}
