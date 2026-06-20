import { useMemo } from 'react'

import { webhmi } from '@/device/proto/generated/webhmi'

export const getSceneModeFromConfig = (config: webhmi.IDeviceConfig | null): webhmi.OutputSceneMode => {
  const value = config?.db?.system?.sceneMode
  return typeof value === 'number' ? value as webhmi.OutputSceneMode : webhmi.OutputSceneMode.OUTPUT_SCENE_SING
}

export const getOutputEqForScene = (output: any, sceneMode: webhmi.OutputSceneMode): webhmi.IEq | null =>
  sceneMode === webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE
    ? output?.danceEq ?? output?.singEq ?? null
    : output?.singEq ?? output?.danceEq ?? null

export const getOutputMixerForScene = (output: any, sceneMode: webhmi.OutputSceneMode): webhmi.IMixer | null =>
  sceneMode === webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE
    ? output?.danceMixer ?? output?.singMixer ?? null
    : output?.singMixer ?? output?.danceMixer ?? null

export const mixerPatchForScene = (sceneMode: webhmi.OutputSceneMode, patch: webhmi.IMixerPatch) =>
  sceneMode === webhmi.OutputSceneMode.OUTPUT_SCENE_DANCE
    ? { danceMixer: patch }
    : { singMixer: patch }

export const useOutputScene = (config: webhmi.IDeviceConfig | null) => {
  const sceneMode = getSceneModeFromConfig(config)

  return useMemo(
    () => ({
      sceneMode,
      getEq: (output: any) => getOutputEqForScene(output, sceneMode),
      getMixer: (output: any) => getOutputMixerForScene(output, sceneMode),
      mixerPatch: (patch: webhmi.IMixerPatch) => mixerPatchForScene(sceneMode, patch),
    }),
    [sceneMode],
  )
}

