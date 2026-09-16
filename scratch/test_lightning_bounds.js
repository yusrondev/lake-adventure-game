import * as THREE from 'three';

// Measure exact Y bounds of medieval_sword mesh at scale 56 with rotation set(0, PI/2, PI/2)
const group = new THREE.Group();
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(2.0, 0.07, 0.38)
);
mesh.scale.set(56.0, 56.0, 56.0);
mesh.rotation.set(0, Math.PI / 2, Math.PI / 2);
group.add(mesh);

const box = new THREE.Box3().setFromObject(mesh);
console.log('Mesh min.y:', box.min.y); // -56
console.log('Mesh max.y:', box.max.y); // +56

// If tip is lodged 35 meters underwater:
// world Y min = -35.0
// group.position.y = -box.min.y - 35.0 = 56.0 - 35.0 = 21.0!
const groupY = -box.min.y - 35.0;
console.log('Calculated groupY:', groupY); // 21.0

// Water level in world space is Y = 0.0
// Local Y inside group corresponding to water level = 0.0 - groupY = -21.0!
const localWaterY = 0.0 - groupY;
console.log('Local Y for water surface:', localWaterY); // -21.0
