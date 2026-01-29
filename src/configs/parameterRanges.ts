export type RangeConfig = {
  min: number
  max: number
  step: number
}

const range = (min: number, max: number, step: number): RangeConfig => ({
  min,
  max,
  step
})

const levelRange = range(0, 100, 1)
const toneRange = range(-12, 12, 0.1)
const compressorRange = {
  threshold: range(-60, 0, 0.1),
  ratio: range(2, 100, 1),
  attack: range(0, 500, 1),
  release: range(50, 3000, 1)
}

const parameterRanges = {
  music: {
    inputGain: range(-10, 0, 1),
    btGain: range(-10, 0, 1),
    udiskGain: range(-10, 0, 1),
    musicPitch: range(-12.5, 12.5, 0.1),
    bass: toneRange,
    mid: toneRange,
    midFreq: range(20, 20000, 1),
    treble: toneRange,
    noise: {
      gate: range(-90, -50, 0.1),
      frameTime: range(1, 5000, 1),
      atkTime: range(1, 3000, 1),
      relTime: range(1, 3000, 1)
    }
  },
  mic: {
    micAVolume: levelRange,
    micBVolume: levelRange,
    bass: toneRange,
    mid: toneRange,
    midFreq: range(20, 20000, 1),
    treble: toneRange,
    noise: {
      gate: range(-90, -50, 0.1),
      frameTime: range(1, 5000, 1),
      atkTime: range(1, 3000, 1),
      relTime: range(1, 3000, 1)
    },
    compressor: compressorRange
  },
  reverb: {
    reverbLevel: levelRange,
    micDirectLevel: levelRange,
    reverbPredelay: range(0, 200, 1),
    reverbDecay: range(0, 5000, 1)
  },
  echo: {
    echoLevel: levelRange,
    micDirectLevel: levelRange,
    echoPredelay: range(0, 250, 1),
    echoDelayTime: range(0, 500, 1),
    echoRepeat: range(0, 90, 1),
    echoRightPredelay: range(0, 50, 1),
    echoRightDelay: range(-50, 50, 1)
  },
  mainOutput: {
    output: {
      leftChannelVolume: range(-70, 12, 0.1),
      rightChannelVolume: range(-70, 12, 0.1),
      leftDelay: range(0, 50, 0.1),
      rightDelay: range(0, 50, 0.1)
    },
    mixer: {
      micDirectLevel: levelRange,
      musicLevel: levelRange,
      reverbLevel: levelRange,
      echoLevel: levelRange
    },
    compressor: compressorRange
  },
  subOutput: {
    output: {
      volume: range(-70, 24, 0.1),
      delay: range(0, 50, 0.1)
    },
    mixer: {
      micDirectLevel: levelRange,
      musicLevel: levelRange,
      reverbLevel: levelRange,
      echoLevel: levelRange
    },
    compressor: compressorRange
  },
  center: {
    output: {
      volume: range(-70, 12, 0.1),
      delay: range(0, 50, 0.1)
    },
    mixer: {
      micDirectLevel: levelRange,
      musicLevel: levelRange,
      reverbLevel: levelRange,
      echoLevel: levelRange
    },
    compressor: compressorRange
  },
  surround: {
    output: {
      leftChannelVolume: range(-70, 12, 0.1),
      rightChannelVolume: range(-70, 12, 0.1),
      leftDelay: range(0, 50, 0.1),
      rightDelay: range(0, 50, 0.1)
    },
    mixer: {
      micDirectLevel: levelRange,
      musicLevel: levelRange,
      reverbLevel: levelRange,
      echoLevel: levelRange
    },
    compressor: compressorRange
  }
}

export default parameterRanges
