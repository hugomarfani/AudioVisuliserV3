// Using a single default image for now
import defaultParticle from '../../assets/icon.png';
import note1 from '../../assets/particles/musicNotes/note1.png';
import bubble1 from '../../assets/particles/bubbles/bubbles1.png';
import star1 from '../../assets/particles/stars/star1.png';
import star2 from '../../assets/particles/stars/star2.png';


export interface ParticlePhysics {
  name: string;
  weight: number;
  gravity: number;
  bounce: number;
  airResistance: number;
  lifespan: number;
  glow?: boolean;
  images: string[];
  moods?: string[]; // Add moods attribute
}

// Example storage structure
export const particlePhysics: Record<string, ParticlePhysics> = {
  musicNote: { 
    name: "musicNote", 
    weight: 1.0, gravity: 0.15, bounce: 0.6, airResistance: 0.01, lifespan: 5000, 
    images: [note1],
    moods: ['happy', 'energetic']
  },
  bubble: { 
    name: "bubble", 
    weight: 0.3, gravity: 0.05, bounce: 0.8, airResistance: 0.02, lifespan: 4000, 
    images: [bubble1],
    moods: ['calm', 'happy']
  },
  star: { 
    name: "star", 
    weight: 2.8, gravity: 0.1, bounce: 0.7, airResistance: 0.015, lifespan: 6000, glow: true,
    images: [star1, star2],
    moods: ['happy', 'magical', 'festive']
  },
  balloon: {
    name: "balloon",
    weight: 0.2,
    gravity: -0.05, // Negative gravity makes it float up
    bounce: 0.3,
    airResistance: 0.02,
    lifespan: 8000,
    images: [defaultParticle], // Replace with actual balloon images
    moods: ['happy', 'celebratory', 'playful']
  },
  butterfly: {
    name: "butterfly",
    weight: 0.1,
    gravity: 0.02,
    bounce: 0.4,
    airResistance: 0.03,
    lifespan: 7000,
    images: [defaultParticle], // Replace with actual butterfly images
    moods: ['peaceful', 'gentle', 'romantic']
  },
  confetti: {
    name: "confetti",
    weight: 0.05,
    gravity: 0.08,
    bounce: 0.5,
    airResistance: 0.02,
    lifespan: 4000,
    images: [defaultParticle], // Replace with actual confetti images
    moods: ['celebratory', 'festive', 'energetic']
  },
  flower: {
    name: "flower",
    weight: 0.4,
    gravity: 0.12,
    bounce: 0.3,
    airResistance: 0.015,
    lifespan: 5000,
    images: [defaultParticle], // Replace with actual flower images
    moods: ['peaceful', 'romantic', 'gentle']
  },
  heart: {
    name: "heart",
    weight: 0.3,
    gravity: 0.1,
    bounce: 0.4,
    airResistance: 0.02,
    lifespan: 4500,
    glow: true,
    images: [defaultParticle], // Replace with actual heart images
    moods: ['romantic', 'loving', 'gentle']
  },
  leaf: {
    name: "leaf",
    weight: 0.2,
    gravity: 0.07,
    bounce: 0.3,
    airResistance: 0.025,
    lifespan: 6000,
    images: [defaultParticle], // Replace with actual leaf images
    moods: ['calm', 'peaceful', 'melancholic']
  },
  raindrop: {
    name: "raindrop",
    weight: 0.6,
    gravity: 0.2,
    bounce: 0.7,
    airResistance: 0.01,
    lifespan: 3000,
    images: [defaultParticle], // Replace with actual raindrop images
    moods: ['sad', 'melancholic', 'calm']
  },
  snowflake: {
    name: "snowflake",
    weight: 0.15,
    gravity: 0.05,
    bounce: 0.2,
    airResistance: 0.03,
    lifespan: 5500,
    images: [defaultParticle], // Replace with actual snowflake images
    moods: ['peaceful', 'gentle', 'magical']
  },
  firework: {
    name: "firework",
    weight: 0.8,
    gravity: 0.15,
    bounce: 0.6,
    airResistance: 0.01,
    lifespan: 2000,
    glow: true,
    images: [defaultParticle], // Replace with actual firework images
    moods: ['celebratory', 'festive', 'energetic']
  }
};

// Function to get a random image for a given particle type
export function getRandomParticleImage(type: string): string {
  const physics = particlePhysics[type];
  if (!physics) return defaultParticle; // Return defaultParticle instead of "default.png"
  return physics.images[Math.floor(Math.random() * physics.images.length)];
}
