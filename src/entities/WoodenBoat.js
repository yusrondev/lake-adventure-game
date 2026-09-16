import * as THREE from 'three';

export class WoodenBoat {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();

    // 8.4m Grand Low-Poly Wooden Vessel Dimensions
    this.width = 3.4;
    this.length = 8.4;
    this.height = 1.4;
    this.deckY = 0.28;

    this.isLoaded = true;
    this.numSlices = 24;
    this.hullProfile = new Float32Array(this.numSlices);

    // Lantern State & Physics Sway
    this.isLanternOn = false;
    this.spotlightAngle = 0; // 0 = Forward (-Z)
    this.targetSpotlightAngle = 0;
    this.currentSpotlightAngle = 0;
    this.lanternSway = new THREE.Vector2(0, 0);
    this.lanternVel = new THREE.Vector2(0, 0);
    this.blinkTimer = 0;

    this.buildLowPolyBoatMesh();
    this.buildHangingLantern();
    this.initSternSplashSystem();
    this.initImpactDustSystem();
    this.initHullContour();

    if (this.scene) {
      this.scene.add(this.mesh);
    }
  }

  buildLowPolyBoatMesh() {
    this.model = new THREE.Group();

    // Stylized Low-Poly Faceted Wood Materials
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.8,
      flatShading: true
    });

    const lightWoodMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.75,
      flatShading: true
    });

    const seatWoodMat = new THREE.MeshStandardMaterial({
      color: 0xa06d3b,
      roughness: 0.7,
      flatShading: true
    });

    const metalTrimMat = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      roughness: 0.5,
      metalness: 0.4,
      flatShading: true
    });

    // 1. Outer Faceted Hull (Pointed Bow at -Z, Tapered Stern at +Z)
    const hullGroup = new THREE.Group();

    const plankCount = 7;
    const plankW = this.width / plankCount;

    for (let i = 0; i < plankCount; i++) {
      const xOffset = -this.width / 2 + plankW / 2 + i * plankW;
      const mat = i % 2 === 0 ? darkWoodMat : lightWoodMat;
      const plankGeo = new THREE.BoxGeometry(plankW - 0.04, 0.24, this.length, 1, 1, 12);
      
      const pos = plankGeo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const vz = pos.getZ(v);
        const normZ = (vz / (this.length / 2)); // -1 to +1
        if (normZ < 0) {
          const taper = Math.pow(Math.abs(normZ), 1.2) * 0.45;
          pos.setX(v, pos.getX(v) * (1.0 - taper));
        }
      }
      plankGeo.computeVertexNormals();

      const plankMesh = new THREE.Mesh(plankGeo, mat);
      plankMesh.position.set(xOffset, 0.12, 0);
      plankMesh.castShadow = true;
      plankMesh.receiveShadow = true;
      hullGroup.add(plankMesh);
    }

    // 2. Faceted Side Gunwales
    const sideWallGeoLeft = new THREE.BoxGeometry(0.2, 0.7, this.length, 1, 4, 12);
    const leftWall = new THREE.Mesh(sideWallGeoLeft, darkWoodMat);
    leftWall.position.set(-this.width / 2 + 0.1, 0.45, 0);
    leftWall.rotation.z = 0.15;
    leftWall.castShadow = true;
    hullGroup.add(leftWall);

    const sideWallGeoRight = new THREE.BoxGeometry(0.2, 0.7, this.length, 1, 4, 12);
    const rightWall = new THREE.Mesh(sideWallGeoRight, darkWoodMat);
    rightWall.position.set(this.width / 2 - 0.1, 0.45, 0);
    rightWall.rotation.z = -0.15;
    rightWall.castShadow = true;
    hullGroup.add(rightWall);

    // 3. Low-Poly Pointed Bow Stem
    const bowStemGeo = new THREE.ConeGeometry(0.4, 1.2, 4);
    const bowStem = new THREE.Mesh(bowStemGeo, metalTrimMat);
    bowStem.rotation.x = Math.PI / 3;
    bowStem.position.set(0, 0.55, -this.length / 2 - 0.2);
    bowStem.castShadow = true;
    hullGroup.add(bowStem);

    // 4. Low-Poly Cross Benches
    const seatPositions = [-this.length * 0.25, 0, this.length * 0.25];
    seatPositions.forEach((zPos) => {
      const seatGeo = new THREE.BoxGeometry(this.width * 0.82, 0.12, 0.5, 4, 2, 2);
      const seatMesh = new THREE.Mesh(seatGeo, seatWoodMat);
      seatMesh.position.set(0, 0.38, zPos);
      seatMesh.castShadow = true;
      hullGroup.add(seatMesh);
    });

    this.model.add(hullGroup);
    this.mesh.add(this.model);
  }

  buildHangingLantern() {
    // Extended Prow / Bowsprit Nautical Lantern Fixture mounted forward at the pointed bow (z = -5.0m)
    this.lanternProwZ = -5.0; // Light origin is 5.0m forward, ahead of the walkable player deck

    const postGroup = new THREE.Group();
    postGroup.position.set(0, 0.45, -this.length * 0.50); // Base mounted at pointed bow tip (z = -4.2m)

    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.8, flatShading: true });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, metalness: 0.7, roughness: 0.4, flatShading: true });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3, flatShading: true });

    // 1. Angled Reinforced Wooden Bowsprit Extension Beam extending forward & up
    const bowspritGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.1, 6);
    bowspritGeo.rotateX(Math.PI / 3.2);
    const bowspritMesh = new THREE.Mesh(bowspritGeo, darkWoodMat);
    bowspritMesh.position.set(0, 0.42, -0.42);
    bowspritMesh.castShadow = true;
    postGroup.add(bowspritMesh);

    // 2. Ornate Forged Iron Lantern Arch / Crane Arm
    const archArmGeo = new THREE.BoxGeometry(0.06, 0.06, 0.55);
    const archArmMesh = new THREE.Mesh(archArmGeo, ironMat);
    archArmMesh.position.set(0, 0.95, -0.65);
    postGroup.add(archArmMesh);

    // Decorative Iron Support Strut
    const strutGeo = new THREE.BoxGeometry(0.04, 0.04, 0.45);
    strutGeo.rotateX(-Math.PI / 4.5);
    const strutMesh = new THREE.Mesh(strutGeo, ironMat);
    strutMesh.position.set(0, 0.65, -0.58);
    postGroup.add(strutMesh);

    // 3. Hanging Lantern Assembly (Sways with Physics ahead of the hull)
    this.lanternHinge = new THREE.Group();
    this.lanternHinge.position.set(0, 0.92, -0.80); // In world boat space: z = -5.0m

    // Chain Link Ring
    const ringGeo = new THREE.TorusGeometry(0.04, 0.012, 6, 8);
    const ringMesh = new THREE.Mesh(ringGeo, ironMat);
    ringMesh.rotation.x = Math.PI / 2;
    this.lanternHinge.add(ringMesh);

    // Faceted Nautical Ship Lantern Body
    this.lanternBody = new THREE.Group();
    this.lanternBody.position.y = -0.06;

    // Brass Top Dome Cap
    const capGeo = new THREE.ConeGeometry(0.20, 0.14, 6);
    const capMesh = new THREE.Mesh(capGeo, brassMat);
    capMesh.position.y = -0.06;
    this.lanternBody.add(capMesh);

    // Iron Cage Frame
    const cageGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.36, 6);
    const cageMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, metalness: 0.6, roughness: 0.4, flatShading: true });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    cageMesh.position.y = -0.26;
    this.lanternBody.add(cageMesh);

    // Glowing Inner Glass Flame Bulb
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
    const flameGeo = new THREE.SphereGeometry(0.10, 12, 12);
    this.flameMesh = new THREE.Mesh(flameGeo, this.flameMat);
    this.flameMesh.position.y = -0.26;
    this.lanternBody.add(this.flameMesh);

    this.lanternHinge.add(this.lanternBody);
    postGroup.add(this.lanternHinge);

    // 4. Warm Point Light for Deck & Immediate Ambience
    this.lanternPointLight = new THREE.PointLight(0xffaa44, 0, 14.0, 1.2);
    this.lanternPointLight.position.set(0, 1.3, this.lanternProwZ);
    this.mesh.add(this.lanternPointLight);

    // 5. Warm Golden Amber Rotatable Searchlight Spot Light (Focused narrow-angle beam directly forward on water)
    this.lanternSpotLight = new THREE.SpotLight(0xffd79e, 0, 220.0, Math.PI / 8.5, 0.4, 0.45);
    this.lanternSpotLight.position.set(0, 1.3, this.lanternProwZ);
    this.lanternSpotLight.castShadow = true;
    this.lanternSpotLight.shadow.mapSize.width = 1024;
    this.lanternSpotLight.shadow.mapSize.height = 1024;

    // 6. Clean V-Shaped Volumetric Light Cone Beam (Narrow focused translucent golden haze)
    const beamCanvas = document.createElement('canvas');
    beamCanvas.width = 256;
    beamCanvas.height = 512;
    const bCtx = beamCanvas.getContext('2d');

    // Soft warm golden linear gradient
    const bGrad = bCtx.createLinearGradient(128, 0, 128, 512);
    bGrad.addColorStop(0.00, 'rgba(255, 220, 140, 0.40)');
    bGrad.addColorStop(0.20, 'rgba(255, 190, 90, 0.22)');
    bGrad.addColorStop(0.55, 'rgba(255, 150, 40, 0.08)');
    bGrad.addColorStop(0.85, 'rgba(255, 110, 10, 0.02)');
    bGrad.addColorStop(1.00, 'rgba(255, 80, 0, 0.00)');

    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.moveTo(128, 0);   // Apex at lantern
    bCtx.lineTo(200, 512); // Narrow bottom right
    bCtx.lineTo(56, 512);  // Narrow bottom left
    bCtx.closePath();
    bCtx.fill();

    const beamTexture = new THREE.CanvasTexture(beamCanvas);
    const beamGeo = new THREE.PlaneGeometry(8.5, 42.0);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, -21.0);

    this.beamMat = new THREE.MeshBasicMaterial({
      map: beamTexture,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.vBeamPivot = new THREE.Group();
    this.vBeamPivot.position.set(0, 0.35, this.lanternProwZ);

    this.beamMesh = new THREE.Mesh(beamGeo, this.beamMat);
    this.beamMesh.visible = false; // Disable fake 2D canvas plane mesh to eliminate white triangle artifact
    this.vBeamPivot.add(this.beamMesh);
    this.mesh.add(this.vBeamPivot);

    // Spotlight Target (Rotates 360 degrees around boat)
    this.spotLightTarget = new THREE.Object3D();
    this.spotLightTarget.position.set(0, -1.0, this.lanternProwZ - 35.0); // Pointing forward (-Z)
    this.mesh.add(this.spotLightTarget);
    this.lanternSpotLight.target = this.spotLightTarget;

    this.mesh.add(this.lanternSpotLight);
    this.mesh.add(postGroup);
  }

  setLanternOn(onState) {
    this.isLanternOn = !!onState;
    if (this.isLanternOn) {
      this.lanternPointLight.intensity = 2.5;
      this.lanternSpotLight.intensity = 35.0;
      this.beamMat.opacity = 0.0; // Keep 2D canvas triangle mesh invisible
      this.flameMat.color.setHex(0xffffff);
    } else {
      this.lanternPointLight.intensity = 0.0;
      this.lanternSpotLight.intensity = 0.0;
      this.beamMat.opacity = 0.0;
      this.flameMat.color.setHex(0x442200);
    }
  }

  setSpotlightAngle(angleRad) {
    this.targetSpotlightAngle = angleRad;
  }

  updateLanternPhysics(delta, speed, turnSpeed, roll, pitch, waterMaterial = null) {
    // 1. Smooth Continuous Mechanical Swivel of Bow Searchlight
    const swivelRate = 1.0 - Math.exp(-6.0 * delta); // Smooth gradual rotation, degree by degree
    this.currentSpotlightAngle += (this.targetSpotlightAngle - this.currentSpotlightAngle) * swivelRate;
    this.spotlightAngle = this.currentSpotlightAngle;

    const distance = 35.0;
    const prowZ = this.lanternProwZ || -5.0;
    const targetX = Math.sin(this.spotlightAngle) * distance;
    const targetZ = prowZ - Math.cos(this.spotlightAngle) * distance;
    this.spotLightTarget.position.set(targetX, -1.0, targetZ);
    if (this.vBeamPivot) {
      this.vBeamPivot.rotation.y = this.spotlightAngle;
    }

    // 2. Pendulum Swinging Sway Dynamics
    const targetSwayX = -turnSpeed * 0.4 - roll * 0.8;
    const targetSwayZ = -(speed * 0.04) + pitch * 0.6;

    const spring = 24.0;
    const damping = 5.0;

    const forceX = (targetSwayX - this.lanternSway.x) * spring - this.lanternVel.x * damping;
    const forceZ = (targetSwayZ - this.lanternSway.y) * spring - this.lanternVel.y * damping;

    this.lanternVel.x += forceX * delta;
    this.lanternVel.y += forceZ * delta;

    this.lanternSway.x += this.lanternVel.x * delta;
    this.lanternSway.y += this.lanternVel.y * delta;

    // Apply sway rotations to hanging lantern hinge
    this.lanternHinge.rotation.z = THREE.MathUtils.clamp(this.lanternSway.x, -0.6, 0.6);
    this.lanternHinge.rotation.x = THREE.MathUtils.clamp(this.lanternSway.y, -0.6, 0.6);

    // Update Water Material Searchlight Uniforms in World Coordinates
    if (waterMaterial && waterMaterial.uniforms) {
      if (this.isLanternOn) {
        const spotWorldPos = new THREE.Vector3(0, 1.3, prowZ).applyMatrix4(this.mesh.matrixWorld);
        const targetWorldPos = new THREE.Vector3(
          Math.sin(this.spotlightAngle) * 35.0,
          -1.0,
          prowZ - Math.cos(this.spotlightAngle) * 35.0
        ).applyMatrix4(this.mesh.matrixWorld);

        const spotWorldDir = targetWorldPos.sub(spotWorldPos).normalize();

        waterMaterial.uniforms.uSpotLightPos.value.copy(spotWorldPos);
        waterMaterial.uniforms.uSpotLightDir.value.copy(spotWorldDir);
        waterMaterial.uniforms.uSpotLightIntensity.value = 0.95;
        waterMaterial.uniforms.uSpotLightAngle.value = Math.PI / 8.5;
      } else {
        waterMaterial.uniforms.uSpotLightIntensity.value = 0.0;
      }
    }
  }

  generateWaterParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Soft organic radial water drop / foam alpha gradient (zero hard box edges!)
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.35, 'rgba(224, 242, 254, 0.75)');
    grad.addColorStop(0.70, 'rgba(186, 230, 253, 0.30)');
    grad.addColorStop(1.0, 'rgba(186, 230, 253, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  generateDustParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.90)');
    grad.addColorStop(0.40, 'rgba(240, 230, 210, 0.60)');
    grad.addColorStop(0.75, 'rgba(200, 180, 150, 0.20)');
    grad.addColorStop(1.0, 'rgba(200, 180, 150, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  initSternSplashSystem() {
    this.splashCount = 100;
    this.splashGeo = new THREE.PlaneGeometry(0.40, 0.40);
    this.splashGeo.rotateX(-Math.PI / 2);

    const waterTexture = this.generateWaterParticleTexture();

    this.splashMat = new THREE.MeshBasicMaterial({
      map: waterTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });

    this.splashPool = [];
    this.splashGroup = new THREE.Group();
    this.splashGroup.renderOrder = 950;

    for (let i = 0; i < this.splashCount; i++) {
      const mesh = new THREE.Mesh(this.splashGeo, this.splashMat.clone());
      mesh.visible = false;
      this.splashGroup.add(mesh);
      this.splashPool.push({
        mesh: mesh,
        active: false,
        type: 'STERN', // 'STERN', 'LEFT_SIDE', 'RIGHT_SIDE'
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        startScale: 0.4,
        endScale: 2.2,
        life: 0,
        maxLife: 0.4
      });
    }

    this.mesh.add(this.splashGroup);
    this.spawnTimer = 0;
  }

  initHullContour() {
    for (let i = 0; i < this.numSlices; i++) {
      const normZ = (i / (this.numSlices - 1)) * 2.0 - 1.0;
      const shapeFactor = Math.sin(Math.PI * (0.5 + normZ * 0.45));
      this.hullProfile[i] = Math.max(0.35, (this.width / 2) * Math.pow(Math.max(0, shapeFactor), 0.7));
    }
  }

  getHullHalfWidthAtZ(localZ) {
    const minZ = -this.length / 2;
    const maxZ = this.length / 2;
    const norm = (localZ - minZ) / (maxZ - minZ);
    const clampedNorm = THREE.MathUtils.clamp(norm, 0, 1);

    const indexFloat = clampedNorm * (this.numSlices - 1);
    const idx0 = Math.floor(indexFloat);
    const idx1 = Math.min(this.numSlices - 1, idx0 + 1);
    const frac = indexFloat - idx0;

    const w0 = this.hullProfile[idx0] || (this.width / 2);
    const w1 = this.hullProfile[idx1] || (this.width / 2);

    return THREE.MathUtils.lerp(w0, w1, frac) * 0.88;
  }

  loadGLTFModel(path) {
    this.isLoaded = true;
    if (this.onLoadedCallback) this.onLoadedCallback(this);
  }

  updateSplash(speed, turnRate, delta) {
    const absSpeed = Math.abs(speed);

    // 1. Spawning realistic water wake & side bow spray particles
    if (absSpeed > 0.8) {
      this.spawnTimer -= delta;
      const spawnInterval = Math.max(0.010, 0.06 - absSpeed * 0.0025);

      if (this.spawnTimer <= 0) {
        this.spawnTimer = spawnInterval;

        // A. STERN WAKE FOAM (Behind boat)
        const pStern = this.splashPool.find(p => !p.active);
        if (pStern) {
          pStern.active = true;
          pStern.type = 'STERN';
          pStern.life = 0;
          pStern.maxLife = 0.35 + Math.random() * 0.25;

          const sternX = (Math.random() - 0.5) * 2.0;
          const sternZ = (this.length / 2) - 0.2 + (Math.random() - 0.5) * 0.3;

          pStern.x = sternX;
          pStern.y = 0.03 + Math.random() * 0.06;
          pStern.z = sternZ;

          const speedRatio = Math.min(1.0, absSpeed / 16.0);
          pStern.vx = (Math.random() - 0.5) * (0.6 + speedRatio * 1.0) - (turnRate * 0.6);
          pStern.vy = 0.4 + Math.random() * 1.2 * speedRatio;
          pStern.vz = 0.8 + Math.random() * 2.2 * speedRatio;

          pStern.startScale = 0.4 + Math.random() * 0.3;
          pStern.endScale = 1.8 + Math.random() * 1.0;

          pStern.mesh.position.set(pStern.x, pStern.y, pStern.z);
          pStern.mesh.scale.setScalar(pStern.startScale);
          pStern.mesh.material.opacity = 0.70;
          pStern.mesh.visible = true;
        }

        // B. LEFT SIDE BOW WATER SPRAY (Sprays outward-left as hull cuts through water)
        const pLeft = this.splashPool.find(p => !p.active);
        if (pLeft) {
          pLeft.active = true;
          pLeft.type = 'LEFT_SIDE';
          pLeft.life = 0;
          pLeft.maxLife = 0.30 + Math.random() * 0.20;

          const sideZ = -1.8 + (Math.random() - 0.5) * 2.4;
          const halfW = this.getHullHalfWidthAtZ(sideZ);

          pLeft.x = -halfW - 0.08;
          pLeft.y = 0.04 + Math.random() * 0.06;
          pLeft.z = sideZ;

          const speedRatio = Math.min(1.0, absSpeed / 16.0);
          const turnExtra = turnRate < 0 ? Math.abs(turnRate) * 1.5 : 0;
          pLeft.vx = -(1.2 + Math.random() * 1.8 + turnExtra) * speedRatio;
          pLeft.vy = 0.6 + Math.random() * 1.4 * speedRatio;
          pLeft.vz = (0.4 + Math.random() * 1.2) * speedRatio;

          pLeft.startScale = 0.3 + Math.random() * 0.2;
          pLeft.endScale = 1.4 + Math.random() * 0.8;

          pLeft.mesh.position.set(pLeft.x, pLeft.y, pLeft.z);
          pLeft.mesh.scale.setScalar(pLeft.startScale);
          pLeft.mesh.material.opacity = 0.65;
          pLeft.mesh.visible = true;
        }

        // C. RIGHT SIDE BOW WATER SPRAY (Sprays outward-right as hull cuts through water)
        const pRight = this.splashPool.find(p => !p.active);
        if (pRight) {
          pRight.active = true;
          pRight.type = 'RIGHT_SIDE';
          pRight.life = 0;
          pRight.maxLife = 0.30 + Math.random() * 0.20;

          const sideZ = -1.8 + (Math.random() - 0.5) * 2.4;
          const halfW = this.getHullHalfWidthAtZ(sideZ);

          pRight.x = halfW + 0.08;
          pRight.y = 0.04 + Math.random() * 0.06;
          pRight.z = sideZ;

          const speedRatio = Math.min(1.0, absSpeed / 16.0);
          const turnExtra = turnRate > 0 ? Math.abs(turnRate) * 1.5 : 0;
          pRight.vx = (1.2 + Math.random() * 1.8 + turnExtra) * speedRatio;
          pRight.vy = 0.6 + Math.random() * 1.4 * speedRatio;
          pRight.vz = (0.4 + Math.random() * 1.2) * speedRatio;

          pRight.startScale = 0.3 + Math.random() * 0.2;
          pRight.endScale = 1.4 + Math.random() * 0.8;

          pRight.mesh.position.set(pRight.x, pRight.y, pRight.z);
          pRight.mesh.scale.setScalar(pRight.startScale);
          pRight.mesh.material.opacity = 0.65;
          pRight.mesh.visible = true;
        }
      }
    }

    // 2. Physics update for active water spray & foam particles
    const gravity = -5.5;
    for (const p of this.splashPool) {
      if (p.active) {
        p.life += delta;
        const progress = p.life / p.maxLife;

        if (progress >= 1.0 || p.y < -0.2) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.vy += gravity * delta;
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.z += p.vz * delta;

          p.mesh.position.set(p.x, p.y, p.z);

          const scale = THREE.MathUtils.lerp(p.startScale, p.endScale, progress);
          p.mesh.scale.setScalar(scale);
          p.mesh.material.opacity = (1.0 - progress) * 0.65;
        }
      }
    }
  }

  initImpactDustSystem() {
    this.dustPool = [];
    const dustCount = 45;

    const circleGeo = new THREE.CircleGeometry(0.35, 8);
    const shardGeo = new THREE.BoxGeometry(0.10, 0.05, 0.14);

    const dustColors = [0x8b5a2b, 0xc2a68c, 0xa08060, 0x6e4a27, 0xd4b896];

    this.dustGroup = new THREE.Group();
    if (this.scene) {
      this.scene.add(this.dustGroup);
    }

    const dustTexture = this.generateDustParticleTexture();

    for (let i = 0; i < dustCount; i++) {
      const isShard = i % 4 === 0;
      let mesh;
      if (isShard) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x4a2e16,
          transparent: true,
          opacity: 0.95
        });
        mesh = new THREE.Mesh(shardGeo, mat);
      } else {
        const color = dustColors[i % dustColors.length];
        const mat = new THREE.MeshBasicMaterial({
          map: dustTexture,
          color: color,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        mesh = new THREE.Mesh(circleGeo, mat);
        mesh.rotation.x = -Math.PI * 0.35;
      }

      mesh.visible = false;
      this.dustGroup.add(mesh);

      this.dustPool.push({
        mesh: mesh,
        active: false,
        life: 0,
        maxLife: 0.6,
        isShard: isShard,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        rotVx: 0, rotVy: 0,
        startScale: 0.3,
        endScale: 2.2
      });
    }
  }

  triggerImpactDust(worldX, worldY, worldZ, normalX = 0, normalZ = 0) {
    const particlesToSpawn = 22;
    let spawned = 0;

    for (const p of this.dustPool) {
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = p.isShard ? (0.45 + Math.random() * 0.3) : (0.65 + Math.random() * 0.45);

        p.x = worldX + (Math.random() - 0.5) * 0.7;
        p.y = worldY + (Math.random() - 0.5) * 0.4;
        p.z = worldZ + (Math.random() - 0.5) * 0.7;

        const speedMult = p.isShard ? (3.5 + Math.random() * 3.5) : (1.4 + Math.random() * 2.2);
        const spreadX = (Math.random() - 0.5) * 1.6 + normalX * 1.4;
        const spreadZ = (Math.random() - 0.5) * 1.6 + normalZ * 1.4;

        p.vx = spreadX * speedMult * 0.65;
        p.vy = 1.4 + Math.random() * 2.6;
        p.vz = spreadZ * speedMult * 0.65;

        if (p.isShard) {
          p.rotVx = (Math.random() - 0.5) * 14.0;
          p.rotVy = (Math.random() - 0.5) * 14.0;
          p.startScale = 0.8 + Math.random() * 0.6;
          p.endScale = p.startScale;
        } else {
          p.startScale = 0.35 + Math.random() * 0.25;
          p.endScale = 2.0 + Math.random() * 1.4;
        }

        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.scale.setScalar(p.startScale);
        p.mesh.material.opacity = p.isShard ? 0.95 : 0.85;
        p.mesh.visible = true;

        spawned++;
        if (spawned >= particlesToSpawn) break;
      }
    }
  }

  updateImpactDust(delta) {
    const gravity = -6.5;
    for (const p of this.dustPool) {
      if (p.active) {
        p.life += delta;
        const progress = p.life / p.maxLife;

        if (progress >= 1.0) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.vy += gravity * delta * (p.isShard ? 1.6 : 0.35);
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.z += p.vz * delta;

          p.vx *= (1.0 - 2.8 * delta);
          p.vz *= (1.0 - 2.8 * delta);

          p.mesh.position.set(p.x, p.y, p.z);

          if (p.isShard) {
            p.mesh.rotation.x += p.rotVx * delta;
            p.mesh.rotation.y += p.rotVy * delta;
          } else {
            const currentScale = THREE.MathUtils.lerp(p.startScale, p.endScale, progress);
            p.mesh.scale.setScalar(currentScale);
            p.mesh.material.opacity = (1.0 - progress) * 0.85;
          }
        }
      }
    }
  }

  triggerWhiteBlink(duration = 0.55) {
    this.blinkTimer = duration;
  }

  updateBlink(delta) {
    if (this.blinkTimer <= 0) return;

    this.blinkTimer -= delta;
    const isWhite = this.blinkTimer > 0 && (Math.floor(this.blinkTimer * 22) % 2 === 0);

    this.mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => this.applyMeshBlink(m, isWhite));
        } else {
          this.applyMeshBlink(child.material, isWhite);
        }
      }
    });

    if (this.blinkTimer <= 0) {
      this.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => this.restoreMeshColor(m));
          } else {
            this.restoreMeshColor(child.material);
          }
        }
      });
    }
  }

  applyMeshBlink(material, isWhite) {
    if (!material.userData) material.userData = {};
    if (!material.userData.origColor) {
      material.userData.origColor = material.color.clone();
      if (material.emissive) material.userData.origEmissive = material.emissive.clone();
    }

    if (isWhite) {
      material.color.setHex(0xffffff);
      if (material.emissive) material.emissive.setHex(0xffffff);
    } else {
      this.restoreMeshColor(material);
    }
  }

  restoreMeshColor(material) {
    if (material.userData && material.userData.origColor) {
      material.color.copy(material.userData.origColor);
      if (material.emissive && material.userData.origEmissive) {
        material.emissive.copy(material.userData.origEmissive);
      }
    }
  }
}
