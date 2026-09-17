import * as THREE from 'three';
import { BlockyHumanoid } from './BlockyHumanoid.js';

export class RemotePlayer {
  constructor(boatMesh, playerData) {
    this.boatMesh = boatMesh;
    this.id = playerData.id;
    this.name = playerData.name || 'Player';
    this.color = playerData.color || '#38bdf8';
    this.isHost = !!playerData.isHost;

    this.localPos = { x: playerData.localPos ? playerData.localPos.x : 0, y: playerData.localPos ? playerData.localPos.y : 0 };
    this.targetLocalPos = { ...this.localPos };
    this.heading = playerData.heading || 0;
    this.targetHeading = this.heading;

    this.walkAnimTime = 0;
    this.prevPos = { ...this.localPos };

    this.initAvatar();
    this.initNametag();

    if (this.boatMesh) {
      this.boatMesh.add(this.group);
    }
  }

  initAvatar() {
    this.group = new THREE.Group();

    // Create customized BlockyHumanoid avatar
    this.humanoid = new BlockyHumanoid();
    
    // Customize shirt color to match player's assigned color
    if (this.color && this.humanoid) {
      this.humanoid.setShirtColor(this.color);
    }

    this.group.add(this.humanoid.mesh);
    this.updateTransform();
  }

  initNametag() {
    let container = document.getElementById('nametags-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'nametags-container';
      document.body.appendChild(container);
    }

    this.nametagElem = document.createElement('div');
    this.nametagElem.className = 'html-nametag';
    this.nametagElem.style.setProperty('--tag-color', this.color || '#38bdf8');

    const hostHtml = this.isHost ? '<span class="host-icon">👑</span>' : '';
    const safeName = String(this.name || 'Player').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);

    this.nametagElem.innerHTML = `${hostHtml}<span class="nametag-text">${safeName}</span>`;
    container.appendChild(this.nametagElem);

    this.projVec = new THREE.Vector3();
  }

  setTargetState(localPos, heading) {
    if (localPos) {
      this.targetLocalPos.x = localPos.x;
      this.targetLocalPos.y = localPos.y;
    }
    if (heading !== undefined) {
      this.targetHeading = heading;
    }
  }

  updateTransform() {
    // Plank / Deck height is y = 0.48m on the boat
    this.group.position.set(this.localPos.x, 0.48, this.localPos.y);
    this.group.rotation.y = this.heading;
  }

  update(delta, camera) {
    // 1. Smooth interpolation to target local position on deck
    const lerpRate = 1.0 - Math.exp(-15.0 * delta);
    const dx = this.targetLocalPos.x - this.localPos.x;
    const dy = this.targetLocalPos.y - this.localPos.y;

    this.localPos.x += dx * lerpRate;
    this.localPos.y += dy * lerpRate;

    // Smooth heading interpolation
    let dHeading = this.targetHeading - this.heading;
    while (dHeading > Math.PI) dHeading -= Math.PI * 2;
    while (dHeading < -Math.PI) dHeading += Math.PI * 2;
    this.heading += dHeading * lerpRate;

    this.updateTransform();

    // 2. Walking leg/arm swing animation
    const moveDist = Math.hypot(this.localPos.x - this.prevPos.x, this.localPos.y - this.prevPos.y);
    const isMoving = moveDist > 0.002;
    this.prevPos.x = this.localPos.x;
    this.prevPos.y = this.localPos.y;

    if (isMoving) {
      this.walkAnimTime += delta * 12.0;
    } else {
      this.walkAnimTime = 0;
    }

    if (this.humanoid) {
      this.humanoid.update(delta, isMoving, this.localPos, this.targetLocalPos);
    }

    // 3. Ultra-Crisp Screen-Space Projected HTML Nametag
    if (this.nametagElem && camera) {
      this.projVec.setFromMatrixPosition(this.group.matrixWorld);
      this.projVec.y += 1.35; // Positioned right above character head level

      this.projVec.project(camera);

      // Check frustum clipping (behind camera lens or beyond far plane)
      if (this.projVec.z > 1.0 || this.projVec.z < -1.0) {
        this.nametagElem.style.display = 'none';
      } else {
        const screenX = (this.projVec.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-(this.projVec.y * 0.5) + 0.5) * window.innerHeight;

        this.nametagElem.style.display = 'flex';
        this.nametagElem.style.left = `${screenX}px`;
        this.nametagElem.style.top = `${screenY}px`;
      }
    }
  }

  destroy() {
    if (this.nametagElem && this.nametagElem.parentNode) {
      this.nametagElem.parentNode.removeChild(this.nametagElem);
      this.nametagElem = null;
    }
    if (this.boatMesh && this.group) {
      this.boatMesh.remove(this.group);
    }
  }
}
