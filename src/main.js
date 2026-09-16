import * as THREE from 'three';
import { WaterSystem } from './graphics/WaterShader.js';
import { BlockyHumanoid } from './entities/BlockyHumanoid.js';
import { WoodenBoat } from './entities/WoodenBoat.js';
import { PlankPhysics } from './physics/PlankPhysics.js';
import { ChunkManager } from './world/ChunkManager.js';
import { DayNightCycle } from './graphics/DayNightCycle.js';
import { RockManager } from './entities/RockManager.js';
import { WeatherManager } from './graphics/WeatherManager.js';
import { ToriiGateManager } from './entities/ToriiGateManager.js';
import { AssetLoader } from './utils/AssetLoader.js';
import { NetworkManager } from './net/NetworkManager.js';
import { RemotePlayer } from './entities/RemotePlayer.js';

class InfiniteLakeGame {
  constructor() {
    this.container = document.getElementById('game-container');
    
    // UI Elements
    this.timeEl = document.getElementById('time-val');
    this.weatherEl = document.getElementById('weather-val');
    this.compassEl = document.getElementById('compass-val');
    this.distanceEl = document.getElementById('distance-val');
    this.speedEl = document.getElementById('speed-val');
    this.highscoreEl = document.getElementById('highscore-val');
    this.hpValEl = document.getElementById('hp-val');
    this.hpFillEl = document.getElementById('hp-bar-fill');
    this.modalScreen = document.getElementById('modal-screen');

    // 3D Asset Loading Bar Elements
    this.assetLoaderBox = document.getElementById('asset-loader-box');
    this.assetLoaderStatus = document.getElementById('asset-loader-status');
    this.assetLoaderPct = document.getElementById('asset-loader-pct');
    this.assetLoaderBar = document.getElementById('asset-loader-bar');

    // Modal Views
    this.viewModeSelect = document.getElementById('view-mode-select');
    this.viewMpLobby = document.getElementById('view-mp-lobby');
    this.viewWaitingRoom = document.getElementById('view-waiting-room');
    this.viewGameOver = document.getElementById('view-game-over');

    // Mode Selection Buttons
    this.btnModeSolo = document.getElementById('btn-mode-solo');
    this.btnModeMultiplayer = document.getElementById('btn-mode-multiplayer');

    // MP Lobby Elements
    this.inputPlayerName = document.getElementById('input-player-name');
    this.btnCreateRoom = document.getElementById('btn-create-room');
    this.inputRoomCode = document.getElementById('input-room-code');
    this.btnJoinRoom = document.getElementById('btn-join-room');
    this.btnBackToMode = document.getElementById('btn-back-to-mode');
    this.mpLobbyError = document.getElementById('mp-lobby-error');

    // Waiting Room Elements
    this.roomCodeVal = document.getElementById('room-code-val');
    this.btnCopyCode = document.getElementById('btn-copy-code');
    this.copyToast = document.getElementById('copy-toast');
    this.playerCountNum = document.getElementById('player-count-num');
    this.playerListContainer = document.getElementById('player-list-container');
    this.btnHostStart = document.getElementById('btn-host-start');
    this.guestWaitingMsg = document.getElementById('guest-waiting-msg');
    this.btnLeaveRoom = document.getElementById('btn-leave-room');

    // Game Over Elements
    this.gameoverSubtitle = document.getElementById('gameover-subtitle');
    this.btnGameoverRestart = document.getElementById('btn-gameover-restart');
    this.btnGameoverMenu = document.getElementById('btn-gameover-menu');

    // In-game MP HUD Badge
    this.hudMpPill = document.getElementById('hud-mp-pill');
    this.hudMpInfo = document.getElementById('hud-mp-info');

    // Milestone Notification Elements
    this.milestoneBanner = document.getElementById('milestone-banner');
    this.milestoneText = document.getElementById('milestone-text');
    this.milestoneTimeout = null;

    // Joystick UI Elements
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickStick = document.getElementById('joystick-stick');
    this.joystickActive = false;
    this.joystickVector = { x: 0, y: 0 };

    // Lantern UI Elements & 360 Spotlight Aim State
    this.btnLanternToggle = document.getElementById('btn-lantern-toggle');
    this.lanternAimBar = document.getElementById('lantern-aim-bar');
    this.btnAimLeft = document.getElementById('btn-aim-left');
    this.btnAimFront = document.getElementById('btn-aim-front');
    this.btnAimRight = document.getElementById('btn-aim-right');
    this.spotlightDegree = 0; // 0 = Forward (-Z)

    // Camera Shake
    this.screenShake = 0;

    // High Score
    this.highScore = parseInt(localStorage.getItem('lake_highscore') || '0', 10);
    if (this.highscoreEl) {
      this.highscoreEl.innerHTML = `${this.highScore} <small>m</small>`;
    }

    // Game state & Mode
    this.gameState = 'MENU';
    this.isMultiplayer = false;
    this.distanceTraveled = 0;

    // Multiplayer Networking
    this.networkManager = new NetworkManager();
    this.remotePlayers = new Map(); // playerId -> RemotePlayer
    this.netSyncTimer = 0;
    this.envSyncTimer = 0;

    // Keyboard Input States
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false
    };

    // Pre-allocated Vector3 buffers to prevent GC stuttering in animation loop
    this.tempCamOffset = new THREE.Vector3();
    this.targetCamPos = new THREE.Vector3();
    this.lookAtPos = new THREE.Vector3();
    this.upAxis = new THREE.Vector3(0, 1, 0);

    this.initThree();
    this.initEntities();
    this.setupEvents();
    this.setupNetworkEvents();
    this.setupJoystick();
    this.startAssetPreloading();

    // Start Animation Loop
    this.clock = new THREE.Clock();
    this.animate();
  }

  showView(viewId) {
    const views = [this.viewModeSelect, this.viewMpLobby, this.viewWaitingRoom, this.viewGameOver];
    views.forEach(v => {
      if (v) v.classList.add('hidden');
    });

    if (viewId === 'mode-select' && this.viewModeSelect) this.viewModeSelect.classList.remove('hidden');
    if (viewId === 'mp-lobby' && this.viewMpLobby) this.viewMpLobby.classList.remove('hidden');
    if (viewId === 'waiting-room' && this.viewWaitingRoom) this.viewWaitingRoom.classList.remove('hidden');
    if (viewId === 'game-over' && this.viewGameOver) this.viewGameOver.classList.remove('hidden');
  }

  startAssetPreloading() {
    this.assetLoader = new AssetLoader();
    this.preloadedAssets = null;

    this.assetLoader.loadAll(
      (pct, url) => {
        if (this.assetLoaderPct) this.assetLoaderPct.textContent = `${pct}%`;
        if (this.assetLoaderBar) this.assetLoaderBar.style.width = `${pct}%`;
        if (this.assetLoaderStatus) {
          if (pct < 100) {
            this.assetLoaderStatus.textContent = `Memuat Aset 3D (${pct}%)...`;
          } else {
            this.assetLoaderStatus.textContent = 'Semua Aset 3D Siap!';
          }
        }
      },
      (assets) => {
        this.preloadedAssets = assets;

        // Apply preloaded assets to managers
        if (this.rockManager && assets.has('stone')) {
          this.rockManager.initModel(assets.get('stone'));
        }
        if (this.toriiGateManager && assets.has('toriiGate')) {
          this.toriiGateManager.initModel(assets.get('toriiGate'));
        }

        // Pre-warm GPU WebGL Shaders and Texture Buffers (Zero runtime hitching)
        try {
          if (this.renderer && this.scene && this.camera) {
            this.renderer.compile(this.scene, this.camera);
          }
        } catch (e) {
          console.warn('[WebGL Prewarm]', e);
        }

        // Hide loader box and show Mode Selection Menu
        setTimeout(() => {
          if (this.assetLoaderBox) this.assetLoaderBox.classList.add('hidden');
          this.showView('mode-select');
        }, 350);
      }
    );
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x60a5fa);
    this.scene.fog = new THREE.FogExp2(0x60a5fa, 0.007);

    // Wide perspective camera POV with extended draw distance for distant landmarks (Torii gates)
    this.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.1,
      3500
    );
    this.camera.position.set(0, 9.5, 18.0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.HemisphereLight(0xddeeff, 0x224422, 0.65);
    this.scene.add(ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    this.sunLight.position.set(40, 60, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.left = -30;
    this.sunLight.shadow.camera.right = 30;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.scene.add(this.sunLight);
  }

  initEntities() {
    this.waterSystem = new WaterSystem(this.scene);
    this.humanoid = new BlockyHumanoid();

    // Direct synchronous low-poly wooden boat instantiation
    this.woodenBoat = new WoodenBoat(this.scene);
    this.physics = new PlankPhysics(this.woodenBoat, this.humanoid, this.waterSystem);

    this.chunkManager = new ChunkManager(this.scene, this.waterSystem.material);

    // Lake Rock Obstacle Manager (stylized_low-poly_stone.glb)
    this.rockManager = new RockManager(this.scene, this);
    this.chunkManager.setRockManager(this.rockManager);
    
    // Dynamic Day-Night Celestial Cycle with giant glowing sun & water lighting sync
    this.dayNightCycle = new DayNightCycle(this.scene, this.sunLight, this.camera, this.waterSystem.material);

    // Dynamic Realistic Weather Manager (Rain streaks, overcast, lightning strikes, thunder audio)
    this.weatherManager = new WeatherManager(this.scene, this, this.dayNightCycle);
    this.dayNightCycle.setWeatherManager(this.weatherManager);

    // Japanese Torii Gate Manager (Monumental Torii Gates spanning the lake every 2000m)
    this.toriiGateManager = new ToriiGateManager(this.scene, this);
  }

  setupEvents() {
    window.addEventListener('keydown', (e) => this.handleKey(e, true));
    window.addEventListener('keyup', (e) => this.handleKey(e, false));

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Reliable Event Binding Helper
    const bindBtn = (btnEl, actionFn) => {
      if (!btnEl) return;
      const handler = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        actionFn();
      };
      btnEl.addEventListener('pointerdown', handler);
      btnEl.addEventListener('click', handler);
    };

    // Mode Selection Handlers
    bindBtn(this.btnModeSolo, () => {
      this.isMultiplayer = false;
      if (this.hudMpPill) this.hudMpPill.classList.add('hidden');
      this.startGame();
    });

    bindBtn(this.btnModeMultiplayer, () => {
      this.showView('mp-lobby');
    });

    // Multiplayer Lobby Handlers
    bindBtn(this.btnBackToMode, () => {
      this.networkManager.leaveRoom();
      this.showView('mode-select');
    });

    bindBtn(this.btnCreateRoom, () => {
      const name = (this.inputPlayerName ? this.inputPlayerName.value : '').trim() || 'Captain';
      this.setMpError('');
      this.networkManager.createRoom(name).catch(err => {
        this.setMpError('Gagal membuat ruangan. Pastikan server aktif.');
      });
    });

    bindBtn(this.btnJoinRoom, () => {
      const name = (this.inputPlayerName ? this.inputPlayerName.value : '').trim() || 'Crew';
      const code = (this.inputRoomCode ? this.inputRoomCode.value : '').trim().toUpperCase();
      if (!code || code.length < 4) {
        this.setMpError('Masukkan kode ruangan yang valid.');
        return;
      }
      this.setMpError('');
      this.networkManager.joinRoom(code, name).catch(err => {
        this.setMpError('Gagal bergabung ke ruangan.');
      });
    });

    // Waiting Room Handlers
    bindBtn(this.btnCopyCode, () => {
      if (this.networkManager.roomCode) {
        navigator.clipboard.writeText(this.networkManager.roomCode).then(() => {
          if (this.copyToast) {
            this.copyToast.classList.remove('hidden');
            setTimeout(() => { if (this.copyToast) this.copyToast.classList.add('hidden'); }, 2000);
          }
        }).catch(() => {});
      }
    });

    bindBtn(this.btnHostStart, () => {
      this.networkManager.startGame();
    });

    bindBtn(this.btnLeaveRoom, () => {
      this.networkManager.leaveRoom();
      this.showView('mp-lobby');
    });

    // Game Over Handlers
    bindBtn(this.btnGameoverRestart, () => {
      if (this.isMultiplayer) {
        if (this.networkManager.isHost) {
          this.networkManager.startGame();
        } else {
          this.showView('waiting-room');
          this.modalScreen.classList.remove('hidden');
        }
      } else {
        this.startGame();
      }
    });

    bindBtn(this.btnGameoverMenu, () => {
      this.networkManager.leaveRoom();
      this.showView('mode-select');
      this.modalScreen.classList.remove('hidden');
    });

    // Lantern Control UI Buttons
    bindBtn(this.btnLanternToggle, () => {
      const nextState = !this.woodenBoat.isLanternOn;
      this.woodenBoat.setLanternOn(nextState);
      if (this.isMultiplayer) {
        this.networkManager.sendLanternSync(this.woodenBoat.isLanternOn, this.woodenBoat.targetSpotlightAngle);
      }
      if (this.lanternAimBar) {
        if (this.woodenBoat.isLanternOn) {
          this.lanternAimBar.classList.remove('hidden');
        } else {
          this.lanternAimBar.classList.add('hidden');
        }
      }
    });

    const updateSpotlightAngle = (targetDeg) => {
      let norm = targetDeg % 360;
      if (norm > 180) norm -= 360;
      if (norm < -180) norm += 360;

      this.spotlightDegree = norm;
      const rad = (this.spotlightDegree * Math.PI) / 180;
      this.woodenBoat.setSpotlightAngle(rad);

      if (this.isMultiplayer) {
        this.networkManager.sendLanternSync(this.woodenBoat.isLanternOn, rad);
      }

      if (this.btnAimFront) {
        if (Math.abs(this.spotlightDegree) < 5) this.btnAimFront.classList.add('active');
        else this.btnAimFront.classList.remove('active');
      }
      if (this.btnAimLeft) {
        if (this.spotlightDegree <= -5) this.btnAimLeft.classList.add('active');
        else this.btnAimLeft.classList.remove('active');
      }
      if (this.btnAimRight) {
        if (this.spotlightDegree >= 5) this.btnAimRight.classList.add('active');
        else this.btnAimRight.classList.remove('active');
      }
    };

    bindBtn(this.btnAimLeft, () => {
      const newDeg = Math.max(-75, this.spotlightDegree - 15);
      updateSpotlightAngle(newDeg);
    });

    bindBtn(this.btnAimRight, () => {
      const newDeg = Math.min(75, this.spotlightDegree + 15);
      updateSpotlightAngle(newDeg);
    });

    bindBtn(this.btnAimFront, () => {
      updateSpotlightAngle(0);
    });
  }

  setMpError(msg) {
    if (!this.mpLobbyError) return;
    if (msg) {
      this.mpLobbyError.textContent = msg;
      this.mpLobbyError.classList.remove('hidden');
    } else {
      this.mpLobbyError.classList.add('hidden');
    }
  }

  setupNetworkEvents() {
    this.networkManager.on('room_created', (data) => {
      this.isMultiplayer = true;
      if (this.roomCodeVal) this.roomCodeVal.textContent = data.roomCode;
      if (this.btnHostStart) this.btnHostStart.classList.remove('hidden');
      if (this.guestWaitingMsg) this.guestWaitingMsg.classList.add('hidden');
      this.updatePlayerListUI(data.players || []);
      this.showView('waiting-room');
    });

    this.networkManager.on('room_joined', (data) => {
      this.isMultiplayer = true;
      if (this.roomCodeVal) this.roomCodeVal.textContent = data.roomCode;
      if (this.btnHostStart) this.btnHostStart.classList.add('hidden');
      if (this.guestWaitingMsg) this.guestWaitingMsg.classList.remove('hidden');
      this.updatePlayerListUI(data.players || []);
      this.showView('waiting-room');
    });

    this.networkManager.on('player_joined', (data) => {
      this.updatePlayerListUI(data.players || []);
      // If game is active, spawn remote player avatar
      if (this.gameState === 'PLAYING' && data.player && data.player.id !== this.networkManager.playerId) {
        this.spawnRemotePlayer(data.player);
      }
    });

    this.networkManager.on('player_left', (data) => {
      this.updatePlayerListUI(data.players || []);
      this.removeRemotePlayer(data.playerId);

      // Check if this player became host
      if (this.networkManager.isHost) {
        if (this.btnHostStart) this.btnHostStart.classList.remove('hidden');
        if (this.guestWaitingMsg) this.guestWaitingMsg.classList.add('hidden');
      }
    });

    this.networkManager.on('game_start', (data) => {
      // Set room world seed in RockManager so all clients generate identical obstacles
      if (data.worldSeed && this.rockManager) {
        this.rockManager.setWorldSeed(data.worldSeed);
      }
      if (data.timeOfDay !== undefined && this.dayNightCycle) {
        this.dayNightCycle.timeOfDay = data.timeOfDay;
      }

      // Initialize remote players on the shared boat
      this.clearAllRemotePlayers();
      if (data.players) {
        data.players.forEach(p => {
          if (p.id !== this.networkManager.playerId) {
            this.spawnRemotePlayer(p);
          }
        });
      }

      // Show HUD multiplayer info
      if (this.hudMpPill && this.hudMpInfo) {
        this.hudMpInfo.textContent = this.networkManager.roomCode;
        this.hudMpPill.classList.remove('hidden');
      }

      this.startGame();
    });

    this.networkManager.on('player_moved', (data) => {
      const rp = this.remotePlayers.get(data.playerId);
      if (rp) {
        rp.setTargetState(data.localPos, data.heading);
      }
    });

    this.networkManager.on('boat_sync', (data) => {
      // Non-host players interpolate boat physics snapshot from host
      if (!this.networkManager.isHost && data.boatState) {
        this.physics.applyRemoteBoatState(data.boatState);
      }
    });

    this.networkManager.on('env_sync', (data) => {
      if (data.timeOfDay !== undefined && this.dayNightCycle) {
        this.dayNightCycle.timeOfDay = data.timeOfDay;
      }
    });

    this.networkManager.on('lantern_sync', (data) => {
      if (data.lanternState) {
        this.woodenBoat.setLanternOn(data.lanternState.isLanternOn);
        if (data.lanternState.spotlightAngle !== undefined) {
          this.woodenBoat.setSpotlightAngle(data.lanternState.spotlightAngle);
        }
      }
    });

    this.networkManager.on('collision_event', (data) => {
      if (data.damage > 0) {
        this.triggerDamageFeedback();
      }
      if (data.health !== undefined) {
        this.physics.health = data.health;
        this.updateHpUI();
      }
    });

    this.networkManager.on('game_over', (data) => {
      this.gameOver(data.reason);
    });

    this.networkManager.on('error', (msg) => {
      this.setMpError(msg);
    });
  }

  updatePlayerListUI(players) {
    if (!this.playerListContainer) return;
    this.playerListContainer.innerHTML = '';
    if (this.playerCountNum) this.playerCountNum.textContent = players.length;

    players.forEach(p => {
      const item = document.createElement('div');
      item.className = 'player-card-item';

      const left = document.createElement('div');
      left.className = 'player-card-left';

      const dot = document.createElement('span');
      dot.className = 'player-color-dot';
      dot.style.background = p.color || '#38bdf8';
      dot.style.color = p.color || '#38bdf8';

      const name = document.createElement('span');
      name.className = 'player-name-text';
      name.textContent = p.name + (p.id === this.networkManager.playerId ? ' (Anda)' : '');

      left.appendChild(dot);
      left.appendChild(name);
      item.appendChild(left);

      if (p.isHost) {
        const hostTag = document.createElement('span');
        hostTag.className = 'player-host-tag';
        hostTag.textContent = '👑 Host';
        item.appendChild(hostTag);
      }

      this.playerListContainer.appendChild(item);
    });
  }

  spawnRemotePlayer(playerData) {
    if (!playerData || this.remotePlayers.has(playerData.id)) return;
    const remotePlayer = new RemotePlayer(this.woodenBoat.mesh, playerData);
    this.remotePlayers.set(playerData.id, remotePlayer);
  }

  removeRemotePlayer(playerId) {
    const rp = this.remotePlayers.get(playerId);
    if (rp) {
      rp.destroy();
      this.remotePlayers.delete(playerId);
    }
  }

  clearAllRemotePlayers() {
    this.remotePlayers.forEach(rp => rp.destroy());
    this.remotePlayers.clear();
  }

  setupJoystick() {
    if (!this.joystickBase) return;

    this.joystickOrigin = null;

    const handlePointerStart = (clientX, clientY) => {
      if (this.gameState !== 'PLAYING') return;

      this.joystickActive = true;
      this.joystickOrigin = { x: clientX, y: clientY };

      this.joystickBase.style.left = `${clientX}px`;
      this.joystickBase.style.top = `${clientY}px`;
      this.joystickBase.classList.add('active');
      this.joystickStick.style.transform = `translate(0px, 0px)`;
      this.joystickVector = { x: 0, y: 0 };
    };

    const handlePointerMove = (clientX, clientY) => {
      if (!this.joystickActive || !this.joystickOrigin) return;

      let deltaX = clientX - this.joystickOrigin.x;
      let deltaY = clientY - this.joystickOrigin.y;

      const maxRadius = 55;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
      }

      this.joystickStick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      const normX = deltaX / maxRadius;
      const normY = deltaY / maxRadius;

      this.joystickVector.x = normX;
      this.joystickVector.y = normY;
    };

    const handlePointerEnd = () => {
      this.joystickActive = false;
      this.joystickOrigin = null;
      this.joystickBase.classList.remove('active');
      this.joystickStick.style.transform = `translate(0px, 0px)`;
      this.joystickVector = { x: 0, y: 0 };
    };

    const isTargetingUI = (target, clientY) => {
      if (clientY < 60) return true;
      if (!target) return false;
      return !!target.closest('#lantern-hud-container, .hud-top-bar, .lantern-btn, .aim-btn, .modal-card');
    };

    window.addEventListener('touchstart', (e) => {
      if (this.gameState !== 'PLAYING') return;
      const touch = e.touches[0];
      if (isTargetingUI(e.target || touch.target, touch.clientY)) return;
      handlePointerStart(touch.clientX, touch.clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.joystickActive && e.touches.length > 0) {
        const touch = e.touches[0];
        handlePointerMove(touch.clientX, touch.clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => handlePointerEnd());
    window.addEventListener('touchcancel', () => handlePointerEnd());

    window.addEventListener('mousedown', (e) => {
      if (this.gameState !== 'PLAYING') return;
      if (isTargetingUI(e.target, e.clientY)) return;
      handlePointerStart(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.joystickActive) {
        handlePointerMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => handlePointerEnd());
  }

  handleKey(e, isDown) {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') this.input.forward = isDown;
    if (code === 'KeyS' || code === 'ArrowDown') this.input.backward = isDown;
    if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = isDown;
    if (code === 'KeyD' || code === 'ArrowRight') this.input.right = isDown;

    if (code === 'KeyR' && isDown) {
      if (this.weatherManager) {
        const active = this.weatherManager.toggleStormDebug();
        console.log(`[Weather] Manual storm override: ${active}`);
      }
    }
  }

  startGame() {
    this.gameState = 'PLAYING';
    this.modalScreen.classList.add('hidden');

    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen().catch(() => {});
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen().catch(() => {});
    }
    
    this.physics.worldPosition.set(0, 0, 0);
    this.physics.playerLocalPos.set(0, 0);
    this.physics.targetPlayerLocalPos.set(0, 0);
    this.physics.speed = 0;
    this.physics.heading = 0;
    this.physics.turnSpeed = 0;
    this.physics.health = 100;
    this.distanceTraveled = 0;
    this.updateHpUI();
  }

  updateHpUI() {
    const hp = this.physics.health;
    if (this.hpValEl) this.hpValEl.textContent = `${hp}%`;
    if (this.hpFillEl) {
      this.hpFillEl.style.width = `${hp}%`;
      if (hp > 50) {
        this.hpFillEl.style.background = 'linear-gradient(90deg, #2ed573, #7bed9f)';
        if (this.hpValEl) this.hpValEl.style.color = '#2ed573';
      } else if (hp > 25) {
        this.hpFillEl.style.background = 'linear-gradient(90deg, #ffa502, #ffc048)';
        if (this.hpValEl) this.hpValEl.style.color = '#ffa502';
      } else {
        this.hpFillEl.style.background = 'linear-gradient(90deg, #ff4757, #ff6b81)';
        if (this.hpValEl) this.hpValEl.style.color = '#ff4757';
      }
    }
  }

  triggerDamageFeedback() {
    this.screenShake = 0.45;
    document.body.classList.add('damage-flash');
    setTimeout(() => {
      document.body.classList.remove('damage-flash');
    }, 400);
    this.updateHpUI();
  }

  gameOver(customReason = null) {
    this.gameState = 'GAMEOVER';
    
    const finalDist = Math.floor(this.distanceTraveled);
    if (finalDist > this.highScore) {
      this.highScore = finalDist;
      localStorage.setItem('lake_highscore', this.highScore.toString());
      if (this.highscoreEl) {
        this.highscoreEl.innerHTML = `${this.highScore} <small>m</small>`;
      }
    }

    if (this.gameoverSubtitle) {
      this.gameoverSubtitle.textContent = customReason 
        ? `${customReason} Jarak tempuh: ${finalDist} meter.`
        : `Perahu Anda hancur akibat benturan tebing. Jarak tempuh: ${finalDist} meter.`;
    }

    this.showView('game-over');
    this.modalScreen.classList.remove('hidden');

    if (this.isMultiplayer && this.networkManager.isHost) {
      this.networkManager.sendGameOver(customReason || 'Perahu hancur.', finalDist);
    }
  }

  onGatePassed(gateIndex, distance) {
    if (!this.milestoneBanner || !this.milestoneText) return;

    const km = (gateIndex * 2).toLocaleString('id-ID');
    this.milestoneText.textContent = `Gerbang Torii • ${km}.000 Meter`;

    this.milestoneBanner.classList.remove('hidden');
    void this.milestoneBanner.offsetWidth;
    this.milestoneBanner.classList.add('show');

    if (this.milestoneTimeout) clearTimeout(this.milestoneTimeout);
    this.milestoneTimeout = setTimeout(() => {
      if (this.milestoneBanner) {
        this.milestoneBanner.classList.remove('show');
        setTimeout(() => {
          if (this.milestoneBanner) this.milestoneBanner.classList.add('hidden');
        }, 550);
      }
    }, 2800);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.gameState === 'PLAYING') {
      if (this.joystickActive && (this.joystickVector.x !== 0 || this.joystickVector.y !== 0)) {
        this.physics.applyJoystickVector(this.joystickVector.x, this.joystickVector.y, delta);
      } else {
        this.physics.updateInput(this.input, delta);
      }

      // Physics update (incorporating all player weight centers on deck)
      this.physics.updatePhysics(delta, this.remotePlayers);
      this.waterSystem.update(delta);

      // Update other player avatars on the shared boat deck
      this.remotePlayers.forEach(rp => {
        rp.update(delta, this.camera);
      });

      // Multiplayer Network Sync (25Hz)
      if (this.isMultiplayer && this.networkManager.isConnected) {
        this.netSyncTimer += delta;
        if (this.netSyncTimer >= 0.04) {
          this.netSyncTimer = 0;

          // Broadcast local player movement on deck
          this.networkManager.sendPlayerMove(
            { x: this.physics.playerLocalPos.x, y: this.physics.playerLocalPos.y },
            this.physics.heading
          );

          // Host broadcasts boat physics state
          if (this.networkManager.isHost) {
            this.networkManager.sendBoatSync(this.physics.getBoatState());
          }
        }

        // Periodic environmental state sync (1Hz) from Host
        if (this.networkManager.isHost) {
          this.envSyncTimer += delta;
          if (this.envSyncTimer >= 1.0) {
            this.envSyncTimer = 0;
            this.networkManager.sendEnvSync(
              this.dayNightCycle.timeOfDay,
              this.weatherManager ? this.weatherManager.currentWeatherStatus : 'CLEAR'
            );
          }
        }
      }

      const pPos = this.physics.worldPosition;
      this.chunkManager.update(pPos.z);

      // Update Dynamic Weather System
      if (this.weatherManager) {
        this.weatherManager.update(pPos, delta);
      }

      // Update Dynamic Day-Night Celestial Cycle
      this.dayNightCycle.update(pPos, delta);

      // Update HUD Badges
      if (this.timeEl) {
        this.timeEl.textContent = this.dayNightCycle.getTimeFormatted();
      }
      if (this.weatherEl && this.weatherManager) {
        this.weatherEl.textContent = this.weatherManager.currentWeatherStatus;
      }
      if (this.compassEl) {
        const deg = Math.round(this.physics.heading * 180 / Math.PI);
        this.compassEl.textContent = `${deg}°`;
      }

      // Rock Collisions
      if (this.rockManager) {
        this.rockManager.update(this.physics);
      }

      // Torii Gate Collisions
      if (this.toriiGateManager) {
        this.toriiGateManager.update(pPos.z);
        const gateCollision = this.toriiGateManager.checkPillarCollision(pPos);
        if (gateCollision.collided) {
          const hit = this.physics.handleCollision(gateCollision.bounceDir, gateCollision.penetration);
          if (hit) {
            this.triggerDamageFeedback();
            if (this.isMultiplayer) {
              this.networkManager.sendCollision(20, this.physics.health, gateCollision.bounceDir, gateCollision.penetration, this.physics.speed);
            }
            if (this.physics.health <= 0) {
              this.gameOver('Perahu Anda hancur menabrak tiang gerbang Torii.');
            }
          }
        }
      }

      // Shore Bank Collisions
      const collision = this.physics.check3DHullShoreCollision(this.chunkManager);
      if (collision.collided) {
        const hit = this.physics.handleCollision(collision.bounceDir, collision.penetration);
        if (hit) {
          this.triggerDamageFeedback();
          if (this.isMultiplayer) {
            this.networkManager.sendCollision(20, this.physics.health, collision.bounceDir, collision.penetration, this.physics.speed);
          }
          if (this.physics.health <= 0) {
            this.gameOver();
          }
        }
      }

      this.distanceTraveled = Math.max(this.distanceTraveled, -pPos.z);
      const speedKmH = (Math.abs(this.physics.speed) * 3.6).toFixed(1);
      const isReverse = this.physics.speed < -0.15;

      if (this.distanceEl) this.distanceEl.innerHTML = `${Math.floor(this.distanceTraveled)} <small>m</small>`;
      if (this.speedEl) this.speedEl.innerHTML = `${isReverse ? 'R ' : ''}${speedKmH} <small>km/h</small>`;

      // Proximity Trigger check for player near front-bow lantern fixture (z = -3.4m)
      const playerPosOnDeck = this.physics.playerLocalPos;
      const distToLantern = Math.hypot(playerPosOnDeck.x - 0, playerPosOnDeck.y - (-3.4));

      if (distToLantern <= 2.4) {
        if (this.btnLanternToggle) this.btnLanternToggle.classList.remove('hidden');
        if (this.woodenBoat.isLanternOn && this.lanternAimBar) {
          this.lanternAimBar.classList.remove('hidden');
        }
      } else {
        if (this.btnLanternToggle) this.btnLanternToggle.classList.add('hidden');
        if (this.lanternAimBar) this.lanternAimBar.classList.add('hidden');
      }

      // Zero-GC Camera Tracking (Wide POV: Vector3(0, 9.5, 18.0))
      this.tempCamOffset.set(0, 9.5, 18.0);
      this.tempCamOffset.applyAxisAngle(this.upAxis, this.physics.heading * 0.15);

      this.targetCamPos.copy(pPos).add(this.tempCamOffset);
      this.targetCamPos.x = THREE.MathUtils.clamp(this.targetCamPos.x, -14.0, 14.0);

      if (this.screenShake > 0) {
        this.targetCamPos.x += (Math.random() - 0.5) * this.screenShake;
        this.targetCamPos.y += (Math.random() - 0.5) * this.screenShake;
        this.screenShake = Math.max(0, this.screenShake - delta * 2.0);
      }

      this.camera.position.lerp(this.targetCamPos, 1.0 - Math.exp(-8.0 * delta));
      
      this.lookAtPos.set(0, 1.5, -9.0);
      this.lookAtPos.applyAxisAngle(this.upAxis, this.physics.heading * 0.15);
      this.lookAtPos.add(pPos);
      this.camera.lookAt(this.lookAtPos);
    }

    this.renderer.render(this.scene, this.camera);
  }

  onGatePassed(gateIndex, distanceMeters) {
    if (!this.milestoneBanner || !this.milestoneText) return;

    const formattedDist = (distanceMeters / 1000).toFixed(1).replace('.0', '') + '.000m';
    this.milestoneText.textContent = `Gerbang Torii • ${formattedDist}`;

    this.milestoneBanner.classList.remove('hidden');

    if (this.milestoneTimeout) clearTimeout(this.milestoneTimeout);
    this.milestoneTimeout = setTimeout(() => {
      if (this.milestoneBanner) {
        this.milestoneBanner.classList.add('hidden');
      }
    }, 4000);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new InfiniteLakeGame();
});
