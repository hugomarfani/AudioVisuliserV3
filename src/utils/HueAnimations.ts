/**
 * Advanced animation utilities for Philips Hue lights
 * This file contains functions that create dramatic lighting animations
 */
import HueService from './HueService';

// Generate a flash sequence animation with multiple steps
export const createFlashSequence = async (
  baseColor: [number, number, number],
  lightIndices: number[] = [],
  steps: number = 3
): Promise<void> => {
  if (!HueService.isInitialized()) {
    console.warn("Cannot create flash sequence - HueService not properly initialized");
    return;
  }

  try {
    console.log(`🎭 Creating ${steps}-step flash sequence animation with base color:`, baseColor);

    // First flash - full brightness
    const boostedColor: [number, number, number] = [
      Math.min(1, baseColor[0] * 1.5),
      Math.min(1, baseColor[1] * 1.5),
      Math.min(1, baseColor[2] * 1.5)
    ];

    // Send initial flash
    await HueService.sendColorTransition(boostedColor, 0, true);

    // Wait a short time
    await new Promise(r => setTimeout(r, 150));

    // Second flash - MUCH dimmer for dramatic effect
    const dimmedColor: [number, number, number] = [
      Math.max(0.05, baseColor[0] * 0.1), // Much dimmer - almost off
      Math.max(0.05, baseColor[1] * 0.1),
      Math.max(0.05, baseColor[2] * 0.1)
    ];

    // Send dimmed flash
    await HueService.sendColorTransition(dimmedColor, 0, true);

    // Wait a short time
    await new Promise(r => setTimeout(r, 150));

    // Final flash - back to full brightness
    await HueService.sendColorTransition(boostedColor, 0, true);

    console.log('✨ Flash sequence animation completed');
  } catch (error) {
    console.error("Error creating flash sequence:", error);
  }
};

// Create a rapid pulse animation (good for beats)
export const createPulseAnimation = async (
  baseColor: [number, number, number],
  pulseCount: number = 3,
  pulseSpeed: number = 100 // milliseconds between pulses
): Promise<void> => {
  if (!HueService.isInitialized()) {
    console.warn("Cannot create pulse animation - HueService not properly initialized");
    return;
  }

  try {
    console.log(`🌟 Creating ${pulseCount}-pulse animation with color:`, baseColor);

    // Run multiple pulses
    for (let i = 0; i < pulseCount; i++) {
      // Calculate pulse intensity - start bright, then diminish dramatically
      const intensity = 1 - (i / (pulseCount * 1.1));

      // Create color for this pulse
      const pulseColor: [number, number, number] = [
        baseColor[0] * intensity,
        baseColor[1] * intensity,
        baseColor[2] * intensity
      ];

      // Send this pulse
      await HueService.sendColorTransition(pulseColor, 0, true);

      // Wait for next pulse
      if (i < pulseCount - 1) {
        await new Promise(r => setTimeout(r, pulseSpeed));

        // NEW: Send a very dim intermediate "off" state for more contrast
        if (i === 0) { // Only after first pulse for efficiency
          const offColor: [number, number, number] = [0.05, 0.05, 0.05]; // Almost off
          await HueService.sendColorTransition(offColor, 0, true);
          await new Promise(r => setTimeout(r, pulseSpeed / 2)); // Shorter wait in dim state
        }
      }
    }

    console.log('✨ Pulse animation completed');
  } catch (error) {
    console.error("Error creating pulse animation:", error);
  }
};

// Create a dramatic color cycle animation
export const createColorCycleAnimation = async (
  duration: number = 1000, // Total duration in ms
  steps: number = 5 // Number of color steps
): Promise<void> => {
  if (!HueService.isInitialized()) {
    console.warn("Cannot create color cycle - HueService not properly initialized");
    return;
  }

  try {
    console.log(`🌈 Creating color cycle animation with ${steps} steps over ${duration}ms`);

    const stepDuration = duration / steps;
    // Use more contrasting colors
    const colors: [number, number, number][] = [
      [1, 0, 0],     // Pure red
      [1, 0.8, 0],   // Yellow-orange
      [0, 1, 0],     // Pure green
      [0, 0.5, 1],   // Sky blue
      [0.8, 0, 1]    // Purple
    ];

    // Send each color in sequence
    for (let i = 0; i < Math.min(colors.length, steps); i++) {
      await HueService.sendColorTransition(colors[i], 0, true);

      // Wait between steps
      if (i < steps - 1) {
        await new Promise(r => setTimeout(r, stepDuration));
      }
    }

    console.log('✨ Color cycle animation completed');
  } catch (error) {
    console.error("Error creating color cycle animation:", error);
  }
};

// A special test flash that creates a dramatic animated sequence
export const testFlash = async (
  color: [number, number, number] = [1, 0, 0]
): Promise<boolean> => {
  try {
    console.log('🔍 DRAMATIC TEST FLASH requested with color:', color);

    // First, try the service's built-in test flash
    await HueService.testFlash(color);

    // Then add our own more dramatic sequence with off states
    setTimeout(async () => {
      try {
        // Create an even more dramatic flash sequence
        const dramaticColor: [number, number, number] = [
          Math.min(1, color[0] * 2.0), // Even brighter
          Math.min(1, color[1] * 2.0),
          Math.min(1, color[2] * 2.0)
        ];

        // Full brightness
        await HueService.sendColorTransition(dramaticColor, 0, true);
        await new Promise(r => setTimeout(r, 200));

        // Almost off
        await HueService.sendColorTransition([0.05, 0.05, 0.05], 0, true);
        await new Promise(r => setTimeout(r, 200));

        // Full brightness again
        await HueService.sendColorTransition(dramaticColor, 0, true);
        await new Promise(r => setTimeout(r, 200));

        // Almost off
        await HueService.sendColorTransition([0.05, 0.05, 0.05], 0, true);
        await new Promise(r => setTimeout(r, 150));

        // Final bright flash
        await HueService.sendColorTransition(dramaticColor, 0, true);
      } catch (e) {
        console.error('Error during additional animation sequence:', e);
      }
    }, 600); // Start after the initial test flash finishes

    return true;
  } catch (error) {
    console.error('Failed to run animated test flash:', error);
    return false;
  }
};

// ENHANCED: Beat animation sequence that creates a dramatic beat flash with near-off states
export const createBeatAnimation = async (
  color: [number, number, number],
  intensity: number = 1.0
): Promise<void> => {
  if (!HueService.isInitialized()) return;

  try {
    console.log(`🎵 Creating ULTRA dramatic beat animation with intensity ${intensity}`);

    // Enhanced colors for more drama
    const enhancedColor: [number, number, number] = [
      Math.min(1, color[0] * (1.5 + intensity)), // Much higher multiplier
      Math.min(1, color[1] * (1.5 + intensity)),
      Math.min(1, color[2] * (1.5 + intensity))
    ];

    // ULTRA bright initial flash
    await HueService.sendColorTransition(enhancedColor, 0, true);

    // Quick follow-up with NEARLY OFF state - dramatic contrast
    setTimeout(async () => {
      // Go to nearly off state - for high contrast
      const offColor: [number, number, number] = [0.05, 0.05, 0.05]; // Almost completely off
      await HueService.sendColorTransition(offColor, 0, true);

      // Brief second flash at 60% brightness after off state
      setTimeout(async () => {
        const secondColor: [number, number, number] = [
          color[0] * 0.6,
          color[1] * 0.6,
          color[2] * 0.6
        ];
        await HueService.sendColorTransition(secondColor, 0, true);

        // And back to almost off again
        setTimeout(async () => {
          await HueService.sendColorTransition(offColor, 0, true);
        }, 100);
      }, 100);
    }, 100);
  } catch (error) {
    console.error('Error in beat animation:', error);
  }
};

export default {
  createFlashSequence,
  createPulseAnimation,
  createColorCycleAnimation,
  testFlash,
  createBeatAnimation
};
