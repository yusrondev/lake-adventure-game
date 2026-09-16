import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class SwordRainManager {
  constructor(scene, game = null, preloadedModel = null) {
    this.scene = scene;
    this.game = game;

    this.milestoneInterval = 3500;   // Every 3500m (3500m, 7000m, 10500m...) - No overlap with 2000m Torii Gates!
    this.visibleDistanceAhead = 600; // Visible starting from 600m ahead (matching ToriiGateManager!)
    this.despawnDistanceBehind = 400;

    this.isLoaded = false;
    this.swordTemplate = null;
    this.swordScale = 56.0;  // Giant Titan Medieval Sword (~112m height)
    this.swordTargetY = 8.0;  // Base lodging height (48m underwater deep into lake bed!)

    // Pool of 2 pre-warmed giant swords (1 active sword per milestone)
    this.swords = [];
    this.poolSize = 2;

    // Track active milestone index
    this.currentMilestoneIdx = 0;
    this.activeMilestoneZ = 0;
    this.isMilestoneActive = false;

    // Milestone completion tracking
    this.processedMilestones = new Set();

    if (preloadedModel) {
      this.initModel(preloadedModel);
    } else {
      this.preloadAsset();
    }
  }

  reset() {
    this.processedMilestones.clear();
    this.isMilestoneActive = false;
    this.currentMilestoneIdx = 0;
    for (const s of this.swords) {
      s.group.position.set(0, -9999, 0);
      s.active = false;
    }
  }

  preloadAsset() {
    const loader = new GLTFLoader();
    const loadPath = (url, fallback) => {
      loader.load(
        url,
        (gltf) => this.initModel(gltf.scene),
        undefined,
        (err) => {
          if (fallback) loadPath(fallback, null);
          else console.error('Error loading sword GLB:', err);
        }
      );
    };
    loadPath('/models/medieval_sword.glb', '/src/env/medieval_sword.glb');
  }

  getSwordVariant(milestoneIdx) {
    // Cycle between 3 distinct epic spawn variants:
    // 0 = Straight Center, 1 = Slightly Tilted in Channel, 2 = Lodged in Cliff Leaning Over Lake
    const variantType = milestoneIdx % 3;

    if (variantType === 0) {
      // Variant 1: Straight Titan Gate (Centered in channel, 100% vertical)
      return {
        name: 'Straight Center',
        x: 0,
        yOffset: 0,
        rotX: 0,
        rotY: Math.PI / 2,
        rotZ: Math.PI / 2,
        shadowOffsetX: 12.0,
        shadowOffsetZ: -18.0,
        shadowRotZ: Math.PI / 5,
        halfWidthX: 1.8,
        halfDepthZ: 1.4
      };
    } else if (variantType === 1) {
      // Variant 2: Slightly Tilted Ancient Sword (Offset in channel, ~14° tilt)
      const side = (milestoneIdx % 2 === 0) ? 1 : -1;
      return {
        name: 'Slightly Tilted',
        x: side * 3.5,
        yOffset: -2.0,
        rotX: side * 0.10,
        rotY: Math.PI / 2,
        rotZ: Math.PI / 2 + side * 0.24, // ~14° tilt
        shadowOffsetX: side * 14.0,
        shadowOffsetZ: -15.0,
        shadowRotZ: Math.PI / 5 + side * 0.24,
        halfWidthX: 3.2,
        halfDepthZ: 2.0
      };
    } else {
      // Variant 3: Lodged in Cliff Wall Leaning Over Lake (Nancap di tebing & doyong ke danau)
      const side = (milestoneIdx % 2 === 1) ? 1 : -1; // +1 = Right cliff leaning left, -1 = Left cliff leaning right
      return {
        name: 'Cliff Lodged Leaning',
        x: side * 15.5,
        yOffset: 6.0,
        rotX: 0.12,
        rotY: Math.PI / 2,
        rotZ: Math.PI / 2 - side * 0.65, // ~37° steep tilt leaning high over channel!
        shadowOffsetX: -side * 10.0,
        shadowOffsetZ: -20.0,
        shadowRotZ: Math.PI / 5 - side * 0.65,
        halfWidthX: 6.5,
        halfDepthZ: 3.5
      };
    }
  }

  initModel(modelScene) {
    this.swordTemplate = modelScene;

    // Configure materials: metallic rendering, fog disabled for crisp distance rendering from 600m
    this.swordTemplate.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.metalness = 0.92;
          child.material.roughness = 0.18;
          child.material.fog = false; // Crisp visibility
          if (child.material.emissive) {
            child.material.emissive = new THREE.Color(0x1e1b4b);
            child.material.emissiveIntensity = 0.4;
          }
          child.material.needsUpdate = true;
        }
      }
    });

    // Create pre-warmed pool of giant sword assemblies
    for (let i = 0; i < this.poolSize; i++) {
      const group = new THREE.Group();
      group.frustumCulled = false;

      const mesh = this.swordTemplate.clone(true);
      mesh.scale.set(this.swordScale, this.swordScale, this.swordScale);
      mesh.rotation.set(0, Math.PI / 2, Math.PI / 2);

      group.add(mesh);

      // Compute exact bounding box of rotated mesh to lodge tip 48m underwater into lake bed
      const box = new THREE.Box3().setFromObject(mesh);
      const tipLodgedDepth = 48.0; // 48 meters underwater into lake bed for deep firm lodging!
      this.swordTargetY = -box.min.y - tipLodgedDepth; // = 8.0

      // Create Realistic Dark Sword Shadow Mesh lying flat on top of water surface
      const shadowMesh = this.createSwordShadowMesh(group, this.swordTargetY);

      // Create Dramatic Yellow Lightning Effect Assembly attached to sword group
      const lightningData = this.createLightningGroup(group, this.swordTargetY);

      // PRE-WARM: Keep visible = true permanently in scene graph, place at y = -9999 when inactive
      group.visible = true;
      group.position.set(0, -9999, 0);
      this.scene.add(group);

      this.swords.push({
        group: group,
        mesh: mesh,
        shadowMesh: shadowMesh,
        lightning: lightningData,
        x: 0,
        y: this.swordTargetY,
        z: 0,
        active: false,
        halfWidthX: 1.8,
        halfDepthZ: 1.4
      });
    }

    this.isLoaded = true;

    // Force WebGL Shader & Shadow Compilation pre-warm during asset load (zero runtime hitching)
    if (this.game && this.game.renderer && this.game.scene && this.game.camera) {
      try {
        for (let i = 0; i < this.poolSize; i++) {
          this.swords[i].group.position.set(0, 8.0, -50);
        }
        this.game.renderer.compile(this.game.scene, this.game.camera);
        for (let i = 0; i < this.poolSize; i++) {
          this.swords[i].group.position.set(0, -9999, 0);
        }
      } catch (e) {
        console.warn('[Sword GPU Prewarm]', e);
      }
    }

    // Check if player is already near a milestone
    if (this.game && this.game.physics) {
      this.update(this.game.physics.worldPosition.z, 0.016);
    }
  }

  createSwordShadowMesh(parentGroup, groupY) {
    const localWaterY = 0.0 - groupY; // = -8.0 (water surface level)

    // Generate soft, realistic dark titan sword shadow texture using HTML Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 512);

    // Gradient for long blade shadow stretching across water
    const grad = ctx.createLinearGradient(128, 512, 128, 0);
    grad.addColorStop(0.0, 'rgba(2, 6, 23, 0.85)'); // Deep dark shadow near base
    grad.addColorStop(0.5, 'rgba(2, 6, 23, 0.60)');
    grad.addColorStop(0.85, 'rgba(2, 6, 23, 0.30)');
    grad.addColorStop(1.0, 'rgba(2, 6, 23, 0.00)');  // Fades out smoothly at tip

    ctx.fillStyle = grad;

    // Draw blade shadow shape
    ctx.beginPath();
    ctx.moveTo(105, 512);
    ctx.lineTo(151, 512);
    ctx.lineTo(142, 40);
    ctx.lineTo(114, 40);
    ctx.closePath();
    ctx.fill();

    // Draw crossguard shadow shape
    ctx.fillRect(35, 410, 186, 28);

    const texture = new THREE.CanvasTexture(canvas);
    const geom = new THREE.PlaneGeometry(30.0, 75.0);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const shadowMesh = new THREE.Mesh(geom, mat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.rotation.z = Math.PI / 5; // Slanted shadow pointing away from sun vector
    shadowMesh.position.set(12.0, localWaterY + 0.08, -18.0); // Flat on water surface!
    shadowMesh.frustumCulled = false;

    parentGroup.add(shadowMesh);
    return shadowMesh;
  }

  createLightningGroup(parentGroup, groupY) {
    const lightningGroup = new THREE.Group();
    lightningGroup.frustumCulled = false;

    // Local Y corresponding to water surface level (world Y = 0.0)
    const localWaterY = 0.0 - groupY; // = -8.0

    // 1. DYNAMIC JAGGED ZIG-ZAG LIGHTNING ARCS (No straight vertical lines!)
    const arcCount = 4;
    const arcs = [];
    const arcPoints = 18;
    const startY = 48.0;               // Crossguard level
    const endY = localWaterY - 3.0;    // Extends 3m underwater (-11.0)

    for (let i = 0; i < arcCount; i++) {
      const positions = new Float32Array(arcPoints * 3);
      for (let p = 0; p < arcPoints; p++) {
        const t = p / (arcPoints - 1);
        const y = startY + t * (endY - startY);
        positions[p * 3] = (Math.random() - 0.5) * 4.0;
        positions[p * 3 + 1] = y;
        positions[p * 3 + 2] = (Math.random() - 0.5) * 4.0;
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // DOMINANT ELECTRIC YELLOW COLOR SCHEME (0xfacc15 & 0xfef08a)
      const mat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? 0xfacc15 : 0xfef08a, // Electric Gold & Bright Yellow-White
        transparent: true,
        opacity: 0.95,
        linewidth: 2,
        blending: THREE.AdditiveBlending
      });

      const line = new THREE.Line(geom, mat);
      line.frustumCulled = false;
      lightningGroup.add(line);

      arcs.push({
        line: line,
        geom: geom,
        positions: positions,
        pointCount: arcPoints,
        startY: startY - i * 2,
        endY: endY,
        maxJitter: 7.0 + i * 1.5,
        phaseOffset: i * (Math.PI / 2)
      });
    }

    // 2. HELICAL YELLOW LIGHTNING ARCS WRAPPING THE BLADE
    const spiralCount = 2;
    const spirals = [];
    const spiralPoints = 28;
    const spiralStartY = 50.0;
    const spiralEndY = localWaterY - 2.0;

    for (let i = 0; i < spiralCount; i++) {
      const positions = new Float32Array(spiralPoints * 3);
      for (let p = 0; p < spiralPoints; p++) {
        const t = p / (spiralPoints - 1);
        positions[p * 3] = 0;
        positions[p * 3 + 1] = spiralStartY + t * (spiralEndY - spiralStartY);
        positions[p * 3 + 2] = 0;
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.LineBasicMaterial({
        color: 0xfde047, // Intense Electric Yellow
        transparent: true,
        opacity: 0.9,
        linewidth: 2,
        blending: THREE.AdditiveBlending
      });

      const line = new THREE.Line(geom, mat);
      line.frustumCulled = false;
      lightningGroup.add(line);

      spirals.push({
        line: line,
        geom: geom,
        positions: positions,
        pointCount: spiralPoints,
        startY: spiralStartY,
        endY: spiralEndY,
        turns: 4.5,
        radius: 4.0 + i * 2.0,
        phaseOffset: i * Math.PI
      });
    }

    // 3. Expanding Water Surface Electrical Spark Ripples (2 expanding rings)
    const ringCount = 2;
    const rings = [];
    const ringPoints = 28;

    for (let i = 0; i < ringCount; i++) {
      const positions = new Float32Array(ringPoints * 3);
      const ringY = localWaterY + 0.2 + i * 0.8;

      for (let p = 0; p < ringPoints; p++) {
        const a = (p / ringPoints) * Math.PI * 2;
        positions[p * 3] = Math.cos(a) * (6.0 + i * 5.0);
        positions[p * 3 + 1] = ringY;
        positions[p * 3 + 2] = Math.sin(a) * (6.0 + i * 5.0);
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.LineBasicMaterial({
        color: 0xeab308, // Electric Gold
        transparent: true,
        opacity: 0.85,
        linewidth: 2,
        blending: THREE.AdditiveBlending
      });

      const line = new THREE.LineLoop(geom, mat);
      line.frustumCulled = false;
      lightningGroup.add(line);

      rings.push({
        line: line,
        geom: geom,
        positions: positions,
        pointCount: ringPoints,
        y: ringY,
        baseRadius: 6.0 + i * 6.0,
        currentRadius: 6.0 + i * 6.0,
        speed: 18.0 + i * 8.0
      });
    }

    // 4. ELECTRIC YELLOW GLOW LIGHTS
    const hiltLight = new THREE.PointLight(0xfacc15, 25.0, 500.0, 1.1);
    hiltLight.position.set(0, 38.0, 0);
    lightningGroup.add(hiltLight);

    const midLight = new THREE.PointLight(0xfde047, 20.0, 400.0, 1.2);
    midLight.position.set(0, 5.0, 0);
    lightningGroup.add(midLight);

    const baseFlashLight = new THREE.PointLight(0xfff176, 40.0, 350.0, 0.8);
    baseFlashLight.position.set(0, localWaterY + 0.8, 0); // 0.8m above water surface!
    lightningGroup.add(baseFlashLight);

    parentGroup.add(lightningGroup);

    return {
      group: lightningGroup,
      arcs: arcs,
      spirals: spirals,
      rings: rings,
      hiltLight: hiltLight,
      midLight: midLight,
      baseFlashLight: baseFlashLight,
      flickerTimer: 0,
      vboUpdateTimer: 0
    };
  }

  updateLightning(lightningData, delta) {
    if (!lightningData) return;

    lightningData.flickerTimer += delta;
    lightningData.vboUpdateTimer += delta;

    const isSurge = Math.random() < 0.10; // 10% chance per frame for sudden lightning strike surge!
    const surgeMult = isSurge ? 2.8 : 1.0;

    // Throttle GPU VBO buffer updates to 25 FPS (every 0.04s) for zero hitching
    if (lightningData.vboUpdateTimer >= 0.04) {
      lightningData.vboUpdateTimer = 0;

      // Update Vertical Main Zig-Zag Lightning Arcs
      for (const arc of lightningData.arcs) {
        const positions = arc.positions;
        const count = arc.pointCount;
        const tOffset = lightningData.flickerTimer * 18.0 + arc.phaseOffset;

        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          const y = arc.startY + t * (arc.endY - arc.startY);

          const env = Math.sin(t * Math.PI);
          const waveX = Math.sin(t * Math.PI * 5.0 + tOffset) * (arc.maxJitter * 0.5 * env);
          const waveZ = Math.cos(t * Math.PI * 4.0 - tOffset) * (arc.maxJitter * 0.5 * env);

          const jitterX = (Math.random() - 0.5) * arc.maxJitter * env;
          const jitterZ = (Math.random() - 0.5) * arc.maxJitter * env;

          positions[i * 3] = waveX + jitterX;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = waveZ + jitterZ;
        }

        arc.geom.attributes.position.needsUpdate = true;
        arc.line.material.opacity = 0.65 + Math.random() * 0.35;
      }

      // Update Spiral Lightning Arcs
      for (const spiral of lightningData.spirals) {
        const positions = spiral.positions;
        const count = spiral.pointCount;
        const timeOffset = lightningData.flickerTimer * 14.0;

        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          const y = spiral.startY + t * (spiral.endY - spiral.startY);
          const angle = t * Math.PI * 2 * spiral.turns + timeOffset + spiral.phaseOffset;

          const jitter = (Math.random() - 0.5) * 2.2;
          const r = spiral.radius + jitter;

          positions[i * 3] = Math.cos(angle) * r;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = Math.sin(angle) * r;
        }

        spiral.geom.attributes.position.needsUpdate = true;
        spiral.line.material.opacity = 0.55 + Math.random() * 0.45;
      }

      // Update Expanding Water Surface Spark Ripples
      for (const ring of lightningData.rings) {
        ring.currentRadius += ring.speed * delta;
        if (ring.currentRadius > 26.0) {
          ring.currentRadius = 5.0;
        }

        const positions = ring.positions;
        const count = ring.pointCount;

        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const jitter = (Math.random() - 0.5) * 2.5;
          const r = ring.currentRadius + jitter;

          positions[i * 3] = Math.cos(angle) * r;
          positions[i * 3 + 1] = ring.y + (Math.random() - 0.5) * 0.3;
          positions[i * 3 + 2] = Math.sin(angle) * r;
        }

        ring.geom.attributes.position.needsUpdate = true;
        const fadeProgress = 1.0 - (ring.currentRadius / 26.0);
        ring.line.material.opacity = Math.max(0.1, fadeProgress * 0.85);
      }
    }

    // Electrical Surge & Light Flickering
    lightningData.hiltLight.intensity = (20.0 + Math.random() * 15.0) * surgeMult;
    lightningData.midLight.intensity = (15.0 + Math.random() * 12.0) * surgeMult;
    lightningData.baseFlashLight.intensity = (30.0 + Math.random() * 25.0) * surgeMult;
  }

  triggerMilestone(milestoneIdx, milestoneZ) {
    if (this.processedMilestones.has(milestoneIdx)) return;

    this.currentMilestoneIdx = milestoneIdx;
    this.activeMilestoneZ = milestoneZ;
    this.isMilestoneActive = true;

    const sword = this.swords[0];
    const variant = this.getSwordVariant(milestoneIdx);

    sword.x = variant.x;
    sword.z = milestoneZ;
    sword.y = this.swordTargetY + variant.yOffset;
    sword.active = true;
    sword.halfWidthX = variant.halfWidthX;
    sword.halfDepthZ = variant.halfDepthZ;

    // Apply mesh variant rotations
    sword.mesh.rotation.set(variant.rotX, variant.rotY, variant.rotZ);

    // Position shadow mesh relative to variant tilt
    if (sword.shadowMesh) {
      const localWaterY = 0.0 - sword.y;
      sword.shadowMesh.position.set(variant.shadowOffsetX, localWaterY + 0.08, variant.shadowOffsetZ);
      sword.shadowMesh.rotation.z = variant.shadowRotZ;
    }

    // Instant zero-cost reposition (group is already visible and pre-warmed!)
    sword.group.position.set(sword.x, sword.y, sword.z);
  }

  update(playerZ, delta = 0.016) {
    if (!this.isLoaded) return;

    const distanceTraveled = -playerZ;

    // Calculate milestone index (every 3500m: 3500m, 7000m, 10500m... - No overlap with 2000m Torii gates!)
    const milestoneIdx = Math.max(1, Math.floor((distanceTraveled + 600) / this.milestoneInterval));
    const milestoneZ = -milestoneIdx * this.milestoneInterval;

    const distToMilestone = playerZ - milestoneZ; // Positive distance remaining to milestone

    // Visible starting from 600m ahead up to 400m past milestone (matching ToriiGateManager!)
    if (distToMilestone <= 600 && distToMilestone >= -400) {
      if (!this.isMilestoneActive || this.currentMilestoneIdx !== milestoneIdx) {
        this.triggerMilestone(milestoneIdx, milestoneZ);
      }
    }

    // Update active sword lightning animations & atmosphere
    if (this.isMilestoneActive) {
      const sword = this.swords[0];
      if (sword && sword.active) {
        this.updateLightning(sword.lightning, delta);

        // Dramatic screen rumble when player is close (< 200m) to high-voltage titan sword
        const currentDist = Math.abs(playerZ - sword.z);
        if (this.game && currentDist < 200) {
          const rumbleFactor = 1.0 - (currentDist / 200);
          if (Math.random() < 0.15) {
            this.game.screenShake = Math.max(this.game.screenShake || 0, 0.4 * rumbleFactor);
          }
        }
      }
    }

    // Cleanup milestone once player passes 400m beyond it
    if (playerZ < this.activeMilestoneZ - 400) {
      if (this.isMilestoneActive) {
        this.processedMilestones.add(this.currentMilestoneIdx);
        this.isMilestoneActive = false;
        for (const s of this.swords) {
          s.group.position.set(0, -9999, 0);
          s.active = false;
        }
      }
    }
  }

  checkSwordCollision(boatWorldPos, hullRadius = 1.4) {
    if (!this.isLoaded || !this.isMilestoneActive) return { collided: false, bounceDir: 0, penetration: 0 };

    const sword = this.swords[0];
    if (sword && sword.active) {
      const dz = boatWorldPos.z - sword.z;
      const absDz = Math.abs(dz);

      // Precise Rectangular AABB Collision matching water-level titan blade bounds for active variant
      const minX = sword.x - sword.halfWidthX - hullRadius;
      const maxX = sword.x + sword.halfWidthX + hullRadius;
      const minZ = sword.z - sword.halfDepthZ - hullRadius;
      const maxZ = sword.z + sword.halfDepthZ + hullRadius;

      if (boatWorldPos.x > minX && boatWorldPos.x < maxX &&
          boatWorldPos.z > minZ && boatWorldPos.z < maxZ) {
        
        const penRight = maxX - boatWorldPos.x;
        const penLeft = boatWorldPos.x - minX;
        const penZ = Math.min(maxZ - boatWorldPos.z, boatWorldPos.z - minZ);

        if (Math.min(penLeft, penRight) < penZ) {
          // Side hit on blade edge
          const bounceDir = penRight < penLeft ? 1 : -1;
          return { collided: true, bounceDir: bounceDir, penetration: Math.min(penLeft, penRight) };
        } else {
          // Front/back hit on broad blade face
          const bounceDir = boatWorldPos.x >= sword.x ? 1 : -1;
          return { collided: true, bounceDir: bounceDir, penetration: penZ };
        }
      }
    }

    return { collided: false, bounceDir: 0, penetration: 0 };
  }
}
