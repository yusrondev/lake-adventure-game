import * as THREE from 'three';

export class TerrainSegment {
  constructor(scene, waterMaterial, zOffset, length = 80, width = 70, channelWidth = 40) {
    this.scene = scene;
    this.waterMaterial = waterMaterial;
    this.zOffset = zOffset;
    this.length = length;
    this.width = width;
    this.channelWidth = channelWidth;

    this.group = new THREE.Group();
    this.group.position.z = zOffset;

    this.buildSegment();
  }

  buildSegment() {
    // Stylized Low-Poly Faceted Materials (flatShading: true)
    const lowPolyGrassMat = new THREE.MeshStandardMaterial({
      color: 0x2e7d32,
      roughness: 0.85,
      flatShading: true
    });

    const lowPolyRockMat = new THREE.MeshStandardMaterial({
      color: 0x546e7a,
      roughness: 0.9,
      flatShading: true
    });

    const lowPolyEarthMat = new THREE.MeshStandardMaterial({
      color: 0x4e342e,
      roughness: 0.95,
      flatShading: true
    });

    const lowPolyTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x3e2723,
      roughness: 0.9,
      flatShading: true
    });

    const lowPolyPineMat1 = new THREE.MeshStandardMaterial({
      color: 0x1b5e20,
      roughness: 0.7,
      flatShading: true
    });

    const lowPolyPineMat2 = new THREE.MeshStandardMaterial({
      color: 0x2e7d32,
      roughness: 0.7,
      flatShading: true
    });

    // 1. Solid Underwater Lakebed Floor (Prevents any transparent void hole artifacts)
    const lakebedGeo = new THREE.PlaneGeometry(this.channelWidth + 36, this.length, 8, 8);
    const lakebedMat = new THREE.MeshStandardMaterial({
      color: 0x081320,
      roughness: 0.95,
      flatShading: true
    });
    const lakebedMesh = new THREE.Mesh(lakebedGeo, lakebedMat);
    lakebedMesh.rotation.x = -Math.PI / 2;
    lakebedMesh.position.y = -1.8;
    this.group.add(lakebedMesh);

    // 1b. Opaque Water Plane Surface (Smooth 32x32 resolution)
    const waterGeo = new THREE.PlaneGeometry(this.channelWidth + 8, this.length, 32, 32);
    const waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 0;
    waterMesh.receiveShadow = true;
    this.group.add(waterMesh);

    // 2. Stylized Low-Poly Mountainous Cliffs (Left & Right Banks with High Random Variation)
    const cliffBouldersCount = 12;

    for (let i = 0; i < cliffBouldersCount; i++) {
      const zPos = -this.length / 2 + (i / (cliffBouldersCount - 1)) * this.length + (Math.random() - 0.5) * 4;

      // --- LEFT BANK ---
      const isToweringLeft = Math.random() < 0.35; // 35% chance of giant towering peak
      const baseRadiusLeft = isToweringLeft ? (11.0 + Math.random() * 8.0) : (5.0 + Math.random() * 4.5);
      const leftCliffGeo = new THREE.IcosahedronGeometry(baseRadiusLeft, 1);
      const leftCliff = new THREE.Mesh(leftCliffGeo, (i % 2 === 0 ? lowPolyGrassMat : lowPolyRockMat));

      const scaleYLeft = isToweringLeft ? (1.8 + Math.random() * 1.6) : (0.85 + Math.random() * 0.7);
      const scaleXZLeft = 0.85 + Math.random() * 0.4;
      leftCliff.scale.set(scaleXZLeft, scaleYLeft, scaleXZLeft);

      // Math fix: Ensure rightmost edge of cliff sphere stays strictly outside water channel (x <= -21.0m)
      const effRadLeft = baseRadiusLeft * scaleXZLeft;
      const leftX = -(this.channelWidth / 2 + effRadLeft + 1.2 + Math.random() * 3.0);
      const posYLeft = isToweringLeft ? (baseRadiusLeft * scaleYLeft * 0.40) : (2.0 + Math.random() * 2.5);
      leftCliff.position.set(leftX, posYLeft, zPos);
      leftCliff.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
      leftCliff.castShadow = true;
      leftCliff.receiveShadow = true;
      this.group.add(leftCliff);

      // --- RIGHT BANK ---
      const isToweringRight = Math.random() < 0.35; // 35% chance of giant towering peak
      const baseRadiusRight = isToweringRight ? (11.0 + Math.random() * 8.0) : (5.0 + Math.random() * 4.5);
      const rightCliffGeo = new THREE.IcosahedronGeometry(baseRadiusRight, 1);
      const rightCliff = new THREE.Mesh(rightCliffGeo, (i % 2 === 1 ? lowPolyGrassMat : lowPolyEarthMat));

      const scaleYRight = isToweringRight ? (1.8 + Math.random() * 1.6) : (0.85 + Math.random() * 0.7);
      const scaleXZRight = 0.85 + Math.random() * 0.4;
      rightCliff.scale.set(scaleXZRight, scaleYRight, scaleXZRight);

      // Math fix: Ensure leftmost edge of cliff sphere stays strictly outside water channel (x >= +21.0m)
      const effRadRight = baseRadiusRight * scaleXZRight;
      const rightX = (this.channelWidth / 2 + effRadRight + 1.2 + Math.random() * 3.0);
      const posYRight = isToweringRight ? (baseRadiusRight * scaleYRight * 0.40) : (2.0 + Math.random() * 2.5);
      rightCliff.position.set(rightX, posYRight, zPos);
      rightCliff.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
      rightCliff.castShadow = true;
      rightCliff.receiveShadow = true;
      this.group.add(rightCliff);
    }

    // 2b. Layered Background Giant Mountain Silhouettes (Far Out Peaks)
    const bgPeakCount = 4;
    for (let i = 0; i < bgPeakCount; i++) {
      const zPos = -this.length / 2 + (i / (bgPeakCount - 1)) * this.length + (Math.random() - 0.5) * 12;

      // Far Background Left Peak
      const bgRadL = 15.0 + Math.random() * 12.0;
      const bgPeakL = new THREE.Mesh(new THREE.IcosahedronGeometry(bgRadL, 1), lowPolyRockMat);
      bgPeakL.scale.set(1.2, 1.8 + Math.random() * 1.6, 1.2);
      bgPeakL.position.set(-(this.channelWidth / 2 + 28 + Math.random() * 16), bgRadL * 0.9, zPos);
      bgPeakL.rotation.set(0.2, Math.random() * Math.PI, 0.2);
      this.group.add(bgPeakL);

      // Far Background Right Peak
      const bgRadR = 15.0 + Math.random() * 12.0;
      const bgPeakR = new THREE.Mesh(new THREE.IcosahedronGeometry(bgRadR, 1), lowPolyRockMat);
      bgPeakR.scale.set(1.2, 1.8 + Math.random() * 1.6, 1.2);
      bgPeakR.position.set((this.channelWidth / 2 + 28 + Math.random() * 16), bgRadR * 0.9, zPos);
      bgPeakR.rotation.set(0.2, Math.random() * Math.PI, 0.2);
      this.group.add(bgPeakR);
    }

    // 3. Low-Poly Shoreline Rocks
    const rockCount = 8;
    for (let i = 0; i < rockCount; i++) {
      const isLeft = Math.random() > 0.5;
      const rockSize = 1.2 + Math.random() * 2.0;
      const rockGeo = new THREE.DodecahedronGeometry(rockSize, 1);
      const rock = new THREE.Mesh(rockGeo, lowPolyRockMat);
      
      const rockX = isLeft ? -(this.channelWidth / 2 + 1.2) : (this.channelWidth / 2 + 1.2);
      const zPos = (Math.random() - 0.5) * (this.length * 0.9);
      
      rock.position.set(rockX, 0.6, zPos);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
    }

    // 4. Pure Procedural Low-Poly Pine Trees (Faceted 3-Tier Pine Cones)
    const treeCount = 12;
    for (let i = 0; i < treeCount; i++) {
      const isLeft = Math.random() > 0.5;
      const xSide = isLeft ? -(this.channelWidth / 2 + 6 + Math.random() * 9) : (this.channelWidth / 2 + 6 + Math.random() * 9);
      const zPos = (Math.random() - 0.5) * (this.length * 0.9);

      const treeGroup = new THREE.Group();

      // Faceted Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.5, 5);
      const trunk = new THREE.Mesh(trunkGeo, lowPolyTrunkMat);
      trunk.position.y = 1.75;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Tier 1 (Bottom Foliage Cone)
      const pineMat = Math.random() > 0.5 ? lowPolyPineMat1 : lowPolyPineMat2;
      const tier1 = new THREE.Mesh(new THREE.ConeGeometry(2.5, 3.8, 5), pineMat);
      tier1.position.y = 4.2;
      tier1.castShadow = true;
      treeGroup.add(tier1);

      // Tier 2 (Middle Foliage Cone)
      const tier2 = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.2, 5), pineMat);
      tier2.position.y = 6.0;
      tier2.castShadow = true;
      treeGroup.add(tier2);

      // Tier 3 (Top Foliage Cone)
      const tier3 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.6, 5), pineMat);
      tier3.position.y = 7.6;
      tier3.castShadow = true;
      treeGroup.add(tier3);

      // Scale & Rotation Variations
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
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
  }
}
