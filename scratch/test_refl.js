import * as THREE from 'three';

const reflGeom = new THREE.RingGeometry(0.5, 24.0, 32);
const reflMat = new THREE.MeshBasicMaterial({
  color: 0xfacc15,
  transparent: true,
  opacity: 0.45,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide
});

const mesh = new THREE.Mesh(reflGeom, reflMat);
mesh.rotation.x = -Math.PI / 2;
console.log('Reflection mesh created successfully!');
