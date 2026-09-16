import * as THREE from 'three';

// Let's test Box3 math for scale 56.0 with rotation Z = Math.PI/2 and Y = Math.PI/2
const group = new THREE.Group();
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(2.0, 0.07, 0.38) // mimicking gltf bounds: X length 2.0, Y 0.07, Z 0.38
);

mesh.scale.set(56.0, 56.0, 56.0);
mesh.rotation.set(0, Math.PI / 2, Math.PI / 2);
group.add(mesh);

const box = new THREE.Box3().setFromObject(group);
const size = new THREE.Vector3();
box.getSize(size);

console.log('Group Box Min:', box.min);
console.log('Group Box Max:', box.max);
console.log('Group Box Size:', size);
