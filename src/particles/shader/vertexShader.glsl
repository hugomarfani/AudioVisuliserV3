varying vec2 vUv;

uniform float time;
uniform sampler2D uTexture;
uniform float uFrequency;

// float normalizeFrequency( float f ) {
//     return f / 120.;
// }

// vec3 expelParticlesByFrequency(float f, vec3 position) {
//     vec2 center = vec2(0.0, 0.0);
//     position += f * position * 0.5;
//     return position;
// }

void main(){
    vUv = uv;
    vec3 newpos = position;
    vec4 color = texture2D( uTexture, vUv );
    newpos.xy = color.xy;

    // float radius = sqrt( newpos.x * newpos.x + newpos.y * newpos.y );
    // float angle = atan( newpos.y, newpos.x ) + time * 0.1;

    // float f = normalizeFrequency(uFrequency);
    // newpos = expelParticlesByFrequency(f, newpos);

    vec4 mvPosition = modelViewMatrix * vec4( newpos, 1.0 );
    gl_PointSize = (2.0 / -mvPosition.z );
    gl_Position = projectionMatrix * mvPosition;
}
