import p5 from "p5";
import { particlePhysics, getRandomParticleImage } from "./particlePhysics";

class Particle {
  pos: p5.Vector;
  vel: p5.Vector;
  acc: p5.Vector;
  lifespan: number;
  type: string;
  img: p5.Image;
  p: p5;

  constructor(p: p5, x: number, y: number, type: string) {
    this.p = p;
    this.pos = p.createVector(x, y);
    // Increased initial velocity range for more dynamic movement
    this.vel = p.createVector(p.random(-2, 2), p.random(-2, 2));
    this.acc = p.createVector(0, 0);
    this.type = type;
    
    // Load image
    this.img = p.loadImage(getRandomParticleImage(type));

    // Get physics properties
    const physics = particlePhysics[type] || particlePhysics["musicNote"];
    this.lifespan = physics.lifespan;
  }

  applyForce(force: p5.Vector) {
    this.acc.add(force);
  }

  update() {
    const physics = particlePhysics[this.type] || particlePhysics["musicNote"];
    
    // Apply gravity (positive y is downward in p5)
    const gravity = this.p.createVector(0, physics.gravity * physics.weight);
    this.applyForce(gravity);
    
    // Apply air resistance
    const airResistance = this.vel.copy();
    airResistance.mult(-physics.airResistance);
    this.applyForce(airResistance);

    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);

    // Only bounce off left and right edges
    if (this.pos.x < 0 || this.pos.x > this.p.width) {
      this.vel.x *= -physics.bounce;
    }

    this.lifespan -= 2;
  }

  display() {
    this.p.image(this.img, this.pos.x, this.pos.y, 30, 30); // Draw the image
  }

  isDead() {
    // Remove particles when they go off screen vertically or expire
    return this.lifespan <= 0 || 
           this.pos.y > this.p.height + 30; // +30 to account for particle size
  }

  handleMouseCollision(mouseX: number, mouseY: number, mouseVelX: number, mouseVelY: number) {
    const mouseRadius = 50; // Increased radius for easier interaction
    const dx = this.pos.x - mouseX;
    const dy = this.pos.y - mouseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < mouseRadius) {
      // Create repulsion force
      const repulsionStrength = 1 - (distance / mouseRadius); // Stronger when closer
      const baseForce = 15; // Increased base force
      
      // Calculate force direction
      let forceX = (dx / distance) * baseForce * repulsionStrength;
      let forceY = (dy / distance) * baseForce * repulsionStrength;
      
      // Add mouse velocity influence
      const mouseInfluence = 0.3;
      forceX += mouseVelX * mouseInfluence;
      forceY += mouseVelY * mouseInfluence;
      
      // Apply the force
      this.vel.x += forceX;
      this.vel.y += forceY;
      
      // Add some chaos
      this.vel.x += this.p.random(-0.5, 0.5);
      this.vel.y += this.p.random(-0.5, 0.5);
      
      // Optional: Cap maximum velocity
      const maxVel = 20;
      this.vel.x = this.p.constrain(this.vel.x, -maxVel, maxVel);
      this.vel.y = this.p.constrain(this.vel.y, -maxVel, maxVel);
    }
  }

  checkCollision(other: Particle) {
    const dx = other.pos.x - this.pos.x;
    const dy = other.pos.y - this.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = 40; // Increased interaction radius

    if (distance < minDist && distance > 0) {  // Added distance > 0 check
      // Calculate collision normal
      const nx = dx / distance;
      const ny = dy / distance;

      // Calculate relative velocity
      const dvx = other.vel.x - this.vel.x;
      const dvy = other.vel.y - this.vel.y;

      // Calculate impulse with increased bounce effect
      const impulse = (dvx * nx + dvy * ny) * 0.8; // Increased bounce coefficient

      // Apply impulse with stronger effect
      const impulseX = nx * impulse;
      const impulseY = ny * impulse;
      
      this.vel.x += impulseX;
      this.vel.y += impulseY;
      other.vel.x -= impulseX;
      other.vel.y -= impulseY;

      // Add slight repulsion force
      const repulsion = 0.5;
      this.vel.x -= nx * repulsion;
      this.vel.y -= ny * repulsion;
      other.vel.x += nx * repulsion;
      other.vel.y += ny * repulsion;

      // Separate particles more aggressively
      const overlap = minDist - distance;
      const separation = overlap * 0.7; // Increased separation factor
      this.pos.x -= nx * separation;
      this.pos.y -= ny * separation;
      other.pos.x += nx * separation;
      other.pos.y += ny * separation;
    }
  }
}

class ParticleSystem {
  particles: Particle[] = [];
  p: p5;
  maxParticles = 10;  // New maximum particles limit

  constructor(p: p5) {
    this.p = p;
  }

  addParticle(x: number, y: number, type: string): Particle | null {
    if (this.particles.length >= this.maxParticles) {
      // Remove oldest particle if at max capacity
      this.particles.shift();
    }
    const particle = new Particle(this.p, x, y, type);
    this.particles.push(particle);
    return particle;
  }

  updateAndDisplay(mouseX: number, mouseY: number, mouseVelX: number, mouseVelY: number) {
    // More thorough collision detection
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      
      // Check collisions with all other particles
      for (let j = 0; j < this.particles.length; j++) {
        if (i !== j) {
          particle.checkCollision(this.particles[j]);
        }
      }

      // Update particle
      particle.handleMouseCollision(mouseX, mouseY, mouseVelX, mouseVelY);
      particle.update();
      particle.display();
    }

    // Remove dead particles
    this.particles = this.particles.filter(particle => !particle.isDead());
  }
}

export { ParticleSystem };
