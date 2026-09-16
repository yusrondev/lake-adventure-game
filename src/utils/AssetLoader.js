import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AssetLoader {
  constructor() {
    this.assets = new Map();
    this.loadingManager = new THREE.LoadingManager();
    this.gltfLoader = new GLTFLoader(this.loadingManager);

    this.assetManifest = [
      { id: 'stone', path: '/models/stylized_low-poly_stone.glb' },
      { id: 'toriiGate', path: '/models/japanese_tori_gate.glb' },
      { id: 'pineTree', path: '/models/pine_tree.glb' },
      { id: 'woodenBoat', path: '/models/wooden_boat.glb' },
      { id: 'bambooRaft', path: '/models/bamboo_raft.glb' },
      { id: 'medievalSword', path: '/models/medieval_sword.glb' }
    ];

    this.onProgressCallback = null;
    this.onCompleteCallback = null;
  }

  loadAll(onProgress, onComplete) {
    this.onProgressCallback = onProgress;
    this.onCompleteCallback = onComplete;

    let loadedCount = 0;
    const totalCount = this.assetManifest.length;

    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const pct = Math.min(100, Math.round((itemsLoaded / itemsTotal) * 100));
      if (this.onProgressCallback) {
        this.onProgressCallback(pct, url);
      }
    };

    this.loadingManager.onLoad = () => {
      if (this.onProgressCallback) {
        this.onProgressCallback(100, 'Complete');
      }
      if (this.onCompleteCallback) {
        this.onCompleteCallback(this.assets);
      }
    };

    this.loadingManager.onError = (url) => {
      console.warn(`[AssetLoader] Warning: Asset failed to load: ${url}`);
      // Continue loading other assets gracefully
      loadedCount++;
      const pct = Math.min(100, Math.round((loadedCount / totalCount) * 100));
      if (this.onProgressCallback) {
        this.onProgressCallback(pct, url);
      }
      if (loadedCount >= totalCount && this.onCompleteCallback) {
        this.onCompleteCallback(this.assets);
      }
    };

    // Trigger loads for all assets in manifest
    this.assetManifest.forEach(item => {
      this.gltfLoader.load(
        item.path,
        (gltf) => {
          // Pre-configure meshes for smooth rendering
          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          this.assets.set(item.id, gltf.scene);
        },
        undefined,
        (err) => {
          console.warn(`[AssetLoader] Could not load ${item.path}:`, err);
        }
      );
    });
  }

  getAsset(id) {
    return this.assets.get(id) || null;
  }
}
