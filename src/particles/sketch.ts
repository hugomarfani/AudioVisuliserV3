import p5 from "p5";
import { ParticleSystem } from "./particles";
import { ParticleSelector } from "./particleSelector";

let particleSystem: ParticleSystem | null = null; // Initialize as null
let frameCount = 0;
let lastMouseX: number;
let lastMouseY: number;
let mouseVelX = 0;
let mouseVelY = 0;
let currentMood = 'happy'; // Can be updated based on AI input
let allowedParticles: string[] = ['musicNote']; // Default particle
let isActive = true;

export const initializeSketch = (particleTypes: string[], active: boolean) => {
  console.log('Initializing sketch with particle types:', particleTypes);
  isActive = active;
  allowedParticles = particleTypes.map(type => {
    const validatedType = ParticleSelector.validateParticleType(type);
    console.log(`Validated particle type: ${type} -> ${validatedType}`);
    return validatedType;
  });
  return sketch;
};

const sketch = (p: p5) => {
  p.preload = () => {
    // Preload images if needed
  };

  p.setup = () => {
    console.log('Setting up particle system');
    const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
    canvas.style('position', 'fixed');
    canvas.style('top', '0');
    canvas.style('left', '0');
    canvas.style('z-index', '1');
    particleSystem = new ParticleSystem(p);
    console.log('Particle system initialized');

    // Add window resize handler
    window.addEventListener('resize', () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
    });
  };

  p.draw = () => {
    p.clear(); // Use clear instead of background to maintain transparency
    
    // Improved mouse velocity calculation
    mouseVelX = (p.mouseX - (lastMouseX || p.mouseX)) * 0.5; // Scaled for better control
    mouseVelY = (p.mouseY - (lastMouseY || p.mouseY)) * 0.5;
    lastMouseX = p.mouseX;
    lastMouseY = p.mouseY;
    
    // Add velocity smoothing
    mouseVelX = p.constrain(mouseVelX, -10, 10);
    mouseVelY = p.constrain(mouseVelY, -10, 10);
    
    // Check if particleSystem exists before using it
    if (particleSystem && isActive) {
      particleSystem.updateAndDisplay(p.mouseX, p.mouseY, mouseVelX, mouseVelY);
    
      frameCount++;
      if (frameCount % 30 === 0 && particleSystem.particles.length < particleSystem.maxParticles) {
        let randomType = ParticleSelector.getRandomParticleFromArray(allowedParticles);
        console.log('Creating new particle of type:', randomType);
        let randomX = p.random(p.width);
        let randomY = p.random(p.height);
        const newParticle = particleSystem.addParticle(randomX, randomY, randomType);
        if (newParticle) {
          console.log('Particle created successfully');
        }
      }
    }
  };

  p.mousePressed = async () => {
    // Guard clause to prevent execution if particleSystem is not initialized
    if (!particleSystem || !isActive) return;

    const remainingSlots = particleSystem.maxParticles - particleSystem.particles.length;
    const numParticles = Math.min(5, remainingSlots); // Create up to 5 particles, but not more than available slots
    
    if (numParticles <= 0) return; // Don't create any particles if we're at max

    const types = ["musicNote", "bubble", "star"];
    
    for(let i = 0; i < numParticles; i++) {
      let randomType = ParticleSelector.getRandomParticleFromArray(allowedParticles);
      // Add slight position variation
      let spawnX = p.mouseX + p.random(-10, 10);
      let spawnY = p.mouseY + p.random(-10, 10);
      
      // Wait for particle to be created and image loaded
      const particle = await particleSystem.addParticle(spawnX, spawnY, randomType);
      
      if (particle) {  // Check if particle was created successfully
        // Add initial velocity based on mouse movement plus random spread
        let angle = p.random(p.TWO_PI);
        let speed = p.random(2, 5);
        let velX = mouseVelX * 0.5 + Math.cos(angle) * speed;
        let velY = mouseVelY * 0.5 + Math.sin(angle) * speed;
        
        particle.vel.set(velX, velY);
      }
    }
  };

  // Remove existing mouseMoved handler as we're handling mouse interaction in the particle system
  p.mouseMoved = () => {};
};

// Remove the direct p5 initialization since we'll do it from the React component
