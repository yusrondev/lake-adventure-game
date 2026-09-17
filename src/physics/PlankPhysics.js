import * as THREE from 'three';

export class PlankPhysics {
  constructor(woodenBoat, humanoid, waterSystem) {
    this.boat = woodenBoat;
    this.humanoid = humanoid;
    this.waterSystem = waterSystem;

    // Attach humanoid directly to boat group for 100% matrix synchronization
    this.boat.mesh.add(this.humanoid.mesh);
    this.humanoid.mesh.position.set(0, 0.12, 0);

    // Initial default bounds for doubled grand vessel (8.4m length)
    this.maxX = 1.6;
    this.minZ = -3.5; // Front deck boundary (keeps player strictly behind the bow lantern at z = -5.0m)
    this.maxZ = 3.6;  // Stern deck boundary

    this.playerLocalPos = new THREE.Vector2(0, 0);
    this.targetPlayerLocalPos = new THREE.Vector2(0, 0);

    // Hydrodynamic parameters
    this.speed = 0;              
    this.maxSpeed = 65.0;        
    this.maxReverseSpeed = 4.8; // ~17 km/h max reverse speed
    this.acceleration = 11.0;    
    this.brakingRate = 16.0;     
    this.drag = 1.2;             

    this.heading = 0;            
    this.turnSpeed = 0;          
    this.maxTurnSpeed = 0.32;    // Reduced sensitivity max turning speed
    this.maxHeadingAngle = 0.44; // Exact 25.0 degree max steering angle

    this.roll = 0;               
    this.pitch = 0;              

    // World Position
    this.worldPosition = new THREE.Vector3(0, 0, 0);
    this.safeChannelLimit = 19.2; // Matches exact visual shoreline banks (40m channel width)

    // Health & Collision Stun Penalty
    this.maxHealth = 100;
    this.health = 100;
    this.invulnerableTimer = 0;
    this.collisionSlowTimer = 0;
    this.stuckTimer = 0;
  }

  applyJoystickVector(normX, normY, delta) {
    const moveRate = 2.4; // Smooth deck walking rate for fine steering control
    this.targetPlayerLocalPos.x += normX * moveRate * delta;
    this.targetPlayerLocalPos.y += normY * moveRate * delta;

    // Dynamically clamp player within 3D boat hull contour
    const currentMaxX = this.boat.getHullHalfWidthAtZ(this.targetPlayerLocalPos.y);
    this.targetPlayerLocalPos.x = THREE.MathUtils.clamp(this.targetPlayerLocalPos.x, -currentMaxX, currentMaxX);
    this.targetPlayerLocalPos.y = THREE.MathUtils.clamp(this.targetPlayerLocalPos.y, this.minZ, this.maxZ);
  }

  updateInput(input, delta) {
    const moveRate = 2.4;

    let dirX = 0;
    let dirZ = 0;

    if (input.left) dirX -= 1;
    if (input.right) dirX += 1;
    if (input.forward) dirZ -= 1;
    if (input.backward) dirZ += 1;

    if (dirX !== 0 || dirZ !== 0) {
      this.targetPlayerLocalPos.x += dirX * moveRate * delta;
      this.targetPlayerLocalPos.y += dirZ * moveRate * delta;

      const currentMaxX = this.boat.getHullHalfWidthAtZ(this.targetPlayerLocalPos.y);
      this.targetPlayerLocalPos.x = THREE.MathUtils.clamp(this.targetPlayerLocalPos.x, -currentMaxX, currentMaxX);
      this.targetPlayerLocalPos.y = THREE.MathUtils.clamp(this.targetPlayerLocalPos.y, this.minZ, this.maxZ);
    }
  }

  updatePhysics(delta, remotePlayers = null) {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= delta;
    }

    // 1. SMOOTH PLAYER POSITION ON BOAT DECK (Player remains at last position!)
    const posDamp = 1.0 - Math.exp(-8.0 * delta);
    this.playerLocalPos.x += (this.targetPlayerLocalPos.x - this.playerLocalPos.x) * posDamp;
    this.playerLocalPos.y += (this.targetPlayerLocalPos.y - this.playerLocalPos.y) * posDamp;

    // Dynamically clamp active position to 3D hull contour
    const activeMaxX = this.boat.getHullHalfWidthAtZ(this.playerLocalPos.y);
    this.playerLocalPos.x = THREE.MathUtils.clamp(this.playerLocalPos.x, -activeMaxX, activeMaxX);
    this.playerLocalPos.y = THREE.MathUtils.clamp(this.playerLocalPos.y, this.minZ, this.maxZ);

    // 2. COMBINED CENTER-OF-MASS ACROSS ALL PLAYERS ON DECK (Equal physical weight for Host & Joiners)
    let totalX = this.playerLocalPos.x;
    let totalZ = this.playerLocalPos.y;
    let playerCount = 1;

    if (remotePlayers) {
      const playerList = remotePlayers instanceof Map ? remotePlayers.values() : remotePlayers;
      for (const rp of playerList) {
        if (rp && rp.localPos) {
          totalX += rp.localPos.x;
          totalZ += rp.localPos.y;
          playerCount++;
        }
      }
    }

    const avgLocalX = totalX / playerCount;
    const avgLocalZ = totalZ / playerCount;

    const normX = avgLocalX / (activeMaxX > 0 ? activeMaxX : 0.7);
    const normZ = avgLocalZ / this.maxZ;

    // 2. DYNAMIC HYDRODYNAMIC STEERING & SAFE ROLL TILT (Pure lateral drift + roll tilt, NO diagonal yaw serong)
    let activeLateralSpeed = 0;
    const targetRoll = THREE.MathUtils.clamp(-normX * 0.22, -0.22, 0.22); 

    if (Math.abs(normX) > 0.18) {
      const activeX = (normX - Math.sign(normX) * 0.18) / 0.82;
      activeLateralSpeed = activeX * 16.0;
    }

    const steerDamp = 1.0 - Math.exp(-4.5 * delta);
    this.turnSpeed += (activeLateralSpeed - this.turnSpeed) * steerDamp;
    this.heading = 0; // Lock heading straight forward down channel (tanpa serong!)

    // 3. BASE CRUISING SPEED, ACCELERATION & REVERSE DYNAMICS (With Collision Impact Stun Penalty)
    const baseCruisingSpeed = 3.6; // ~13 km/h
    const factor = Math.abs(normZ);

    let activeMaxSpeed = this.maxSpeed;
    let activeAcceleration = this.acceleration;
    let activeCruisingSpeed = baseCruisingSpeed;

    if (this.collisionSlowTimer > 0) {
      this.collisionSlowTimer -= delta;
      // Slight acceleration dampening after impact without hard stopping
      activeAcceleration = this.acceleration * 0.6;
    }

    if (normZ > 0.15) {
      // Standing on back of deck (Holding Backward / S key / Joystick Down)
      const factor = (normZ - 0.15) / 0.85;
      if (this.speed > 0) {
        // Step 1: Brake forward speed down to 0
        this.speed -= this.brakingRate * factor * delta;
        if (this.speed < 0) this.speed = 0;
      } else {
        // Step 2: Once speed reaches 0, holding position accelerates boat in REVERSE!
        this.speed -= activeAcceleration * 0.45 * factor * delta;
      }
    } else if (normZ < -0.15) {
      // Standing on front of deck (Holding Forward / W key / Joystick Up)
      const factor = (-normZ - 0.15) / 0.85;
      if (this.speed < 0) {
        // Step 1: Brake reverse speed back to 0
        this.speed += this.brakingRate * 1.5 * factor * delta;
        if (this.speed > 0) this.speed = 0;
      } else {
        // Step 2: Smooth actual physical acceleration (gradual speed ramp-up over 2.5s to top speed)
        this.speed += activeAcceleration * 0.45 * factor * delta;
      }
    } else {
      // Neutral deck position: return reverse speed to 0, or cruising speed if moving forward
      if (this.speed < 0) {
        this.speed += 6.0 * delta;
        if (this.speed > 0) this.speed = 0;
      } else {
        this.speed += (activeCruisingSpeed - this.speed) * delta * 1.2;
      }
    }

    this.speed = THREE.MathUtils.clamp(this.speed, -this.maxReverseSpeed, activeMaxSpeed);

    // 4. WAVE BUOYANCY & TILT INTERACTION
    let waveY = 0;
    let wavePitch = 0;
    if (this.waterSystem) {
      waveY = this.waterSystem.getWaveHeight(this.worldPosition.x, this.worldPosition.z);
      const frontWave = this.waterSystem.getWaveHeight(this.worldPosition.x, this.worldPosition.z - 1.5);
      const backWave = this.waterSystem.getWaveHeight(this.worldPosition.x, this.worldPosition.z + 1.5);
      wavePitch = (frontWave - backWave) * 0.35;
    }

    // Pure level pitch (no forward/backward leaning / doyong), retaining left/right roll tilt (miring kanan kiri)
    const targetPitch = 0;
    const tiltDamp = 1.0 - Math.exp(-6.0 * delta);
    this.pitch += (targetPitch - this.pitch) * tiltDamp;
    this.roll += (targetRoll - this.roll) * tiltDamp;

    // 5. WORLD POSITION UPDATE (Straight forward along Z, smooth lateral drift along X)
    this.worldPosition.x += this.turnSpeed * delta;
    this.worldPosition.z -= this.speed * delta;
    this.worldPosition.y = waveY * 0.8;

    this.worldPosition.x = THREE.MathUtils.clamp(this.worldPosition.x, -this.safeChannelLimit, this.safeChannelLimit);

    // 6. AUTO-UNSTUCK SYSTEM (5 seconds stuck -> auto-respawn 22m forward in clear open water)
    const isTryingToMove = (Math.abs(normZ) > 0.1 || Math.abs(normX) > 0.1 || Math.abs(this.speed) > 0.1);
    const speedKmH = Math.abs(this.speed * 3.6);
    const isNearBank = Math.abs(this.worldPosition.x) >= (this.safeChannelLimit - 1.2);
    const isStuckCondition = isTryingToMove && (speedKmH < 3.5 || isNearBank || this.collisionSlowTimer > 0);

    if (isStuckCondition) {
      this.stuckTimer += delta;
      if (this.stuckTimer >= 5.0) {
        this.stuckTimer = 0;
        
        // Teleport boat 22 meters FORWARD along the channel into clear open water at center (X = 0)
        this.worldPosition.x = 0.0;
        this.worldPosition.z -= 22.0; // Advance forward past stuck obstacle
        this.turnSpeed = 0.0;
        this.speed = 12.0; // Give smooth forward cruising boost (~43 km/h)
        this.invulnerableTimer = 2.5; // Invulnerable for 2.5s
        this.collisionSlowTimer = 0;

        // Immediately sync boat 3D mesh position
        this.boat.mesh.position.copy(this.worldPosition);

        if (window.gameInstance && window.gameInstance.showNotification) {
          window.gameInstance.showNotification('Perahu dipindahkan ke jalur aman');
        }
      }
    } else {
      this.stuckTimer = 0;
    }

    // 7. THREE.JS MESH UPDATES (Strictly 0 pitch, 0 heading yaw serong, ONLY left/right roll tilt)
    this.heading = 0;
    this.pitch = 0;
    this.boat.mesh.position.copy(this.worldPosition);
    this.boat.mesh.rotation.set(0, 0, this.roll, 'YXZ');

    // Humanoid is child of boat: set local position flush on deck floor (deckY)
    this.humanoid.mesh.position.set(this.playerLocalPos.x, this.boat.deckY || 0.12, this.playerLocalPos.y);
    this.humanoid.updateAnimation(this.speed, this.playerLocalPos, this.targetPlayerLocalPos, delta);

    // Update Splash & Wake Particles + Wood Impact Dust + White Blink + Lantern Sway Physics & Water Lighting Sync
    this.boat.updateSplash(this.speed, this.turnSpeed, delta);
    if (this.boat.updateImpactDust) this.boat.updateImpactDust(delta);
    if (this.boat.updateBlink) this.boat.updateBlink(delta);
    this.boat.updateLanternPhysics(delta, this.speed, this.turnSpeed, this.roll, 0, this.waterSystem ? this.waterSystem.material : null);
  }

  // 3D Mesh Contour Shore Collision Check
  check3DHullShoreCollision(chunkManager) {
    if (chunkManager && chunkManager.getOuterLimitAtZ) {
      this.safeChannelLimit = chunkManager.getOuterLimitAtZ(this.worldPosition.z);
    }
    if (!this.boat.isLoaded) return chunkManager.checkBankCollision(this.worldPosition.x, this.worldPosition.z);

    // Sample 5 key contour points on the 3D boat GLTF mesh (Bow tip, Bow-Port, Bow-Starboard, Stern-Port, Stern-Starboard)
    const halfLength = this.boat.length / 2;
    const bowWidth = this.boat.getHullHalfWidthAtZ(-halfLength * 0.9);
    const midWidth = this.boat.getHullHalfWidthAtZ(0);
    const sternWidth = this.boat.getHullHalfWidthAtZ(halfLength * 0.9);

    const localHullPoints = [
      new THREE.Vector3(0, 0, -halfLength),           // Pointed Bow tip
      new THREE.Vector3(-bowWidth, 0, -halfLength * 0.7), // Bow Port
      new THREE.Vector3(bowWidth, 0, -halfLength * 0.7),  // Bow Starboard
      new THREE.Vector3(-midWidth, 0, 0),                 // Midship Port
      new THREE.Vector3(midWidth, 0, 0),                  // Midship Starboard
      new THREE.Vector3(-sternWidth, 0, halfLength * 0.85),// Stern Port
      new THREE.Vector3(sternWidth, 0, halfLength * 0.85) // Stern Starboard
    ];

    const rotMatrix = new THREE.Euler(0, 0, this.roll, 'YXZ');

    for (const localPt of localHullPoints) {
      const worldPt = localPt.clone().applyEuler(rotMatrix).add(this.worldPosition);
      const collision = chunkManager.checkBankCollision(worldPt.x, worldPt.z);
      if (collision.collided) {
        return collision; // Return true collision based on 3D mesh contour!
      }
    }

    return { collided: false, bounceDir: 0 };
  }

  handleCollision(bounceDirection, penetration = 0.5) {
    const isInitialHit = (this.invulnerableTimer <= 0);
    const speedKmH = Math.abs(this.speed) * 3.6;
    let didDamage = false;

    if (isInitialHit) {
      this.invulnerableTimer = 0.6;
      // 0 Damage if speed is under 50 km/h for all objects
      if (speedKmH >= 50.0) {
        this.health = Math.max(0, this.health - 2);
        didDamage = true;
      }
    }

    // Trigger wood dust & splinter explosion at collision impact point
    const impactX = this.worldPosition.x - bounceDirection * 1.6;
    const impactZ = this.worldPosition.z;
    this.lastImpactPos = { x: impactX, y: 0.8, z: impactZ };

    if (this.boat && this.boat.triggerImpactDust) {
      this.boat.triggerImpactDust(impactX, 0.4, impactZ, bounceDirection, 0);
    }

    // Smooth physical separation force (bounce off smoothly towards open water)
    const pushAmount = Math.max(0.35, (penetration || 0.4) * 0.6);
    this.worldPosition.x += bounceDirection * pushAmount;
    this.worldPosition.x = THREE.MathUtils.clamp(
      this.worldPosition.x,
      -this.safeChannelLimit + 0.2,
      this.safeChannelLimit - 0.2
    );

    // Apply lateral turn speed impulse away from shore/wall without turning heading serong
    this.turnSpeed = bounceDirection * 5.0;
    this.heading = 0;

    // Maintain momentum (~75% forward speed at high speed)
    const retainFactor = Math.abs(this.speed) > 5.0 ? 0.75 : 0.50;
    this.speed = this.speed * retainFactor;
    this.collisionSlowTimer = 0.5;

    // Smooth visual roll banking response upon impact
    this.roll = THREE.MathUtils.lerp(this.roll, -bounceDirection * 0.25, 0.4);

    return didDamage ? { hit: true, impactPos: this.lastImpactPos } : false;
  }

  getBoatState() {
    return {
      x: this.worldPosition.x,
      y: this.worldPosition.y,
      z: this.worldPosition.z,
      speed: this.speed,
      heading: this.heading,
      turnSpeed: this.turnSpeed,
      roll: this.roll,
      pitch: this.pitch,
      health: this.health
    };
  }

  applyRemoteBoatState(data, delta = 0.016) {
    if (!data) return;
    const lerpRate = Math.min(1.0, 15.0 * delta);
    if (data.x !== undefined) this.worldPosition.x = THREE.MathUtils.lerp(this.worldPosition.x, data.x, lerpRate);
    if (data.y !== undefined) this.worldPosition.y = THREE.MathUtils.lerp(this.worldPosition.y, data.y, lerpRate);
    if (data.z !== undefined) this.worldPosition.z = THREE.MathUtils.lerp(this.worldPosition.z, data.z, lerpRate);
    if (data.speed !== undefined) this.speed = THREE.MathUtils.lerp(this.speed, data.speed, lerpRate);
    if (data.heading !== undefined) this.heading = THREE.MathUtils.lerp(this.heading, data.heading, lerpRate);
    if (data.turnSpeed !== undefined) this.turnSpeed = THREE.MathUtils.lerp(this.turnSpeed, data.turnSpeed, lerpRate);
    if (data.roll !== undefined) this.roll = THREE.MathUtils.lerp(this.roll, data.roll, lerpRate);
    if (data.pitch !== undefined) this.pitch = THREE.MathUtils.lerp(this.pitch, data.pitch, lerpRate);
    if (data.health !== undefined) this.health = data.health;
  }

  getStatusText() {
    const normX = this.playerLocalPos.x / 0.7;
    const normZ = this.playerLocalPos.y / 1.35;

    if (normZ > 0.4) {
      return this.speed < -0.2 ? "⏪ Mundur (Tumpuan Belakang)" : "⏹️ Mengerem (Tumpuan Belakang)";
    }
    if (normZ < -0.4) return "🚀 Maju (Tumpuan Depan)";
    if (normX < -0.25) return "↩️ Belok Kiri";
    if (normX > 0.25) return "↪️ Belok Kanan";
    return "⚖️ Meluncur Lurus";
  }
}
