import * as THREE from 'three';

export class DayNightCycle {
  constructor(scene, sunLight, camera, waterMaterial = null, hemiLight = null, ambientLight = null) {
    this.scene = scene;
    this.sunLight = sunLight;
    this.camera = camera;
    this.waterMaterial = waterMaterial;
    this.hemiLight = hemiLight;
    this.ambientLight = ambientLight;

    // Time state (0.0 to 24.0 hours)
    // Start at 5.5 (Golden Dawn / Sunrise)
    this.timeOfDay = 5.5; 
    this.timeSpeed = 0.08; // Continuous dynamic cycle (~5 minutes per full 24h day/night)
    this.elapsedTime = 0;

    // Pre-allocate temporary Color objects for keyframe interpolation (Zero-GC)
    this.skyColorCurrent = new THREE.Color();
    this.fogColorCurrent = new THREE.Color();
    this.sunLightColorCurrent = new THREE.Color();
    this.sunMatColorCurrent = new THREE.Color();
    this.haloColorCurrent = new THREE.Color();
    this.glareColorCurrent = new THREE.Color();
    this.waterSunColorCurrent = new THREE.Color();

    this.hemiSkyColorCurrent = new THREE.Color();
    this.hemiGroundColorCurrent = new THREE.Color();
    this.ambientColorCurrent = new THREE.Color();

    // Pre-allocated storm mood colors
    this.stormSkyColor = new THREE.Color(0x151e2e);
    this.stormFogColor = new THREE.Color(0x1c2738);
    this.stormLightColor = new THREE.Color(0x475569);
    this.stormCloudColor = new THREE.Color(0x1e293b);
    this.stormHemiSkyColor = new THREE.Color(0x1e293b);
    this.stormHemiGroundColor = new THREE.Color(0x0f172a);
    this.stormAmbientColor = new THREE.Color(0x1e293b);

    this.weatherManager = null;
    this.currentFogDensity = 0.0018;

    this.initCelestialOrbs();
    this.initStarfield();
    this.initLowPolyClouds();
    this.initKeyframes();
  }

  setWeatherManager(weatherManager) {
    this.weatherManager = weatherManager;
  }

  initKeyframes() {
    // 100% Realistic Continuous 24-hour Life Cycle Keyframes with Vibrant Daytime Fill Light
    this.keyframes = [
      { time: 0.0,  sky: 0x060c1c, fog: 0x060c1c, fogDensity: 0.007, light: 0x3b82f6, lightIntensity: 0.35, hemiSky: 0x1e293b, hemiGround: 0x0f172a, hemiIntensity: 0.45, ambient: 0x1e293b, ambientIntensity: 0.30, starOpacity: 0.95, sunMat: 0xf59e0b, halo: 0xd97706, glareOpacity: 0.0,  sunScale: 0.5 },
      { time: 4.5,  sky: 0x111c3a, fog: 0x152244, fogDensity: 0.007, light: 0x60a5fa, lightIntensity: 0.45, hemiSky: 0x334155, hemiGround: 0x1e293b, hemiIntensity: 0.55, ambient: 0x334155, ambientIntensity: 0.40, starOpacity: 0.70, sunMat: 0xfbbf24, halo: 0xd97706, glareOpacity: 0.15, sunScale: 0.7 },
      { time: 5.5,  sky: 0x4a6b8f, fog: 0xfde68a, fogDensity: 0.006, light: 0xfef08a, lightIntensity: 0.85, hemiSky: 0x93c5fd, hemiGround: 0x475569, hemiIntensity: 0.90, ambient: 0xfde047, ambientIntensity: 0.55, starOpacity: 0.00, sunMat: 0xfef08a, halo: 0xfbbf24, glareOpacity: 0.45, sunScale: 0.9 }, // Golden Dawn / Sunrise
      { time: 6.8,  sky: 0x60a5fa, fog: 0xdbeafe, fogDensity: 0.005, light: 0xfffaed, lightIntensity: 1.35, hemiSky: 0xffffff, hemiGround: 0x8592a6, hemiIntensity: 1.25, ambient: 0xffffff, ambientIntensity: 0.65, starOpacity: 0.00, sunMat: 0xffffff, halo: 0xfde047, glareOpacity: 0.75, sunScale: 1.2 },  // Pagi Emas
      { time: 12.0, sky: 0x38bdf8, fog: 0xbae6fd, fogDensity: 0.004, light: 0xffffff, lightIntensity: 1.50, hemiSky: 0xffffff, hemiGround: 0x94a3b8, hemiIntensity: 1.35, ambient: 0xffffff, ambientIntensity: 0.70, starOpacity: 0.00, sunMat: 0xffffff, halo: 0xffea00, glareOpacity: 1.00, sunScale: 1.45 }, // Siang Cerah
      { time: 15.5, sky: 0x38bdf8, fog: 0xbae6fd, fogDensity: 0.005, light: 0xfef08a, lightIntensity: 1.40, hemiSky: 0xffffff, hemiGround: 0x8592a6, hemiIntensity: 1.30, ambient: 0xffffff, ambientIntensity: 0.68, starOpacity: 0.00, sunMat: 0xfffaed, halo: 0xfbbf24, glareOpacity: 0.80, sunScale: 1.25 }, // Sore
      { time: 17.5, sky: 0xf97316, fog: 0xf59e0b, fogDensity: 0.006, light: 0xfbbf24, lightIntensity: 1.10, hemiSky: 0xfed7aa, hemiGround: 0x78350f, hemiIntensity: 1.05, ambient: 0xfdba74, ambientIntensity: 0.60, starOpacity: 0.00, sunMat: 0xf97316, halo: 0xeab308, glareOpacity: 0.70, sunScale: 1.20 }, // Sunset Golden Amber
      { time: 18.8, sky: 0xc2410c, fog: 0xea580c, fogDensity: 0.0065, light: 0xf97316, lightIntensity: 0.80, hemiSky: 0xf97316, hemiGround: 0x451a03, hemiIntensity: 0.80, ambient: 0xf97316, ambientIntensity: 0.50, starOpacity: 0.00, sunMat: 0xef4444, halo: 0xf97316, glareOpacity: 0.50, sunScale: 1.35 }, // Deep Crimson Sunset Horizon (Sinking Sun)
      { time: 19.8, sky: 0x311042, fog: 0x2e1065, fogDensity: 0.007, light: 0x6366f1, lightIntensity: 0.50, hemiSky: 0x4338ca, hemiGround: 0x1e1b4b, hemiIntensity: 0.55, ambient: 0x4338ca, ambientIntensity: 0.40, starOpacity: 0.20, sunMat: 0xd97706, halo: 0x9a3412, glareOpacity: 0.15, sunScale: 1.00 }, // Twilight Dusk
      { time: 21.5, sky: 0x08132b, fog: 0x08132b, fogDensity: 0.007, light: 0x3b82f6, lightIntensity: 0.35, hemiSky: 0x1e293b, hemiGround: 0x0f172a, hemiIntensity: 0.45, ambient: 0x1e293b, ambientIntensity: 0.30, starOpacity: 0.85, sunMat: 0xf59e0b, halo: 0xd97706, glareOpacity: 0.0,  sunScale: 0.5 },  // Malam
      { time: 24.0, sky: 0x060c1c, fog: 0x060c1c, fogDensity: 0.007, light: 0x3b82f6, lightIntensity: 0.35, hemiSky: 0x1e293b, hemiGround: 0x0f172a, hemiIntensity: 0.45, ambient: 0x1e293b, ambientIntensity: 0.30, starOpacity: 0.95, sunMat: 0xf59e0b, halo: 0xd97706, glareOpacity: 0.0,  sunScale: 0.5 }
    ];

    // Pre-create THREE.Color objects for keyframes to prevent GC
    this.keyframes.forEach(k => {
      k.cSky = new THREE.Color(k.sky);
      k.cFog = new THREE.Color(k.fog);
      k.cLight = new THREE.Color(k.light);
      k.cSunMat = new THREE.Color(k.sunMat);
      k.cHalo = new THREE.Color(k.halo);
      k.cHemiSky = new THREE.Color(k.hemiSky);
      k.cHemiGround = new THREE.Color(k.hemiGround);
      k.cAmbient = new THREE.Color(k.ambient);
    });
  }

  initCelestialOrbs() {
    this.sunGroup = new THREE.Group();

    // 1. Pure Smooth Core Sun Sphere in Deep Celestial Background
    const sunGeo = new THREE.SphereGeometry(65.0, 64, 64);
    this.sunMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      fog: false,
      depthWrite: true,
      depthTest: true
    });
    this.sunMesh = new THREE.Mesh(sunGeo, this.sunMat);
    this.sunMesh.renderOrder = -100;
    this.sunGroup.add(this.sunMesh);

    // 2. Pure Borderless Soft Radial Glow Sun Halo
    const haloGeo = new THREE.PlaneGeometry(165.0, 165.0);
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 256;
    haloCanvas.height = 256;
    const hCtx = haloCanvas.getContext('2d');
    
    const grad = hCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.30, 'rgba(255, 245, 200, 0.7)');
    grad.addColorStop(0.65, 'rgba(255, 180, 60, 0.25)');
    grad.addColorStop(0.90, 'rgba(255, 120, 20, 0.04)');
    grad.addColorStop(1.00, 'rgba(255, 90, 0, 0.00)');
    hCtx.fillStyle = grad;
    hCtx.fillRect(0, 0, 256, 256);

    const haloTexture = new THREE.CanvasTexture(haloCanvas);
    this.haloMat = new THREE.MeshBasicMaterial({
      map: haloTexture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      fog: false
    });
    this.haloMesh = new THREE.Mesh(haloGeo, this.haloMat);
    this.haloMesh.renderOrder = -95;
    this.sunGroup.add(this.haloMesh);

    this.scene.add(this.sunGroup);

    // 3. Realistic Cratered Moon with Basalt Maria & Distinct Craters (Smaller, recognizable, not plain white)
    this.moonGroup = new THREE.Group();

    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 512;
    moonCanvas.height = 512;
    const mCtx = moonCanvas.getContext('2d');

    // Soft Pearlescent Ash Moon Base Tone (Warm Silvery Grey)
    mCtx.fillStyle = '#cbd5e1';
    mCtx.fillRect(0, 0, 512, 512);

    // Base Surface Grain Noise
    const imgData = mCtx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 26;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    mCtx.putImageData(imgData, 0, 0);

    // Dark Basalt Lunar Maria Plains (Sea of Tranquility, Oceanus Procellarum, etc.)
    const mariaRegions = [
      { x: 195, y: 165, rx: 95, ry: 75, angle: 0.25, color: 'rgba(51, 65, 85, 0.72)' },
      { x: 315, y: 145, rx: 80, ry: 60, angle: -0.30, color: 'rgba(30, 41, 59, 0.68)' },
      { x: 235, y: 275, rx: 115, ry: 85, angle: 0.15, color: 'rgba(51, 65, 85, 0.70)' },
      { x: 375, y: 265, rx: 70, ry: 50, angle: 0.40, color: 'rgba(71, 85, 105, 0.65)' },
      { x: 145, y: 315, rx: 65, ry: 55, angle: -0.20, color: 'rgba(100, 116, 139, 0.60)' }
    ];

    mariaRegions.forEach(m => {
      const mGrad = mCtx.createRadialGradient(m.x, m.y, 0, m.x, m.y, Math.max(m.rx, m.ry));
      mGrad.addColorStop(0.0, m.color);
      mGrad.addColorStop(0.65, m.color);
      mGrad.addColorStop(1.0, 'rgba(203, 213, 225, 0)');
      mCtx.fillStyle = mGrad;
      mCtx.beginPath();
      mCtx.ellipse(m.x, m.y, m.rx, m.ry, m.angle, 0, Math.PI * 2);
      mCtx.fill();
    });

    // Prominent Impact Craters with Rims & Radial Ejecta Rays (Tycho, Copernicus, Kepler)
    const craters = [
      { x: 260, y: 395, r: 25 },
      { x: 160, y: 220, r: 20 },
      { x: 110, y: 200, r: 15 },
      { x: 380, y: 180, r: 18 },
      { x: 340, y: 360, r: 14 },
      { x: 210, y: 120, r: 12 }
    ];

    craters.forEach(c => {
      // Crater Radial Ejecta Rays (Bright splashes)
      mCtx.strokeStyle = 'rgba(255, 255, 255, 0.50)';
      mCtx.lineWidth = 1.6;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const rayLen = c.r * (1.8 + Math.random() * 2.2);
        mCtx.beginPath();
        mCtx.moveTo(c.x, c.y);
        mCtx.lineTo(c.x + Math.cos(a) * rayLen, c.y + Math.sin(a) * rayLen);
        mCtx.stroke();
      }

      // Dark Inner Shadow
      mCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      mCtx.beginPath();
      mCtx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      mCtx.fill();

      // Bright Highlighted Raised Rim
      mCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      mCtx.lineWidth = 2.8;
      mCtx.beginPath();
      mCtx.arc(c.x - 1.2, c.y - 1.2, c.r * 0.9, 0, Math.PI * 2);
      mCtx.stroke();

      // Central Peak
      mCtx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      mCtx.beginPath();
      mCtx.arc(c.x, c.y, Math.max(1.8, c.r * 0.20), 0, Math.PI * 2);
      mCtx.fill();
    });

    const moonTexture = new THREE.CanvasTexture(moonCanvas);
    const moonGeo = new THREE.SphereGeometry(32.0, 32, 32);
    this.moonMat = new THREE.MeshBasicMaterial({
      map: moonTexture,
      transparent: true,
      opacity: 0.0,
      fog: false,
      depthWrite: true,
      depthTest: true
    });
    this.moonMesh = new THREE.Mesh(moonGeo, this.moonMat);
    this.moonMesh.renderOrder = -90;
    this.moonGroup.add(this.moonMesh);

    // Soft Lunar Silver Atmospheric Glow Halo
    const moonHaloGeo = new THREE.PlaneGeometry(85.0, 85.0);
    const moonHaloCanvas = document.createElement('canvas');
    moonHaloCanvas.width = 128;
    moonHaloCanvas.height = 128;
    const mhCtx = moonHaloCanvas.getContext('2d');
    const mhGrad = mhCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    mhGrad.addColorStop(0.00, 'rgba(215, 235, 255, 0.45)');
    mhGrad.addColorStop(0.35, 'rgba(180, 210, 255, 0.20)');
    mhGrad.addColorStop(0.70, 'rgba(150, 180, 240, 0.05)');
    mhGrad.addColorStop(1.00, 'rgba(100, 150, 220, 0.00)');
    mhCtx.fillStyle = mhGrad;
    mhCtx.fillRect(0, 0, 128, 128);

    const moonHaloTexture = new THREE.CanvasTexture(moonHaloCanvas);
    this.moonHaloMat = new THREE.MeshBasicMaterial({
      map: moonHaloTexture,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      fog: false
    });
    this.moonHaloMesh = new THREE.Mesh(moonHaloGeo, this.moonHaloMat);
    this.moonHaloMesh.renderOrder = -85;
    this.moonGroup.add(this.moonHaloMesh);

    this.scene.add(this.moonGroup);
  }

  initStarfield() {
    this.starCount = 2500;
    this.starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(this.starCount * 3);

    for (let i = 0; i < this.starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      // Elevation from horizon (0.01 rad ~ 0.5 deg up to 0.85 rad ~ 50 deg up)
      const phi = 0.01 + Math.pow(Math.random(), 1.3) * 0.84;
      const radius = 1600 + Math.random() * 500;

      starPositions[i * 3] = radius * Math.cos(phi) * Math.sin(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) + 40.0;
      starPositions[i * 3 + 2] = -radius * Math.cos(phi) * Math.cos(theta);
    }

    this.starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    // High-contrast sparkling 4-point star texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.2, 'rgba(238, 242, 255, 0.95)');
    grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.50)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    // Cross flare lines for diamond starlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(32, 8); ctx.lineTo(32, 56);
    ctx.moveTo(8, 32); ctx.lineTo(56, 32);
    ctx.stroke();

    const starTex = new THREE.CanvasTexture(canvas);

    this.starMat = new THREE.PointsMaterial({
      size: 3.8,
      sizeAttenuation: false, // Critical for crisp, clear star visibility at infinite background distance
      map: starTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending
    });

    this.starPoints = new THREE.Points(this.starGeo, this.starMat);
    this.scene.add(this.starPoints);
  }

  initLowPolyClouds() {
    this.cloudGroup = new THREE.Group();
    this.clouds = [];
    // All clouds completely removed as requested
  }

  update(playerPos, delta) {
    this.elapsedTime += delta;

    // Advance Time of Day (0.0 to 24.0 hours)
    this.timeOfDay = (this.timeOfDay + this.timeSpeed * delta) % 24.0;

    // Daytime sun trajectory (Sunrise 04:45 to Sunset 20:15)
    // Map timeOfDay in [4.75, 20.25] to daytime angle [-PI/2, +PI/2]
    const dayProgress = (this.timeOfDay - 4.75) / 15.5; // 0 at dawn, 0.5 at noon, 1 at sunset
    const sunAngle = (dayProgress - 0.5) * Math.PI; // -PI/2 to +PI/2

    // Sun stays ALWAYS deep in the celestial background (-Z axis, 2200m away in distant horizon)
    const sunDistance = 2200.0;
    const sunX = playerPos.x + Math.sin(sunAngle * 0.25) * 80.0;
    // Allow sun to physically dip below horizon line (down to Y = -55.0) so top sliver remains visible as it sets
    const sunY = Math.cos(sunAngle) * 630.0 - 55.0;
    const sunZ = playerPos.z - sunDistance;

    this.sunGroup.position.set(sunX, sunY, sunZ);
    // Dynamic Sunlight for directional shadows positioned behind/above player camera shining down-river
    this.sunLight.position.set(
      playerPos.x + Math.sin(sunAngle * 0.25) * 50.0 + 25.0,
      Math.max(45.0, sunY * 0.45 + 35.0),
      playerPos.z + 90.0 // Anchored behind player camera at +Z shining down-river toward -Z
    );
    if (this.sunLight.target) {
      this.sunLight.target.position.set(playerPos.x, playerPos.y + 2.0, playerPos.z - 80.0);
    }

    // Shadow Off during daytime (5.5h to 18.5h)
    const isDay = (this.timeOfDay >= 5.5 && this.timeOfDay <= 18.5);
    this.sunLight.castShadow = !isDay;

    // Smooth horizon fade as sun dips deep below horizon (-55m)
    const horizonFade = THREE.MathUtils.clamp((sunY + 60.0) / 110.0, 0.0, 1.0);

    if (this.haloMesh) {
      this.haloMesh.lookAt(this.camera.position);
    }

    // Distant High Moon (Deep celestial background at 2100m, always behind gates and terrain)
    const moonDistance = 2100.0;
    const moonX = playerPos.x + 190.0;
    const moonY = 520.0;
    const moonZ = playerPos.z - moonDistance;
    this.moonGroup.position.set(moonX, moonY, moonZ);

    if (this.moonHaloMesh) {
      this.moonHaloMesh.lookAt(this.camera.position);
    }

    // Synchronized Night Opacity & Fade-In/Fade-Out for BOTH Moon and Stars
    let nightOpacity = 0.0;
    if (this.timeOfDay >= 19.2 && this.timeOfDay < 20.8) {
      nightOpacity = (this.timeOfDay - 19.2) / 1.6; // Smooth fade in starting at sunset dusk
    } else if (this.timeOfDay >= 20.8 || this.timeOfDay <= 4.5) {
      nightOpacity = 1.0; // Sparkling moon & brilliant diamond stars in deep night
    } else if (this.timeOfDay > 4.5 && this.timeOfDay <= 5.8) {
      nightOpacity = 1.0 - (this.timeOfDay - 4.5) / 1.3; // Smooth fade out at dawn
    }
    nightOpacity = THREE.MathUtils.clamp(nightOpacity, 0.0, 1.0);

    const isNightActive = (nightOpacity > 0.001);

    // Moon & Stars appear together and fade in/out together
    this.moonGroup.visible = isNightActive;
    this.moonMat.opacity = nightOpacity;
    if (this.moonHaloMat) {
      this.moonHaloMat.opacity = nightOpacity * 0.75;
    }

    this.starPoints.position.copy(playerPos);
    this.starPoints.visible = isNightActive;
    this.starMat.opacity = nightOpacity * 1.0;
    this.starMat.size = 3.6 + Math.sin(this.elapsedTime * 2.5) * 0.45; // Subtle twinkling starlight pulse

    // 100% Smooth Continuous Keyframe Interpolation
    let kPrev = this.keyframes[0];
    let kNext = this.keyframes[this.keyframes.length - 1];

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (this.timeOfDay >= this.keyframes[i].time && this.timeOfDay <= this.keyframes[i + 1].time) {
        kPrev = this.keyframes[i];
        kNext = this.keyframes[i + 1];
        break;
      }
    }

    const duration = kNext.time - kPrev.time;
    const alpha = duration > 0 ? (this.timeOfDay - kPrev.time) / duration : 0;
    const t = alpha * alpha * (3 - 2 * alpha);

    this.skyColorCurrent.copy(kPrev.cSky).lerp(kNext.cSky, t);
    this.fogColorCurrent.copy(kPrev.cFog).lerp(kNext.cFog, t);
    this.sunLightColorCurrent.copy(kPrev.cLight).lerp(kNext.cLight, t);
    this.sunMatColorCurrent.copy(kPrev.cSunMat).lerp(kNext.cSunMat, t);
    this.haloColorCurrent.copy(kPrev.cHalo).lerp(kNext.cHalo, t);
    this.hemiSkyColorCurrent.copy(kPrev.cHemiSky).lerp(kNext.cHemiSky, t);
    this.hemiGroundColorCurrent.copy(kPrev.cHemiGround).lerp(kNext.cHemiGround, t);
    this.ambientColorCurrent.copy(kPrev.cAmbient).lerp(kNext.cAmbient, t);

    let fogDensity = THREE.MathUtils.lerp(kPrev.fogDensity, kNext.fogDensity, t);
    let lightIntensity = THREE.MathUtils.lerp(kPrev.lightIntensity, kNext.lightIntensity, t) * horizonFade;
    let hemiIntensity = THREE.MathUtils.lerp(kPrev.hemiIntensity, kNext.hemiIntensity, t);
    let ambientIntensity = THREE.MathUtils.lerp(kPrev.ambientIntensity, kNext.ambientIntensity, t);
    let glareOpacity = THREE.MathUtils.lerp(kPrev.glareOpacity, kNext.glareOpacity, t) * horizonFade;
    const sunScale = THREE.MathUtils.lerp(kPrev.sunScale, kNext.sunScale, t);

    // Blend Overcast / Storm Darkening (Mendung Atmosphere)
    const stormOvercast = this.weatherManager ? this.weatherManager.overcastFactor : 0.0;
    if (stormOvercast > 0.001) {
      this.skyColorCurrent.lerp(this.stormSkyColor, stormOvercast * 0.88);
      this.fogColorCurrent.lerp(this.stormFogColor, stormOvercast * 0.85);
      this.sunLightColorCurrent.lerp(this.stormLightColor, stormOvercast * 0.90);
      this.hemiSkyColorCurrent.lerp(this.stormHemiSkyColor, stormOvercast * 0.85);
      this.hemiGroundColorCurrent.lerp(this.stormHemiGroundColor, stormOvercast * 0.85);
      this.ambientColorCurrent.lerp(this.stormAmbientColor, stormOvercast * 0.85);

      lightIntensity = THREE.MathUtils.lerp(lightIntensity, 0.30, stormOvercast * 0.85);
      hemiIntensity = THREE.MathUtils.lerp(hemiIntensity, 0.45, stormOvercast * 0.85);
      ambientIntensity = THREE.MathUtils.lerp(ambientIntensity, 0.30, stormOvercast * 0.85);
      fogDensity = THREE.MathUtils.lerp(fogDensity, 0.011, stormOvercast * 0.85);
      glareOpacity *= (1.0 - stormOvercast * 0.9);
      nightOpacity *= (1.0 - stormOvercast * 0.95);

      this.starPoints.visible = isNightActive && (stormOvercast < 0.85);
      this.starMat.opacity = nightOpacity * 0.95 * (1.0 - stormOvercast);
      this.moonMesh.visible = isNightActive && (stormOvercast < 0.85);
      this.moonMat.opacity = nightOpacity * (1.0 - stormOvercast);
    }

    // Strict Celestial Visibility Control (Sun remains visible through sunset until it dips below horizon at 20.25)
    const isDaytime = (this.timeOfDay >= 4.75 && this.timeOfDay <= 20.25);
    this.sunGroup.visible = isDaytime && (stormOvercast < 0.95);

    // Apply values to Three.js elements
    this.scene.background.copy(this.skyColorCurrent);
    if (this.scene.fog) {
      this.scene.fog = null;
    }

    this.sunLight.color.copy(this.sunLightColorCurrent);
    this.sunLight.intensity = lightIntensity;

    if (this.hemiLight) {
      this.hemiLight.color.copy(this.hemiSkyColorCurrent);
      this.hemiLight.groundColor.copy(this.hemiGroundColorCurrent);
      this.hemiLight.intensity = hemiIntensity;
    }

    if (this.ambientLight) {
      this.ambientLight.color.copy(this.ambientColorCurrent);
      this.ambientLight.intensity = ambientIntensity;
    }

    this.sunMat.color.copy(this.sunMatColorCurrent);
    this.sunMat.transparent = true;
    this.sunMat.opacity = horizonFade * (1.0 - stormOvercast * 0.9);

    this.haloMat.color.copy(this.haloColorCurrent);
    this.haloMat.opacity = Math.min(0.95, glareOpacity * 0.85);

    this.sunGroup.scale.setScalar(sunScale);

    // Update Low-Poly Drift Clouds
    if (this.clouds) {
      for (const cloud of this.clouds) {
        cloud.position.x += cloud.userData.speed * delta;
        cloud.position.z = playerPos.z + cloud.userData.relZ;

        if (cloud.position.x > playerPos.x + 180) {
          cloud.position.x = playerPos.x - 180;
        }
      }

      if (this.cloudMat) {
        let baseCloudColor = 0xffffff;
        if (this.timeOfDay >= 6.0 && this.timeOfDay < 16.0) {
          baseCloudColor = 0xffffff; // Daytime crisp white
        } else if (this.timeOfDay >= 16.0 && this.timeOfDay < 19.2) {
          baseCloudColor = 0xfb923c; // Sunset warm golden orange
        } else {
          baseCloudColor = 0x334155; // Nighttime slate
        }

        this.cloudMat.color.setHex(baseCloudColor);
        if (stormOvercast > 0.001) {
          this.cloudMat.color.lerp(this.stormCloudColor, stormOvercast * 0.92);
          this.cloudMat.opacity = THREE.MathUtils.lerp(0.35, 0.65, stormOvercast);
        } else {
          this.cloudMat.opacity = 0.35;
        }
      }
    }

    // Update Water Material Specular Light & Sky Color Uniforms dynamically
    if (this.waterMaterial && this.waterMaterial.uniforms) {
      if (this.waterMaterial.uniforms.uSunColor) {
        this.waterMaterial.uniforms.uSunColor.value.copy(this.sunLightColorCurrent);
      }
      if (this.waterMaterial.uniforms.uSkyColor) {
        this.waterMaterial.uniforms.uSkyColor.value.copy(this.skyColorCurrent);
      }
      if (this.waterMaterial.uniforms.uSunDirection) {
        this.waterMaterial.uniforms.uSunDirection.value.set(sunX - playerPos.x, sunY, sunZ - playerPos.z).normalize();
      }
    }
  }

  getTimeFormatted() {
    const hours = Math.floor(this.timeOfDay);
    const mins = Math.floor((this.timeOfDay % 1) * 60);
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    if (this.timeOfDay >= 6.0 && this.timeOfDay < 11.0) return `🌅 ${timeStr}`;
    if (this.timeOfDay >= 11.0 && this.timeOfDay < 16.0) return `☀️ ${timeStr}`;
    if (this.timeOfDay >= 16.0 && this.timeOfDay < 19.2) return `🌇 ${timeStr}`;
    return `🌙 ${timeStr}`;
  }
}
