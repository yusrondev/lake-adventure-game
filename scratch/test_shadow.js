import * as THREE from 'three';

// Verify PlaneGeometry & MeshBasicMaterial creation
const geom = new THREE.PlaneGeometry(28.0, 70.0);
const mat = new THREE.MeshBasicMaterial({
  color: 0x020617,
  transparent: true,
  opacity: 0.65,
  depthWrite: false,
  side: THREE.DoubleSide
});

const mesh = new THREE.Mesh(geom, mat);
mesh.rotation.x = -Math.PI / 2;
console.log('Shadow mesh created successfully!');
