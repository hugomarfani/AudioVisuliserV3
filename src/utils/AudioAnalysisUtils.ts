/**
 * Maps a number from one range to another
 */
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

/**
 * Converts a frequency to a color hue
 * Low frequencies (20-200Hz) -> red/orange (0-30)
 * Mid frequencies (200-2000Hz) -> yellow/green (30-120)
 * High-Mid (2000-8000Hz) -> cyan/blue (120-240)
 * High frequencies (8000-20000Hz) -> purple (240-300)
 */
export function colorFromFrequency(frequency: number, min: number, max: number): [number, number, number] {
  // Map frequency to hue (0-360)
  const hue = mapRange(frequency, min, max, 0, 360);

  // Generate RGB from HSV with full saturation and value
  return hsvToRgb(hue / 360, 1.0, 1.0);
}

/**
 * Calculate average value in a frequency data array between start and end indices
 */
export function averageFrequency(dataArray: Uint8Array, start: number, end: number): number {
  if (!dataArray || start >= end || start < 0 || end > dataArray.length) {
    return 0;
  }

  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += dataArray[i];
  }

  return sum / (end - start);
}

// History buffer size for beat detection
const BEAT_HISTORY_SIZE = 20;
let energyHistory: number[] = [];
let lastBeatTime = 0;
const MIN_BEAT_INTERVAL_MS = 300; // Prevent too frequent beat detection (300ms minimum)

/**
 * Detects a beat in audio data using energy levels and dynamic thresholds
 */
export function detectBeat(dataArray: Uint8Array, threshold: number = 1.15): boolean {
  if (!dataArray || dataArray.length === 0) return false;

  // Get current energy (bass-focused for better beat detection)
  const currentEnergy = calculateBassEnergy(dataArray);

  // Prevent beat detection if it's too soon after the last beat
  const now = performance.now();
  if (now - lastBeatTime < MIN_BEAT_INTERVAL_MS) {
    return false;
  }

  // Add energy to history, keep history at fixed size
  energyHistory.push(currentEnergy);
  if (energyHistory.length > BEAT_HISTORY_SIZE) {
    energyHistory.shift();
  }

  // Need a minimum history to detect beats
  if (energyHistory.length < 5) return false;

  // Calculate average energy from history, excluding the highest value
  const sortedHistory = [...energyHistory].sort((a, b) => a - b);
  const averageEnergy = sortedHistory.slice(0, sortedHistory.length - 1)
    .reduce((a, b) => a + b, 0) / (sortedHistory.length - 1);

  // A beat occurs when current energy is significantly higher than the average
  if (currentEnergy > averageEnergy * threshold && currentEnergy > 30) {
    lastBeatTime = now;
    return true;
  }

  return false;
}

/**
 * Calculates energy in the bass frequency range (more relevant for beat detection)
 */
function calculateBassEnergy(dataArray: Uint8Array): number {
  // Focus on lower frequencies where bass/beats typically occur
  // For a typical FFT of size 256, the first ~20 bins contain the bass frequencies
  const bassEnd = Math.min(20, Math.floor(dataArray.length * 0.15));

  let total = 0;
  for (let i = 0; i < bassEnd; i++) {
    total += dataArray[i];
  }

  return total / bassEnd;
}

/**
 * Calculate frequency bands for visualization and light control
 */
export function calculateFrequencyBands(dataArray: Uint8Array) {
  const length = dataArray.length;

  // Define frequency band ranges (approximate for common fft sizes)
  const bassEnd = Math.floor(length * 0.1);        // 0-10% of spectrum
  const midStart = bassEnd;
  const midEnd = Math.floor(length * 0.5);         // 10-50% of spectrum
  const trebleStart = midEnd;
  const trebleEnd = length;                        // 50-100% of spectrum

  // Calculate average energy in each band
  const bass = averageFrequency(dataArray, 0, bassEnd);
  const mid = averageFrequency(dataArray, midStart, midEnd);
  const treble = averageFrequency(dataArray, trebleStart, trebleEnd);

  return { bass, mid, treble };
}

/**
 * Converts HSV color values to RGB
 * h: 0-1 (hue), s: 0-1 (saturation), v: 0-1 (value)
 * Returns [r, g, b] each in 0-1 range
 */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r: number, g: number, b: number;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
    default: r = 0, g = 0, b = 0; break;
  }

  return [r, g, b];
}

/**
 * Convert RGB color to CIE xy color space for Hue lights
 * Formula from: https://developers.meethue.com/develop/application-design-guidance/color-conversion-formulas-rgb-to-xy-and-back/
 */
export function rgbToXy(r: number, g: number, b: number): [number, number] {
  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert to XYZ using the Wide RGB D65 conversion formula
  const X = r * 0.649926 + g * 0.103455 + b * 0.197109;
  const Y = r * 0.234327 + g * 0.743075 + b * 0.022598;
  const Z = r * 0.000000 + g * 0.053077 + b * 1.035763;

  // Calculate the xy values
  const x = X / (X + Y + Z) || 0;
  const y = Y / (X + Y + Z) || 0;

  return [x, y];
}

/**
 * Generate a smooth color transition array for visual effects
 * @param steps Number of steps in the transition
 * @returns Array of RGB colors
 */
export function generateColorTransition(steps: number): [number, number, number][] {
  const colors: [number, number, number][] = [];

  for (let i = 0; i < steps; i++) {
    const hue = (i / steps) * 360;
    const rgb = hsvToRgb(hue / 360, 1, 1);
    colors.push(rgb);
  }

  return colors;
}

/**
 * Create a smoothed analyzer for audio processing
 * @param audioContext The audio context
 * @param smoothingTimeConstant Amount of smoothing (0-1)
 * @param fftSize FFT size (power of 2)
 * @returns AnalyserNode configured for audio visualization
 */
export function createAnalyzer(
  audioContext: AudioContext,
  smoothingTimeConstant: number = 0.8,
  fftSize: number = 2048
): AnalyserNode {
  const analyzer = audioContext.createAnalyser();
  analyzer.fftSize = fftSize;
  analyzer.smoothingTimeConstant = smoothingTimeConstant;
  return analyzer;
}

/**
 * Extract the rhythm strength and pace from audio data
 */
export function analyzeRhythm(
  dataArray: Uint8Array,
  historySize: number = 60
): { strength: number; pace: number } {
  // Use closure to store beat history
  const beatHistory = (analyzeRhythm as any).beatHistory || new Array(historySize).fill(0);

  // Detect current beat
  const isBeat = detectBeat(dataArray);

  // Shift history and add new beat
  beatHistory.shift();
  beatHistory.push(isBeat ? 1 : 0);
  (analyzeRhythm as any).beatHistory = beatHistory;

  // Calculate beat pattern regularity
  let beatCount = 0;
  let intervalSum = 0;
  let lastBeatIndex = -1;

  for (let i = 0; i < beatHistory.length; i++) {
    if (beatHistory[i] === 1) {
      beatCount++;

      if (lastBeatIndex >= 0) {
        intervalSum += i - lastBeatIndex;
      }

      lastBeatIndex = i;
    }
  }

  // Calculate average interval between beats
  const avgInterval = beatCount > 1 ? intervalSum / (beatCount - 1) : 0;

  // Calculate pace (normalize to 0-1 range where 0.5 is moderate tempo)
  // 4 frames ≈ 240 BPM (very fast), 30 frames ≈ 30 BPM (very slow)
  const pace = avgInterval > 0 ? mapRange(avgInterval, 4, 30, 1, 0) : 0;

  // Calculate strength based on beat frequency
  const strength = beatCount / historySize;

  return { strength, pace };
}

/**
 * Extract audio features for reactive lighting
 * @returns Various audio characteristics for light control
 */
export function extractAudioFeatures(dataArray: Uint8Array): {
  volume: number;
  energy: number;
  brightness: number;
  dominantFreq: number;
  dominantIntensity: number;
  bassEnergy: number;
  midEnergy: number;
  trebleEnergy: number;
  isBeat: boolean;
} {
  const bufferLength = dataArray.length;

  // Calculate bands
  const bands = calculateFrequencyBands(dataArray);

  // Calculate overall volume
  const volumeSum = Array.from(dataArray).reduce((sum, val) => sum + val, 0);
  const volume = volumeSum / (bufferLength * 255); // Normalize to 0-1

  // Find dominant frequency
  let maxValue = 0;
  let maxIndex = 0;
  for (let i = 0; i < bufferLength; i++) {
    if (dataArray[i] > maxValue) {
      maxValue = dataArray[i];
      maxIndex = i;
    }
  }

  // Detect beat
  const isBeat = detectBeat(dataArray);

  // Calculate energy (sum of squared amplitudes)
  const energy = Array.from(dataArray)
    .reduce((sum, val) => sum + (val * val), 0) / (bufferLength * 65025); // Normalize to 0-1

  // Calculate brightness based on volume and energy
  const brightness = Math.min(1, volume * 1.5);

  return {
    volume,
    energy,
    brightness,
    dominantFreq: maxIndex / bufferLength, // 0-1 representing the frequency range
    dominantIntensity: maxValue / 255, // 0-1
    bassEnergy: bands.bass / 255, // 0-1
    midEnergy: bands.mid / 255, // 0-1
    trebleEnergy: bands.treble / 255, // 0-1
    isBeat
  };
}

/**
 * Calculate tempo in BPM from beat detection history
 */
export function calculateTempo(beatHistory: boolean[]): number {
  // Find intervals between beats
  const intervals: number[] = [];
  let lastBeatIndex = -1;

  for (let i = 0; i < beatHistory.length; i++) {
    if (beatHistory[i]) {
      if (lastBeatIndex !== -1) {
        intervals.push(i - lastBeatIndex);
      }
      lastBeatIndex = i;
    }
  }

  // Not enough beats to calculate tempo
  if (intervals.length < 2) {
    return 0;
  }

  // Calculate average interval between beats
  const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

  // Convert from frames to seconds, assuming 60fps (standard animation frame rate)
  const secondsPerFrame = 1 / 60;
  const secondsPerBeat = averageInterval * secondsPerFrame;

  // Convert to BPM (beats per minute)
  const bpm = 60 / secondsPerBeat;

  // Reasonable BPM range is usually 60-200
  return Math.max(60, Math.min(200, bpm));
}

/**
 * Detect audio onset (sudden increases in energy)
 */
export function detectOnset(
  currentEnergy: number,
  energyHistory: number[],
  thresholdMultiplier: number = 1.5
): boolean {
  if (energyHistory.length < 3) return false;

  // Calculate the average energy over the history
  const averageEnergy = energyHistory.reduce((sum, e) => sum + e, 0) / energyHistory.length;

  // If current energy is significantly higher than average, it's an onset
  return currentEnergy > averageEnergy * thresholdMultiplier;
}

/**
 * Classify the mood of audio based on frequency distribution
 */
export function classifyAudioMood(dataArray: Uint8Array): 'calm' | 'energetic' | 'balanced' {
  const { bass, mid, treble } = calculateFrequencyBands(dataArray);
  const total = bass + mid + treble;

  if (total < 50) return 'calm'; // Low overall energy

  const bassRatio = bass / total;
  const trebleRatio = treble / total;

  if (bassRatio > 0.5) return 'energetic'; // Heavy bass usually indicates high energy
  if (trebleRatio > 0.5) return 'energetic'; // High treble can also indicate high energy

  return 'balanced';
}

/**
 * Detect audio silence (very low volume)
 */
export function isSilent(dataArray: Uint8Array, threshold: number = 5): boolean {
  const sum = Array.from(dataArray).reduce((acc, val) => acc + val, 0);
  const average = sum / dataArray.length;
  return average < threshold;
}

/**
 * Compute spectral centroid - represents the "center of mass" of the spectrum
 * Higher values indicate "brighter" sound
 */
export function spectralCentroid(dataArray: Uint8Array, sampleRate: number): number {
  let weightedSum = 0;
  let sum = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const frequency = i * sampleRate / (2 * dataArray.length);
    weightedSum += frequency * dataArray[i];
    sum += dataArray[i];
  }

  return sum === 0 ? 0 : weightedSum / sum;
}

/**
 * Create color scheme based on audio characteristics
 */
export function generateColorScheme(
  audioFeatures: ReturnType<typeof extractAudioFeatures>
): { primary: [number, number, number]; secondary: [number, number, number]; accent: [number, number, number] } {
  const { bassEnergy, midEnergy, trebleEnergy, brightness } = audioFeatures;

  // Base hue derived from frequency balance
  let hue = 0;
  if (bassEnergy > midEnergy && bassEnergy > trebleEnergy) {
    // Bass dominant (reds, oranges)
    hue = mapRange(bassEnergy, 0, 1, 0, 40);
  } else if (midEnergy > bassEnergy && midEnergy > trebleEnergy) {
    // Mid dominant (greens, teals)
    hue = mapRange(midEnergy, 0, 1, 100, 180);
  } else {
    // Treble dominant (blues, purples)
    hue = mapRange(trebleEnergy, 0, 1, 220, 300);
  }

  // Generate complementary and analogous colors
  const primary = hsvToRgb(hue / 360, 0.8, brightness);
  const secondary = hsvToRgb(((hue + 180) % 360) / 360, 0.7, brightness * 0.8);
  const accent = hsvToRgb(((hue + 30) % 360) / 360, 0.9, brightness * 1.2);

  return { primary, secondary, accent };
}

/**
 * Create a smooth transition between colors based on audio features
 */
export function transitionColors(
  current: [number, number, number],
  target: [number, number, number],
  smoothingFactor: number = 0.1
): [number, number, number] {
  return [
    current[0] + (target[0] - current[0]) * smoothingFactor,
    current[1] + (target[1] - current[1]) * smoothingFactor,
    current[2] + (target[2] - current[2]) * smoothingFactor
  ];
}

// Audio analysis utilities for enhanced beat detection and visualization

// History buffer size for beat detection
