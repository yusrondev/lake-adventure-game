import * as THREE from 'three';

export class WeatherManager {
  constructor(scene, game, dayNightCycle) {
    this.scene = scene;
    this.game = game;
    this.dayNightCycle = dayNightCycle;

    // Daily Rain Schedule State
    // 1 Day = 24.0 in-game hours
    this.currentDayIndex = 0;
    this.scheduledRainHour = 22.0; // Day 0 rain scheduled at 22:00 PM (guarantees 100% clear start at 17:30 Sore/Senja)
    this.drizzleDurationSeconds = 15.0; // 15 real seconds of clear-sky drizzle before storm
    this.rainDurationHours = 3.6;     // Extended longer duration for rain & storm
    this.clearingDurationHours = 1.0; // Smooth clearing phase

    // Weather factors (0.0 to 1.0)
    this.overcastFactor = 0.0; // 0 = clear sky, 1 = dark stormy clouds & sky
    this.rainIntensity = 0.0;  // 0 = no rain, 1 = heavy downpour
    this.weatherState = 'CLEAR'; // 'CLEAR', 'DRIZZLE', 'STORM', 'CLEARING'
    this.currentWeatherStatus = '☀️ Cerah';

    // Manual debug override flag
    this.manualStormActive = false;

    // Scaling Boat Lightning Strikes per storm event state (+1 strike on each subsequent storm)
    this.stormCount = 1;
    this.boatStrikesThisStormCount = 0;
    this.maxBoatStrikesThisStorm = 1;
    this.nextBoatStrikeTimer = 2.5; // First strike timer after storm begins
    this.nextDistantLightningTimer = 1.0; // Frequent distant lightning interval

    // Pool of active lightning bolts for multiple simultaneous visible strikes
    this.activeLightningBolts = [];
    this.lightningFlashTimer = 0;
    this.lightningFlashIntensity = 0;

    // Setup visual particle systems
    this.initStreakRain();
    this.initWaterRipples();
    this.initLightningLight();
    this.initAudioSynthesizer();
  }

  reset() {
    this.currentDayIndex = 0;
    this.stormCount = 1;
    this.boatStrikesThisStormCount = 0;
    this.maxBoatStrikesThisStorm = 1;
    this.nextBoatStrikeTimer = 2.5;
    this.manualStormActive = false;
  }

  generateRandomRainHour() {
    // Pick a random hour in the later afternoon/night (between 11:00 AM and 22:00 PM)
    return 11.0 + Math.random() * 11.0;
  }

  // --- 1. REALISTIC NATURAL TRANSLUCENT STREAK RAIN ---
  initStreakRain() {
    // Light natural drop count to keep view clear and performant
    this.dropCount = 2200;
    this.rainGeo = new THREE.BufferGeometry();
    
    // Each line segment has 2 vertices (start & end) -> 2 * 3 = 6 floats per drop
    this.rainPositions = new Float32Array(this.dropCount * 6);
    this.dropData = [];

    // Camera view bounds: Camera is at playerPos.z + 18, viewing forward to playerPos.z - 110
    this.rainBounds = {
      halfX: 36.0,
      centerZOffset: -45.0, // Center of camera view cone ahead of boat
      halfZ: 65.0,          // Extends from player.z - 110 to player.z + 20
      minY: 0.0,
      maxY: 34.0
    };

    // Wind velocity vector (subtle natural angle)
    this.windX = -3.8;
    this.windZ = -1.8;
    this.dropLength = 1.25;

    for (let i = 0; i < this.dropCount; i++) {
      const rx = (Math.random() - 0.5) * (this.rainBounds.halfX * 2);
      const ry = Math.random() * this.rainBounds.maxY;
      const rz = this.rainBounds.centerZOffset + (Math.random() - 0.5) * (this.rainBounds.halfZ * 2);
      const speed = 44.0 + Math.random() * 20.0; // Realistic fall velocity (44-64 m/s)
      const len = this.dropLength * (0.75 + Math.random() * 0.5);

      this.dropData.push({
        x: rx,
        y: ry,
        z: rz,
        speed: speed,
        len: len
      });

      const idx = i * 6;
      // Start vertex (top)
      this.rainPositions[idx] = rx;
      this.rainPositions[idx + 1] = ry;
      this.rainPositions[idx + 2] = rz;

      // End vertex (bottom, stretched along fall & wind trajectory)
      this.rainPositions[idx + 3] = rx + (this.windX / speed) * len;
      this.rainPositions[idx + 4] = ry - len;
      this.rainPositions[idx + 5] = rz + (this.windZ / speed) * len;
    }

    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    // Natural translucent raindrop material (Normal blending with soft glassy slate-blue tint)
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0x8ba6c1,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.renderOrder = 999;
    this.scene.add(this.rainLines);
  }

  // --- 2. WATER IMPACT SPLASH RIPPLES ---
  initWaterRipples() {
    this.rippleCount = 60;
    this.ripples = [];
    this.rippleGeo = new THREE.RingGeometry(0.12, 0.32, 16);
    this.rippleGeo.rotateX(-Math.PI / 2);

    this.rippleMat = new THREE.MeshBasicMaterial({
      color: 0x7fa4c2,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });

    this.rippleGroup = new THREE.Group();
    this.rippleGroup.renderOrder = 998;

    for (let i = 0; i < this.rippleCount; i++) {
      const mesh = new THREE.Mesh(this.rippleGeo, this.rippleMat.clone());
      mesh.visible = false;
      mesh.position.set(0, 0.04, 0);
      this.rippleGroup.add(mesh);
      this.ripples.push({
        mesh: mesh,
        active: false,
        life: 0,
        maxLife: 0.42 + Math.random() * 0.22,
        maxScale: 1.6 + Math.random() * 1.2
      });
    }

    this.scene.add(this.rippleGroup);
  }

  spawnRipple(x, z) {
    const ripple = this.ripples.find(r => !r.active);
    if (!ripple) return;

    ripple.active = true;
    ripple.life = 0;
    ripple.mesh.visible = true;
    ripple.mesh.position.x = x;
    ripple.mesh.position.z = z;
    ripple.mesh.position.y = 0.04;
    ripple.mesh.scale.set(0.2, 0.2, 0.2);
    ripple.mesh.material.opacity = 0.45;
  }

  // --- 3. MULTIPLE LIGHTNING BOLTS & FLASH SYSTEM ---
  initLightningLight() {
    this.lightningLight = new THREE.DirectionalLight(0xdbeafe, 0.0);
    this.lightningLight.position.set(0, 80, 0);
    this.scene.add(this.lightningLight);

    this.lightningPointLight = new THREE.PointLight(0x60a5fa, 0.0, 140, 1.5);
    this.scene.add(this.lightningPointLight);
  }

  createLightningBoltGeometry(startPos, endPos) {
    const points = [];
    const segments = 18;
    let curr = startPos.clone();
    points.push(curr.clone());

    const dir = new THREE.Vector3().subVectors(endPos, startPos);
    const step = dir.clone().divideScalar(segments);

    for (let i = 1; i < segments; i++) {
      const basePos = startPos.clone().add(step.clone().multiplyScalar(i));
      const jitter = (1.0 - i / segments) * 4.0 + 1.2;
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * jitter * 2.2,
        (Math.random() - 0.5) * (jitter * 0.6),
        (Math.random() - 0.5) * jitter * 2.2
      );
      curr = basePos.add(offset);
      points.push(curr.clone());

      // Secondary fork branch (30% chance)
      if (Math.random() < 0.30 && i < segments - 3) {
        const branchEnd = curr.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 12.0,
          -Math.random() * 15.0,
          (Math.random() - 0.5) * 12.0
        ));
        points.push(branchEnd);
        points.push(curr.clone()); // Return to main stem
      }
    }
    points.push(endPos.clone());

    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    return lineGeo;
  }

  triggerLightningStrike(playerWorldPos, forceBoatHit = false) {
    if (this.rainIntensity < 0.20) return;

    let targetX, targetY, targetZ;
    const isBoatHit = forceBoatHit;

    if (isBoatHit) {
      // Strike directly at player boat center / mast
      targetX = playerWorldPos.x + (Math.random() - 0.5) * 0.5;
      targetY = 1.8;
      targetZ = playerWorldPos.z + (Math.random() - 0.5) * 1.0;
      this.hasStruckBoatThisStorm = true;
    } else {
      // Atmospheric distant lightning striking lake horizon, distant cliffs, or distant water
      const distance = 35.0 + Math.random() * 110.0;
      const angle = (Math.random() - 0.5) * Math.PI * 1.5 - Math.PI / 2; // Mostly in forward lake view
      targetX = playerWorldPos.x + Math.sin(angle) * distance;
      targetY = (Math.random() < 0.4) ? 0.0 : (Math.random() * 15.0); // Surface or cloud-to-cloud
      targetZ = playerWorldPos.z + Math.cos(angle) * distance - 20.0;
    }

    const startPos = new THREE.Vector3(
      targetX + (Math.random() - 0.5) * 30.0,
      68.0 + Math.random() * 20.0,
      targetZ + (Math.random() - 0.5) * 30.0
    );
    const endPos = new THREE.Vector3(targetX, targetY, targetZ);

    const boltGeo = this.createLightningBoltGeometry(startPos, endPos);
    const boltMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 3,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });

    const boltMesh = new THREE.Line(boltGeo, boltMat);
    boltMesh.renderOrder = 1001;
    this.scene.add(boltMesh);

    this.activeLightningBolts.push({
      mesh: boltMesh,
      timer: 0.18 + Math.random() * 0.08,
      maxTimer: 0.24,
      isBoatHit: isBoatHit
    });

    // Light flash
    this.lightningFlashTimer = 0.22;
    this.lightningFlashIntensity = isBoatHit ? 3.8 : 1.8;
    this.lightningLight.intensity = Math.max(this.lightningLight.intensity, this.lightningFlashIntensity);
    this.lightningPointLight.position.set(targetX, Math.max(2.0, targetY + 3.0), targetZ);
    this.lightningPointLight.intensity = Math.max(this.lightningPointLight.intensity, isBoatHit ? 14.0 : 5.0);

    // Play synthesized thunder audio
    this.playThunderSound(isBoatHit);

    // Apply boat damage and feedback if hit
    if (isBoatHit && this.game) {
      this.applyBoatLightningDamage();
    }
  }

  createJaggedLightningBoltGeometry(startPos, endPos, isWaterArc = false) {
    const points = [];
    const segments = isWaterArc ? 14 : 18;
    let curr = startPos.clone();
    points.push(curr.clone());

    const dir = new THREE.Vector3().subVectors(endPos, startPos);
    const step = dir.clone().divideScalar(segments);

    // Perpendicular vectors for organic 3D zigzag displacement
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
    const perpUp = new THREE.Vector3().crossVectors(right, dir).normalize();

    let lastJitterRight = 0;
    let lastJitterUp = 0;

    for (let i = 1; i < segments; i++) {
      const progress = i / segments;
      const basePos = startPos.clone().add(step.clone().multiplyScalar(i));
      
      const envelope = Math.sin(progress * Math.PI);
      const maxDisplacement = (isWaterArc ? 5.5 : 8.5) * envelope;

      // Sharp direction flips for dramatic jagged path ("bekelok-kelok")
      lastJitterRight = -lastJitterRight * 0.35 + (Math.random() - 0.5) * maxDisplacement;
      lastJitterUp = -lastJitterUp * 0.35 + (Math.random() - 0.5) * maxDisplacement;

      const offset = right.clone().multiplyScalar(lastJitterRight)
        .add(perpUp.clone().multiplyScalar(lastJitterUp));

      curr = basePos.add(offset);
      points.push(curr.clone());

      // Jagged branch split (30% chance)
      if (Math.random() < 0.30 && i < segments - 2) {
        const branchOffset = right.clone().multiplyScalar((Math.random() - 0.5) * maxDisplacement * 1.5)
          .add(perpUp.clone().multiplyScalar((Math.random() - 0.5) * maxDisplacement * 1.5))
          .add(step.clone().multiplyScalar(1.2));
        const branchEnd = curr.clone().add(branchOffset);
        points.push(branchEnd);
        points.push(curr.clone());
      }
    }
    points.push(endPos.clone());

    return new THREE.BufferGeometry().setFromPoints(points);
  }

  spawnWaterLightningStrike(targetX, targetY, targetZ) {
    // Random offset around titan sword base on lake water surface (8m to 25m radius)
    const angle = Math.random() * Math.PI * 2;
    const dist = 8.0 + Math.random() * 18.0;
    const waterX = targetX + Math.cos(angle) * dist;
    const waterZ = targetZ + Math.sin(angle) * dist;

    // Start position originates FROM THE TITAN SWORD MESH (not from the sky!)
    const startPos = new THREE.Vector3(
      targetX + (Math.random() - 0.5) * 2.5,
      Math.max(6.0, (targetY || 8.0) + 10.0 + Math.random() * 22.0),
      targetZ + (Math.random() - 0.5) * 2.5
    );

    // End position strikes down onto the surrounding lake water surface Y = 0.1
    const endPos = new THREE.Vector3(waterX, 0.1, waterZ);

    const boltGeo = this.createJaggedLightningBoltGeometry(startPos, endPos, true);
    const boltMat = new THREE.LineBasicMaterial({
      color: 0x60a5fa, // Electric cyan-blue water strike tint
      linewidth: 1.5,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    const boltMesh = new THREE.Line(boltGeo, boltMat);
    boltMesh.renderOrder = 1002;
    this.scene.add(boltMesh);

    this.activeLightningBolts.push({
      mesh: boltMesh,
      timer: 0.16 + Math.random() * 0.06,
      maxTimer: 0.22,
      isBoatHit: false
    });

    // Water impact ripple & splash spray where lightning arcs from sword into the lake!
    this.spawnRipple(waterX, waterZ);
    if (this.game && this.game.swordRainManager) {
      this.game.swordRainManager.spawnWaterSplash(waterX, waterZ);
    }
  }

  spawnSingleSwordStrike(targetX, targetY, targetZ) {
    // Jagged 3D lightning bolt striking the titan sword
    const startPos = new THREE.Vector3(
      targetX + (Math.random() - 0.5) * 10.0,
      135.0 + Math.random() * 15.0,
      targetZ + (Math.random() - 0.5) * 10.0
    );
    const endPos = new THREE.Vector3(targetX, Math.max(4.0, targetY + 22.0), targetZ);

    const boltGeo = this.createJaggedLightningBoltGeometry(startPos, endPos, false);
    const boltMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 1.8,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });

    const boltMesh = new THREE.Line(boltGeo, boltMat);
    boltMesh.renderOrder = 1002;
    this.scene.add(boltMesh);

    this.activeLightningBolts.push({
      mesh: boltMesh,
      timer: 0.16 + Math.random() * 0.06,
      maxTimer: 0.22,
      isBoatHit: false
    });

    // Arc lightning directly FROM THE TITAN SWORD to the surrounding lake water surface (2-3 simultaneous water arcs!)
    const waterStrikesCount = 2 + Math.floor(Math.random() * 2);
    for (let w = 0; w < waterStrikesCount; w++) {
      this.spawnWaterLightningStrike(targetX, targetY, targetZ);
    }

    // Light flash & subtle camera shake
    this.lightningFlashTimer = 0.20;
    this.lightningFlashIntensity = 2.8;
    this.lightningLight.intensity = Math.max(this.lightningLight.intensity, 2.8);
    this.lightningPointLight.position.set(targetX, Math.max(10.0, targetY + 15.0), targetZ);
    this.lightningPointLight.intensity = 18.0;

    if (this.game) {
      this.game.screenShake = 0.55;
    }

    document.body.classList.add('sword-lightning-flash');
    setTimeout(() => {
      document.body.classList.remove('sword-lightning-flash');
    }, 220);

    // Play synthesized thunder sound effect
    this.playThunderSound(true);
  }

  triggerTitanSwordLightning(targetX, targetY, targetZ) {
    // 2x consecutive strikes to the sword (1st strike immediate, 2nd strike 240ms later)
    this.spawnSingleSwordStrike(targetX, targetY, targetZ);

    setTimeout(() => {
      this.spawnSingleSwordStrike(targetX, targetY, targetZ);
    }, 240);
  }

  applyBoatLightningDamage() {
    const physics = this.game.physics;
    if (!physics) return;

    // Reduce Boat HP by 5 (5%)
    physics.health = Math.max(0, physics.health - 5);
    
    // Trigger boat white blink electric flash effect
    if (this.game.woodenBoat && this.game.woodenBoat.triggerWhiteBlink) {
      this.game.woodenBoat.triggerWhiteBlink(0.55);
    }

    // Heavy camera shake and electric visual flash
    this.game.screenShake = 0.85;
    
    // Trigger damage screen feedback
    document.body.classList.add('lightning-damage-flash');
    setTimeout(() => {
      document.body.classList.remove('lightning-damage-flash');
    }, 450);

    if (this.game.updateHpUI) {
      this.game.updateHpUI();
    }

    if (this.game.spawnFloatingDamage) {
      this.game.spawnFloatingDamage(5);
    }

    // Check game over
    if (physics.health <= 0) {
      this.game.gameOver("Perahu Anda hancur tersambar petir di tengah badai!");
    }
  }

  // --- 4. WEB AUDIO PROCEDURAL SYNTHESIZER ---
  initAudioSynthesizer() {
    this.audioCtx = null;
    this.rainGain = null;
    this.isAudioActive = false;

    // Initialize on first user gesture
    const initAudio = () => {
      if (this.audioCtx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.audioCtx = new AudioContext();

        // 1. Synthesize Procedural Continuous Rain Ambient (White/Pink noise with Bandpass filter)
        const bufferSize = this.audioCtx.sampleRate * 2;
        const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02; // Pink-ish noise
          lastOut = output[i];
          output[i] *= 3.5;
        }

        const whiteNoise = this.audioCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const rainFilter = this.audioCtx.createBiquadFilter();
        rainFilter.type = 'lowpass';
        rainFilter.frequency.value = 1400;

        this.rainGain = this.audioCtx.createGain();
        this.rainGain.gain.value = 0.0;

        whiteNoise.connect(rainFilter);
        rainFilter.connect(this.rainGain);
        this.rainGain.connect(this.audioCtx.destination);
        whiteNoise.start(0);

        this.isAudioActive = true;
      } catch (e) {
        console.warn('Web Audio synthesis not supported or blocked:', e);
      }
    };

    window.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
  }

  playThunderSound(isClose) {
    if (!this.audioCtx || this.audioCtx.state === 'suspended') {
      if (this.audioCtx) this.audioCtx.resume();
      return;
    }

    try {
      const now = this.audioCtx.currentTime;

      // 1. Low frequency rumble oscillator
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isClose ? 140 : 75, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + (isClose ? 1.8 : 2.6));

      oscGain.gain.setValueAtTime(isClose ? 0.85 : 0.32, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + (isClose ? 2.0 : 2.8));

      osc.connect(oscGain);
      oscGain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 3.0);

      // 2. Explosive noise snap / rolling rumble
      const bufferSize = this.audioCtx.sampleRate * (isClose ? 1.5 : 2.2);
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }

      const noiseSrc = this.audioCtx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;

      const noiseFilter = this.audioCtx.createBiquadFilter();
      noiseFilter.type = isClose ? 'bandpass' : 'lowpass';
      noiseFilter.frequency.setValueAtTime(isClose ? 600 : 260, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(60, now + 1.4);

      const noiseGain = this.audioCtx.createGain();
      noiseGain.gain.setValueAtTime(isClose ? 0.95 : 0.40, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (isClose ? 1.4 : 2.4));

      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.audioCtx.destination);

      noiseSrc.start(now);
      noiseSrc.stop(now + 2.6);
    } catch (e) {
      console.warn('Thunder sound trigger failed:', e);
    }
  }

  // --- 5. MAIN UPDATE LOOP ---
  update(playerPos, delta) {
    const timeOfDay = this.dayNightCycle.timeOfDay;
    // Calculate total days passed based on elapsed time
    const currentDay = Math.floor(this.dayNightCycle.elapsedTime / (24.0 / this.dayNightCycle.timeSpeed));

    // Schedule 1 storm each new in-game day (increments strike count by +1 each subsequent storm)
    if (currentDay !== this.currentDayIndex) {
      this.currentDayIndex = currentDay;
      this.scheduledRainHour = this.generateRandomRainHour();
      this.stormCount++;
      this.maxBoatStrikesThisStorm = this.stormCount;
      this.boatStrikesThisStormCount = 0;
      this.nextBoatStrikeTimer = 2.5;
    }

    // Check daily weather schedule window
    const drizzleLeadHours = this.drizzleDurationSeconds * this.dayNightCycle.timeSpeed;
    const stormStart = this.scheduledRainHour;
    const drizzleStart = stormStart - drizzleLeadHours;
    const stormEnd = stormStart + this.rainDurationHours;
    const clearEnd = stormEnd + this.clearingDurationHours;

    let targetOvercast = 0.0;
    let targetRain = 0.0;
    let statusText = '☀️ Cerah';

    if (this.manualStormActive) {
      targetOvercast = 1.0;
      targetRain = 1.0;
      this.weatherState = 'STORM';
      statusText = '⛈️ Hujan Badai';
    } else {
      if (timeOfDay >= drizzleStart && timeOfDay < stormStart) {
        // Phase 1: GERIMIS (15 detik sebelum hujan, TANPA mendung, hanya gerimis rintik halus)
        targetOvercast = 0.0; // Langit tetap normal tanpa mendung
        targetRain = 0.22;    // Gerimis halus rintik-rintik
        this.weatherState = 'DRIZZLE';
        statusText = '🌦️ Gerimis';
      } else if (timeOfDay >= stormStart && timeOfDay < stormEnd) {
        // Phase 2: FULL STORM (Langit mendung gelap, hujan lebat, ombak bergejolak, petir)
        const inStorm = (timeOfDay - stormStart);
        targetOvercast = Math.min(1.0, inStorm / 0.4);
        targetRain = 1.0;
        this.weatherState = 'STORM';
        statusText = '⛈️ Hujan Badai';
      } else if (timeOfDay >= stormEnd && timeOfDay < clearEnd) {
        // Phase 3: CLEARING (Hujan reda, langit kembali cerah, air tenang)
        const clearingProgress = (timeOfDay - stormEnd) / this.clearingDurationHours;
        targetOvercast = 1.0 - clearingProgress;
        targetRain = Math.max(0.0, 1.0 - clearingProgress);
        this.weatherState = 'CLEARING';
        statusText = '🌦️ Hujan Reda';
      } else {
        // Clear normal weather
        targetOvercast = 0.0;
        targetRain = 0.0;
        this.weatherState = 'CLEAR';
        statusText = '☀️ Cerah';
      }
    }

    // Smoothly interpolate factors
    this.overcastFactor += (targetOvercast - this.overcastFactor) * Math.min(1.0, delta * 2.0);
    this.rainIntensity += (targetRain - this.rainIntensity) * Math.min(1.0, delta * 2.0);

    this.currentWeatherStatus = statusText;

    // Dynamically adjust water level rise (+0.60m) and storm wave deformation in WaterSystem (Only during storm phase, not during gerimis)
    if (this.game && this.game.waterSystem) {
      const stormWavesFactor = (this.overcastFactor > 0.05) ? this.rainIntensity : 0.0;
      this.game.waterSystem.setStormFactor(stormWavesFactor);
    }

    // Update Rain Ambience Volume (Gentle whisper for drizzle, heavy for storm)
    if (this.rainGain && this.audioCtx && this.audioCtx.state === 'running') {
      const targetGain = (this.weatherState === 'DRIZZLE') ? 0.08 : (this.rainIntensity * 0.35);
      this.rainGain.gain.setValueAtTime(
        Math.max(0.0001, THREE.MathUtils.lerp(this.rainGain.gain.value, targetGain, delta * 4.0)),
        this.audioCtx.currentTime
      );
    }

    // --- Update Streak Rain Particles Across Lake View Frustum ---
    if (this.rainLines) {
      if (this.rainIntensity > 0.01) {
        this.rainLines.visible = true;
        // Soft translucent natural opacity (0.35 - 0.45, lighter during drizzle)
        const opacityScale = (this.weatherState === 'DRIZZLE') ? 0.18 : 0.28;
        this.rainMat.opacity = this.rainIntensity * opacityScale;

        const pos = this.rainGeo.attributes.position.array;
        const halfX = this.rainBounds.halfX;
        const halfZ = this.rainBounds.halfZ;
        const centerZ = playerPos.z + this.rainBounds.centerZOffset;

        for (let i = 0; i < this.dropCount; i++) {
          const d = this.dropData[i];
          d.y -= d.speed * delta;
          d.x += this.windX * delta;
          d.z += this.windZ * delta;

          // Check boundary relative to active camera frustum
          const relX = d.x - playerPos.x;
          const relZ = d.z - centerZ;

          if (d.y <= 0 || Math.abs(relX) > halfX || Math.abs(relZ) > halfZ) {
            // Drop hit water -> spawn subtle splash ripple
            if (d.y <= 0 && Math.random() < 0.06 && this.rainIntensity > 0.2) {
              this.spawnRipple(d.x, d.z);
            }

            d.y = this.rainBounds.maxY + Math.random() * 4.0;
            d.x = playerPos.x + (Math.random() - 0.5) * (halfX * 2);
            d.z = centerZ + (Math.random() - 0.5) * (halfZ * 2);
          }

          const idx = i * 6;
          // Start point
          pos[idx] = d.x;
          pos[idx + 1] = d.y;
          pos[idx + 2] = d.z;

          // End point (streak line trailing downward with wind)
          pos[idx + 3] = d.x + (this.windX / d.speed) * d.len;
          pos[idx + 4] = d.y - d.len;
          pos[idx + 5] = d.z + (this.windZ / d.speed) * d.len;
        }

        this.rainGeo.attributes.position.needsUpdate = true;
      } else {
        this.rainLines.visible = false;
      }
    }

    // --- Update Water Splash Ripples ---
    for (const r of this.ripples) {
      if (r.active) {
        r.life += delta;
        const p = r.life / r.maxLife;
        if (p >= 1.0) {
          r.active = false;
          r.mesh.visible = false;
        } else {
          const s = 0.2 + p * r.maxScale;
          r.mesh.scale.set(s, s, s);
          r.mesh.material.opacity = (1.0 - p) * 0.4 * this.rainIntensity;
        }
      }
    }

    // --- Update Lightning Strikes during Rain (Only active in heavy storm with overcast, NOT during drizzle) ---
    if (this.rainIntensity > 0.35 && this.overcastFactor > 0.25) {
      // 1. Boat strikes: repeat until boatStrikesThisStormCount reaches maxBoatStrikesThisStorm (+1 strike for each subsequent storm!)
      if (this.boatStrikesThisStormCount < this.maxBoatStrikesThisStorm) {
        this.nextBoatStrikeTimer -= delta;
        if (this.nextBoatStrikeTimer <= 0) {
          this.triggerLightningStrike(playerPos, true); // Strike boat!
          this.boatStrikesThisStormCount++;
          // Interval between consecutive strikes in the same storm (4.5s to 8.5s)
          this.nextBoatStrikeTimer = 4.5 + Math.random() * 4.0;
        }
      }

      // 2. Frequent distant lightning bolts across horizon/sky (atmospheric effect, 0 boat damage)
      this.nextDistantLightningTimer -= delta;
      if (this.nextDistantLightningTimer <= 0) {
        this.triggerLightningStrike(playerPos, false);
        // Random short interval between 0.8s and 2.2s for rich active storm visuals
        this.nextDistantLightningTimer = 0.8 + Math.random() * 1.4;
      }
    }

    // Update & Decay active lightning bolts in pool
    for (let i = this.activeLightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.activeLightningBolts[i];
      bolt.timer -= delta;
      const alpha = Math.max(0, bolt.timer / bolt.maxTimer);

      if (bolt.mesh && bolt.mesh.material) {
        bolt.mesh.material.opacity = alpha;
      }

      if (bolt.timer <= 0) {
        this.scene.remove(bolt.mesh);
        if (bolt.mesh.geometry) bolt.mesh.geometry.dispose();
        this.activeLightningBolts.splice(i, 1);
      }
    }

    // Decay flash lighting
    if (this.lightningFlashTimer > 0) {
      this.lightningFlashTimer -= delta;
      const alpha = Math.max(0, this.lightningFlashTimer / 0.22);
      this.lightningLight.intensity = this.lightningFlashIntensity * alpha;
      this.lightningPointLight.intensity = (this.lightningFlashIntensity * 3.0) * alpha;

      if (this.lightningFlashTimer <= 0) {
        this.lightningLight.intensity = 0;
        this.lightningPointLight.intensity = 0;
      }
    }
  }

  toggleStormDebug() {
    this.manualStormActive = !this.manualStormActive;
    if (this.manualStormActive) {
      this.stormCount++;
      this.maxBoatStrikesThisStorm = this.stormCount;
      this.boatStrikesThisStormCount = 0;
      this.nextBoatStrikeTimer = 1.8;
    }
    return this.manualStormActive;
  }
}
