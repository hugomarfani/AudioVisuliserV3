// Using a single default image for now
import particleListData from './particleList.json';

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

// Function to get particle physics from JSON
export const getParticlePhysics = (type: string): ParticlePhysics => {
  // Make case-insensitive comparison
  const particle = particleListData.particles.find(p => p.name.toLowerCase() === type.toLowerCase());
  if (particle) {
    return {
      name: particle.name,
      weight: particle.weight,
      gravity: particle.gravity,
      bounce: particle.bounce,
      airResistance: particle.airResistance,
      lifespan: particle.lifespan,
      glow: particle.glow,
      images: particle.images,
      moods: particle.moods
    };
  }
  
  // Return default if particle type not found
  const defaultParticle = particleListData.particles.find(p => p.name.toLowerCase() === "musicnote") || particleListData.particles[0];
  return {
    name: defaultParticle.name,
    weight: defaultParticle.weight,
    gravity: defaultParticle.gravity,
    bounce: defaultParticle.bounce,
    airResistance: defaultParticle.airResistance,
    lifespan: defaultParticle.lifespan,
    glow: defaultParticle.glow,
    images: defaultParticle.images,
    moods: defaultParticle.moods
  };
};

// Keep particlePhysics for backward compatibility but make it access the JSON data
export const particlePhysics: Record<string, ParticlePhysics> = new Proxy({} as Record<string, ParticlePhysics>, {
  get(target, prop) {
    if (typeof prop !== 'string') return undefined;
    return getParticlePhysics(prop);
  }
});

// Get particle configuration from JSON
export const getParticleConfig = (type: string): { dir: string, count: number } => {
  // Make case-insensitive comparison
  const particle = particleListData.particles.find(p => p.name.toLowerCase() === type.toLowerCase());
  if (particle) {
    return {
      dir: particle.dir,
      count: particle.count
    };
  }
  
  // Return default if particle type not found
  const defaultParticle = particleListData.particles.find(p => p.name.toLowerCase() === "musicnote") || particleListData.particles[0];
  return {
    dir: defaultParticle.dir,
    count: defaultParticle.count
  };
};

// Keep particleConfig for backward compatibility but make it access the JSON data
export const particleConfig: { [key: string]: { dir: string, count: number } } = new Proxy({} as { [key: string]: { dir: string, count: number } }, {
  get(target, prop) {
    if (typeof prop !== 'string') return undefined;
    return getParticleConfig(prop);
  }
});

// Function to get a random image for a given particle type
export const getRandomParticleImage = async (type: string, imageNumberDet?: number): Promise<string> => {
    console.log(`Getting image for particle type: ${type}`);
    
    // Get config from JSON - case-insensitive
    const particle = particleListData.particles.find(p => p.name.toLowerCase() === type.toLowerCase());
    
    if (!particle) {
        console.warn(`Particle type not found in JSON: ${type}, using default`);
        return await window.electron.fileSystem.mergeAssetPath('particles/musicNotes/musicNote1.png');
    }
    
    const config = {
        dir: particle.dir,
        count: particle.count
    };
    
    let imageNumber;

    if (imageNumberDet !== undefined) {
      imageNumber = imageNumberDet;
    } else {
      // If count is 0, there's no numbered images, use the particle name directly
      imageNumber = config.count > 0 ? Math.floor(Math.random() * config.count) + 1 : "";
    }
    
    // Construct the relative path
    let imageName;
    if (config.count === 0) {
        // For particles with count 0, just use the name as the filename without a number
        imageName = `${particle.name.toLowerCase().replace(/\s+/g, '_')}.png`;
    } else if (type.toLowerCase() === 'bubble') {
        imageName = 'bubbles1.png';
    } else {
        // Use a safer format for filenames by replacing spaces with underscores
        const safeType = type.toLowerCase().replace(/\s+/g, '_');
        imageName = `${safeType}${imageNumber}.png`;
    }
    
    // Construct the relative path with the directory from the JSON
    const relativePath = `particles/${config.dir}/${imageName}`;
    
    console.log(`Looking for image at: ${relativePath}`);
    
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
