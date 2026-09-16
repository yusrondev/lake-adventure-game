import * as THREE from 'three';

// Test variants logic
function getSwordVariant(milestoneIdx) {
  const variantType = milestoneIdx % 3;

  if (variantType === 0) {
    return { name: 'Straight Center', x: 0, rotZ: Math.PI / 2 };
  } else if (variantType === 1) {
    const side = (milestoneIdx % 2 === 0) ? 1 : -1;
    return { name: 'Slightly Tilted', x: side * 3.5, rotZ: Math.PI / 2 + side * 0.24 };
  } else {
    const side = (milestoneIdx % 2 === 1) ? 1 : -1;
    return { name: 'Cliff Lodged Leaning', x: side * 15.5, rotZ: Math.PI / 2 - side * 0.65 };
  }
}

for (let m = 1; m <= 6; m++) {
  const milestoneZ = -m * 3500;
  const v = getSwordVariant(m);
  console.log(`Milestone ${m} (${-milestoneZ}m): ${v.name}, x=${v.x}, rotZ=${(v.rotZ * 180 / Math.PI).toFixed(1)}°`);
}
