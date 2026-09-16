import * as THREE from 'three';

export class DayNightCycle {
  constructor(scene, sunLight, camera, waterMaterial = null) {
    this.scene = scene;
    this.sunLight = sunLight;
    this.camera = camera;
    this.waterMaterial = waterMaterial;

    // Time state (0.0 to 24.0 hours)
    // Start at 15.2 (Sore) so player quickly experiences Senja sunset transition into night and then morning
    this.timeOfDay = 15.2; 
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

    // Pre-allocated storm mood colors
    this.stormSkyColor = new THREE.Color(0x151e2e);
    this.stormFogColor = new THREE.Color(0x1c2738);
    this.stormLightColor = new THREE.Color(0x475569);
    this.stormCloudColor = new THREE.Color(0x1e293b);

    this.weatherManager = null;

    this.initCelestialOrbs();
    this.initStarfield();
    this.initLowPolyClouds();
    this.initKeyframes();
  }

  setWeatherManager(weatherManager) {
    this.weatherManager = weatherManager;
  }

  initKeyframes() {
    // 100% Realistic Continuous 24-hour Life Cycle Keyframes with Natural Golden Sunrise
    this.keyframes = [
      { time: 0.0,  sky: 0x060c1c, fog: 0x060c1c, fogDensity: 0.007, light: 0x2c3e50, lightIntensity: 0.28, starOpacity: 0.95, sunMat: 0xf59e0b, halo: 0xd97706, glareOpacity: 0.0,  sunScale: 0.5 },
      { time: 4.5,  sky: 0x111c3a, fog: 0x152244, fogDensity: 0.007, light: 0x475569, lightIntensity: 0.35, starOpacity: 0.70, sunMat: 0xfbbf24, halo: 0xd97706, glareOpacity: 0.15, sunScale: 0.7 },
      { time: 5.5,  sky: 0x4a6b8f, fog: 0xfde68a, fogDensity: 0.006, light: 0xfef08a, lightIntensity: 0.75, starOpacity: 0.00, sunMat: 0xfef08a, halo: 0xfbbf24, glareOpacity: 0.45, sunScale: 0.9 }, // Golden Dawn / Sunrise
      { time: 6.8,  sky: 0x60a5fa, fog: 0xdbeafe, fogDensity: 0.005, light: 0xfffaed, lightIntensity: 1.25, starOpacity: 0.00, sunMat: 0xffffff, halo: 0xfde047, glareOpacity: 0.75, sunScale: 1.2 },  // Pagi Emas
      { time: 12.0, sky: 0x38bdf8, fog: 0xbae6fd, fogDensity: 0.004, light: 0xffffff, lightIntensity: 1.65, starOpacity: 0.00, sunMat: 0xffffff, halo: 0xffea00, glareOpacity: 1.00, sunScale: 1.45 }, // Siang Cerah
      { time: 15.5, sky: 0x38bdf8, fog: 0xbae6fd, fogDensity: 0.005, light: 0xfef08a, lightIntensity: 1.35, starOpacity: 0.00, sunMat: 0xfffaed, halo: 0xfbbf24, glareOpacity: 0.80, sunScale: 1.25 }, // Sore
      { time: 17.5, sky: 0xfb923c, fog: 0xf59e0b, fogDensity: 0.006, light: 0xfbbf24, lightIntensity: 0.90, starOpacity: 0.00, sunMat: 0xfb923c, halo: 0xf59e0b, glareOpacity: 0.60, sunScale: 1.05 }, // Sunset Golden Amber
      { time: 19.5, sky: 0x2e1065, fog: 0x1e1b4b, fogDensity: 0.007, light: 0x6366f1, lightIntensity: 0.38, starOpacity: 0.00, sunMat: 0xd97706, halo: 0xb45309, glareOpacity: 0.20, sunScale: 0.75 }, // Twilight Dusk
      { time: 21.5, sky: 0x08132b, fog: 0x08132b, fogDensity: 0.007, light: 0x2c3e50, lightIntensity: 0.25, starOpacity: 0.85, sunMat: 0xf59e0b, halo: 0xd97706, glareOpacity: 0.0,  sunScale: 0.5 },  // Malam
      { time: 24.0, sky: 0x060c1c, fog: 0x060c1c, fogDensity: 0.007, light: 0x2c3e50, lightIntensity: 0.28, starOpacity: 0.95, sunMat: 0xf59e0b, halo: 0xd97706, glareOpacity: 0.0,  sunScale: 0.5 }
    ];

    // Pre-create THREE.Color objects for keyframes to prevent GC
    this.keyframes.forEach(k => {
      k.cSky = new THREE.Color(k.sky);
      k.cFog = new THREE.Color(k.fog);
      k.cLight = new THREE.Color(k.light);
      k.cSunMat = new THREE.Color(k.sunMat);
      k.cHalo = new THREE.Color(k.halo);
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
    this.starCount = 1600;
    this.starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(this.starCount * 3);

    for (let i = 0; i < this.starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      // Elevation from horizon (0.02 rad ~ 1 deg up to 0.70 rad ~ 40 deg up)
      const phi = 0.02 + Math.pow(Math.random(), 1.4) * 0.68;
      const radius = 1800 + Math.random() * 400;

      starPositions[i * 3] = radius * Math.cos(phi) * Math.sin(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) + 50.0;
      starPositions[i * 3 + 2] = -radius * Math.cos(phi) * Math.cos(theta);
    }

    this.starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(220, 240, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const starTex = new THREE.CanvasTexture(canvas);

    this.starMat = new THREE.PointsMaterial({
      size: 1.8,
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

    this.cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      flatShading: true,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });

    const cloudCount = 28;
    const puffGeo = new THREE.DodecahedronGeometry(1.0, 1);

    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const puffCount = 5 + Math.floor(Math.random() * 4);

      for (let p = 0; p < puffCount; p++) {
        const mesh = new THREE.Mesh(puffGeo, this.cloudMat);
        const radius = 2.4 + Math.random() * 3.5;
        mesh.scale.set(radius, radius * (0.6 + Math.random() * 0.4), radius * 1.2);
        mesh.position.set(
          (p - puffCount / 2) * 2.8 + (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 2.5
        );
        mesh.castShadow = true;
        cloud.add(mesh);
      }

      const initialX = (Math.random() - 0.5) * 360;
      const initialY = 58 + Math.random() * 32;
      const initialZ = -220 + Math.random() * 260;

      cloud.position.set(initialX, initialY, initialZ);
      cloud.userData = { speed: 1.2 + Math.random() * 2.2, relZ: initialZ };
      this.cloudGroup.add(cloud);
      this.clouds.push(cloud);
    }

    this.scene.add(this.cloudGroup);
  }

  update(playerPos, delta) {
    this.elapsedTime += delta;

    // Advance Time of Day (0.0 to 24.0 hours)
    this.timeOfDay = (this.timeOfDay + this.timeSpeed * delta) % 24.0;

    // Daytime sun trajectory (Sunrise 05:15 to Sunset 19:15)
    // Map timeOfDay in [5.25, 19.25] to daytime angle [-PI/2, +PI/2]
    const dayProgress = (this.timeOfDay - 5.25) / 14.0; // 0 at dawn, 0.5 at noon, 1 at sunset
    const sunAngle = (dayProgress - 0.5) * Math.PI; // -PI/2 to +PI/2

    // Sun stays ALWAYS deep in the celestial background (-Z axis, 2200m away in distant horizon)
    const sunDistance = 2200.0;
    const sunX = playerPos.x + Math.sin(sunAngle * 0.25) * 80.0;
    const sunY = Math.max(22.0, Math.cos(sunAngle) * 580.0 + 35.0);
    const sunZ = playerPos.z - sunDistance;

    this.sunGroup.position.set(sunX, sunY, sunZ);
    // Dynamic Sunlight for directional shadows anchored near player
    this.sunLight.position.set(playerPos.x + 60.0, Math.max(35.0, sunY * 0.35 + 20.0), playerPos.z - 80.0);
    if (this.sunLight.target) {
      this.sunLight.target.position.copy(playerPos);
    }

    const horizonFade = THREE.MathUtils.clamp((sunY - 20.0) / 90.0, 0.0, 1.0);

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
    if (this.timeOfDay >= 20.5 && this.timeOfDay < 21.5) {
      nightOpacity = (this.timeOfDay - 20.5) / 1.0; // Smooth fade in at nightfall
    } else if (this.timeOfDay >= 21.5 || this.timeOfDay <= 4.0) {
      nightOpacity = 1.0; // Glowing moon & twinkling stars in deep night
    } else if (this.timeOfDay > 4.0 && this.timeOfDay <= 5.0) {
      nightOpacity = 1.0 - (this.timeOfDay - 4.0) / 1.0; // Smooth fade out at dawn
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
    this.starMat.opacity = nightOpacity * 0.95;

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

    let fogDensity = THREE.MathUtils.lerp(kPrev.fogDensity, kNext.fogDensity, t);
    let lightIntensity = THREE.MathUtils.lerp(kPrev.lightIntensity, kNext.lightIntensity, t) * horizonFade;
    let glareOpacity = THREE.MathUtils.lerp(kPrev.glareOpacity, kNext.glareOpacity, t) * horizonFade;
    const sunScale = THREE.MathUtils.lerp(kPrev.sunScale, kNext.sunScale, t);

    // Blend Overcast / Storm Darkening (Mendung Atmosphere)
    const stormOvercast = this.weatherManager ? this.weatherManager.overcastFactor : 0.0;
    if (stormOvercast > 0.001) {
      this.skyColorCurrent.lerp(this.stormSkyColor, stormOvercast * 0.88);
      this.fogColorCurrent.lerp(this.stormFogColor, stormOvercast * 0.85);
      this.sunLightColorCurrent.lerp(this.stormLightColor, stormOvercast * 0.90);
      
      lightIntensity = THREE.MathUtils.lerp(lightIntensity, 0.22, stormOvercast * 0.85);
      fogDensity = THREE.MathUtils.lerp(fogDensity, 0.011, stormOvercast * 0.85);
      glareOpacity *= (1.0 - stormOvercast * 0.9);
      nightOpacity *= (1.0 - stormOvercast * 0.95);

      this.starPoints.visible = isNightActive && (stormOvercast < 0.85);
      this.starMat.opacity = nightOpacity * 0.95 * (1.0 - stormOvercast);
      this.moonMesh.visible = isNightActive && (stormOvercast < 0.85);
      this.moonMat.opacity = nightOpacity * (1.0 - stormOvercast);
    }

    // Strict Celestial Visibility Control
    const isDaytime = (this.timeOfDay >= 5.25 && this.timeOfDay <= 19.25);
    this.sunGroup.visible = isDaytime && (stormOvercast < 0.95);

    // Apply values to Three.js elements
    this.scene.background.copy(this.skyColorCurrent);
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.fogColorCurrent);
      this.scene.fog.density = fogDensity * 0.38;
    }

    this.sunLight.color.copy(this.sunLightColorCurrent);
    this.sunLight.intensity = lightIntensity;

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

    // Update Water Material Specular Light Uniforms dynamically
    if (this.waterMaterial && this.waterMaterial.uniforms) {
      if (this.waterMaterial.uniforms.uSunColor) {
        this.waterMaterial.uniforms.uSunColor.value.copy(this.sunLightColorCurrent);
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
