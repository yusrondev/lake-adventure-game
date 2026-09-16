import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class RockManager {
  constructor(scene, game, preloadedModel = null) {
    this.scene = scene;
    this.game = game;

    this.isLoaded = false;
    this.rockModel = null;
    this.baseExtents = new THREE.Vector3(2.5, 2.5, 2.5);
    this.baseCenter = new THREE.Vector3(0, 0, 0);

    // Active rocks map keyed by segment index -> array of rock objects
    this.activeSegmentRocks = new Map();

    if (preloadedModel) {
      this.initModel(preloadedModel);
    } else {
      this.preloadAsset();
    }
  }

  initModel(modelScene) {
    this.rockModel = modelScene;
    this.rockModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.flatShading = true;
          if (child.material.roughness !== undefined) {
            child.material.roughness = 0.65;
            child.material.metalness = 0.15;
          }
          child.material.needsUpdate = true;
        }
      }
    });

    const box = new THREE.Box3().setFromObject(this.rockModel);
    box.getSize(this.baseExtents);
    box.getCenter(this.baseCenter);
    if (this.baseExtents.x === 0) this.baseExtents.set(2.5, 2.5, 2.5);
    this.isLoaded = true;
  }

  preloadAsset() {
    const loader = new GLTFLoader();
    loader.load(
      '/src/env/stylized_low-poly_stone.glb',
      (gltf) => {
        this.rockModel = gltf.scene;
        
        this.rockModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.flatShading = true;
              if (child.material.roughness !== undefined) {
                child.material.roughness = 0.65;
                child.material.metalness = 0.15;
              }
              child.material.needsUpdate = true;
            }
          }
        });

        // Compute local 3D bounding box of base GLTF rock geometry
        const box = new THREE.Box3().setFromObject(this.rockModel);
        box.getSize(this.baseExtents);
        box.getCenter(this.baseCenter);

        if (this.baseExtents.x === 0) this.baseExtents.set(2.5, 2.5, 2.5);

        this.isLoaded = true;
      },
      undefined,
      (err) => {
        console.error('Error loading stylized_low-poly_stone.glb asset:', err);
      }
    );
  }

  onSegmentCreated(segmentIndex, zCenter, segmentLength) {
    // Only spawn rocks if the 3D asset stylized_low-poly_stone.glb is fully loaded
    if (!this.isLoaded || !this.rockModel) return;

    // Don't spawn rocks in initial starting area (segments 0 and 1) so player starts safely
    if (segmentIndex <= 1) return;

    // 60% chance of 1 rock per 80m segment to guarantee clear open lanes and ample space
    if (Math.random() > 0.60) return;

    const segmentRocks = [];

    // Position Z within segment with margin
    const offsetZ = (Math.random() - 0.5) * (segmentLength - 30);
    const rockZ = zCenter + offsetZ;

    // Do not spawn rocks directly in the gateway zone of Japanese Torii Gates (every 2000m)
    const nearestGateZ = Math.round(rockZ / 2000) * 2000;
    if (Math.abs(rockZ - nearestGateZ) < 45) return;

    // Distribute across left, center-left, center-right, and right lanes
    const laneChoices = [-10.5, -4.5, 4.5, 10.5];
    const chosenLane = laneChoices[Math.floor(Math.random() * laneChoices.length)];
    const rockX = chosenLane + (Math.random() * 2.0 - 1.0);

    const rockMesh = this.createRockInstance();
    if (!rockMesh) return;

    // Highly varied non-uniform sizes (Scale range 1.4x to 3.8x)
    const scaleBase = 1.4 + Math.random() * 2.4;
    const scaleX = scaleBase * (0.85 + Math.random() * 0.35);
    const scaleY = scaleBase * (0.9 + Math.random() * 0.4);
    const scaleZ = scaleBase * (0.85 + Math.random() * 0.35);

    rockMesh.scale.set(scaleX, scaleY, scaleZ);

    // Submerge rock base into lake bed so it looks grounded underwater (-1.0m to -1.8m)
    const posY = -1.0 - (scaleY * 0.22);
    rockMesh.position.set(rockX, posY, rockZ);

    // Unique random 3D rotations for organic shape variation
    rockMesh.rotation.set(
      (Math.random() - 0.5) * 0.4,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.4
    );

    this.scene.add(rockMesh);
    rockMesh.updateMatrixWorld(true);

    // Calculate true physical horizontal radius of this rock instance at water level
    const radiusWaterX = (this.baseExtents.x * 0.5) * scaleX * 0.70;
    const radiusWaterZ = (this.baseExtents.z * 0.5) * scaleZ * 0.70;
    const effectiveWaterRadius = Math.max(radiusWaterX, radiusWaterZ);

    segmentRocks.push({
      mesh: rockMesh,
      x: rockX,
      z: rockZ,
      effectiveWaterRadius: effectiveWaterRadius,
      maxWorldRadius: effectiveWaterRadius + 4.5
    });

    this.activeSegmentRocks.set(segmentIndex, segmentRocks);
  }

  createRockInstance() {
    if (!this.rockModel) return null;
    const instance = this.rockModel.clone(true);

    instance.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return instance;
  }

  onSegmentDestroyed(segmentIndex) {
    const rocks = this.activeSegmentRocks.get(segmentIndex);
    if (rocks) {
      rocks.forEach((r) => {
        this.scene.remove(r.mesh);
        r.mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
        });
      });
      this.activeSegmentRocks.delete(segmentIndex);
    }
  }

  update(physics) {
    if (!physics || !physics.boat) return;

    const boatPos = physics.worldPosition;
    const halfLength = physics.boat.length / 2; // 4.2m

    // Boat heading direction unit vectors in world space
    const heading = physics.heading;
    const fX = Math.sin(heading);
    const fZ = -Math.cos(heading);
    const rX = Math.cos(heading);
    const rZ = Math.sin(heading);

    for (const [idx, rocks] of this.activeSegmentRocks.entries()) {
      for (const rock of rocks) {
        // Broad phase cutoff
        const dx = rock.x - boatPos.x;
        const dz = rock.z - boatPos.z;
        const distSq = dx * dx + dz * dz;
        const maxCutoff = halfLength + rock.effectiveWaterRadius + 1.0;
        if (distSq > maxCutoff * maxCutoff) {
          continue;
        }

        // Project relative vector (dx, dz) into boat local coordinate frame
        // forward s is longitudinal position along boat axis (-4.2 = bow tip, +4.2 = stern)
        const s = dx * fX + dz * fZ;
        // lateral d is lateral distance from boat central spine
        const d = dx * rX + dz * rZ;

        // Clamp longitudinal position to boat hull length
        const sClamped = THREE.MathUtils.clamp(s, -halfLength, halfLength);
        
        // Exact hull half-width at this specific longitudinal position along the tapered boat
        const hullHalfWidth = physics.boat.getHullHalfWidthAtZ(sClamped);

        // Distance from rock center to boat's outer hull perimeter
        const deltaLong = Math.abs(s - sClamped);
        const deltaLat = Math.max(0, Math.abs(d) - hullHalfWidth);
        const distToHull = Math.hypot(deltaLong, deltaLat);

        // Exact physical contact check: distance to hull < physical radius of rock at water level
        if (distToHull < rock.effectiveWaterRadius) {
          // Contact detected!
          const overlap = rock.effectiveWaterRadius - distToHull;

          // Compute exact push normal pointing from rock contact point to boat
          let normX, normZ;
          if (distToHull > 0.001) {
            // World position of the closest point on the boat hull
            const closestBoatX = boatPos.x + sClamped * fX + (Math.sign(d) * Math.min(Math.abs(d), hullHalfWidth)) * rX;
            const closestBoatZ = boatPos.z + sClamped * fZ + (Math.sign(d) * Math.min(Math.abs(d), hullHalfWidth)) * rZ;
            
            const diffX = closestBoatX - rock.x;
            const diffZ = closestBoatZ - rock.z;
            const len = Math.hypot(diffX, diffZ) || 0.001;
            normX = diffX / len;
            normZ = diffZ / len;
          } else {
            normX = (d >= 0 ? -rX : rX);
            normZ = (d >= 0 ? -rZ : rZ);
          }

          // Capture incoming boat speed BEFORE deceleration
          const incomingSpeedKmH = Math.abs(physics.speed) * 3.6;

          // 1. HARD IMPENETRABLE COLLISION DISPLACEMENT ALONG CONTACT NORMAL
          const pushDistance = Math.max(0.20, overlap + 0.08);
          physics.worldPosition.x += normX * pushDistance;
          physics.worldPosition.z += normZ * pushDistance;

          // Clamp X to safe channel boundary
          physics.worldPosition.x = THREE.MathUtils.clamp(
            physics.worldPosition.x,
            -physics.safeChannelLimit + 0.3,
            physics.safeChannelLimit - 0.3
          );

          // 2. STOP FORWARD SPEED & APPLY STEERING BOUNCE IMPULSE
          physics.speed = Math.max(0, physics.speed * 0.15);
          physics.turnSpeed = normX * 1.5;

          // 3. DAMAGE & FEEDBACK (Only trigger HP reduction when incoming speed >= 20 km/h and not invulnerable)
          if (physics.invulnerableTimer <= 0) {
            if (incomingSpeedKmH >= 20.0) {
              physics.health = Math.max(0, physics.health - 20);
              physics.invulnerableTimer = 0.8;

              if (this.game) {
                this.game.triggerDamageFeedback();
                if (physics.health <= 0) {
                  this.game.gameOver();
                }
              }
            } else {
              // Gentle scrape/bump below 20 km/h: physical bounce only, no HP damage
              physics.invulnerableTimer = 0.35;
            }
          }

          break; // Handled hit for this rock
        }
      }
    }
  }
}
