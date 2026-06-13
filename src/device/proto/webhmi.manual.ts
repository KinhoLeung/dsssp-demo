import { PbReader, PbWriter, readPackedVarint32 } from './wire'

export enum MsgId {
  Auth = 0x0000,
  GetDb = 0x0001,
  SetEq = 0x0002,
  SetSystem = 0x0003,
  SetMusic = 0x0004,
  SetMic = 0x0005,
  SetReverb = 0x0006,
  SetEcho = 0x0007,
  SetMainOutput = 0x0008,
  SetSubOutput = 0x0009,
  SetCenter = 0x000a,
  SetSurround = 0x000b,
  SwitchCurrentMode = 0x000c,
  SaveMode = 0x000d,
  ResetEq = 0x000e,
}

export enum FilterType {
  Peak = 0,
  LowShelf = 1,
  HighShelf = 2,
  LowPass = 3,
  HighPass = 4,
  BandPass = 5,
  Notch = 6,
}

export enum InputSelect {
  BT = 0,
  UDISK = 1,
  SPDIF = 2,
  COA = 3,
  USB = 4,
  AUX1 = 6,
  AUX2 = 7,
}

export enum FbxMode {
  Off = 0,
  Level1 = 1,
  Level2 = 2,
  Level3 = 3,
  Level4 = 4,
  Level5 = 5,
  Level6 = 6,
}

export enum EqTarget {
  MUSIC = 0,
  MIC_A = 1,
  MIC_B = 2,
  REVERB = 3,
  ECHO = 4,
  MAIN_OUTPUT = 5,
  SUB_OUTPUT = 6,
  CENTER = 7,
  SURROUND = 8,
}

export type EqPoint = {
  index?: number
  type?: FilterType
  freq?: number
  gain?: number
  q?: number
  defaultType?: FilterType
  defaultFreq?: number
  defaultGain?: number
  defaultQ?: number
}

export type Eq = {
  point?: EqPoint[]
  bypass?: boolean
  highPassTypeList?: FilterType[]
  typeList?: FilterType[]
  lowPassTypeList?: FilterType[]
}

export type NoiseGate = {
  gate?: number
  frameTime?: number
  atkTime?: number
  relTime?: number
}

export type Compressor = {
  threshold?: number
  ratio?: number
  attack?: number
  release?: number
  bypass?: boolean
}

export type SystemDb = {
  bleName?: string
  panelLock?: boolean
  mute?: boolean
  musicMaxVolume?: number
  micMaxVolume?: number
  effectMaxVolume?: number
  musicDefaultVolume?: number
  micDefaultVolume?: number
  effectDefaultVolume?: number
  useDefaultVolume?: boolean
  modeList?: string[]
  currentModeIndex?: number
  musicVolume?: number
  micVolume?: number
  effectVolume?: number
}

export type MusicDb = {
  eq?: Eq
  inputGain?: number
  btGain?: number
  udiskGain?: number
  musicPitch?: number
  inputSelect?: InputSelect
  bass?: number
  mid?: number
  midFreq?: number
  treble?: number
  noise?: NoiseGate
  inputSelectList?: InputSelect[]
}

export type MicEqDb = { eq?: Eq }

export type MicDb = {
  micAEq?: MicEqDb
  micBEq?: MicEqDb
  micEqJointDebugging?: boolean
  micAVolume?: number
  micBVolume?: number
  micFBX?: FbxMode
  bass?: number
  mid?: number
  midFreq?: number
  treble?: number
  noise?: NoiseGate
  compressor?: Compressor
}

export type ReverbDb = {
  eq?: Eq
  reverbLevel?: number
  micDirectLevel?: number
  reverbPredelay?: number
  reverbDecay?: number
}

export type EchoDb = {
  eq?: Eq
  echoLevel?: number
  micDirectLevel?: number
  echoPredelay?: number
  echoDelayTime?: number
  echoRepeat?: number
  echoRightPredelay?: number
  echoRightDelay?: number
}

export type StereoOutput = {
  leftChannelVolume?: number
  rightChannelVolume?: number
  leftDelay?: number
  rightDelay?: number
  leftMute?: boolean
  rightMute?: boolean
}

export type MonoOutput = {
  volume?: number
  delay?: number
  mute?: boolean
}

export type Mixer = {
  micDirectLevel?: number
  musicLevel?: number
  reverbLevel?: number
  echoLevel?: number
}

export type MainOutputDb = {
  eq?: Eq
  output?: StereoOutput
  mixer?: Mixer
  compressor?: Compressor
}

export type SubOutputDb = {
  eq?: Eq
  output?: MonoOutput
  mixer?: Mixer
  compressor?: Compressor
}

export type CenterDb = {
  eq?: Eq
  output?: MonoOutput
  mixer?: Mixer
  compressor?: Compressor
}

export type SurroundDb = {
  eq?: Eq
  output?: StereoOutput
  mixer?: Mixer
  compressor?: Compressor
}

export type DeviceDb = {
  system?: SystemDb
  music?: MusicDb
  mic?: MicDb
  reverb?: ReverbDb
  echo?: EchoDb
  mainOutput?: MainOutputDb
  subOutput?: SubOutputDb
  center?: CenterDb
  surround?: SurroundDb
}

export type GetDbRequest = {}

export type GetDbResponse = {
  deviceId?: string
  firmwareVersion?: string
  db?: DeviceDb
}

export type EqPointPatch = {
  index?: number
  type?: FilterType
  freq?: number
  gain?: number
  q?: number
}

export type EqPatch = {
  target?: EqTarget
  bypass?: boolean
  point?: EqPointPatch[]
}

export type SetEqRequest = {
  eq?: EqPatch[]
}

export type NoiseGatePatch = {
  gate?: number
  frameTime?: number
  atkTime?: number
  relTime?: number
}

export type CompressorPatch = {
  threshold?: number
  ratio?: number
  attack?: number
  release?: number
  bypass?: boolean
}

export type StereoOutputPatch = {
  leftChannelVolume?: number
  rightChannelVolume?: number
  leftDelay?: number
  rightDelay?: number
  leftMute?: boolean
  rightMute?: boolean
}

export type MonoOutputPatch = {
  volume?: number
  delay?: number
  mute?: boolean
}

export type MixerPatch = {
  micDirectLevel?: number
  musicLevel?: number
  reverbLevel?: number
  echoLevel?: number
}

export type SetSystemRequest = {
  bleName?: string
  panelLock?: boolean
  mute?: boolean
  musicMaxVolume?: number
  micMaxVolume?: number
  effectMaxVolume?: number
  musicDefaultVolume?: number
  micDefaultVolume?: number
  effectDefaultVolume?: number
  useDefaultVolume?: boolean
  currentModeIndex?: number
  musicVolume?: number
  micVolume?: number
  effectVolume?: number
}

export type SetMusicRequest = {
  inputGain?: number
  btGain?: number
  udiskGain?: number
  musicPitch?: number
  inputSelect?: InputSelect
  bass?: number
  mid?: number
  midFreq?: number
  treble?: number
  noise?: NoiseGatePatch
}

export type SetMicRequest = {
  micEqJointDebugging?: boolean
  micAVolume?: number
  micBVolume?: number
  micFBX?: FbxMode
  bass?: number
  mid?: number
  midFreq?: number
  treble?: number
  noise?: NoiseGatePatch
  compressor?: CompressorPatch
}

export type SetReverbRequest = {
  reverbLevel?: number
  micDirectLevel?: number
  reverbPredelay?: number
  reverbDecay?: number
}

export type SetEchoRequest = {
  echoLevel?: number
  micDirectLevel?: number
  echoPredelay?: number
  echoDelayTime?: number
  echoRepeat?: number
  echoRightPredelay?: number
  echoRightDelay?: number
}

export type SetMainOutputRequest = {
  output?: StereoOutputPatch
  mixer?: MixerPatch
  compressor?: CompressorPatch
}

export type SetSubOutputRequest = {
  output?: MonoOutputPatch
  mixer?: MixerPatch
  compressor?: CompressorPatch
}

export type SetCenterRequest = {
  output?: MonoOutputPatch
  mixer?: MixerPatch
  compressor?: CompressorPatch
}

export type SetSurroundRequest = {
  output?: StereoOutputPatch
  mixer?: MixerPatch
  compressor?: CompressorPatch
}

export type SwitchCurrentModeRequest = {
  currentModeIndex?: number
}

export type SwitchCurrentModeResponse = {
  db?: DeviceDb
}

export type SaveModeRequest = {
  currentModeIndex?: number
}

export type ResetEqRequest = {
  target?: EqTarget
  index?: number[]
}

export const encodeGetDbRequest = (_: GetDbRequest) => new Uint8Array()

export const decodeGetDbResponse = (bytes: Uint8Array): GetDbResponse => {
  const reader = new PbReader(bytes)
  const message: GetDbResponse = {}

  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7

    switch (fieldNo) {
      case 1:
        message.deviceId = reader.string()
        break
      case 2:
        message.firmwareVersion = reader.string()
        break
      case 3:
        message.db = decodeDeviceDb(reader.bytes())
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

export const encodeSetEqRequest = (message: SetEqRequest) => {
  const writer = new PbWriter()
  for (const v of message.eq ?? []) writer.message(1, encodeEqPatch(v))
  return writer.finish()
}

export const encodeSetSystemRequest = (message: SetSystemRequest) => {
  const writer = new PbWriter()
  writer.string(1, message.bleName)
  writer.bool(2, message.panelLock)
  writer.bool(3, message.mute)
  writer.uint32(4, message.musicMaxVolume)
  writer.uint32(5, message.micMaxVolume)
  writer.uint32(6, message.effectMaxVolume)
  writer.uint32(7, message.musicDefaultVolume)
  writer.uint32(8, message.micDefaultVolume)
  writer.uint32(9, message.effectDefaultVolume)
  writer.bool(10, message.useDefaultVolume)
  writer.uint32(11, message.currentModeIndex)
  writer.uint32(12, message.musicVolume)
  writer.uint32(13, message.micVolume)
  writer.uint32(14, message.effectVolume)
  return writer.finish()
}

export const encodeSetMusicRequest = (message: SetMusicRequest) => {
  const writer = new PbWriter()
  writer.int32(1, message.inputGain)
  writer.int32(2, message.btGain)
  writer.int32(3, message.udiskGain)
  writer.float(4, message.musicPitch)
  writer.uint32(5, message.inputSelect)
  writer.float(6, message.bass)
  writer.float(7, message.mid)
  writer.uint32(8, message.midFreq)
  writer.float(9, message.treble)
  writer.message(10, message.noise ? encodeNoiseGatePatch(message.noise) : undefined)
  return writer.finish()
}

export const encodeSetMicRequest = (message: SetMicRequest) => {
  const writer = new PbWriter()
  writer.bool(1, message.micEqJointDebugging)
  writer.uint32(2, message.micAVolume)
  writer.uint32(3, message.micBVolume)
  writer.uint32(4, message.micFBX)
  writer.float(5, message.bass)
  writer.float(6, message.mid)
  writer.uint32(7, message.midFreq)
  writer.float(8, message.treble)
  writer.message(9, message.noise ? encodeNoiseGatePatch(message.noise) : undefined)
  writer.message(10, message.compressor ? encodeCompressorPatch(message.compressor) : undefined)
  return writer.finish()
}

export const encodeSetReverbRequest = (message: SetReverbRequest) => {
  const writer = new PbWriter()
  writer.uint32(1, message.reverbLevel)
  writer.uint32(2, message.micDirectLevel)
  writer.uint32(3, message.reverbPredelay)
  writer.uint32(4, message.reverbDecay)
  return writer.finish()
}

export const encodeSetEchoRequest = (message: SetEchoRequest) => {
  const writer = new PbWriter()
  writer.uint32(1, message.echoLevel)
  writer.uint32(2, message.micDirectLevel)
  writer.uint32(3, message.echoPredelay)
  writer.uint32(4, message.echoDelayTime)
  writer.uint32(5, message.echoRepeat)
  writer.uint32(6, message.echoRightPredelay)
  writer.int32(7, message.echoRightDelay)
  return writer.finish()
}

export const encodeSetMainOutputRequest = (message: SetMainOutputRequest) => {
  const writer = new PbWriter()
  writer.message(1, message.output ? encodeStereoOutputPatch(message.output) : undefined)
  writer.message(2, message.mixer ? encodeMixerPatch(message.mixer) : undefined)
  writer.message(3, message.compressor ? encodeCompressorPatch(message.compressor) : undefined)
  return writer.finish()
}

export const encodeSetSubOutputRequest = (message: SetSubOutputRequest) => {
  const writer = new PbWriter()
  writer.message(1, message.output ? encodeMonoOutputPatch(message.output) : undefined)
  writer.message(2, message.mixer ? encodeMixerPatch(message.mixer) : undefined)
  writer.message(3, message.compressor ? encodeCompressorPatch(message.compressor) : undefined)
  return writer.finish()
}

export const encodeSetCenterRequest = (message: SetCenterRequest) => {
  const writer = new PbWriter()
  writer.message(1, message.output ? encodeMonoOutputPatch(message.output) : undefined)
  writer.message(2, message.mixer ? encodeMixerPatch(message.mixer) : undefined)
  writer.message(3, message.compressor ? encodeCompressorPatch(message.compressor) : undefined)
  return writer.finish()
}

export const encodeSetSurroundRequest = (message: SetSurroundRequest) => {
  const writer = new PbWriter()
  writer.message(1, message.output ? encodeStereoOutputPatch(message.output) : undefined)
  writer.message(2, message.mixer ? encodeMixerPatch(message.mixer) : undefined)
  writer.message(3, message.compressor ? encodeCompressorPatch(message.compressor) : undefined)
  return writer.finish()
}

export const encodeSwitchCurrentModeRequest = (message: SwitchCurrentModeRequest) => {
  const writer = new PbWriter()
  writer.uint32(1, message.currentModeIndex)
  return writer.finish()
}

export const decodeSwitchCurrentModeResponse = (bytes: Uint8Array): SwitchCurrentModeResponse => {
  const reader = new PbReader(bytes)
  const message: SwitchCurrentModeResponse = {}

  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7

    switch (fieldNo) {
      case 1:
        message.db = decodeDeviceDb(reader.bytes())
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

export const encodeSaveModeRequest = (message: SaveModeRequest) => {
  const writer = new PbWriter()
  writer.uint32(1, message.currentModeIndex)
  return writer.finish()
}

export const encodeResetEqRequest = (message: ResetEqRequest) => {
  const writer = new PbWriter()
  writer.uint32(1, message.target)
  writer.packedVarint32(2, message.index)
  return writer.finish()
}

const encodeEqPoint = (message: EqPoint) => {
  const writer = new PbWriter()
  writer.uint32(1, message.index)
  writer.uint32(2, message.type)
  writer.uint32(3, message.freq)
  writer.float(4, message.gain)
  writer.float(5, message.q)
  writer.uint32(6, message.defaultType)
  writer.uint32(7, message.defaultFreq)
  writer.float(8, message.defaultGain)
  writer.float(9, message.defaultQ)
  return writer.finish()
}

const decodeEqPoint = (bytes: Uint8Array): EqPoint => {
  const reader = new PbReader(bytes)
  const message: EqPoint = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.index = reader.uint32()
        break
      case 2:
        message.type = reader.uint32() as FilterType
        break
      case 3:
        message.freq = reader.uint32()
        break
      case 4:
        message.gain = reader.float()
        break
      case 5:
        message.q = reader.float()
        break
      case 6:
        message.defaultType = reader.uint32() as FilterType
        break
      case 7:
        message.defaultFreq = reader.uint32()
        break
      case 8:
        message.defaultGain = reader.float()
        break
      case 9:
        message.defaultQ = reader.float()
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeEq = (message: Eq) => {
  const writer = new PbWriter()
  for (const v of message.point ?? []) writer.message(1, encodeEqPoint(v))
  writer.bool(2, message.bypass)
  writer.packedVarint32(3, message.highPassTypeList as unknown as number[])
  writer.packedVarint32(4, message.typeList as unknown as number[])
  writer.packedVarint32(5, message.lowPassTypeList as unknown as number[])
  return writer.finish()
}

const decodeEq = (bytes: Uint8Array): Eq => {
  const reader = new PbReader(bytes)
  const message: Eq = { point: [], highPassTypeList: [], typeList: [], lowPassTypeList: [] }

  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7

    switch (fieldNo) {
      case 1:
        message.point!.push(decodeEqPoint(reader.bytes()))
        break
      case 2:
        message.bypass = reader.bool()
        break
      case 3:
        if (wire === 2) {
          message.highPassTypeList!.push(...(readPackedVarint32(reader) as FilterType[]))
        } else {
          message.highPassTypeList!.push(reader.uint32() as FilterType)
        }
        break
      case 4:
        if (wire === 2) {
          message.typeList!.push(...(readPackedVarint32(reader) as FilterType[]))
        } else {
          message.typeList!.push(reader.uint32() as FilterType)
        }
        break
      case 5:
        if (wire === 2) {
          message.lowPassTypeList!.push(...(readPackedVarint32(reader) as FilterType[]))
        } else {
          message.lowPassTypeList!.push(reader.uint32() as FilterType)
        }
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeNoiseGate = (message: NoiseGate) => {
  const writer = new PbWriter()
  writer.float(1, message.gate)
  writer.uint32(2, message.frameTime)
  writer.uint32(3, message.atkTime)
  writer.uint32(4, message.relTime)
  return writer.finish()
}

const decodeNoiseGate = (bytes: Uint8Array): NoiseGate => {
  const reader = new PbReader(bytes)
  const message: NoiseGate = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.gate = reader.float()
        break
      case 2:
        message.frameTime = reader.uint32()
        break
      case 3:
        message.atkTime = reader.uint32()
        break
      case 4:
        message.relTime = reader.uint32()
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeCompressor = (message: Compressor) => {
  const writer = new PbWriter()
  writer.float(1, message.threshold)
  writer.uint32(2, message.ratio)
  writer.uint32(3, message.attack)
  writer.uint32(4, message.release)
  writer.bool(5, message.bypass)
  return writer.finish()
}

const decodeCompressor = (bytes: Uint8Array): Compressor => {
  const reader = new PbReader(bytes)
  const message: Compressor = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.threshold = reader.float()
        break
      case 2:
        message.ratio = reader.uint32()
        break
      case 3:
        message.attack = reader.uint32()
        break
      case 4:
        message.release = reader.uint32()
        break
      case 5:
        message.bypass = reader.bool()
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeSystemDb = (message: SystemDb) => {
  const writer = new PbWriter()
  writer.string(1, message.bleName)
  writer.bool(2, message.panelLock)
  writer.bool(3, message.mute)
  writer.uint32(4, message.musicMaxVolume)
  writer.uint32(5, message.micMaxVolume)
  writer.uint32(6, message.effectMaxVolume)
  writer.uint32(7, message.musicDefaultVolume)
  writer.uint32(8, message.micDefaultVolume)
  writer.uint32(9, message.effectDefaultVolume)
  writer.bool(10, message.useDefaultVolume)
  for (const v of message.modeList ?? []) writer.string(11, v)
  writer.uint32(12, message.currentModeIndex)
  writer.uint32(13, message.musicVolume)
  writer.uint32(14, message.micVolume)
  writer.uint32(15, message.effectVolume)
  return writer.finish()
}

const decodeSystemDb = (bytes: Uint8Array): SystemDb => {
  const reader = new PbReader(bytes)
  const message: SystemDb = { modeList: [] }

  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7

    switch (fieldNo) {
      case 1:
        message.bleName = reader.string()
        break
      case 2:
        message.panelLock = reader.bool()
        break
      case 3:
        message.mute = reader.bool()
        break
      case 4:
        message.musicMaxVolume = reader.uint32()
        break
      case 5:
        message.micMaxVolume = reader.uint32()
        break
      case 6:
        message.effectMaxVolume = reader.uint32()
        break
      case 7:
        message.musicDefaultVolume = reader.uint32()
        break
      case 8:
        message.micDefaultVolume = reader.uint32()
        break
      case 9:
        message.effectDefaultVolume = reader.uint32()
        break
      case 10:
        message.useDefaultVolume = reader.bool()
        break
      case 11:
        message.modeList!.push(reader.string())
        break
      case 12:
        message.currentModeIndex = reader.uint32()
        break
      case 13:
        message.musicVolume = reader.uint32()
        break
      case 14:
        message.micVolume = reader.uint32()
        break
      case 15:
        message.effectVolume = reader.uint32()
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeMusicDb = (message: MusicDb) => {
  const writer = new PbWriter()
  writer.message(1, message.eq ? encodeEq(message.eq) : undefined)
  writer.int32(2, message.inputGain)
  writer.int32(3, message.btGain)
  writer.int32(4, message.udiskGain)
  writer.float(5, message.musicPitch)
  writer.uint32(6, message.inputSelect)
  writer.float(7, message.bass)
  writer.float(8, message.mid)
  writer.uint32(9, message.midFreq)
  writer.float(10, message.treble)
  writer.message(11, message.noise ? encodeNoiseGate(message.noise) : undefined)
  if (message.inputSelectList && message.inputSelectList.length > 0) {
    writer.packedVarint32(12, message.inputSelectList as unknown as number[])
  }
  return writer.finish()
}

const decodeMusicDb = (bytes: Uint8Array): MusicDb => {
  const reader = new PbReader(bytes)
  const message: MusicDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.eq = decodeEq(reader.bytes())
        break
      case 2:
        message.inputGain = reader.int32()
        break
      case 3:
        message.btGain = reader.int32()
        break
      case 4:
        message.udiskGain = reader.int32()
        break
      case 5:
        message.musicPitch = reader.float()
        break
      case 6:
        message.inputSelect = reader.uint32() as InputSelect
        break
      case 7:
        message.bass = reader.float()
        break
      case 8:
        message.mid = reader.float()
        break
      case 9:
        message.midFreq = reader.uint32()
        break
      case 10:
        message.treble = reader.float()
        break
      case 11:
        message.noise = decodeNoiseGate(reader.bytes())
        break
      case 12:
        if (!message.inputSelectList) message.inputSelectList = []
        if (wire === 2) {
          message.inputSelectList.push(...(readPackedVarint32(reader) as InputSelect[]))
        } else {
          message.inputSelectList.push(reader.uint32() as InputSelect)
        }
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeMicEqDb = (message: MicEqDb) => {
  const writer = new PbWriter()
  writer.message(1, message.eq ? encodeEq(message.eq) : undefined)
  return writer.finish()
}

const decodeMicEqDb = (bytes: Uint8Array): MicEqDb => {
  const reader = new PbReader(bytes)
  const message: MicEqDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.eq = decodeEq(reader.bytes())
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeMicDb = (message: MicDb) => {
  const writer = new PbWriter()
  writer.message(1, message.micAEq ? encodeMicEqDb(message.micAEq) : undefined)
  writer.message(2, message.micBEq ? encodeMicEqDb(message.micBEq) : undefined)
  writer.bool(3, message.micEqJointDebugging)
  writer.uint32(4, message.micAVolume)
  writer.uint32(5, message.micBVolume)
  writer.uint32(6, message.micFBX)
  writer.float(7, message.bass)
  writer.float(8, message.mid)
  writer.uint32(9, message.midFreq)
  writer.float(10, message.treble)
  writer.message(11, message.noise ? encodeNoiseGate(message.noise) : undefined)
  writer.message(12, message.compressor ? encodeCompressor(message.compressor) : undefined)
  return writer.finish()
}

const decodeMicDb = (bytes: Uint8Array): MicDb => {
  const reader = new PbReader(bytes)
  const message: MicDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.micAEq = decodeMicEqDb(reader.bytes())
        break
      case 2:
        message.micBEq = decodeMicEqDb(reader.bytes())
        break
      case 3:
        message.micEqJointDebugging = reader.bool()
        break
      case 4:
        message.micAVolume = reader.uint32()
        break
      case 5:
        message.micBVolume = reader.uint32()
        break
      case 6:
        message.micFBX = reader.uint32() as FbxMode
        break
      case 7:
        message.bass = reader.float()
        break
      case 8:
        message.mid = reader.float()
        break
      case 9:
        message.midFreq = reader.uint32()
        break
      case 10:
        message.treble = reader.float()
        break
      case 11:
        message.noise = decodeNoiseGate(reader.bytes())
        break
      case 12:
        message.compressor = decodeCompressor(reader.bytes())
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeReverbDb = (message: ReverbDb) => {
  const writer = new PbWriter()
  writer.message(1, message.eq ? encodeEq(message.eq) : undefined)
  writer.uint32(2, message.reverbLevel)
  writer.uint32(3, message.micDirectLevel)
  writer.uint32(4, message.reverbPredelay)
  writer.uint32(5, message.reverbDecay)
  return writer.finish()
}

const decodeReverbDb = (bytes: Uint8Array): ReverbDb => {
  const reader = new PbReader(bytes)
  const message: ReverbDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.eq = decodeEq(reader.bytes())
        break
      case 2:
        message.reverbLevel = reader.uint32()
        break
      case 3:
        message.micDirectLevel = reader.uint32()
        break
      case 4:
        message.reverbPredelay = reader.uint32()
        break
      case 5:
        message.reverbDecay = reader.uint32()
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeEchoDb = (message: EchoDb) => {
  const writer = new PbWriter()
  writer.message(1, message.eq ? encodeEq(message.eq) : undefined)
  writer.uint32(2, message.echoLevel)
  writer.uint32(3, message.micDirectLevel)
  writer.uint32(4, message.echoPredelay)
  writer.uint32(5, message.echoDelayTime)
  writer.uint32(6, message.echoRepeat)
  writer.uint32(7, message.echoRightPredelay)
  writer.int32(8, message.echoRightDelay)
  return writer.finish()
}

const decodeEchoDb = (bytes: Uint8Array): EchoDb => {
  const reader = new PbReader(bytes)
  const message: EchoDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.eq = decodeEq(reader.bytes())
        break
      case 2:
        message.echoLevel = reader.uint32()
        break
      case 3:
        message.micDirectLevel = reader.uint32()
        break
      case 4:
        message.echoPredelay = reader.uint32()
        break
      case 5:
        message.echoDelayTime = reader.uint32()
        break
      case 6:
        message.echoRepeat = reader.uint32()
        break
      case 7:
        message.echoRightPredelay = reader.uint32()
        break
      case 8:
        message.echoRightDelay = reader.int32()
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeStereoOutput = (message: StereoOutput) => {
  const writer = new PbWriter()
  writer.float(1, message.leftChannelVolume)
  writer.float(2, message.rightChannelVolume)
  writer.float(3, message.leftDelay)
  writer.float(4, message.rightDelay)
  writer.bool(5, message.leftMute)
  writer.bool(6, message.rightMute)
  return writer.finish()
}

const decodeStereoOutput = (bytes: Uint8Array): StereoOutput => {
  const reader = new PbReader(bytes)
  const message: StereoOutput = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.leftChannelVolume = reader.float()
        break
      case 2:
        message.rightChannelVolume = reader.float()
        break
      case 3:
        message.leftDelay = reader.float()
        break
      case 4:
        message.rightDelay = reader.float()
        break
      case 5:
        message.leftMute = reader.bool()
        break
      case 6:
        message.rightMute = reader.bool()
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeMonoOutput = (message: MonoOutput) => {
  const writer = new PbWriter()
  writer.float(1, message.volume)
  writer.float(2, message.delay)
  writer.bool(3, message.mute)
  return writer.finish()
}

const decodeMonoOutput = (bytes: Uint8Array): MonoOutput => {
  const reader = new PbReader(bytes)
  const message: MonoOutput = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.volume = reader.float()
        break
      case 2:
        message.delay = reader.float()
        break
      case 3:
        message.mute = reader.bool()
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeMixer = (message: Mixer) => {
  const writer = new PbWriter()
  writer.uint32(1, message.micDirectLevel)
  writer.uint32(2, message.musicLevel)
  writer.uint32(3, message.reverbLevel)
  writer.uint32(4, message.echoLevel)
  return writer.finish()
}

const decodeMixer = (bytes: Uint8Array): Mixer => {
  const reader = new PbReader(bytes)
  const message: Mixer = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.micDirectLevel = reader.uint32()
        break
      case 2:
        message.musicLevel = reader.uint32()
        break
      case 3:
        message.reverbLevel = reader.uint32()
        break
      case 4:
        message.echoLevel = reader.uint32()
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeMainOutputDb = (message: MainOutputDb) => {
  const writer = new PbWriter()
  writer.message(1, message.eq ? encodeEq(message.eq) : undefined)
  writer.message(2, message.output ? encodeStereoOutput(message.output) : undefined)
  writer.message(3, message.mixer ? encodeMixer(message.mixer) : undefined)
  writer.message(4, message.compressor ? encodeCompressor(message.compressor) : undefined)
  return writer.finish()
}

const decodeMainOutputDb = (bytes: Uint8Array): MainOutputDb => {
  const reader = new PbReader(bytes)
  const message: MainOutputDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.eq = decodeEq(reader.bytes())
        break
      case 2:
        message.output = decodeStereoOutput(reader.bytes())
        break
      case 3:
        message.mixer = decodeMixer(reader.bytes())
        break
      case 4:
        message.compressor = decodeCompressor(reader.bytes())
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeSubOutputDb = (message: SubOutputDb) => {
  const writer = new PbWriter()
  writer.message(1, message.eq ? encodeEq(message.eq) : undefined)
  writer.message(2, message.output ? encodeMonoOutput(message.output) : undefined)
  writer.message(3, message.mixer ? encodeMixer(message.mixer) : undefined)
  writer.message(4, message.compressor ? encodeCompressor(message.compressor) : undefined)
  return writer.finish()
}

const decodeSubOutputDb = (bytes: Uint8Array): SubOutputDb => {
  const reader = new PbReader(bytes)
  const message: SubOutputDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.eq = decodeEq(reader.bytes())
        break
      case 2:
        message.output = decodeMonoOutput(reader.bytes())
        break
      case 3:
        message.mixer = decodeMixer(reader.bytes())
        break
      case 4:
        message.compressor = decodeCompressor(reader.bytes())
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeCenterDb = (message: CenterDb) => {
  const writer = new PbWriter()
  writer.message(1, message.eq ? encodeEq(message.eq) : undefined)
  writer.message(2, message.output ? encodeMonoOutput(message.output) : undefined)
  writer.message(3, message.mixer ? encodeMixer(message.mixer) : undefined)
  writer.message(4, message.compressor ? encodeCompressor(message.compressor) : undefined)
  return writer.finish()
}

const decodeCenterDb = (bytes: Uint8Array): CenterDb => {
  const reader = new PbReader(bytes)
  const message: CenterDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.eq = decodeEq(reader.bytes())
        break
      case 2:
        message.output = decodeMonoOutput(reader.bytes())
        break
      case 3:
        message.mixer = decodeMixer(reader.bytes())
        break
      case 4:
        message.compressor = decodeCompressor(reader.bytes())
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeSurroundDb = (message: SurroundDb) => {
  const writer = new PbWriter()
  writer.message(1, message.eq ? encodeEq(message.eq) : undefined)
  writer.message(2, message.output ? encodeStereoOutput(message.output) : undefined)
  writer.message(3, message.mixer ? encodeMixer(message.mixer) : undefined)
  writer.message(4, message.compressor ? encodeCompressor(message.compressor) : undefined)
  return writer.finish()
}

const decodeSurroundDb = (bytes: Uint8Array): SurroundDb => {
  const reader = new PbReader(bytes)
  const message: SurroundDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.eq = decodeEq(reader.bytes())
        break
      case 2:
        message.output = decodeStereoOutput(reader.bytes())
        break
      case 3:
        message.mixer = decodeMixer(reader.bytes())
        break
      case 4:
        message.compressor = decodeCompressor(reader.bytes())
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

export const encodeDeviceDb = (message: DeviceDb) => {
  const writer = new PbWriter()
  writer.message(1, message.system ? encodeSystemDb(message.system) : undefined)
  writer.message(2, message.music ? encodeMusicDb(message.music) : undefined)
  writer.message(3, message.mic ? encodeMicDb(message.mic) : undefined)
  writer.message(4, message.reverb ? encodeReverbDb(message.reverb) : undefined)
  writer.message(5, message.echo ? encodeEchoDb(message.echo) : undefined)
  writer.message(6, message.mainOutput ? encodeMainOutputDb(message.mainOutput) : undefined)
  writer.message(7, message.subOutput ? encodeSubOutputDb(message.subOutput) : undefined)
  writer.message(8, message.center ? encodeCenterDb(message.center) : undefined)
  writer.message(9, message.surround ? encodeSurroundDb(message.surround) : undefined)
  return writer.finish()
}

const decodeDeviceDb = (bytes: Uint8Array): DeviceDb => {
  const reader = new PbReader(bytes)
  const message: DeviceDb = {}
  while (!reader.eof()) {
    const tag = reader.tag()
    if (tag === 0) break
    const fieldNo = tag >>> 3
    const wire = tag & 7
    switch (fieldNo) {
      case 1:
        message.system = decodeSystemDb(reader.bytes())
        break
      case 2:
        message.music = decodeMusicDb(reader.bytes())
        break
      case 3:
        message.mic = decodeMicDb(reader.bytes())
        break
      case 4:
        message.reverb = decodeReverbDb(reader.bytes())
        break
      case 5:
        message.echo = decodeEchoDb(reader.bytes())
        break
      case 6:
        message.mainOutput = decodeMainOutputDb(reader.bytes())
        break
      case 7:
        message.subOutput = decodeSubOutputDb(reader.bytes())
        break
      case 8:
        message.center = decodeCenterDb(reader.bytes())
        break
      case 9:
        message.surround = decodeSurroundDb(reader.bytes())
        break
      default:
        reader.skip(wire)
        break
    }
  }
  return message
}

const encodeEqPointPatch = (message: EqPointPatch) => {
  const writer = new PbWriter()
  writer.uint32(1, message.index)
  writer.uint32(2, message.type)
  writer.uint32(3, message.freq)
  writer.float(4, message.gain)
  writer.float(5, message.q)
  return writer.finish()
}

const encodeEqPatch = (message: EqPatch) => {
  const writer = new PbWriter()
  writer.uint32(1, message.target)
  writer.bool(2, message.bypass)
  for (const v of message.point ?? []) writer.message(3, encodeEqPointPatch(v))
  return writer.finish()
}

const encodeNoiseGatePatch = (message: NoiseGatePatch) => {
  const writer = new PbWriter()
  writer.float(1, message.gate)
  writer.uint32(2, message.frameTime)
  writer.uint32(3, message.atkTime)
  writer.uint32(4, message.relTime)
  return writer.finish()
}

const encodeCompressorPatch = (message: CompressorPatch) => {
  const writer = new PbWriter()
  writer.float(1, message.threshold)
  writer.uint32(2, message.ratio)
  writer.uint32(3, message.attack)
  writer.uint32(4, message.release)
  writer.bool(5, message.bypass)
  return writer.finish()
}

const encodeStereoOutputPatch = (message: StereoOutputPatch) => {
  const writer = new PbWriter()
  writer.float(1, message.leftChannelVolume)
  writer.float(2, message.rightChannelVolume)
  writer.float(3, message.leftDelay)
  writer.float(4, message.rightDelay)
  writer.bool(5, message.leftMute)
  writer.bool(6, message.rightMute)
  return writer.finish()
}

const encodeMonoOutputPatch = (message: MonoOutputPatch) => {
  const writer = new PbWriter()
  writer.float(1, message.volume)
  writer.float(2, message.delay)
  writer.bool(3, message.mute)
  return writer.finish()
}

const encodeMixerPatch = (message: MixerPatch) => {
  const writer = new PbWriter()
  writer.uint32(1, message.micDirectLevel)
  writer.uint32(2, message.musicLevel)
  writer.uint32(3, message.reverbLevel)
  writer.uint32(4, message.echoLevel)
  return writer.finish()
}
