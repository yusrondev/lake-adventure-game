import * as THREE from 'three';

export class WaterSystem {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    
    const normalMap = this.generateWaterNormalMap();

    // Advanced Water Shader with Smooth World-Space Waves, Dynamic Storm Surge and Seamless Color Gradient
    this.waterLevelRise = 0.0;
    this.stormWaveMult = 1.0;
    this.targetStormFactor = 0.0;
    this.currentStormFactor = 0.0;

    // Localized Titan Sword Emergence Wave
    this.swordPos = new THREE.Vector3(0, -9999, 0);
    this.swordWaveFactor = 0.0;
    this.targetSwordWaveFactor = 0.0;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNormalMap: { value: normalMap },
        uDeepColor: { value: new THREE.Color(0x04243a) },    // Deep crystal lake blue
        uShallowColor: { value: new THREE.Color(0x1382a3) }, // Clear turquoise
        uFoamColor: { value: new THREE.Color(0xe8f8ff) },    // Soft white foam
        uSunColor: { value: new THREE.Color(0xfffaea) },
        uSkyColor: { value: new THREE.Color(0xfb923c) },    // Dynamic sky glow color
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.5).normalize() },
        uSpotLightPos: { value: new THREE.Vector3(0, 2.0, -3.0) },
        uSpotLightDir: { value: new THREE.Vector3(0, -0.3, -1.0).normalize() },
        uSpotLightColor: { value: new THREE.Color(0xffb84d) },
        uSpotLightIntensity: { value: 0.0 },
        uSpotLightAngle: { value: Math.PI / 8.5 },
        uWaterLevelRise: { value: 0.0 },
        uStormWaveMult: { value: 1.0 },
        uSwordPos: { value: this.swordPos },
        uSwordWaveFactor: { value: 0.0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWaterLevelRise;
        uniform float uStormWaveMult;
        uniform vec3 uSwordPos;
        uniform float uSwordWaveFactor;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vWaveHeight;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Compute world position before displacement
          vec4 initialWorldPos = modelMatrix * vec4(pos, 1.0);
          float wx = initialWorldPos.x;
          float wz = initialWorldPos.z;
          float t = uTime;

          // Extra Large Rolling Storm Waves with Smooth Continuous Phase
          float wave1 = sin(wx * 0.12 + wz * 0.18 - t * 1.3) * (0.16 * uStormWaveMult);
          float wave2 = cos(wx * 0.18 - wz * 0.14 + t * 1.0) * (0.12 * uStormWaveMult);
          float wave3 = sin(wz * 0.32 - t * 1.7) * (0.08 * uStormWaveMult);
          float stormSwell = sin(wx * 0.28 + wz * 0.38 + t * 2.0) * (0.14 * max(0.0, uStormWaveMult - 1.0));

          // Localized Titan Sword Emergence Wave (Radius <= 55m around uSwordPos)
          float swordDist = length(vec2(wx - uSwordPos.x, wz - uSwordPos.z));
          float swordAtten = smoothstep(55.0, 0.0, swordDist);
          float swordSwell = sin(swordDist * 0.45 - t * 3.2) * (0.35 * uSwordWaveFactor * swordAtten);

          float totalWave = uWaterLevelRise + wave1 + wave2 + wave3 + stormSwell + swordSwell;

          // In PlaneGeometry with rotation.x = -PI/2, local Z points UP in world space
          pos.z += totalWave;

          vec4 finalWorldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = finalWorldPos.xyz;
          vWaveHeight = totalWave;
          vNormal = normalize(mat3(modelMatrix) * normal);
          
          gl_Position = projectionMatrix * viewMatrix * finalWorldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uNormalMap;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSunColor;
        uniform vec3 uSkyColor;
        uniform vec3 uSunDirection;
        uniform vec3 uSpotLightPos;
        uniform vec3 uSpotLightDir;
        uniform vec3 uSpotLightColor;
        uniform float uSpotLightIntensity;
        uniform float uSpotLightAngle;
        
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vWaveHeight;

        void main() {
          // Continuous world-space UV texture scrolling
          vec2 uv1 = vWorldPosition.xz * 0.04 + vec2(uTime * 0.015, uTime * 0.01);
          vec2 uv2 = vWorldPosition.xz * 0.07 - vec2(uTime * 0.01, uTime * 0.018);

          vec3 normal1 = texture2D(uNormalMap, uv1).rgb * 2.0 - 1.0;
          vec3 normal2 = texture2D(uNormalMap, uv2).rgb * 2.0 - 1.0;
          vec3 blendedNormal = normalize(normal1 + normal2);

          vec3 worldNormal = normalize(vNormal + blendedNormal * 0.08);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);

          // Fresnel Factor (glassy reflections at glancing angles)
          float fresnel = pow(1.0 - max(0.0, dot(viewDir, worldNormal)), 3.0);
          fresnel = clamp(fresnel, 0.2, 0.85);

          // Rich crystal blue water gradient
          vec3 baseWater = mix(uDeepColor, uShallowColor, fresnel * 0.65);

          // Gentle wave crest sparkle
          float crestFoam = smoothstep(0.22, 0.42, vWaveHeight) * 0.25;
          vec3 waterCol = mix(baseWater, uFoamColor, crestFoam);

          // Clean, Smooth Specular Sun Reflection on Water (No lines or stripes)
          vec3 lightDir = normalize(uSunDirection);
          vec3 halfVector = normalize(lightDir + viewDir);

          float NdotH = max(0.0, dot(worldNormal, halfVector));
          float sunGlintCore = pow(NdotH, 64.0) * 0.55;

          // Dynamic Sky Reflection using uSkyColor (matches sunset/day/night)
          vec3 finalColor = mix(waterCol, uSkyColor, fresnel * 0.35) + uSunColor * sunGlintCore;

          // Dynamic Searchlight Headlight Projection on Lake Water (Bright Warm Amber Glow, Soft Edges)
          if (uSpotLightIntensity > 0.01) {
            vec3 lightToSurf = vWorldPosition - uSpotLightPos;
            float dist = length(lightToSurf);
            vec3 lDir = normalize(lightToSurf);
            
            float cosAngle = dot(lDir, normalize(uSpotLightDir));
            float cosCutoff = cos(uSpotLightAngle);
            
            if (cosAngle > cosCutoff && dist < 140.0) {
              // Smooth continuous radial falloff from beam center to outer edge (no hard triangular boundary)
              float angleFactor = clamp((cosAngle - cosCutoff) / (1.0 - cosCutoff), 0.0, 1.0);
              float coneAtten = pow(angleFactor, 1.8);
              float distAtten = pow(clamp(1.0 - (dist / 140.0), 0.0, 1.0), 1.2);
              
              vec3 spotHalfVec = normalize(-lDir + viewDir);
              float spotNdotH = max(0.0, dot(worldNormal, spotHalfVec));
              float spotSpec = pow(spotNdotH, 24.0) * 0.6; // Vibrant specular glint on water surface
              
              float lightFactor = coneAtten * distAtten * uSpotLightIntensity;
              vec3 warmGlow = uSpotLightColor * (0.85 + spotSpec);
              finalColor = mix(finalColor, finalColor + warmGlow, clamp(lightFactor * 0.75, 0.0, 0.85));
            }
          }

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: false,
      side: THREE.DoubleSide
    });
  }

  generateWaterNormalMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        // Multi-frequency organic wave normal generation
        const waveA = Math.sin(x * 0.08 + y * 0.06);
        const waveB = Math.cos(x * 0.05 - y * 0.09);
        const waveC = Math.sin((x + y) * 0.04);
        
        const nx = (waveA + waveC) * 0.25 + 0.5;
        const ny = (waveB - waveC) * 0.25 + 0.5;
        const index = (y * 256 + x) * 4;

        data[index] = Math.floor(nx * 255);
        data[index + 1] = Math.floor(ny * 255);
        data[index + 2] = 255;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // Exact match with vertex shader world coordinates for realistic buoyancy
  getWaveHeight(x, z) {
    const mult = this.stormWaveMult;
    const rise = this.waterLevelRise;
    const t = this.time;

    const wave1 = Math.sin(x * 0.12 + z * 0.18 - t * 1.3) * (0.16 * mult);
    const wave2 = Math.cos(x * 0.18 - z * 0.14 + t * 1.0) * (0.12 * mult);
    const wave3 = Math.sin(z * 0.32 - t * 1.7) * (0.08 * mult);
    const stormSwell = Math.sin(x * 0.28 + z * 0.38 + t * 2.0) * (0.14 * Math.max(0.0, mult - 1.0));

    let swordSwell = 0.0;
    if (this.swordWaveFactor > 0.001) {
      const dx = x - this.swordPos.x;
      const dz = z - this.swordPos.z;
      const swordDist = Math.hypot(dx, dz);
      if (swordDist < 55.0) {
        const swordAtten = 1.0 - (swordDist / 55.0);
        const smoothAtten = swordAtten * swordAtten * (3 - 2 * swordAtten);
        swordSwell = Math.sin(swordDist * 0.45 - t * 3.2) * (0.35 * this.swordWaveFactor * smoothAtten);
      }
    }

    return rise + wave1 + wave2 + wave3 + stormSwell + swordSwell;
  }

  setStormFactor(stormFactor) {
    this.targetStormFactor = stormFactor;
  }

  setSwordWave(x, z, factor) {
    this.swordPos.set(x, 0, z);
    this.targetSwordWaveFactor = factor;
  }

  update(delta) {
    // Silky-smooth exponential damping to eliminate any sudden level jumps or glitches
    const smoothRate = 1.0 - Math.exp(-1.4 * delta);
    this.currentStormFactor += (this.targetStormFactor - this.currentStormFactor) * smoothRate;

    const smoothSword = 1.0 - Math.exp(-3.0 * delta);
    this.swordWaveFactor += (this.targetSwordWaveFactor - this.swordWaveFactor) * smoothSword;

    // +0.60m smooth water swell and up to 3.8x wave multiplier
    this.waterLevelRise = this.currentStormFactor * 0.60;
    this.stormWaveMult = 1.0 + this.currentStormFactor * 2.8;

    // Advance time phase smoothly without phase jumping
    this.time += delta * (0.8 + Math.max(0.0, this.stormWaveMult - 1.0) * 0.35);

    if (this.material && this.material.uniforms) {
      this.material.uniforms.uTime.value = this.time;
      if (this.material.uniforms.uWaterLevelRise) {
        this.material.uniforms.uWaterLevelRise.value = this.waterLevelRise;
      }
      if (this.material.uniforms.uStormWaveMult) {
        this.material.uniforms.uStormWaveMult.value = this.stormWaveMult;
      }
      if (this.material.uniforms.uSwordPos) {
        this.material.uniforms.uSwordPos.value.copy(this.swordPos);
      }
      if (this.material.uniforms.uSwordWaveFactor) {
        this.material.uniforms.uSwordWaveFactor.value = this.swordWaveFactor;
      }
    }
  }
}
