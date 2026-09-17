import { TerrainSegment } from './TerrainSegment.js';

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
        const segment = new TerrainSegment(
          this.scene,
          this.waterMaterial,
          zPos,
          this.segmentLength,
          70,
          this.channelWidth
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

  checkBankCollision(playerX) {
    const safeLimit = 19.2;
    if (playerX < -safeLimit) {
      return { collided: true, bounceDir: 1, penetration: -safeLimit - playerX };
    }
    if (playerX > safeLimit) {
      return { collided: true, bounceDir: -1, penetration: playerX - safeLimit };
    }
    return { collided: false, bounceDir: 0, penetration: 0 };
  }
}
