import { TerrainSegment } from './TerrainSegment.js';

export const FORK_INTERVAL = 6200;

export class ChunkManager {
  constructor(scene, waterMaterial, rockManager = null) {
    this.scene = scene;
    this.waterMaterial = waterMaterial;
    this.rockManager = rockManager;

    this.segmentLength = 80;
    this.visibleSegmentsAhead = 7;
    this.segmentsBehind = 2;
    this.channelWidth = 40;

    this.activeSegments = new Map();
    this.currentChunkIndex = 0;
  }

  setRockManager(rockManager) {
    this.rockManager = rockManager;
  }

  getForkStateAtZ(z) {
    const dist = -z;
    if (dist < 3000) {
      return { isFork: false, forkType: 'none', outerLimit: 19.2, islandHalfWidth: 0, forkZ: 0 };
    }

    const k = Math.round(dist / FORK_INTERVAL);
    if (k < 1) {
      return { isFork: false, forkType: 'none', outerLimit: 19.2, islandHalfWidth: 0, forkZ: 0 };
    }

    const forkZ = -k * FORK_INTERVAL;
    const relZ = z - forkZ; // z is negative, forkZ is negative. e.g. z=-6120, forkZ=-6200 => relZ = +80

    if (relZ > 80 || relZ < -320) {
      return { isFork: false, forkType: 'none', outerLimit: 19.2, islandHalfWidth: 0, forkZ };
    }

    if (relZ >= 0 && relZ <= 80) {
      // Approach & widening phase
      const t = (80 - relZ) / 80; // 0 at 80, 1 at 0
      const outerLimit = 19.2 + t * 18.8; // 19.2 -> 38.0
      const islandHalfWidth = t * 14.0;   // 0 -> 14.0
      return { isFork: true, forkType: 'approach', outerLimit, islandHalfWidth, forkZ, t };
    } else if (relZ >= -240 && relZ < 0) {
      // Main split phase
      return { isFork: true, forkType: 'split', outerLimit: 38.0, islandHalfWidth: 14.0, forkZ, t: 1.0 };
    } else {
      // Exit & narrowing phase (-320 <= relZ < -240)
      const t = (-240 - relZ) / 80; // 0 at -240, 1 at -320
      const outerLimit = 38.0 - t * 18.8; // 38.0 -> 19.2
      const islandHalfWidth = (1.0 - t) * 14.0; // 14.0 -> 0
      return { isFork: true, forkType: 'exit', outerLimit, islandHalfWidth, forkZ, t };
    }
  }

  getOuterLimitAtZ(z) {
    return this.getForkStateAtZ(z).outerLimit;
  }

  update(playerZ, delta = 0.016) {
    // Hide/despawn terrain chunks strictly when 300m behind player for lightweight performance
    const maxBehindDistance = 300;
    const playerSegmentIndex = Math.floor(-playerZ / this.segmentLength);

    const minIndex = Math.floor((-playerZ - maxBehindDistance) / this.segmentLength);
    const maxIndex = playerSegmentIndex + this.visibleSegmentsAhead;

    // 1. Spawn new chunks ahead
    for (let idx = minIndex; idx <= maxIndex; idx++) {
      if (!this.activeSegments.has(idx)) {
        const zPos = -idx * this.segmentLength;
        const forkState = this.getForkStateAtZ(zPos);

        const segment = new TerrainSegment(
          this.scene,
          this.waterMaterial,
          zPos,
          this.segmentLength,
          70,
          this.channelWidth,
          forkState
        );
        this.activeSegments.set(idx, segment);

        if (this.rockManager) {
          this.rockManager.onSegmentCreated(idx, zPos, this.segmentLength);
        }
      }
    }

    // 2. Update active segments (smooth fade-in transition)
    for (const segment of this.activeSegments.values()) {
      if (segment.update) {
        segment.update(delta);
      }
    }

    // 3. Despawn old chunks behind (strictly > 300m behind)
    for (const [idx, segment] of this.activeSegments.entries()) {
      if (idx < minIndex || idx > maxIndex) {
        segment.destroy();
        this.activeSegments.delete(idx);

        if (this.rockManager) {
          this.rockManager.onSegmentDestroyed(idx);
        }
      }
    }
  }

  checkBankCollision(playerX, playerZ = 0) {
    const forkState = this.getForkStateAtZ(playerZ);
    const outerLimit = forkState.outerLimit;

    if (playerX < -outerLimit) {
      return { collided: true, bounceDir: 1, penetration: -outerLimit - playerX };
    }
    if (playerX > outerLimit) {
      return { collided: true, bounceDir: -1, penetration: playerX - outerLimit };
    }

    // Check central island cliff collision
    if (forkState.islandHalfWidth > 0.5) {
      const halfW = forkState.islandHalfWidth;
      if (playerX >= -halfW && playerX <= halfW) {
        const bounceDir = (playerX < 0) ? -1 : 1;
        const penetration = (playerX < 0) ? (playerX - (-halfW)) : (halfW - playerX);
        return { collided: true, bounceDir, penetration: Math.max(0.4, penetration) };
      }
    }

    return { collided: false, bounceDir: 0, penetration: 0 };
  }
}

