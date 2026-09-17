import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ToriiGateManager {
  constructor(scene, game = null, preloadedModel = null) {
    this.scene = scene;
    this.game = game;

    this.gateInterval = 2000; // Every 2000m (2km)
    this.visibleDistanceAhead = 600; // Only visible/loaded when within 600m of the gate
    this.despawnDistanceBehind = 300; // Despawn 300m after passing

    this.isLoaded = false;
    this.gateTemplate = null;
    this.gateBaseBox = new THREE.Box3();
    this.gateBaseSize = new THREE.Vector3();
    this.gateScale = 2.25; // Scaled to fit pillars flush against left/right cliff walls (0 gap)

    // Pre-warmed Zero-Allocation Object Pool (2 permanent gate assemblies in scene graph)
    this.gatePool = [];
    this.poolSize = 2;

    // Map of active gates: gateIndex -> Gate Object
    this.activeGates = new Map();

    // Passed milestone tracking
    this.passedGates = new Set();

    if (preloadedModel) {
      this.initModel(preloadedModel);
    } else {
      this.preloadAsset();
    }
  }

  initModel(modelScene) {
    this.gateTemplate = modelScene;
    this.gateTemplate.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.roughness = 0.55;
          child.material.metalness = 0.10;
          child.material.needsUpdate = true;
        }
      }
    });

    this.gateBaseBox.setFromObject(this.gateTemplate);
    this.gateBaseBox.getSize(this.gateBaseSize);

    // Initialize Pre-warmed Gate Pool into scene graph
    this.initGatePool();

    this.isLoaded = true;

    if (this.game && this.game.physics) {
      this.update(this.game.physics.worldPosition.z);
    }
  }

  initGatePool() {
    // Clear any existing pool
    this.gatePool.forEach(g => {
      if (g.group) this.scene.remove(g.group);
    });
    this.gatePool = [];

    const scaledMinY = this.gateBaseBox.min.y * this.gateScale;
    const modelOffsetY = -scaledMinY - 1.2;

    for (let i = 0; i < this.poolSize; i++) {
      const gateGroup = new THREE.Group();
      const model = this.gateTemplate.clone(true);
      model.scale.set(this.gateScale, this.gateScale, this.gateScale);
      model.position.set(0, modelOffsetY, 0);
      gateGroup.add(model);

      // Pre-instantiated Fixed Torii Lanterns (Never added/removed dynamically from scene)
      const lanternLeft = new THREE.PointLight(0xff7733, 2.5, 35.0, 1.2);
      lanternLeft.position.set(-18.8, 4.8, 0);
      gateGroup.add(lanternLeft);

      const lanternRight = new THREE.PointLight(0xff7733, 2.5, 35.0, 1.2);
      lanternRight.position.set(18.8, 4.8, 0);
      gateGroup.add(lanternRight);

      const centerGlow = new THREE.PointLight(0xffaa44, 1.8, 45.0, 1.5);
      centerGlow.position.set(0, 16.0, 0);
      gateGroup.add(centerGlow);

      // Pre-add to scene graph in invisible, off-screen park position
      gateGroup.visible = false;
      gateGroup.position.set(0, -9999, 0);
      this.scene.add(gateGroup);

      this.gatePool.push({
        group: gateGroup,
        lanternLeft: lanternLeft,
        lanternRight: lanternRight,
        centerGlow: centerGlow,
        inUse: false,
        zPos: 0,
        gateIndex: 0,
        leftPillarX: -18.8,
        rightPillarX: 18.8,
        pillarRadius: 2.2,
        passed: false
      });
    }
  }

  preloadAsset() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/japanese_tori_gate.glb',
      (gltf) => {
        this.initModel(gltf.scene);
      },
      undefined,
      (err) => {
        console.error('Error loading japanese_tori_gate.glb:', err);
      }
    );
  }

  acquireGateFromPool(zPos, gateIndex) {
    const available = this.gatePool.find(g => !g.inUse);
    if (!available) return null;

    available.inUse = true;
    available.zPos = zPos;
    available.gateIndex = gateIndex;
    available.passed = false;

    // Instant zero-cost reposition and activation
    available.group.scale.set(1, 1, 1);
    available.group.position.set(0, 0, zPos);
    available.group.visible = true;

    return available;
  }

  releaseGateToPool(gate) {
    gate.inUse = false;
    gate.group.visible = false;
    gate.group.position.set(0, -9999, 0);
  }

  update(playerZ, delta = 0.016) {
    if (!this.isLoaded || !this.gateTemplate) return;

    const minZ = playerZ - this.visibleDistanceAhead; // Ahead in negative Z
    const maxZ = playerZ + this.despawnDistanceBehind;

    // Calculate gate indices that should be active
    const minGateIdx = Math.max(1, Math.ceil((-maxZ) / this.gateInterval));
    const maxGateIdx = Math.floor((-minZ) / this.gateInterval);

    // 1. Activate gates within render distance using pre-allocated pool (0ms cost)
    for (let idx = minGateIdx; idx <= maxGateIdx; idx++) {
      if (!this.activeGates.has(idx)) {
        const zPos = -idx * this.gateInterval;
        const gate = this.acquireGateFromPool(zPos, idx);
        if (gate) {
          this.activeGates.set(idx, gate);
        }
      }
    }

    // 3. Check gate passing and return out-of-range gates to pool (0ms cost)
    for (const [idx, gate] of this.activeGates.entries()) {
      if (idx < minGateIdx || idx > maxGateIdx) {
        this.releaseGateToPool(gate);
        this.activeGates.delete(idx);
      } else {
        // Milestone check when player passes through the gate
        if (!gate.passed && playerZ <= gate.zPos) {
          gate.passed = true;
          this.passedGates.add(idx);
          if (this.game && typeof this.game.onGatePassed === 'function') {
            this.game.onGatePassed(idx, idx * this.gateInterval);
          }
        }
      }
    }
  }

  checkPillarCollision(boatWorldPos, hullRadius = 1.4) {
    for (const gate of this.activeGates.values()) {
      const dz = Math.abs(boatWorldPos.z - gate.zPos);
      if (dz < 8.0) { // Increased check distance for high speed
        // Use precise rectangular bounding boxes for the Torii pillars based on lantern centers (±18.8)
        const pillarWidthX = 4.2; // Total width in X
        const pillarDepthZ = 5.0; // Total depth in Z
        
        const leftMinX = -18.8 - (pillarWidthX / 2) - hullRadius;
        const leftMaxX = -18.8 + (pillarWidthX / 2) + hullRadius;
        const leftMinZ = gate.zPos - (pillarDepthZ / 2) - hullRadius;
        const leftMaxZ = gate.zPos + (pillarDepthZ / 2) + hullRadius;

        const rightMinX = 18.8 - (pillarWidthX / 2) - hullRadius;
        const rightMaxX = 18.8 + (pillarWidthX / 2) + hullRadius;
        const rightMinZ = gate.zPos - (pillarDepthZ / 2) - hullRadius;
        const rightMaxZ = gate.zPos + (pillarDepthZ / 2) + hullRadius;

        // Left Pillar check (AABB)
        if (boatWorldPos.x > leftMinX && boatWorldPos.x < leftMaxX &&
            boatWorldPos.z > leftMinZ && boatWorldPos.z < leftMaxZ) {
          
          // Determine penetration depths to find the closest edge for precise bounce direction
          const penRight = leftMaxX - boatWorldPos.x;
          const penLeft = boatWorldPos.x - leftMinX;
          const penZ = Math.min(leftMaxZ - boatWorldPos.z, boatWorldPos.z - leftMinZ);
          
          if (Math.min(penLeft, penRight) < penZ) {
             // Side hit
             const bounceDir = penRight < penLeft ? 1 : -1;
             return { collided: true, bounceDir: bounceDir, penetration: Math.min(penLeft, penRight) };
          } else {
             // Front/Back hit (bounce outward slightly)
             return { collided: true, bounceDir: 1, penetration: penZ };
          }
        }

        // Right Pillar check (AABB)
        if (boatWorldPos.x > rightMinX && boatWorldPos.x < rightMaxX &&
            boatWorldPos.z > rightMinZ && boatWorldPos.z < rightMaxZ) {
          
          const penRight = rightMaxX - boatWorldPos.x;
          const penLeft = boatWorldPos.x - rightMinX;
          const penZ = Math.min(rightMaxZ - boatWorldPos.z, boatWorldPos.z - rightMinZ);
          
          if (Math.min(penLeft, penRight) < penZ) {
             // Side hit
             const bounceDir = penRight < penLeft ? 1 : -1;
             return { collided: true, bounceDir: bounceDir, penetration: Math.min(penLeft, penRight) };
          } else {
             // Front/Back hit
             return { collided: true, bounceDir: -1, penetration: penZ };
          }
        }
      }
    }
    return { collided: false, bounceDir: 0, penetration: 0 };
  }
}
