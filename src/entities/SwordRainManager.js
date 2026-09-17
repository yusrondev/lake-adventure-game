import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class SwordRainManager {
  constructor(scene, game = null, preloadedModel = null) {
    this.scene = scene;
    this.game = game;

    this.milestoneInterval = 3500;   // Every 3500m
    this.visibleDistanceAhead = 600; // Visible starting from 600m ahead
    this.despawnDistanceBehind = 400;

    this.isLoaded = false;
    this.swordTemplate = null;
    this.swordScale = 56.0;  // Giant Titan Medieval Sword (~112m height)
    this.swordTargetY = 8.0;  // Base lodging height

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
    // Cycle between 3 distinct spawn variants:
    // 0 = Straight Center, 1 = Slightly Tilted in Channel, 2 = Lodged in Cliff Leaning Over Lake
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
        rotZ: Math.PI / 2 + side * 0.24, // ~14° tilt
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
        rotZ: Math.PI / 2 - side * 0.65, // ~37° steep tilt
        halfWidthX: 6.5,
        halfDepthZ: 3.5
      };
    }
  }

  initModel(modelScene) {
    this.swordTemplate = modelScene;

    // Clean material: no shadow casting/receiving, no emissive glow, no artificial effects
    this.swordTemplate.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = false;
        child.receiveShadow = false;
        if (child.material) {
          child.material.metalness = 0.85;
          child.material.roughness = 0.25;
          child.material.fog = false;
          if (child.material.emissive) {
            child.material.emissive.setHex(0x000000);
            child.material.emissiveIntensity = 0;
          }
          child.material.needsUpdate = true;
        }
      }
    });

    // Create pre-warmed pool of clean giant sword 3D objects
    for (let i = 0; i < this.poolSize; i++) {
      const group = new THREE.Group();
      group.frustumCulled = false;

      // Pure 3D Sword Mesh - No shadows, no reflections, no visual effects
      const mesh = this.swordTemplate.clone(true);
      mesh.scale.set(this.swordScale, this.swordScale, this.swordScale);
      mesh.rotation.set(0, Math.PI / 2, Math.PI / 2);
      group.add(mesh);

      // Compute lodging depth
      const box = new THREE.Box3().setFromObject(mesh);
      const tipLodgedDepth = 48.0;
      this.swordTargetY = -box.min.y - tipLodgedDepth; // = 8.0

      group.visible = true;
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

    // Force WebGL Shader Compilation pre-warm
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

    if (this.game && this.game.physics) {
      this.update(this.game.physics.worldPosition.z, 0.016);
    }
  }

  createSwordShadowMesh(parentGroup, groupY) {
    return null;
  }

  createLightningGroup(parentGroup, groupY) {
    return null;
  }

  updateLightning(lightningData, delta) {
    return;
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
    sword.opacity = 0.0;
    sword.isFadingIn = true;

    // Apply main mesh variant rotations
    sword.mesh.rotation.set(variant.rotX, variant.rotY, variant.rotZ);

    // Set transparency & opacity for smooth fade-in
    sword.group.traverse((child) => {
      if (child.isMesh && child.material) {
        if (!child.userData.originalMat) {
          child.userData.originalMat = child.material;
        }
        child.material = child.userData.originalMat.clone();
        child.material.transparent = true;
        child.material.opacity = 0.0;
      }
    });

    sword.group.position.set(sword.x, sword.y, sword.z);
    sword.group.visible = true;
  }

  update(playerZ, delta = 0.016) {
    if (!this.isLoaded) return;

    const distanceTraveled = -playerZ;

    // Calculate milestone index (every 3500m)
    const milestoneIdx = Math.max(1, Math.floor((distanceTraveled + 600) / this.milestoneInterval));
    const milestoneZ = -milestoneIdx * this.milestoneInterval;

    const distToMilestone = playerZ - milestoneZ;

    // Visible starting from 600m ahead up to 300m past milestone
    if (distToMilestone <= 600 && distToMilestone >= -300) {
      if (!this.isMilestoneActive || this.currentMilestoneIdx !== milestoneIdx) {
        this.triggerMilestone(milestoneIdx, milestoneZ);
      }
    }

    // Update active sword smooth fade-in
    if (this.isMilestoneActive) {
      const sword = this.swords[0];
      if (sword && sword.active) {
        if (sword.isFadingIn) {
          sword.opacity += delta * 1.4; // Fade-in over ~0.7s
          if (sword.opacity >= 1.0) {
            sword.opacity = 1.0;
            sword.isFadingIn = false;
          }

          // Smoothly update opacity across sword mesh
          sword.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.opacity = sword.opacity;
              if (!sword.isFadingIn) child.material.transparent = false;
            }
          });
        }
      }
    }

    // Cleanup milestone once player passes 300m beyond it
    if (playerZ < this.activeMilestoneZ - 300) {
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

    const sword = this.swords[0];
    if (sword && sword.active) {
      // Precise Rectangular AABB Collision matching 3D titan blade bounds at water level for active variant
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

