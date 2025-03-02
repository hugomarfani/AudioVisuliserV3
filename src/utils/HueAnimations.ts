/**
 * Advanced animation utilities for Philips Hue lights
 * This file contains functions that create dramatic lighting animations with rate limiting
 */
import HueService from './HueService';

// Increase these values to prevent rate limiting errors
const MIN_ANIMATION_STEP_TIME = 200; // Minimum ms between animation steps (avoid 429 errors)
const MIN_COMMAND_INTERVAL = 50;    // Minimum ms between individual commands

// Make sure we don't overload the bridge with commands
const MAX_ANIMATION_STEPS = 2;       // Maximum number of steps in an animation

// Helper function to ensure rate limiting
const rateLimitedCommand = async (
  callback: () => Promise<void>,
  delay: number = MIN_COMMAND_INTERVAL
): Promise<void> => {
  try {
    await callback();
    // Ensure minimum delay between commands
    await new Promise(resolve => setTimeout(resolve, Math.max(delay, MIN_COMMAND_INTERVAL)));
  } catch (error) {
    console.error('Error in rate limited command:', error);
    // Add additional delay on error (might be rate limiting)
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a full second on error
  }
};

// Create a beat animation - optimized to prevent rate limiting
export const createBeatAnimation = async (
  color: [number, number, number],
  intensity: number = 1.0
): Promise<void> => {
  if (!HueService.isInitialized()) return;

  try {
    // Limited to just one command to prevent rate limit errors
    console.log(`🎵 Creating optimized beat animation with intensity ${intensity}`);

    // Enhanced colors for more drama
    const enhancedColor: [number, number, number] = [
      Math.min(1, color[0] * (1.5 + intensity)),
      Math.min(1, color[1] * (1.5 + intensity)),
      Math.min(1, color[2] * (1.5 + intensity))
    ];

    // Just one single flash - no follow-up commands to avoid rate limits
    await HueService.sendColorTransition(enhancedColor, 0, true);

  } catch (error) {
    console.error('Error in beat animation:', error);
  }
};

// A test flash that respects rate limits
export const testFlash = async (
  color: [number, number, number] = [1, 0, 0]
): Promise<boolean> => {
  try {
    console.log('🔍 RATE-LIMITED TEST FLASH with color:', color);

    // Enhanced color for dramatic effect
    const dramaticColor: [number, number, number] = [
      Math.min(1, color[0] * 2.0),
      Math.min(1, color[1] * 2.0),
      Math.min(1, color[2] * 2.0)
    ];

    // Just do two steps with a long delay between
    await HueService.sendColorTransition(dramaticColor, 0, true);

    // Wait longer to avoid rate limits
    await new Promise(r => setTimeout(r, MIN_ANIMATION_STEP_TIME * 2));

    // One follow-up step only
    const dimmedColor: [number, number, number] = [
      Math.max(0.05, color[0] * 0.1),
      Math.max(0.05, color[1] * 0.1),
      Math.max(0.05, color[2] * 0.1)
    ];
    await HueService.sendColorTransition(dimmedColor, 0, true);

    return true;
  } catch (error) {
    console.error('Failed to run test flash:', error);
    return false;
  }
};

// Other functions simplified to avoid rate limiting
export const createColorCycleAnimation = async (): Promise<void> => {
  if (!HueService.isInitialized()) {
    console.warn("Cannot create color cycle - HueService not properly initialized");
    return;
  }

  console.log(`🌈 Creating simplified color cycle (just 2 colors to avoid rate limits)`);

  try {
    // Just two colors to avoid rate limiting
    const colors: [number, number, number][] = [
      [1, 0, 0],     // Red
      [0, 0, 1],     // Blue
    ];

    for (let i = 0; i < colors.length; i++) {
      await rateLimitedCommand(async () => {
        await HueService.sendColorTransition(colors[i], 0, true);
      }, MIN_COMMAND_INTERVAL * 2);

      // Longer wait between colors
      if (i < colors.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log('✨ Color cycle completed');
  } catch (error) {
    console.error("Error in color cycle:", error);
  }
};

// Create a flash sequence with fewer steps to avoid rate limiting
export const createFlashSequence = async (
  baseColor: [number, number, number],
  lightIndices: number[] = [],
  steps: number = 2
): Promise<void> => {
  if (!HueService.isInitialized()) {
    console.warn("Cannot create flash sequence - HueService not properly initialized");
    return;
  }

  try {
    console.log(`🎭 Creating ${Math.min(steps, MAX_ANIMATION_STEPS)}-step flash sequence with color:`, baseColor);

    // First flash - full brightness
    const boostedColor: [number, number, number] = [
      Math.min(1, baseColor[0] * 1.5),
      Math.min(1, baseColor[1] * 1.5),
      Math.min(1, baseColor[2] * 1.5)
    ];

    await HueService.sendColorTransition(boostedColor, 0, true);

    // Wait longer between steps to avoid rate limits
    await new Promise(r => setTimeout(r, MIN_ANIMATION_STEP_TIME * 2));

    // Second flash - MUCH dimmer
    const dimmedColor: [number, number, number] = [
      Math.max(0.05, baseColor[0] * 0.1),
      Math.max(0.05, baseColor[1] * 0.1),
      Math.max(0.05, baseColor[2] * 0.1)
    ];

    await HueService.sendColorTransition(dimmedColor, 0, true);

    console.log('✨ Flash sequence completed');
  } catch (error) {
    console.error("Error in flash sequence:", error);
  }
};

// Export only these simplified functions
export default {
  createBeatAnimation,
  testFlash,
  createColorCycleAnimation,
  createFlashSequence
};
