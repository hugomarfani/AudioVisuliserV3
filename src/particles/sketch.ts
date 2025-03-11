import p5 from "p5";
import { ParticleSystem } from "./particles";
import { ParticleSelector } from "./particleSelector";
import { particleConfig } from "./particlePhysics";

let particleSystem: ParticleSystem | null = null; // Initialize as null
let frameCount = 0;
let lastMouseX: number;
let lastMouseY: number;
let mouseVelX = 0;
let mouseVelY = 0;
let currentMood = 'happy'; // Can be updated based on AI input
let allowedParticles: string[] = ['musicNote']; // Default particle
let isActive = true;
let isMouseOnCanvas = true; // Always show overlay by default
let overlayAlwaysVisible = true; // New flag to control overlay visibility behavior
let isMouseHeld = false; // Track if mouse is being held down
let mouseHoldTimer = 0; // Control spawn rate when holding
let mouseParticleType = ParticleSelector.getRandomParticleFromArray(allowedParticles);
let mouseParticleImageType = 1;

export const initializeSketch = (particleTypes: string[], active: boolean) => {
  console.log('Initializing sketch with particle types:', particleTypes);
  isActive = active;
  allowedParticles = particleTypes.map(type => {
    const validatedType = ParticleSelector.validateParticleType(type);
    console.log(`Validated particle type: ${type} -> ${validatedType}`);
    return validatedType;
  });
  mouseParticleType = ParticleSelector.getRandomParticleFromArray(allowedParticles);
  return sketch;
};

const sketch = (p: p5) => {
  p.preload = () => {
    // Preload images if needed
  };

  p.setup = () => {
    // mouseParticleType = ParticleSelector.getRandomParticleFromArray(allowedParticles);
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

    // Simplified event listeners that don't affect overlay visibility
    const canvasElement = document.querySelector('canvas');
    if (canvasElement) {
      // Only track when mouse leaves the window completely
      window.addEventListener('mouseleave', () => {
        if (!overlayAlwaysVisible) {
          isMouseOnCanvas = false;
        }
      });
      
      window.addEventListener('mouseenter', () => {
        isMouseOnCanvas = true;
      });
    }
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
        console.log('Particle created successfully');
      }
      
      // Create particles while mouse is held down
      if (isMouseHeld && particleSystem.particles.length < particleSystem.maxParticles) {
        mouseHoldTimer++;
        // Control spawn rate - create particles every few frames
        if (mouseHoldTimer >= 6) { // Adjust this value to control spawn rate
          mouseHoldTimer = 0;
          createParticlesAtMouse(p, 2); // Create fewer particles per burst when holding
        }
      }
    }

    // Always draw the cursor overlay when in active mode
    if (isActive) {
      drawCursorOverlay(p, p.mouseX, p.mouseY);
    }
  };

  // Function to draw a circular overlay around the cursor/touch point
  const drawCursorOverlay = (p: p5, x: number, y: number) => {
    const radius = 15; // Match the collision radius in handleMouseCollision
    
    p.push();
    
    // Draw outer circle
    p.noFill();
    p.stroke(255, 255, 255, 100); // Semi-transparent white
    p.strokeWeight(2);
    p.circle(x, y, radius * 2);
    
    // Draw inner circle
    p.fill(255, 255, 255, 20); // Very transparent white
    p.noStroke();
    p.circle(x, y, radius * 2 - 4);
    
    p.pop();
  };
  
  // Helper function to create particles at mouse position
  const createParticlesAtMouse = async (p: p5, count: number) => {
    if (!particleSystem || !isActive) return;
    
    const remainingSlots = particleSystem.maxParticles - particleSystem.particles.length;
    const numParticles = Math.min(count, remainingSlots);
    
    if (numParticles <= 0) return;
    
    // Use the same mouseParticleType for all particles in this burst
    // This ensures consistency during a single press/hold interaction
    for(let i = 0; i < numParticles; i++) {
      let spawnX = p.mouseX + p.random(-10, 10);
      let spawnY = p.mouseY + p.random(-10, 10);
      
      const particle = await particleSystem.addParticle(spawnX, spawnY, mouseParticleType, mouseParticleImageType);
      
      if (particle) {
        let angle = p.random(p.TWO_PI);
        let speed = p.random(2, 5);
        let velX = mouseVelX * 0.5 + Math.cos(angle) * speed;
        let velY = mouseVelY * 0.5 + Math.sin(angle) * speed;
        
        particle.vel.set(velX, velY);
      }
    }
  };

  const randomiseParticleType = () => {
    const oldType = mouseParticleType;
    if (allowedParticles.length > 1) {
      do {
        mouseParticleType = ParticleSelector.getRandomParticleFromArray(allowedParticles);
        mouseParticleImageType = Math.floor(Math.random() * particleConfig[mouseParticleType].count) + 1;
      } while (mouseParticleType === oldType && allowedParticles.length > 1);
    } else {
      mouseParticleType = ParticleSelector.getRandomParticleFromArray(allowedParticles);
      mouseParticleImageType = Math.floor(Math.random() * particleConfig[mouseParticleType].count) + 1;
    }
    console.log('Particle type changed to:', mouseParticleType);
  }

  p.mousePressed = async () => {
    // Set flag that mouse is being held
    isMouseHeld = true;
    isMouseOnCanvas = true;
    
    // Create initial burst of particles (all using the same mouseParticleType)
    if (particleSystem && isActive) {
      createParticlesAtMouse(p, 5); // Initial larger burst
    }
    
    return false; // Prevents default
  };
  
  p.mouseReleased = () => {
    // Clear the mouse held flag
    isMouseHeld = false;
    mouseHoldTimer = 0;
    randomiseParticleType();
    return false; // Prevents default
  };

  // Remove existing mouseMoved handler as we're handling mouse interaction in the particle system
  p.mouseMoved = () => {};

  // Update touch support to handle touch and hold
  p.touchStarted = () => {
    isMouseHeld = true;
    isMouseOnCanvas = true;
    if (particleSystem && isActive) {
      createParticlesAtMouse(p, 5);
    }
    return false; // Prevents default
  };
  
  p.touchMoved = () => {
    isMouseOnCanvas = true;
    return false; // Prevents default
  };
  
  p.touchEnded = () => {
    isMouseHeld = false;
    mouseHoldTimer = 0;
    isMouseOnCanvas = true;
    randomiseParticleType();
    return false; // Prevents default
  };
};

// Remove the direct p5 initialization since we'll do it from the React component
