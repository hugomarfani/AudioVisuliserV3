import { particlePhysics, ParticlePhysics } from './particlePhysics';

export class ParticleSelector {
    private static ParticleMap: Record<string, string[]> = {
        star: ['star'],
        bubble: ['bubble'],
        musicNote: ['musicNote'],
        heart: ['heart'],
        snowflake: ['snowflake'],
        leaves: ['leaves'],
        butterfly: ['butterfly'],
        confetti: ['confetti'],
        raindrop: ['raindrop'],
        firefly: ['firefly'],
        balloon: ['balloon'],
        flower: ['flower'],
        firework: ['firework'],
    };

    public static getParticlesForMood(mood: string): string[] {
        const normalizedMood = mood.toLowerCase();
        return this.ParticleMap[normalizedMood] || ['star', 'bubble', 'musicNote']; // default particles
    }

    public static getRandomParticleType(mood: string): string {
        const availableTypes = this.getParticlesForMood(mood);
        return availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }
}
