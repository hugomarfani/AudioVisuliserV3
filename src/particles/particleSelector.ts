import { particlePhysics, ParticlePhysics } from './particlePhysics';
import particleListData from './particleList.json';

export class ParticleSelector {
    private static validParticles: string[] = [];
    private static particleMap: { [key: string]: string } = {};
    private static particleData: any[] = [];
    
    static {
        // Store the full particle data for reference
        this.particleData = particleListData.particles;
        
        // Initialize valid particles from JSON - store both names and IDs
        this.validParticles = this.particleData.map(p => p.name.toLowerCase());
        
        // Initialize particle mappings
        this.particleMap = {
            'snowfaleks': 'snowflake',
            'snowflakes': 'snowflake',
            'musicnote': 'musicNote',
            'music': 'musicNote',
            'note': 'musicNote',
            'leaf': 'leaves',
        };
        
        // Add plural/singular forms automatically and handle ID mappings
        this.particleData.forEach(p => {
            // Convert names to lowercase for consistent comparison
            const name = p.name.toLowerCase();
            
            // Add original name exactly as in JSON
            this.particleMap[p.name.toLowerCase()] = name;
            
            // Handle plural forms
            const pluralForm = name.endsWith('y') ? 
                name.slice(0, -1) + 'ies' : 
                name + 's';
            
            if (name !== pluralForm) {
                this.particleMap[pluralForm] = name;
            }
            
            // Add ID mapping if different from name
            if (p.id) {
                this.particleMap[p.id.toLowerCase()] = name;
            }

            // Handle spaces in names (both with and without spaces)
            if (p.name.includes(' ')) {
                const noSpaceName = p.name.replace(/\s+/g, '').toLowerCase();
                this.particleMap[noSpaceName] = name;
            }
        });
        
        console.log('Valid particles loaded:', this.validParticles);
    }

    private static normalizeParticleType(type: string): string {
        // Handle common variations and typos
        const normalized = type.toLowerCase().trim();
        return this.particleMap[normalized] || normalized;
    }

    public static validateParticleType(type: string): string {
        const normalized = this.normalizeParticleType(type);
        console.log(`Normalizing particle type: ${type} -> ${normalized}`);
        
        // Check if the normalized type is in our valid particles list
        if (this.validParticles.includes(normalized)) {
            return normalized;
        }
        
        // Check if any particle in the JSON has this name (case-insensitive)
        const exactMatch = this.particleData.find(p => 
            p.name.toLowerCase() === normalized || 
            p.id.toLowerCase() === normalized
        );
        
        if (exactMatch) {
            return exactMatch.name.toLowerCase();
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
