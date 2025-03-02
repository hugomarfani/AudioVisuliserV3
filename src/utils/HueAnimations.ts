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

  // Ensure we have valid indices
  const indices = lightIndices.length > 0 ?
    lightIndices :
    HueService.getEntertainmentLightIndices().length > 0 ?
    HueService.getEntertainmentLightIndices() :
    [0, 1, 2]; // Default to first three lights

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

    // Second flash - dimmer
    const dimmedColor: [number, number, number] = [
      Math.max(0.1, baseColor[0] * 0.3),
      Math.max(0.1, baseColor[1] * 0.3),
      Math.max(0.1, baseColor[2] * 0.3)
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
      // Calculate pulse intensity - start bright, then diminish
      const intensity = 1 - (i / (pulseCount * 1.5));

      // Create color for this pulse
      const pulseColor: [number, number, number] = [
        Math.min(1, baseColor[0] * intensity * 1.5), // Boost it
        Math.min(1, baseColor[1] * intensity * 1.5),
        Math.min(1, baseColor[2] * intensity * 1.5)
      ];

      // Send this pulse
      await HueService.sendColorTransition(pulseColor, 0, true);

      // Wait for next pulse
      if (i < pulseCount - 1) {
        await new Promise(r => setTimeout(r, pulseSpeed));
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
  steps: number = 5, // Number of color steps
  intensity: number = 1.0 // How bright the colors should be (0.0-1.0)
): Promise<void> => {
  if (!HueService.isInitialized()) {
    console.warn("Cannot create color cycle - HueService not properly initialized");
    return;
  }

  try {
    console.log(`🌈 Creating color cycle animation with ${steps} steps over ${duration}ms`);

    const stepDuration = duration / steps;
    const colors: [number, number, number][] = [
      [intensity, 0, 0], // Red
      [intensity, intensity, 0], // Yellow
      [0, intensity, 0], // Green
      [0, intensity, intensity], // Cyan
      [0, 0, intensity], // Blue
      [intensity, 0, intensity]  // Purple
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

// Color strobe effect - rapid flashing between colors and black
export const createStrobeEffect = async (




















































































};  testFlash  createStrobeEffect,  createColorCycleAnimation,  createPulseAnimation,  createFlashSequence,export default {};  }    return false;    console.error('Failed to execute test flash animation:', error);  } catch (error) {    return true;        }        break;        await createColorCycleAnimation(800, 6, 1.0);      case 'cycle':        break;        await createStrobeEffect(color, 4, 70);      case 'strobe':        break;        await createPulseAnimation(color, 4, 80);      case 'pulse':        break;        await createFlashSequence(color, [], 3);      case 'flash':    switch (randomAnimation) {        console.log(`Selected animation type: ${randomAnimation}`);        const randomAnimation = animationTypes[Math.floor(Math.random() * animationTypes.length)];    const animationTypes = ['flash', 'pulse', 'strobe', 'cycle'];    // Generate a random animation style for variety        console.log('🌠 Running advanced test flash with animations');  try {): Promise<boolean> => {  color: [number, number, number] = [1, 0, 0]export const testFlash = async (// Test flash with multiple animation styles};  }    console.error("Error creating strobe effect:", error);  } catch (error) {    console.log('✨ Strobe effect completed');        await HueService.sendColorTransition(brightColor, 0, true);    // End with the light on        }      await new Promise(r => setTimeout(r, strobeSpeed));      await HueService.sendColorTransition(blackColor, 0, true);      // Flash off            await new Promise(r => setTimeout(r, strobeSpeed));      await HueService.sendColorTransition(brightColor, 0, true);      // Flash on    for (let i = 0; i < strobeCount; i++) {        const blackColor: [number, number, number] = [0.01, 0.01, 0.01];    // The off state - almost black        ];      Math.min(1, baseColor[2] * 2.0)      Math.min(1, baseColor[1] * 2.0),      Math.min(1, baseColor[0] * 2.0),    const brightColor: [number, number, number] = [    // Enhanced colors for maximum impact        console.log(`⚡ Creating strobe effect with ${strobeCount} flashes at ${strobeSpeed}ms intervals`);  try {    }    return;    console.warn("Cannot create strobe effect - HueService not properly initialized");  if (!HueService.isInitialized()) {): Promise<void> => {  strobeSpeed: number = 80 // milliseconds between flashes  strobeCount: number = 5,  baseColor: [number, number, number],
