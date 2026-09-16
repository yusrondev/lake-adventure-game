import fs from 'fs';

const buf = fs.readFileSync('./public/models/medieval_sword.glb');
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

console.log('GLTF Nodes:', JSON.stringify(gltf.nodes, null, 2));
console.log('GLTF Meshes:', JSON.stringify(gltf.meshes, null, 2));
console.log('GLTF Accessors:', JSON.stringify(gltf.accessors.slice(0, 5), null, 2));
