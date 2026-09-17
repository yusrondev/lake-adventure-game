import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class SwordRainManager {
  constructor(scene, game = null, preloadedModel = null) {
    this.scene = scene;
    this.game = game;

    this.milestoneInterval = 1200;   // Every 1200m (Visible starting at 600m ahead)
    this.visibleDistanceAhead = 600; // Visible starting from 600m ahead
    this.despawnDistanceBehind = 400;

    this.isLoaded = false;

    this.swordTemplate = null;
    this.swordScale = 56.0;  // Giant Titan Medieval Sword (~112m height)
    this.swordTargetY = 8.0;  // Base lodging height

    // Pool of 4 pre-warmed Medieval Swords (to support triple-sword wave at 10,000m+)
    this.swords = [];
    this.poolSize = 4;

    // Track active landmark state
    this.currentMilestoneIdx = 0;
    this.activeMilestoneZ = 0;
    this.isMilestoneActive = false;

    // Milestone completion tracking
    this.processedMilestones = new Set();

    // Water Splash Particle System for Sword Lake Emergence
    this.initWaterSplashSystem();
    this.initRippleSystem();

    if (preloadedModel) {
      this.initModel(preloadedModel);
    } else {
      this.preloadAsset();
    }
  }

  // --- Water Ripple Wave System ---
  initRippleSystem() {
    this.ripples = [];
    this.rippleGroup = new THREE.Group();
    this.rippleGroup.renderOrder = 998;

    const rippleGeo = new THREE.RingGeometry(2, 4, 64);
    rippleGeo.rotateX(-Math.PI / 2);

    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(rippleGeo, rippleMat);
      mesh.visible = false;
      this.rippleGroup.add(mesh);
      this.ripples.push({
        mesh: mesh,
        active: false,
        life: 0,
        maxLife: 2.5 + Math.random() * 1.0,
        scaleSpeed: 8 + Math.random() * 4
      });
    }

    this.scene.add(this.rippleGroup);
  }

  spawnRipple(centerX, centerZ) {
    // Disabled as requested (no white lake ripple effect when sword lodges or emerges)
    return;
  }

  updateRipples(delta) {
    // No-op
  }

  // --- Water Splash Particle System for Sword Emergence ---
  initWaterSplashSystem() {
    this.splashPoolCount = 0;
    this.splashParticles = [];
    this.splashGroup = new THREE.Group();
  }

  spawnWaterSplash(centerX, centerZ) {
    // Disabled as requested (no white splash particle effect when sword lodges or emerges)
    return;
  }

  updateWaterSplash(delta) {
    // No-op
  }

  reset() {
    this.processedMilestones.clear();
    this.isMilestoneActive = false;
    this.currentMilestoneIdx = 0;
    if (this.game && this.game.waterSystem) {
      this.game.waterSystem.setSwordWave(0, -9999, 0);
    }
    for (const s of this.swords) {
      s.group.position.set(0, -9999, 0);
      s.group.visible = false;
      s.active = false;
    }
    for (const p of this.splashParticles) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const r of this.ripples) {
      r.active = false;
      r.mesh.visible = false;
    }
  }

  preloadAsset() {
    const loader = new GLTFLoader();
    const loadPath = (url, fallback, cb) => {
      loader.load(
        url,
        (gltf) => cb(gltf.scene),
        undefined,
        (err) => {
          if (fallback) loadPath(fallback, null, cb);
          else console.error('Error loading sword GLB:', err);
        }
      );
    };
    loadPath('/models/medieval_sword.glb', '/src/env/medieval_sword.glb', (scene) => this.initModel(scene));
  }

  getLandmarkVariant(milestoneIdx) {
    const variantType = milestoneIdx % 3;

    if (variantType === 0) {
      return {
        name: 'Straight Center',
        x: 0,
        yOffset: 0,
        rotX: 0,
        rotY: Math.PI / 2,
        rotZ: Math.PI / 2,
        halfWidthX: 1.8,
        halfDepthZ: 1.4
      };
    } else if (variantType === 1) {
      const side = (milestoneIdx % 2 === 0) ? 1 : -1;
      return {
        name: 'Slightly Tilted',
        x: side * 3.5,
        yOffset: -2.0,
        rotX: side * 0.10,
        rotY: Math.PI / 2,
        rotZ: Math.PI / 2 + side * 0.24,
        halfWidthX: 3.2,
        halfDepthZ: 2.0
      };
    } else {
      const side = (milestoneIdx % 2 === 1) ? 1 : -1;
      return {
        name: 'Cliff Lodged Leaning',
        x: side * 15.5,
        yOffset: 6.0,
        rotX: 0.12,
        rotY: Math.PI / 2,
        rotZ: Math.PI / 2 - side * 0.65,
        halfWidthX: 6.5,
        halfDepthZ: 3.5
      };
    }
  }

  initModel(modelScene) {
    this.swordTemplate = modelScene;

    // Clean material: no shadow casting/receiving, ambient emissive lift for crystal-clear texture visibility
    this.swordTemplate.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = false;
        child.receiveShadow = false;
        if (child.material) {
          child.material.metalness = 0.35;
          child.material.roughness = 0.40;
          child.material.fog = false;
          if (child.material.emissive) {
            child.material.emissive.setHex(0x000000);
            child.material.emissiveIntensity = 0;
          }
        }
      }
    });

    for (let i = 0; i < this.poolSize; i++) {
      const group = new THREE.Group();
      group.frustumCulled = false;

      const mesh = this.swordTemplate.clone(true);
      mesh.scale.set(this.swordScale, this.swordScale, this.swordScale);
      mesh.rotation.set(0, Math.PI / 2, Math.PI / 2);
      group.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      const tipLodgedDepth = 48.0;
      this.swordTargetY = -box.min.y - tipLodgedDepth; // = 8.0

      group.visible = false;
      group.position.set(0, -9999, 0);
      this.scene.add(group);

      this.swords.push({
        group: group,
        mesh: mesh,
        x: 0,
        y: this.swordTargetY,
        z: 0,
        active: false,
        halfWidthX: 1.8,
        halfDepthZ: 1.4
      });
    }

    this.isLoaded = true;

    // WebGL Shader Compilation pre-warm
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
  }

  triggerMilestone(milestoneIdx, milestoneZ) {
    if (this.processedMilestones.has(milestoneIdx)) return;

    const distanceTraveled = -milestoneZ;
    this.currentMilestoneIdx = milestoneIdx;
    this.activeMilestoneZ = milestoneZ;
    this.isMilestoneActive = true;

    const variant = this.getLandmarkVariant(milestoneIdx);

    const isFallingFromSky = (distanceTraveled >= 4000);
    const isTripleWave = (distanceTraveled >= 10000);

    // Deactivate all pool swords first
    for (const s of this.swords) {
      s.active = false;
      s.group.visible = false;
      s.group.position.set(0, -9999, 0);
    }

    if (isTripleWave) {
      // 3 Swords wave with staggered timing and non-aligned positions (Left, Right, Center)
      const patternIdx = milestoneIdx % 3;
      let swordConfigs = [];

      if (patternIdx === 0) {
        // Pattern 0: Left -> Right -> Center
        swordConfigs = [
          { x: -5.2, zOffset: -25, startFallDist: 800, landDist: 250, rotZOffset: -0.15 },
          { x:  5.2, zOffset: 0,   startFallDist: 720, landDist: 170, rotZOffset:  0.15 },
          { x:  0.0, zOffset: 25,  startFallDist: 640, landDist:  90, rotZOffset:  0.0  }
        ];
      } else if (patternIdx === 1) {
        // Pattern 1: Center -> Left -> Right
        swordConfigs = [
          { x:  0.0, zOffset: -25, startFallDist: 800, landDist: 250, rotZOffset:  0.0  },
          { x: -5.5, zOffset: 0,   startFallDist: 720, landDist: 170, rotZOffset: -0.18 },
          { x:  5.5, zOffset: 25,  startFallDist: 640, landDist:  90, rotZOffset:  0.18 }
        ];
      } else {
        // Pattern 2: Right -> Center -> Left
        swordConfigs = [
          { x:  5.0, zOffset: -25, startFallDist: 800, landDist: 250, rotZOffset:  0.15 },
          { x:  0.0, zOffset: 0,   startFallDist: 720, landDist: 170, rotZOffset:  0.0  },
          { x: -5.0, zOffset: 25,  startFallDist: 640, landDist:  90, rotZOffset: -0.15 }
        ];
      }

      for (let i = 0; i < 3; i++) {
        const sword = this.swords[i];
        if (!sword) continue;
        const cfg = swordConfigs[i];

        sword.x = cfg.x;
        sword.z = milestoneZ + cfg.zOffset;
        sword.targetY = this.swordTargetY + variant.yOffset;
        sword.startRiseY = sword.targetY + 250.0;
        sword.isFallingFromSky = true;
        sword.startFallDist = cfg.startFallDist;
        sword.landDist = cfg.landDist;

        sword.y = sword.startRiseY;
        sword.active = true;
        sword.halfWidthX = variant.halfWidthX;
        sword.halfDepthZ = variant.halfDepthZ;
        sword.hasStruckLightning = false;

        sword.mesh.rotation.set(
          variant.rotX,
          variant.rotY,
          variant.rotZ + cfg.rotZOffset
        );
        sword.group.position.set(sword.x, sword.y, sword.z);
        sword.group.visible = true;
      }
    } else {
      // Single Sword (underwater or sky)
      const sword = this.swords[0];
      if (sword) {
        sword.x = variant.x;
        sword.z = milestoneZ;
        sword.targetY = this.swordTargetY + variant.yOffset;
        sword.startFallDist = 800;
        sword.landDist = 250;

        if (isFallingFromSky) {
          sword.startRiseY = sword.targetY + 250.0;
        } else {
          sword.startRiseY = sword.targetY - 110.0;
        }
        sword.isFallingFromSky = isFallingFromSky;

        sword.y = sword.startRiseY;
        sword.active = true;
        sword.halfWidthX = variant.halfWidthX;
        sword.halfDepthZ = variant.halfDepthZ;
        sword.hasStruckLightning = false;

        sword.mesh.rotation.set(variant.rotX, variant.rotY, variant.rotZ);
        sword.group.position.set(sword.x, sword.y, sword.z);
        sword.group.visible = true;
      }
    }
  }

  triggerSwordLightningStrike(activeObj) {
    if (this.game && this.game.weatherManager) {
      this.game.weatherManager.triggerTitanSwordLightning(activeObj.x, activeObj.y, activeObj.z);
    } else {
      // Fallback screen white flash
      document.body.classList.add('sword-lightning-flash');
      setTimeout(() => {
        document.body.classList.remove('sword-lightning-flash');
      }, 450);
      if (this.game) this.game.screenShake = 0.95;
    }
  }

  update(playerZ, delta = 0.016) {
    // Update active water splash particles
    this.updateWaterSplash(delta);
    this.updateRipples(delta);

    if (!this.isLoaded) return;

    const distanceTraveled = -playerZ;

    // Calculate milestone index (every 1200m)
    const milestoneIdx = Math.max(1, Math.floor((distanceTraveled + 800) / this.milestoneInterval));
    const milestoneZ = -milestoneIdx * this.milestoneInterval;

    const distToMilestone = playerZ - milestoneZ;

    // Visible starting from 850m ahead up to 350m past milestone
    if (distToMilestone <= 850 && distToMilestone >= -350) {
      if (!this.isMilestoneActive || this.currentMilestoneIdx !== milestoneIdx) {
        this.triggerMilestone(milestoneIdx, milestoneZ);
      }
    }

    // Update active titan sword smooth rise/fall and fade-in
    if (this.isMilestoneActive) {
      for (const activeObj of this.swords) {
        if (!activeObj || !activeObj.active) continue;

        const distToSword = playerZ - activeObj.z;
        const startFall = activeObj.startFallDist || 800;
        const landDist = activeObj.landDist || 250;
        const distSpan = Math.max(1, startFall - landDist);

        const riseProgress = THREE.MathUtils.clamp((startFall - distToSword) / distSpan, 0, 1);
        const smoothProgress = THREE.MathUtils.smoothstep(riseProgress, 0, 1);

        activeObj.y = THREE.MathUtils.lerp(activeObj.startRiseY, activeObj.targetY, smoothProgress);
        activeObj.group.position.y = activeObj.y;

        // When titan sword reaches 100% emergence/landing (smoothProgress >= 1.0), trigger dramatic lightning strike & white screen blink!
        if (!activeObj.hasStruckLightning && smoothProgress >= 1.0) {
          activeObj.hasStruckLightning = true;
          this.triggerSwordLightningStrike(activeObj);

          // Extra splash & ripple burst on impact
          for (let s = 0; s < 3; s++) {
            this.spawnWaterSplash(activeObj.x, activeObj.z);
          }
          this.spawnRipple(activeObj.x, activeObj.z);
        }



        // Spawn dramatic water splash spray on left/right/front/back sides of titan sword as it breaks water surface
        const shouldSplash = activeObj.isFallingFromSky
          ? (smoothProgress >= 0.70 && distToSword <= startFall && distToSword >= -50)
          : (smoothProgress < 0.98 && distToSword <= startFall && distToSword >= -50);

        if (shouldSplash) {
          this.spawnWaterSplash(activeObj.x, activeObj.z);
          // Spawn ripples frequently
          if (Math.random() < 0.35) {
            this.spawnRipple(activeObj.x, activeObj.z);
          }
        }
      }
    }

    // Cleanup milestone once player passes 350m beyond it
    if (playerZ < this.activeMilestoneZ - 350) {
      if (this.isMilestoneActive) {
        this.processedMilestones.add(this.currentMilestoneIdx);
        this.isMilestoneActive = false;
        if (this.game && this.game.waterSystem) {
          this.game.waterSystem.setSwordWave(0, -9999, 0);
        }
        for (const s of this.swords) {
          s.group.visible = false;
          s.group.position.set(0, -9999, 0);
          s.active = false;
        }
      }
    }
  }

  checkSwordCollision(boatWorldPos, hullRadius = 1.4) {
    if (!this.isLoaded || !this.isMilestoneActive) return { collided: false, bounceDir: 0, penetration: 0 };

    for (const activeObj of this.swords) {
      if (activeObj && activeObj.active) {
        const minX = activeObj.x - activeObj.halfWidthX - hullRadius;
        const maxX = activeObj.x + activeObj.halfWidthX + hullRadius;
        const minZ = activeObj.z - activeObj.halfDepthZ - hullRadius;
        const maxZ = activeObj.z + activeObj.halfDepthZ + hullRadius;

        if (boatWorldPos.x > minX && boatWorldPos.x < maxX &&
            boatWorldPos.z > minZ && boatWorldPos.z < maxZ) {
          
          const penRight = maxX - boatWorldPos.x;
          const penLeft = boatWorldPos.x - minX;
          const penZ = Math.min(maxZ - boatWorldPos.z, boatWorldPos.z - minZ);

          if (Math.min(penLeft, penRight) < penZ) {
            const bounceDir = penRight < penLeft ? 1 : -1;
            return { collided: true, bounceDir: bounceDir, penetration: Math.min(penLeft, penRight) };
          } else {
            const bounceDir = boatWorldPos.x >= activeObj.x ? 1 : -1;
            return { collided: true, bounceDir: bounceDir, penetration: penZ };
          }
        }
      }
    }

    return { collided: false, bounceDir: 0, penetration: 0 };
  }
}

