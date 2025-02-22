import p5 from "p5";
import { ParticleSystem } from "./particles";
import { ParticleSelector } from "./particleSelector";

let particleSystem: ParticleSystem;
let frameCount = 0;
let lastMouseX: number;
let lastMouseY: number;
let mouseVelX = 0;
let mouseVelY = 0;
let currentMood = 'happy'; // Can be updated based on AI input

const sketch = (p: p5) => {
  p.preload = () => {
    // Preload images if needed
  };

  p.setup = () => {
    const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
    canvas.style('position', 'fixed');
    canvas.style('top', '0');
    canvas.style('left', '0');
    canvas.style('z-index', '1');
    particleSystem = new ParticleSystem(p);

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
    
    // Update particle system with mouse data
    particleSystem.updateAndDisplay(p.mouseX, p.mouseY, mouseVelX, mouseVelY);
    
    // Generate random particles periodically using the ParticleSelector
    frameCount++;
    if (frameCount % 30 === 0 && particleSystem.particles.length < particleSystem.maxParticles) {
      let randomType = ParticleSelector.getRandomParticleType(currentMood);
      let randomX = p.random(p.width);
      let randomY = p.random(p.height);
      particleSystem.addParticle(randomX, randomY, randomType);
    }
  };

  // Add particles when the mouse is clicked
  p.mousePressed = () => {
    // Only create particles if we haven't reached the maximum
    const remainingSlots = particleSystem.maxParticles - particleSystem.particles.length;
    const numParticles = Math.min(5, remainingSlots); // Create up to 5 particles, but not more than available slots
    
    if (numParticles <= 0) return; // Don't create any particles if we're at max

    const types = ["musicNote", "bubble", "star"];
    
    for(let i = 0; i < numParticles; i++) {
      let randomType = ParticleSelector.getRandomParticleType(currentMood);
      // Add slight position variation
      let spawnX = p.mouseX + p.random(-10, 10);
      let spawnY = p.mouseY + p.random(-10, 10);
      
      // Create particle with initial velocity based on mouse movement
      let particle = particleSystem.addParticle(spawnX, spawnY, randomType);
      
      // Add initial velocity based on mouse movement plus random spread
      let angle = p.random(p.TWO_PI);
      let speed = p.random(2, 5);
      let velX = mouseVelX * 0.5 + Math.cos(angle) * speed;
      let velY = mouseVelY * 0.5 + Math.sin(angle) * speed;
      
      particle.vel.set(velX, velY);
    }
  };

  // Remove existing mouseMoved handler as we're handling mouse interaction in the particle system
  p.mouseMoved = () => {};
};

new p5(sketch);
