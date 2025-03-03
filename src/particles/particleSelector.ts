import { particlePhysics, ParticlePhysics } from './particlePhysics';

export class ParticleSelector {
    private static validParticles = [
        'star',
        'bubble',
        'musicNote',
        'heart',
        'snowflake',
        'snowflakes', // Add common variants
        'leaves',
        'butterfly',
        'confetti',
        'raindrop',
        'firefly',
        'balloon',
        'flower',
        'firework',
        'crown',
        'animal',
    ];

    private static normalizeParticleType(type: string): string {
        // Handle common variations and typos
        const normalized = type.toLowerCase().trim();
        const particleMap: { [key: string]: string } = {
            'snowfaleks': 'snowflake',
            'snowflakes': 'snowflake',
            'musicnote': 'musicNote',
            'music': 'musicNote',
            'note': 'musicNote',
            'leaf': 'leaves',
            // Add more mappings as needed
        };

        return particleMap[normalized] || normalized;
    }

    public static validateParticleType(type: string): string {
        const normalized = this.normalizeParticleType(type);
        console.log(`Normalizing particle type: ${type} -> ${normalized}`);
        
        if (this.validParticles.includes(normalized)) {
            return normalized;
        }
        
        // If not found, try to find closest match
        const closest = this.validParticles.find(p => p.includes(normalized) || normalized.includes(p));
        if (closest) {
            console.log(`Found closest match for ${normalized}: ${closest}`);
            return closest;
        }
        
        console.log(`No valid particle type found for: ${type}, using default`);
        return 'musicNote';
    }

    public static getRandomParticleFromArray(particles: string[]): string {
        if (!particles || particles.length === 0) {
            return 'musicNote';
        }
        
        // Get a random valid particle from the array
        const validParticles = particles
            .map(p => this.validateParticleType(p))
            .filter(p => this.validParticles.includes(p));

        if (validParticles.length === 0) {
            return 'musicNote';
        }

        return validParticles[Math.floor(Math.random() * validParticles.length)];
    }
}
