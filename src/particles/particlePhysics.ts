// Using a single default image for now

// load in the images -> TODO: change to dynamic changes later
const findImagePath = async (p: string) => {
  const response = await window.electron.fileSystem.mergeAssetPath(p);
  return response;
};
let defaultParticle;
let musicNote1;
let musicNote2;
let bubble1;
let bubble2;
let star1;
let star2;
let crown1;
let animal1;
let animal2;
let animal3;
let animal4;
let animal5;
let animal6;


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
    images: [],
    moods: ['happy', 'energetic']
  },
  bubble: { 
    name: "bubble", 
    weight: 0.3, gravity: 0.05, bounce: 0.8, airResistance: 0.02, lifespan: 4000, 
    images: [],
    moods: ['calm', 'happy']
  },
  star: { 
    name: "star", 
    weight: 2.8, gravity: 0.1, bounce: 0.7, airResistance: 0.015, lifespan: 6000, glow: true,
    images: [],
    moods: ['happy', 'magical', 'festive']
  },
  balloon: {
    name: "balloon",
    weight: 0.2,
    gravity: -0.05, 
    bounce: 0.3,
    airResistance: 0.02,
    lifespan: 8000,
    images: [],
    moods: ['happy', 'celebratory', 'playful']
  },
  butterfly: {
    name: "butterfly",
    weight: 0.1,
    gravity: 0.02,
    bounce: 0.4,
    airResistance: 0.03,
    lifespan: 7000,
    images: [], 
    moods: ['peaceful', 'gentle', 'romantic']
  },
  confetti: {
    name: "confetti",
    weight: 0.05,
    gravity: 0.08,
    bounce: 0.5,
    airResistance: 0.02,
    lifespan: 4000,
    images: [],
    moods: ['celebratory', 'festive', 'energetic']
  },
  flower: {
    name: "flower",
    weight: 0.4,
    gravity: 0.12,
    bounce: 0.3,
    airResistance: 0.015,
    lifespan: 5000,
    images: [], 
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
    images: [], 
    moods: ['romantic', 'loving', 'gentle']
  },
  leaf: {
    name: "leaf",
    weight: 0.2,
    gravity: 0.07,
    bounce: 0.3,
    airResistance: 0.025,
    lifespan: 6000,
    images: [],
    moods: ['calm', 'peaceful', 'melancholic']
  },
  raindrop: {
    name: "raindrop",
    weight: 0.6,
    gravity: 0.2,
    bounce: 0.7,
    airResistance: 0.01,
    lifespan: 3000,
    images: [], 
    moods: ['sad', 'melancholic', 'calm']
  },
  snowflake: {
    name: "snowflake",
    weight: 0.15,
    gravity: 0.05,
    bounce: 0.2,
    airResistance: 0.03,
    lifespan: 5500,
    images: [], 
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
    images: [], 
    moods: ['celebratory', 'festive', 'energetic']
  },
  crown: {
    name: "crown",
    weight: 0.5,
    gravity: 0.1,
    bounce: 0.4,
    airResistance: 0.02,
    lifespan: 5000,
    images: [],
    moods: ['royal', 'festive', 'celebratory']
  },
  animal: {
    name: "animal",
    weight: 1.0,
    gravity: 0.15,
    bounce: 0.6,
    airResistance: 0.01,
    lifespan: 5000,
    images: [],
    moods: ['happy', 'energetic']
  },
  emoji: {
    name: "emoji",
    weight: 0.5,
    gravity: 0.17,
    bounce: 0.4,
    airResistance: 0.03,
    lifespan: 7000,
    images: [], 
    moods: ['happy', 'playful', 'fun']
  }
  
};

export const particleConfig: { [key: string]: { dir: string, count: number } } = {
  musicNote: { dir: 'musicNotes', count: 5 }, 
  star: { dir: 'stars', count: 3 },
  bubble: { dir: 'bubbles', count: 1 },
  snowflake: { dir: 'snowflakes', count: 3 },
  heart: { dir: 'hearts', count: 5},
  leaves: { dir: 'leaves', count: 1 },
  butterfly: { dir: 'butterflies', count: 1 },
  confetti: { dir: 'confetti', count: 2 },
  raindrop: { dir: 'raindrops', count: 4 },
  firefly: { dir: 'fireflies', count: 1 },
  balloon: { dir: 'balloons', count: 4},
  flower: { dir: 'flowers', count: 1 },
  firework: { dir: 'fireworks', count: 4 },
  crown: { dir: 'crowns', count: 1 },
  animal: { dir: 'animals', count: 6 },
  emoji: { dir: 'emojis', count: 5 }
};


// Function to get a random image for a given particle type
export const getRandomParticleImage = async (type: string, imageNumberDet?: number): Promise<string> => {
    console.log(`Getting image for particle type: ${type}`);
    
    // Map particle types to their directory names and number of images

    const config = particleConfig[type] || particleConfig.musicNote;
    
    let imageNumber

    if (imageNumberDet !== undefined) {
      imageNumber = imageNumberDet;
      // console.log("ImageNum is defined in getRandomParticleImage");
    } else {
      imageNumber = Math.floor(Math.random() * config.count) + 1;
    }
    
    // Construct the relative path
    const imageName = type === 'bubble' ? 'bubbles1.png' : `${type}${imageNumber}.png`;
    const relativePath = `particles/${config.dir}/${imageName}`;
    
    try {
        // Use electron to get the correct absolute path
        const fullPath = await window.electron.fileSystem.mergeAssetPath(relativePath);
        console.log(`Selected image path: ${fullPath}`);
        return fullPath;
    } catch (error) {
        console.error(`Error loading image: ${relativePath}`, error);
        // Return a default image path if the requested one fails
        return await window.electron.fileSystem.mergeAssetPath('particles/musicNotes/musicNote1.png');
    }
};
