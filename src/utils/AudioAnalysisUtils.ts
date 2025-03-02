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
export function colorFromFrequency(frequency: number): number {
  // Map logarithmically since human hearing perceives frequency logarithmically
  if (frequency < 20) return 0; // Below human hearing -> red
  if (frequency > 20000) return 300; // Above human hearing -> purple

  // Log scale mapping to get better distribution across the spectrum
  const logFreq = Math.log10(frequency);
  const logMin = Math.log10(20);
  const logMax = Math.log10(20000);

  return mapRange(logFreq, logMin, logMax, 0, 300);
}

/**
 * Calculate average value in a frequency data array between start and end indices
 */
export function averageFrequency(dataArray: Uint8Array, start: number, end: number): number {
  let sum = 0;
  const adjustedEnd = Math.min(end, dataArray.length);
  const adjustedStart = Math.min(start, dataArray.length - 1);
  const count = adjustedEnd - adjustedStart;

  if (count <= 0) return 0;

  for (let i = adjustedStart; i < adjustedEnd; i++) {
    sum += dataArray[i];
  }

  return sum / count;
}

/**
 * Extract dominant frequency from FFT data
 */
export function extractDominantFrequency(dataArray: Uint8Array, sampleRate: number): number {
  let maxValue = 0;
  let maxIndex = 0;

  for (let i = 0; i < dataArray.length; i++) {
    if (dataArray[i] > maxValue) {
      maxValue = dataArray[i];
      maxIndex = i;
    }
  }

  // Convert bin index to frequency
  // For a FFT, the frequency resolution is sampleRate / FFT size
  // The FFT size is 2 * dataArray.length
  const frequency = maxIndex * sampleRate / (2 * dataArray.length);
  return frequency;
}

/**
 * Detect beat from audio data
 * @returns true if a beat is detected
 */
export function detectBeat(dataArray: Uint8Array, threshold: number = 1.5, decay: number = 0.99): boolean {
  // We focus on the bass frequencies for beat detection (typically <150Hz)
  const bassEnd = Math.floor(dataArray.length / 8); // Approximate the bass region

  // Calculate current energy in the bass region
  let energy = 0;
  for (let i = 0; i < bassEnd; i++) {
    energy += dataArray[i] * dataArray[i]; // Square to emphasize peaks
  }

  // Store in a closure to track history between calls
  let history: { energyHistory: number, threshold: number } = (detectBeat as any).history ||
    { energyHistory: energy, threshold: energy };

  // Update threshold with decay
  history.threshold = history.threshold * decay + energy * (1 - decay);

  // Check if energy exceeds threshold by the specified factor
  const isBeat = energy > history.threshold * threshold;

  // Update history
  history.energyHistory = energy;
  (detectBeat as any).history = history;

  return isBeat;
}

/**
 * Calculate energy in different frequency bands
 * @returns Object with energy values for bass, mid, and treble
 */
export function calculateFrequencyBands(dataArray: Uint8Array): { bass: number, mid: number, treble: number } {
  const bufferLength = dataArray.length;

  // Define frequency bands (approximate)
  const bassEnd = Math.floor(bufferLength / 8); // ~0-200Hz
  const midEnd = Math.floor(bufferLength / 2);  // ~200Hz-2kHz

  // Calculate energy in each band
  const bass = averageFrequency(dataArray, 0, bassEnd);
  const mid = averageFrequency(dataArray, bassEnd, midEnd);
  const treble = averageFrequency(dataArray, midEnd, bufferLength);

  return { bass, mid, treble };
}

/**
 * Convert HSV color to RGB
 * @param h Hue (0 to 1)
 * @param s Saturation (0 to 1)
 * @param v Value (0 to 1)
 * @returns RGB values in range 0-1
 */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0, g = 0, b = 0;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
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
