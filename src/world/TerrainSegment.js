import * as THREE from 'three';

// Static Shared Geometries Pool for Reference-Matched Stepped Faceted Rock Architecture
const sharedGeometries = {
  lakebed: new THREE.PlaneGeometry(76, 80, 2, 2),
  water: new THREE.PlaneGeometry(48, 80, 12, 12),
  forkLakebed: new THREE.PlaneGeometry(120, 80, 2, 2),
  forkWater: new THREE.PlaneGeometry(96, 80, 16, 16),
  pillarGeo: new THREE.CylinderGeometry(0.80, 1.15, 1.0, 6),     // 6-sided tapered vertical rock column
  pillarCapGeo: new THREE.CylinderGeometry(0.78, 0.82, 0.12, 6), // 6-sided top plateau cap
  rockUnit: new THREE.DodecahedronGeometry(1.0, 1),
  trunkUnit: new THREE.CylinderGeometry(0.35, 0.55, 3.5, 5),
  coneUnit1: new THREE.ConeGeometry(2.5, 3.8, 5),
  coneUnit2: new THREE.ConeGeometry(1.9, 3.2, 5),
  coneUnit3: new THREE.ConeGeometry(1.3, 2.6, 5)
};

// Static Base Materials matching exact reference color palette & lighting
const baseMaterials = {
  lakebed: new THREE.MeshStandardMaterial({
    color: 0x081320,
    roughness: 0.95,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  grass: new THREE.MeshStandardMaterial({
    color: 0x4d7c0f, // Deep rich low-poly plateau grass green (top cap ONLY)
    roughness: 0.80,
    metalness: 0.0,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  rock: new THREE.MeshStandardMaterial({
    color: 0x475569, // Rich deep slate granite rock body (darker, not washed-out white)
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  earth: new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Deep dark slate collar at waterline
    roughness: 0.90,
    metalness: 0.0,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  topRim: new THREE.MeshStandardMaterial({
    color: 0x64748b, // Darker stone top edge rim (subtle tone, not bright white)
    roughness: 0.75,
    metalness: 0.0,
    flatShading: true,
    transparent: true,
    opacity: 1.0
  }),
  trunk: new THREE.MeshStandardMaterial({
    color: 0x2e3b4e,
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
      topRim: baseMaterials.topRim.clone(),
      trunk: baseMaterials.trunk.clone(),
      pine1: baseMaterials.pine1.clone(),
      pine2: baseMaterials.pine2.clone()
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

  buildCliffWallBlock(x, posY, zPos, baseRadX, heightY, baseRadZ, isTowering) {
    const blockGroup = new THREE.Group();
    blockGroup.position.set(x, posY, zPos);

    const dir = x > 0 ? -1 : 1; // Facing direction towards river channel

    // 4 Stepped 6-sided vertical pillars matching reference image
    const pillars = [
      { xOff: 0.0,                  zOff: 0.0,                 hRatio: 1.00, rRatio: 1.00, rotY: 0.18, tiltZ: -0.06 * dir },
      { xOff: dir * baseRadX * 0.35, zOff: -baseRadZ * 0.28,    hRatio: 0.82, rRatio: 0.85, rotY: 0.72, tiltZ: -0.08 * dir },
      { xOff: dir * baseRadX * 0.22, zOff:  baseRadZ * 0.32,    hRatio: 0.72, rRatio: 0.78, rotY: -0.42, tiltZ: -0.05 * dir },
      { xOff: dir * baseRadX * 0.52, zOff:  baseRadZ * 0.05,    hRatio: 0.52, rRatio: 0.65, rotY: 0.35, tiltZ: -0.10 * dir }
    ];

    pillars.forEach(p => {
      const pRadX = baseRadX * p.rRatio;
      const pRadZ = baseRadZ * p.rRatio;
      const pHeight = heightY * p.hRatio;
      const px = p.xOff;
      const pz = p.zOff;
      const py = -heightY * 0.5 + pHeight * 0.5;

      const pGroup = new THREE.Group();
      pGroup.position.set(px, py, pz);
      pGroup.rotation.y = p.rotY;
      pGroup.rotation.z = p.tiltZ;

      // 1. Dark Charcoal Shoreline Base Collar
      const baseH = Math.min(3.8, pHeight * 0.20);
      const baseMesh = new THREE.Mesh(sharedGeometries.pillarGeo, this.materials.earth);
      baseMesh.scale.set(pRadX * 1.06, baseH, pRadZ * 1.06);
      baseMesh.position.y = -pHeight * 0.5 + baseH * 0.5;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      pGroup.add(baseMesh);

      // 2. Main Vertical Hexagonal Rock Pillar (Slate Gray)
      const rockMesh = new THREE.Mesh(sharedGeometries.pillarGeo, this.materials.rock);
      rockMesh.scale.set(pRadX, pHeight, pRadZ);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      pGroup.add(rockMesh);

      // 3. Light Stone Top Edge Rim
      const rimMesh = new THREE.Mesh(sharedGeometries.pillarCapGeo, this.materials.topRim);
      rimMesh.scale.set(pRadX * 0.98, pHeight * 0.08, pRadZ * 0.98);
      rimMesh.position.y = pHeight * 0.47;
      rimMesh.castShadow = true;
      rimMesh.receiveShadow = true;
      pGroup.add(rimMesh);

      // 4. Flat Grass Top Plateau Cap (ONLY ON TOP SURFACES!)
      const grassMesh = new THREE.Mesh(sharedGeometries.pillarCapGeo, this.materials.grass);
      grassMesh.scale.set(pRadX * 0.92, pHeight * 0.06, pRadZ * 0.92);
      grassMesh.position.y = pHeight * 0.51;
      grassMesh.receiveShadow = true;
      pGroup.add(grassMesh);

      blockGroup.add(pGroup);
    });

    this.group.add(blockGroup);
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

    // 2. Stylized Low-Poly Stepped Hexagonal Cliff Walls
    const cliffBouldersCount = 6;

    for (let i = 0; i < cliffBouldersCount; i++) {
      const zPos = -this.length / 2 + (i / (cliffBouldersCount - 1)) * this.length + (Math.random() - 0.5) * 6;

      // --- LEFT BANK ---
      const isToweringLeft = Math.random() < 0.40;
      const baseRadiusLeft = isToweringLeft ? (14.0 + Math.random() * 8.0) : (7.5 + Math.random() * 5.0);
      const scaleYLeft = isToweringLeft ? (1.8 + Math.random() * 1.6) : (0.95 + Math.random() * 0.7);
      const scaleXZLeft = 0.9 + Math.random() * 0.4;
      const radXZLeft = baseRadiusLeft * scaleXZLeft;
      const heightYLeft = baseRadiusLeft * scaleYLeft;

      const leftX = -(effectiveChannelWidth / 2 + radXZLeft + 1.0 + Math.random() * 2.0);
      const posYLeft = heightYLeft * 0.45;
      this.buildCliffWallBlock(leftX, posYLeft, zPos, radXZLeft, heightYLeft, radXZLeft, isToweringLeft);

      // --- RIGHT BANK ---
      const isToweringRight = Math.random() < 0.40;
      const baseRadiusRight = isToweringRight ? (14.0 + Math.random() * 8.0) : (7.5 + Math.random() * 5.0);
      const scaleYRight = isToweringRight ? (1.8 + Math.random() * 1.6) : (0.95 + Math.random() * 0.7);
      const scaleXZRight = 0.9 + Math.random() * 0.4;
      const radXZRight = baseRadiusRight * scaleXZRight;
      const heightYRight = baseRadiusRight * scaleYRight;

      const rightX = (effectiveChannelWidth / 2 + radXZRight + 1.0 + Math.random() * 2.0);
      const posYRight = heightYRight * 0.45;
      this.buildCliffWallBlock(rightX, posYRight, zPos, radXZRight, heightYRight, radXZRight, isToweringRight);
    }

    // 2b. Layered Background Mountain Silhouettes (Far Out Peaks)
    const bgPeakCount = 2;
    for (let i = 0; i < bgPeakCount; i++) {
      const zPos = -this.length / 2 + (i / (bgPeakCount - 1)) * this.length + (Math.random() - 0.5) * 12;

      // Far Background Left Peak
      const bgRadL = 18.0 + Math.random() * 12.0;
      const bgPeakL = new THREE.Mesh(sharedGeometries.pillarGeo, this.materials.rock);
      bgPeakL.scale.set(bgRadL * 1.2, bgRadL * (1.8 + Math.random() * 1.6), bgRadL * 1.2);
      bgPeakL.position.set(-(effectiveChannelWidth / 2 + 30 + Math.random() * 16), bgRadL * 0.9, zPos);
      bgPeakL.rotation.set(0.2, Math.random() * Math.PI, 0.2);
      bgPeakL.castShadow = true;
      bgPeakL.receiveShadow = true;
      this.group.add(bgPeakL);

      // Far Background Right Peak
      const bgRadR = 18.0 + Math.random() * 12.0;
      const bgPeakR = new THREE.Mesh(sharedGeometries.pillarGeo, this.materials.rock);
      bgPeakR.scale.set(bgRadR * 1.2, bgRadR * (1.8 + Math.random() * 1.6), bgRadR * 1.2);
      bgPeakR.position.set((effectiveChannelWidth / 2 + 30 + Math.random() * 16), bgRadR * 0.9, zPos);
      bgPeakR.rotation.set(0.2, Math.random() * Math.PI, 0.2);
      bgPeakR.castShadow = true;
      bgPeakR.receiveShadow = true;
      this.group.add(bgPeakR);
    }

    // 3. Low-Poly Shoreline Rocks
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
    const isForkActive = this.forkState && this.forkState.isFork;
    if (isForkActive && this.forkState.islandHalfWidth > 0.5) {
      this.buildCentralCliffIsland(this.forkState.islandHalfWidth);
    }

    this.scene.add(this.group);
  }

  buildCentralCliffIsland(halfW) {
    const boulderCount = 8;
    for (let i = 0; i < boulderCount; i++) {
      const zPos = -this.length / 2 + (i / (boulderCount - 1)) * this.length + (Math.random() - 0.5) * 4;
      
      const isTowering = Math.random() < 0.65;
      const baseRad = isTowering ? (halfW * 0.85 + Math.random() * 3.0) : (halfW * 0.60 + Math.random() * 2.0);
      const scaleY = isTowering ? (2.2 + Math.random() * 1.8) : (1.2 + Math.random() * 0.8);
      const scaleXZ = 0.95 + Math.random() * 0.35;
      const radXZ = baseRad * scaleXZ;
      const heightY = baseRad * scaleY;

      const xPos = (Math.random() - 0.5) * (halfW * 0.4);
      const posY = heightY * 0.45;

      this.buildCliffWallBlock(xPos, posY, zPos, radXZ, heightY, radXZ, isTowering);

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

