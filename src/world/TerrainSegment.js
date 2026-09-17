import * as THREE from 'three';

// Static Shared Geometries Pool
const sharedGeometries = {
  lakebed: new THREE.PlaneGeometry(76, 80, 2, 2),
  water: new THREE.PlaneGeometry(48, 80, 12, 12),
  cliffUnit: new THREE.IcosahedronGeometry(1.0, 1),
  rockUnit: new THREE.DodecahedronGeometry(1.0, 1),
  trunkUnit: new THREE.CylinderGeometry(0.35, 0.55, 3.5, 5),
  coneUnit1: new THREE.ConeGeometry(2.5, 3.8, 5),
  coneUnit2: new THREE.ConeGeometry(1.9, 3.2, 5),
  coneUnit3: new THREE.ConeGeometry(1.3, 2.6, 5)
};

// Static Base Materials
const baseMaterials = {
  lakebed: new THREE.MeshStandardMaterial({
    color: 0x081320,
    roughness: 0.95,
    flatShading: true
  }),
  grass: new THREE.MeshStandardMaterial({
    color: 0x388e3c,
    roughness: 0.55,
    metalness: 0.08,
    flatShading: true
  }),
  rock: new THREE.MeshStandardMaterial({
    color: 0x607d8b,
    roughness: 0.48,
    metalness: 0.18,
    flatShading: true
  }),
  earth: new THREE.MeshStandardMaterial({
    color: 0x5d4037,
    roughness: 0.52,
    metalness: 0.12,
    flatShading: true
  }),
  trunk: new THREE.MeshStandardMaterial({
    color: 0x3e2723,
    roughness: 0.85,
    flatShading: true
  }),
  pine1: new THREE.MeshStandardMaterial({
    color: 0x1b5e20,
    roughness: 0.60,
    metalness: 0.05,
    flatShading: true
  }),
  pine2: new THREE.MeshStandardMaterial({
    color: 0x2e7d32,
    roughness: 0.60,
    metalness: 0.05,
    flatShading: true
  })
};

export class TerrainSegment {
  constructor(scene, waterMaterial, zOffset, length = 80, width = 70, channelWidth = 40) {
    this.scene = scene;
    this.waterMaterial = waterMaterial;
    this.zOffset = zOffset;
    this.length = length;
    this.width = width;
    this.channelWidth = channelWidth;

    // Segment-level material cloning for independent opacity fade-in
    this.materials = {
      lakebed: baseMaterials.lakebed.clone(),
      grass: baseMaterials.grass.clone(),
      rock: baseMaterials.rock.clone(),
      earth: baseMaterials.earth.clone(),
      trunk: baseMaterials.trunk.clone(),
      pine1: baseMaterials.pine1.clone(),
      pine2: baseMaterials.pine2.clone()
    };

    // Smooth Fade-In State
    this.opacity = 0.0;
    this.isFadingIn = true;
    for (const mat of Object.values(this.materials)) {
      mat.transparent = true;
      mat.opacity = 0.0;
    }

    this.group = new THREE.Group();
    this.group.position.z = zOffset;

    this.buildSegment();
  }

  update(delta = 0.016) {
    if (this.isFadingIn) {
      this.opacity += delta * 1.4; // Fades in smoothly over ~0.7 seconds
      if (this.opacity >= 1.0) {
        this.opacity = 1.0;
        this.isFadingIn = false;
      }

      for (const mat of Object.values(this.materials)) {
        mat.opacity = this.opacity;
        if (!this.isFadingIn) {
          mat.transparent = false; // Disable transparency when fully opaque for max rendering speed
        }
      }
    }
  }

  buildSegment() {
    // 1. Solid Underwater Lakebed Floor
    const lakebedMesh = new THREE.Mesh(sharedGeometries.lakebed, this.materials.lakebed);
    lakebedMesh.rotation.x = -Math.PI / 2;
    lakebedMesh.position.y = -1.8;
    this.group.add(lakebedMesh);

    // 1b. Water Surface Plane
    const waterMesh = new THREE.Mesh(sharedGeometries.water, this.waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 0;
    waterMesh.receiveShadow = true;
    this.group.add(waterMesh);

    // 2. Stylized Low-Poly Mountainous Cliffs
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
      const leftX = -(this.channelWidth / 2 + effRadLeft + 1.0 + Math.random() * 2.0);
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
      const rightX = (this.channelWidth / 2 + effRadRight + 1.0 + Math.random() * 2.0);
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
      bgPeakL.position.set(-(this.channelWidth / 2 + 30 + Math.random() * 16), bgRadL * 0.9, zPos);
      bgPeakL.rotation.set(0.2, Math.random() * Math.PI, 0.2);
      this.group.add(bgPeakL);

      // Far Background Right Peak
      const bgRadR = 18.0 + Math.random() * 12.0;
      const bgPeakR = new THREE.Mesh(sharedGeometries.cliffUnit, this.materials.rock);
      bgPeakR.scale.set(bgRadR * 1.2, bgRadR * (1.8 + Math.random() * 1.6), bgRadR * 1.2);
      bgPeakR.position.set((this.channelWidth / 2 + 30 + Math.random() * 16), bgRadR * 0.9, zPos);
      bgPeakR.rotation.set(0.2, Math.random() * Math.PI, 0.2);
      this.group.add(bgPeakR);
    }

    // 3. Low-Poly Shoreline Rocks
    const rockCount = 4;
    for (let i = 0; i < rockCount; i++) {
      const isLeft = Math.random() > 0.5;
      const rockSize = 1.4 + Math.random() * 2.2;
      const rock = new THREE.Mesh(sharedGeometries.rockUnit, this.materials.rock);
      rock.scale.set(rockSize, rockSize, rockSize);
      
      const rockX = isLeft ? -(this.channelWidth / 2 + 1.2) : (this.channelWidth / 2 + 1.2);
      const zPos = (Math.random() - 0.5) * (this.length * 0.9);
      
      rock.position.set(rockX, 0.6, zPos);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
    }

    // 4. Low-Poly Pine Trees
    const treeCount = 5;
    for (let i = 0; i < treeCount; i++) {
      const isLeft = Math.random() > 0.5;
      const xSide = isLeft ? -(this.channelWidth / 2 + 6 + Math.random() * 9) : (this.channelWidth / 2 + 6 + Math.random() * 9);
      const zPos = (Math.random() - 0.5) * (this.length * 0.9);

      const treeGroup = new THREE.Group();

      // Trunk
      const trunk = new THREE.Mesh(sharedGeometries.trunkUnit, this.materials.trunk);
      trunk.position.y = 1.75;
      treeGroup.add(trunk);

      // Cones
      const pineMat = Math.random() > 0.5 ? this.materials.pine1 : this.materials.pine2;
      const tier1 = new THREE.Mesh(sharedGeometries.coneUnit1, pineMat);
      tier1.position.y = 4.2;
      treeGroup.add(tier1);

      const tier2 = new THREE.Mesh(sharedGeometries.coneUnit2, pineMat);
      tier2.position.y = 6.0;
      treeGroup.add(tier2);

      const tier3 = new THREE.Mesh(sharedGeometries.coneUnit3, pineMat);
      tier3.position.y = 7.6;
      treeGroup.add(tier3);

      const scaleVar = 0.8 + Math.random() * 0.45;
      treeGroup.scale.set(scaleVar, scaleVar, scaleVar);
      treeGroup.rotation.y = Math.random() * Math.PI * 2;
      
      const distFromBank = Math.abs(xSide) - (this.channelWidth / 2);
      const treeY = 1.2 + distFromBank * 0.45 + Math.random() * 1.5;
      treeGroup.position.set(xSide, treeY, zPos);

      this.group.add(treeGroup);
    }

    this.scene.add(this.group);
  }

  destroy() {
    this.scene.remove(this.group);
    for (const mat of Object.values(this.materials)) {
      mat.dispose();
    }
  }
}
