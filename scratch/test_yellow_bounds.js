import * as THREE from 'three';

const boxMinY = -56.0;
const tipLodgedDepth = 48.0;
const groupY = -boxMinY - tipLodgedDepth; // 8.0
const localWaterY = 0.0 - groupY; // -8.0

console.log('Group target Y:', groupY); // 8.0
console.log('Local Water Y:', localWaterY); // -8.0
console.log('World Y of blade tip:', groupY + boxMinY); // -40.0 (48m below water!)
