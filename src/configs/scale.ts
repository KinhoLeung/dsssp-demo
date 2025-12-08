const scale = {
  minFreq: 20,
  maxFreq: 20000,
  displayMinFreq: 16,
  displayMaxFreq: 25000,
  sampleRate: 96000, // 48000 / 96000 / 192000
  minGain: -18,
  maxGain: 12,
  gainPrecision: 1,
  qPrecision: 1,
  minQ: 0.1,
  maxQ: 25,
  displayMinGain: -18,
  displayMaxGain: 12,
  dbSteps: 3, // 0 to disable
  dbLabelSteps: 6,
  dbLabels: true,
  octaveTicks: 10, // ticks per octave (0 to disable)
  showDbUnitLabel: false,
  frequencyTicks: [
    20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900,
    1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000
  ],
  octaveLabels: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000],
  majorTicks: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000] // ticks with the major line width, same as zero gain
}

export default scale
