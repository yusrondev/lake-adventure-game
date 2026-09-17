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

    // Pool of 2 pre-warmed Medieval Swords
    this.swords = [];
    this.poolSize = 2;

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
      const mesh = new THREE.Mesh(rippleGeo, rippleMat.clone());
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
    const r = this.ripples.find(item => !item.active);
    if (!r) return;

    r.active = true;
    r.life = 0;
    r.mesh.position.set(centerX, 0.1, centerZ);
    r.mesh.scale.set(1, 1, 1);
    r.mesh.visible = true;
  }

  updateRipples(delta) {
    for (const r of this.ripples) {
      if (r.active) {
        r.life += delta;
        const progress = r.life / r.maxLife;

        if (progress >= 1.0) {
          r.active = false;
          r.mesh.visible = false;
        } else {
          const scale = 1 + (r.scaleSpeed * r.life);
          r.mesh.scale.set(scale, scale, scale);
          r.mesh.material.opacity = (1.0 - progress) * 0.45;
        }
      }
    }
  }

  // --- Water Splash Particle System for Sword Emergence ---
  initWaterSplashSystem() {
    this.splashPoolCount = 45;
    this.splashParticles = [];
    this.splashGroup = new THREE.Group();
    this.splashGroup.renderOrder = 999;

    const splashGeo = new THREE.SphereGeometry(0.25, 6, 6);
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < this.splashPoolCount; i++) {
      const mesh = new THREE.Mesh(splashGeo, splashMat.clone());
      mesh.visible = false;
      this.splashGroup.add(mesh);
      this.splashParticles.push({
        mesh: mesh,
        active: false,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.35,
        vx: 0,
        vy: 0,
        vz: 0
      });
    }

    this.scene.add(this.splashGroup);
  }

  spawnWaterSplash(centerX, centerZ) {
    // Spawn 2-4 droplets around the active titan sword at water surface level (Y = 0.1)
    const count = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < count; k++) {
      const p = this.splashParticles.find(item => !item.active);
      if (!p) break;

      p.active = true;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.35;

      const side = Math.random() < 0.5 ? 1 : -1;
      const offsetX = (side * (1.2 + Math.random() * 2.8));
      const offsetZ = (Math.random() - 0.5) * 3.5;

      p.mesh.position.set(centerX + offsetX, 0.15, centerZ + offsetZ);
      p.mesh.visible = true;

      p.vx = (offsetX * 1.8) + (Math.random() - 0.5) * 2.0;
      p.vy = 4.5 + Math.random() * 6.5;
      p.vz = (Math.random() - 0.5) * 4.0;

      const scale = 0.4 + Math.random() * 0.8;
      p.mesh.scale.set(scale, scale * 1.4, scale);
      p.mesh.material.opacity = 0.85;
    }
  }

  updateWaterSplash(delta) {
    for (const p of this.splashParticles) {
      if (p.active) {
        p.life += delta;
        const progress = p.life / p.maxLife;

        if (progress >= 1.0) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.vy -= 18.0 * delta;
          p.mesh.position.x += p.vx * delta;
          p.mesh.position.y += p.vy * delta;
          p.mesh.position.z += p.vz * delta;

          p.mesh.material.opacity = (1.0 - progress) * 0.85;
          const s = (0.4 + progress * 0.6);
          p.mesh.scale.set(s, s * 1.2, s);
        }
      }
    }
  }

  reset() {
    this.processedMilestones.clear();
    this.isMilestoneActive = false;
    this.currentMilestoneIdx = 0;
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
          child.material = child.material.clone();
          child.material.metalness = 0.35;
          child.material.roughness = 0.40;
          child.material.fog = false;
          if (child.material.emissive) {
            child.material.emissive.setHex(0x000000);
            child.material.emissiveIntensity = 0;
          }
          child.material.needsUpdate = true;
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

    // Activate Medieval Sword (Includes smooth underwater rise + water splash spray!)
    const sword = this.swords[0];
    if (sword) {
      sword.x = variant.x;
      sword.z = milestoneZ;
      sword.targetY = this.swordTargetY + variant.yOffset;
      sword.startRiseY = sword.targetY - 110.0;
      sword.y = sword.startRiseY;
      sword.active = true;
      sword.halfWidthX = variant.halfWidthX;
      sword.halfDepthZ = variant.halfDepthZ;
      sword.opacity = 0.0;
      sword.isFadingIn = true;
      sword.hasStruckLightning = false;

      sword.mesh.rotation.set(variant.rotX, variant.rotY, variant.rotZ);

      sword.group.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = 0.0;
        }
      });

      sword.group.position.set(sword.x, sword.y, sword.z);
      sword.group.visible = true;
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

    // Update active titan sword smooth rise and fade-in (Medieval or Jade)
    if (this.isMilestoneActive) {
      const activeObj = this.swords[0];

      if (activeObj && activeObj.active) {
        // Smooth underwater emergence: starts at 800m ahead, completes fully at 250m ahead
        const riseProgress = THREE.MathUtils.clamp((800 - distToMilestone) / 550, 0, 1);
        const smoothProgress = THREE.MathUtils.smoothstep(riseProgress, 0, 1);

        activeObj.y = THREE.MathUtils.lerp(activeObj.startRiseY, activeObj.targetY, smoothProgress);
        activeObj.group.position.y = activeObj.y;

        // When titan sword emerges 75% above lake water (smoothProgress >= 0.75), trigger lightning strike & white screen blink!
        if (!activeObj.hasStruckLightning && smoothProgress >= 0.75) {
          activeObj.hasStruckLightning = true;
          this.triggerSwordLightningStrike(activeObj);
        }

        // Spawn dramatic water splash spray on left/right/front/back sides of titan sword as it breaks water surface
        if (smoothProgress < 0.98 && distToMilestone <= 800 && distToMilestone >= -50) {
          this.spawnWaterSplash(activeObj.x, activeObj.z);
          // Spawn ripples occasionally
          if (Math.random() < 0.06) {
            this.spawnRipple(activeObj.x, activeObj.z);
          }
        }

        if (activeObj.isFadingIn) {
          activeObj.opacity += delta * 3.0;
          if (activeObj.opacity >= 1.0) {
            activeObj.opacity = 1.0;
            activeObj.isFadingIn = false;
          }

          activeObj.group.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.opacity = activeObj.opacity;
              if (!activeObj.isFadingIn) child.material.transparent = false;
            }
          });
        }
      }
    }

    // Cleanup milestone once player passes 350m beyond it
    if (playerZ < this.activeMilestoneZ - 350) {
      if (this.isMilestoneActive) {
        this.processedMilestones.add(this.currentMilestoneIdx);
        this.isMilestoneActive = false;
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

    const activeObj = this.swords[0];
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

    return { collided: false, bounceDir: 0, penetration: 0 };
  }
}

