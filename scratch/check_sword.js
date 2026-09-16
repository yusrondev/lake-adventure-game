import * as THREE from 'three';
import fs from 'fs';

// Read glb file box
console.log('Checking sword model path...');
const path = './public/models/medieval_sword.glb';
if (fs.existsSync(path)) {
  console.log('File exists, size:', fs.statSync(path).size);
} else {
  console.log('File does not exist at', path);
}
