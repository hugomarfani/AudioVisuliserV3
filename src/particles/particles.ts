import p5 from "p5";
import { particlePhysics, getRandomParticleImage } from "./particlePhysics";

class Particle {
  pos: p5.Vector;
  vel: p5.Vector;
  acc: p5.Vector;
  lifespan: number;
  type: string;
  img: p5.Image | null;
  p: p5;

  constructor(p: p5, x: number, y: number, type: string, imageNum?: number) {
    console.log(`Creating particle of type: ${type} at position (${x}, ${y})`);
    this.p = p;
    this.pos = p.createVector(x, y);
    // Increased initial velocity range for more dynamic movement
    this.vel = p.createVector(p.random(-2, 2), p.random(-2, 2));
    this.acc = p.createVector(0, 0);
    this.type = type;
    
    // Initialize with default image
    this.img = null;
    
    // Load image immediately -> prevent white circles
    if (imageNum !== undefined) {
      this.loadImage(imageNum);
    } else {
      this.loadImage();
    }

    // Get physics properties
    const physics = particlePhysics[type] || particlePhysics["musicNote"];
    this.lifespan = physics.lifespan;
  }

  async loadImage(imageNum?: number) {
    try {
      let imagePath;
      if (imageNum !== undefined) {
        imagePath = await getRandomParticleImage(this.type, imageNum);
        // console.log("ImageNum is defined in loadImage");
      } else {
        imagePath = await getRandomParticleImage(this.type);
        // console.log("No ImageNum defined in loadImage");
      }
      // console.log('Loading particle image from:', imagePath);
      
      // Use p5's loadImage with a Promise wrapper
      this.img = await new Promise((resolve, reject) => {
        const img = this.p.loadImage(
          imagePath,
          () => resolve(img),
          (err) => {
            console.error('Failed to load image:', err);
            reject(err);
          }
        );
      });
      
      console.log('Image loaded successfully for', this.type);
    } catch (error) {
      console.error('Error loading particle image:', error);
    }
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

    // Add edge repulsion force to prevent accumulation at edges
    const edgeBuffer = 40; // Distance from edge where repulsion starts
    const edgeForceStrength = 0.05; // Strength of the repulsion
    
    // Left edge repulsion
    if (this.pos.x < edgeBuffer) {
      const force = edgeForceStrength * (1 - this.pos.x / edgeBuffer);
      this.applyForce(this.p.createVector(force, 0));
    }
    
    // Right edge repulsion
    if (this.pos.x > this.p.width - edgeBuffer) {
      const force = edgeForceStrength * (1 - (this.p.width - this.pos.x) / edgeBuffer);
      this.applyForce(this.p.createVector(-force, 0));
    }

    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);

    // Only bounce off left and right edges
    if (this.pos.x < 0 || this.pos.x > this.p.width) {
      this.vel.x *= -physics.bounce;
      // Push particles more firmly back into view if they've gone beyond the edge
      if (this.pos.x < 0) this.pos.x = 5;
      if (this.pos.x > this.p.width) this.pos.x = this.p.width - 5;
    }

    this.lifespan -= 2;
  }

  display() {
    this.p.push();
    if (this.img) {
      this.p.imageMode(this.p.CENTER);
      this.p.tint(255, this.lifespan * 0.5); // Add fade effect based on lifespan
      this.p.image(this.img, this.pos.x, this.pos.y, 90, 90);
      this.p.noTint(); // Reset tint
    } else {
      // Fallback display while image is loading or if it failed to load
      this.p.fill(255, this.lifespan * 0.5);
      this.p.noStroke();
      this.p.ellipse(this.pos.x, this.pos.y, 90, 90);
    }
    this.p.pop();
  }

  isDead() {
    const physics = particlePhysics[this.type] || particlePhysics["musicNote"];
    
    // Check if particle has expired based on lifespan
    if (this.lifespan <= 0) return true;
    
    // For particles with negative gravity (like balloons), check top of screen
    if (physics.gravity < 0) {
      return this.pos.y < -30; // -30 to account for particle size
    }
    
    // For regular particles, check bottom of screen
    return this.pos.y > this.p.height + 30;
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
  maxParticles = 150;  // Changed from 50 to 10

  constructor(p: p5) {
    console.log('Initializing ParticleSystem');
    this.p = p;
  }

  async addParticle(x: number, y: number, type: string, imageNum?: number): Promise<Particle | null> {
    console.log(`Adding particle: type=${type}, x=${x}, y=${y}`);
    if (this.particles.length >= this.maxParticles) {
      console.log('Max particles reached, removing oldest');
      this.particles.shift();
    }
    let particle;
    if (imageNum !== undefined) {
      particle = new Particle(this.p, x, y, type, imageNum);
    } else {
      particle = new Particle(this.p, x, y, type);
    }
    // const particle = new Particle(this.p, x, y, type);
    if (imageNum !== undefined) {
      await particle.loadImage(imageNum); 
      // console.log("ImageNum is defined");
    }else {
      await particle.loadImage(); 
    }
    this.particles.push(particle);
    console.log(`Total particles: ${this.particles.length}`);
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
