import * as THREE from 'three';

// Static Shared Geometries Pool
const sharedGeometries = {
  lakebed: new THREE.PlaneGeometry(76, 80, 2, 2),
  water: new THREE.PlaneGeometry(48, 80, 12, 12),
  forkLakebed: new THREE.PlaneGeometry(120, 80, 2, 2),
  forkWater: new THREE.PlaneGeometry(96, 80, 16, 16),
  cliffUnit: new THREE.IcosahedronGeometry(1.0, 1),
  rockUnit: new THREE.DodecahedronGeometry(1.0, 1),
  trunkUnit: new THREE.CylinderGeometry(0.35, 0.55, 3.5, 5),
  coneUnit1: new THREE.ConeGeometry(2.5, 3.8, 5),
  coneUnit2: new THREE.ConeGeometry(1.9, 3.2, 5),
  coneUnit3: new THREE.ConeGeometry(1.3, 2.6, 5),
  beaconUnit: new THREE.CylinderGeometry(0.7, 1.1, 6.5, 6)
};

// Static Base Materials (Pre-configured as transparent for 0-recompile WebGL opacity fade-in)
const baseMaterials = {
  lakebed: new THREE.MeshStandardMaterial({
    color: 0x081320,
    roughness: 0.95,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  grass: new THREE.MeshStandardMaterial({
    color: 0x388e3c,
    roughness: 0.55,
    metalness: 0.08,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  rock: new THREE.MeshStandardMaterial({
    color: 0x607d8b,
    roughness: 0.48,
    metalness: 0.18,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  earth: new THREE.MeshStandardMaterial({
    color: 0x5d4037,
    roughness: 0.52,
    metalness: 0.12,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  trunk: new THREE.MeshStandardMaterial({
    color: 0x3e2723,
    roughness: 0.85,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  pine1: new THREE.MeshStandardMaterial({
    color: 0x1b5e20,
    roughness: 0.60,
    metalness: 0.05,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  pine2: new THREE.MeshStandardMaterial({
    color: 0x2e7d32,
    roughness: 0.60,
    metalness: 0.05,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  beaconMat: new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xff5500,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  })
};

export class TerrainSegment {
  constructor(scene, waterMaterial, zOffset, length = 80, width = 70, channelWidth = 40, forkState = null) {
    this.scene = scene;
    this.waterMaterial = waterMaterial;
    this.zOffset = zOffset;
    this.length = length;
    this.width = width;
    this.channelWidth = channelWidth;
    this.forkState = forkState;

    // Segment instance materials starting at 0.0 opacity for smooth fade-in
    this.materials = {
      lakebed: baseMaterials.lakebed.clone(),
      grass: baseMaterials.grass.clone(),
      rock: baseMaterials.rock.clone(),
      earth: baseMaterials.earth.clone(),
      trunk: baseMaterials.trunk.clone(),
      pine1: baseMaterials.pine1.clone(),
      pine2: baseMaterials.pine2.clone(),
      beaconMat: baseMaterials.beaconMat.clone()
    };

    this.opacity = 0.0;
    for (const mat of Object.values(this.materials)) {
      mat.opacity = 0.0;
    }

    this.group = new THREE.Group();
    this.group.position.set(0, 0, zOffset);

    this.buildSegment();
  }

  update(delta = 0.016) {
    if (this.opacity < 1.0) {
      this.opacity += delta * 1.8; // Smooth 0.55s visual opacity fade-in
      if (this.opacity >= 1.0) {
        this.opacity = 1.0;
      }
      for (const mat of Object.values(this.materials)) {
        mat.opacity = this.opacity;
      }
    }
  }

  buildSegment() {
    const isFork = this.forkState && this.forkState.isFork;
    const outerLimit = isFork ? this.forkState.outerLimit : 19.2;
    const effectiveChannelWidth = outerLimit * 2;

    // 1. Solid Underwater Lakebed Floor
    const lakebedGeom = isFork ? sharedGeometries.forkLakebed : sharedGeometries.lakebed;
    const lakebedMesh = new THREE.Mesh(lakebedGeom, this.materials.lakebed);
    lakebedMesh.rotation.x = -Math.PI / 2;
    lakebedMesh.position.y = -1.8;
    this.group.add(lakebedMesh);

    // 1b. Water Surface Plane
    const waterGeom = isFork ? sharedGeometries.forkWater : sharedGeometries.water;
    const waterMesh = new THREE.Mesh(waterGeom, this.waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 0;
    waterMesh.receiveShadow = true;
    this.group.add(waterMesh);

    // 2. Stylized Low-Poly Mountainous Outer Cliff Banks
    const cliffBouldersCount = 6;

    for (let i = 0; i < cliffBouldersCount; i++) {
      const zPos = -this.length / 2 + (i / (cliffBouldersCount - 1)) * this.length + (Math.random() - 0.5) * 6;

      // --- LEFT BANK ---
      const isToweringLeft = Math.random() < 0.40;
      const baseRadiusLeft = isToweringLeft ? (14.0 + Math.random() * 8.0) : (7.5 + Math.random() * 5.0);
      const leftCliff = new THREE.Mesh(sharedGeometries.cliffUnit, (i % 2 === 0 ? this.materials.grass : this.materials.rock));

      const scaleYLeft = isToweringLeft ? (1.8 + Math.random() * 1.6) : (0.95 + Math.random() * 0.7);
      const scaleXZLeft = 0.9 + Math.random() * 0.4;
      leftCliff.scale.set(baseRadiusLeft * scaleXZLeft, baseRadiusLeft * scaleYLeft, baseRadiusLeft * scaleXZLeft);

      const effRadLeft = baseRadiusLeft * scaleXZLeft;
      const leftX = -(effectiveChannelWidth / 2 + effRadLeft + 1.0 + Math.random() * 2.0);
      const posYLeft = isToweringLeft ? (baseRadiusLeft * scaleYLeft * 0.38) : (2.0 + Math.random() * 2.5);
      leftCliff.position.set(leftX, posYLeft, zPos);
      leftCliff.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
      leftCliff.receiveShadow = true;
      if (!isToweringLeft) leftCliff.castShadow = true;
      this.group.add(leftCliff);

      // --- RIGHT BANK ---
      const isToweringRight = Math.random() < 0.40;
      const baseRadiusRight = isToweringRight ? (14.0 + Math.random() * 8.0) : (7.5 + Math.random() * 5.0);
      const rightCliff = new THREE.Mesh(sharedGeometries.cliffUnit, (i % 2 === 1 ? this.materials.grass : this.materials.earth));

      const scaleYRight = isToweringRight ? (1.8 + Math.random() * 1.6) : (0.95 + Math.random() * 0.7);
      const scaleXZRight = 0.9 + Math.random() * 0.4;
      rightCliff.scale.set(baseRadiusRight * scaleXZRight, baseRadiusRight * scaleYRight, baseRadiusRight * scaleXZRight);

      const effRadRight = baseRadiusRight * scaleXZRight;
      const rightX = (effectiveChannelWidth / 2 + effRadRight + 1.0 + Math.random() * 2.0);
      const posYRight = isToweringRight ? (baseRadiusRight * scaleYRight * 0.38) : (2.0 + Math.random() * 2.5);
      rightCliff.position.set(rightX, posYRight, zPos);
      rightCliff.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
      rightCliff.receiveShadow = true;
      if (!isToweringRight) rightCliff.castShadow = true;
      this.group.add(rightCliff);
    }

    // 2b. Layered Background Mountain Silhouettes (Far Out Peaks)
    const bgPeakCount = 2;
    for (let i = 0; i < bgPeakCount; i++) {
      const zPos = -this.length / 2 + (i / (bgPeakCount - 1)) * this.length + (Math.random() - 0.5) * 12;

      // Far Background Left Peak
      const bgRadL = 18.0 + Math.random() * 12.0;
      const bgPeakL = new THREE.Mesh(sharedGeometries.cliffUnit, this.materials.rock);
      bgPeakL.scale.set(bgRadL * 1.2, bgRadL * (1.8 + Math.random() * 1.6), bgRadL * 1.2);
      bgPeakL.position.set(-(effectiveChannelWidth / 2 + 30 + Math.random() * 16), bgRadL * 0.9, zPos);
      bgPeakL.rotation.set(0.2, Math.random() * Math.PI, 0.2);
      this.group.add(bgPeakL);

      // Far Background Right Peak
      const bgRadR = 18.0 + Math.random() * 12.0;
      const bgPeakR = new THREE.Mesh(sharedGeometries.cliffUnit, this.materials.rock);
      bgPeakR.scale.set(bgRadR * 1.2, bgRadR * (1.8 + Math.random() * 1.6), bgRadR * 1.2);
      bgPeakR.position.set((effectiveChannelWidth / 2 + 30 + Math.random() * 16), bgRadR * 0.9, zPos);
      bgPeakR.rotation.set(0.2, Math.random() * Math.PI, 0.2);
      this.group.add(bgPeakR);
    }

    // 3. Low-Poly Shoreline Rocks (Pushed outward to keep river channel wide and navigable)
    const rockCount = 4;
    for (let i = 0; i < rockCount; i++) {
      const isLeft = Math.random() > 0.5;
      const rockSize = 1.4 + Math.random() * 2.2;
      const rock = new THREE.Mesh(sharedGeometries.rockUnit, this.materials.rock);
      rock.scale.set(rockSize, rockSize, rockSize);
      
      const rockX = isLeft ? -(effectiveChannelWidth / 2 + 4.5) : (effectiveChannelWidth / 2 + 4.5);
      const zPos = (Math.random() - 0.5) * (this.length * 0.9);
      
      rock.position.set(rockX, 0.6, zPos);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
    }

    // 4. DRAMATIC CENTRAL CLIFF ISLAND (FORK INTERSECTION)
    if (isFork && this.forkState.islandHalfWidth > 0.5) {
      this.buildCentralCliffIsland(this.forkState.islandHalfWidth);
    }

    this.scene.add(this.group);
  }

  buildCentralCliffIsland(halfW) {
    const boulderCount = 8;
    for (let i = 0; i < boulderCount; i++) {
      const zPos = -this.length / 2 + (i / (boulderCount - 1)) * this.length + (Math.random() - 0.5) * 4;
      
      // Central mountain rock unit
      const isTowering = Math.random() < 0.65;
      const baseRad = isTowering ? (halfW * 0.85 + Math.random() * 3.0) : (halfW * 0.60 + Math.random() * 2.0);
      const mat = (i % 3 === 0) ? this.materials.grass : ((i % 3 === 1) ? this.materials.rock : this.materials.earth);
      
      const centerCliff = new THREE.Mesh(sharedGeometries.cliffUnit, mat);
      const scaleY = isTowering ? (2.2 + Math.random() * 1.8) : (1.2 + Math.random() * 0.8);
      const scaleXZ = 0.95 + Math.random() * 0.35;
      centerCliff.scale.set(baseRad * scaleXZ, baseRad * scaleY, baseRad * scaleXZ);

      const xPos = (Math.random() - 0.5) * (halfW * 0.4);
      const posY = isTowering ? (baseRad * scaleY * 0.40) : (2.5 + Math.random() * 3.0);

      centerCliff.position.set(xPos, posY, zPos);
      centerCliff.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
      centerCliff.castShadow = true;
      centerCliff.receiveShadow = true;
      this.group.add(centerCliff);

      // Shoreline jagged rocks at base of central island
      const sideRock = new THREE.Mesh(sharedGeometries.rockUnit, this.materials.rock);
      const rockSize = 1.8 + Math.random() * 2.2;
      sideRock.scale.set(rockSize, rockSize, rockSize);
      const sideX = (i % 2 === 0 ? -1 : 1) * (halfW * 0.85 + Math.random() * 1.2);
      sideRock.position.set(sideX, 0.7, zPos);
      sideRock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      sideRock.castShadow = true;
      this.group.add(sideRock);
    }

    // Glowing Stone Beacon Pillars marking Left/Right channels at fork entry
    if (this.forkState.forkType === 'approach' && this.forkState.t > 0.6) {
      const beaconL = new THREE.Mesh(sharedGeometries.beaconUnit, this.materials.beaconMat);
      beaconL.position.set(-halfW - 2.5, 3.2, 0);
      beaconL.rotation.set(0.1, 0.2, -0.15);
      this.group.add(beaconL);

      const beaconR = new THREE.Mesh(sharedGeometries.beaconUnit, this.materials.beaconMat);
      beaconR.position.set(halfW + 2.5, 3.2, 0);
      beaconR.rotation.set(0.1, -0.2, 0.15);
      this.group.add(beaconR);
    }
  }

  destroy() {
    this.scene.remove(this.group);
    if (this.materials) {
      for (const mat of Object.values(this.materials)) {
        mat.dispose();
      }
    }
  }
}

