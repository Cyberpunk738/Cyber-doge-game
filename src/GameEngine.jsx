import { useEffect, useRef, useState } from 'react';
import { audio } from './App';

const GAME_WIDTH = 100; 
const GAME_HEIGHT = 100;

const PLAYER_SIZE = 8;
const PLAYER_Y = 85;

export default function GameEngine({ highScore, onGameOver }) {
  
  const state = useRef({
    player: { x: 50, vx: 0 },
    obstacles: [],
    collectibles: [],
    particles: [],
    floatingTexts: [],
    score: 0,
    lives: 3,
    combo: 0,
    maxCombo: 0,
    activePowerUp: null,
    powerUpTimer: 0,
    difficulty: 1,
    time: 0,
    lastSpawn: 0,
    lastColSpawn: 0,
    isShaking: false,
    isPaused: false,
    keys: {}
  });

  
  const [uiState, setUiState] = useState({
    score: 0,
    lives: 3,
    combo: 0,
    activePowerUp: null,
    isShaking: false,
    isPaused: false
  });

  const requestRef = useRef();
  const lastTimeRef = useRef();
  const containerRef = useRef();

  const spawnObstacle = () => {
    const { time, difficulty } = state.current;
    
    let width = 5 + Math.random() * 10;
    let height = 5 + Math.random() * 5;
    let type = 'normal';
    let speed = 0.3 + Math.random() * 0.4 + (difficulty * 0.15); 

    
    const rand = Math.random();
    if (difficulty > 1.5 && rand < 0.2) {
      type = 'fast';
      width = 4;
      height = 10;
      speed *= 2;
    } else if (difficulty > 2.5 && rand < 0.4) {
      type = 'large';
      width = 25;
      height = 8;
      speed *= 0.7;
    } else if (difficulty > 3.5 && rand < 0.5) {
      type = 'moving';
    }

    state.current.obstacles.push({
      id: Math.random(),
      x: Math.random() * (100 - width),
      y: -20,
      width,
      height,
      type,
      speed,
      vx: type === 'moving' ? (Math.random() > 0.5 ? 0.3 : -0.3) * (1 + difficulty) : 0
    });
  };

  const spawnCollectible = () => {
    const rand = Math.random();
    const isPowerUp = rand < 0.15; 
    let type = 'orb';
    
    if (isPowerUp) {
      const pTypes = ['shield', 'slow', 'double'];
      type = pTypes[Math.floor(Math.random() * pTypes.length)];
    }

    state.current.collectibles.push({
      id: Math.random(),
      x: 5 + Math.random() * 90,
      y: -10,
      size: type === 'orb' ? 4 : 6,
      type,
      speed: 0.4
    });
  };

  const spawnParticles = (x, y, color, count = 10, speedMult = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 * speedMult;
      state.current.particles.push({
        id: Math.random(),
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color
      });
    }
  };

  const spawnFloatingText = (x, y, text, color) => {
    state.current.floatingTexts.push({
      id: Math.random(),
      x, y,
      text,
      color,
      life: 1,
      vy: -0.2
    });
  };

  const handleCollision = () => {
    if (state.current.activePowerUp === 'shield') {
      audio.playHit();
      state.current.activePowerUp = null;
      state.current.powerUpTimer = 0;
      spawnParticles(state.current.player.x, PLAYER_Y, '#00F5FF', 30, 2); 
      spawnFloatingText(state.current.player.x, PLAYER_Y, "SHIELD BROKEN", '#00F5FF');
      return;
    }

    audio.playHit();
    state.current.lives -= 1;
    state.current.combo = 0;
    state.current.isShaking = true;
    setTimeout(() => { state.current.isShaking = false; }, 400);

    spawnParticles(state.current.player.x, PLAYER_Y, '#FF1744', 50, 3); 
    spawnFloatingText(state.current.player.x, PLAYER_Y, "HIT!", '#FF1744');

    if (state.current.lives <= 0) {
      onGameOver(Math.floor(state.current.score), state.current.maxCombo);
    }
  };

  const updatePhysics = (deltaTime) => {
    const s = state.current;
    if (s.lives <= 0) return;

    
    const playerPx = Math.min(window.innerWidth * 0.1, 50);
    const pSizeVW = (playerPx / window.innerWidth) * 100;
    const pSizeVH = (playerPx / window.innerHeight) * 100;

    
    s.time += deltaTime;
    s.difficulty = s.time / 8000; 

    
    if (s.activePowerUp && s.powerUpTimer > 0) {
      s.powerUpTimer -= deltaTime;
      if (s.powerUpTimer <= 0) s.activePowerUp = null;
    }

    
    if (s.keys['ArrowLeft'] || s.keys['a'] || s.keys['A']) s.player.vx = -1.2;
    else if (s.keys['ArrowRight'] || s.keys['d'] || s.keys['D']) s.player.vx = 1.2;
    else s.player.vx *= 0.8; 

    s.player.x += s.player.vx;
    
    
    if (s.player.x < 0) { s.player.x = 0; s.player.vx = 0; }
    if (s.player.x > 100 - pSizeVW) { s.player.x = 100 - pSizeVW; s.player.vx = 0; }

    
    if (Math.random() < 0.3) {
      s.particles.push({
        id: Math.random(),
        x: s.player.x + pSizeVW / 2,
        y: PLAYER_Y + (pSizeVH * 0.8), 
        vx: (Math.random() - 0.5) * 0.2,
        vy: 0.5 + Math.random() * 0.5,
        life: 1,
        color: '#00F5FF'
      });
    }

    
    const spawnRate = Math.max(250, 1500 - s.difficulty * 250);
    if (s.time - s.lastSpawn > spawnRate) {
      spawnObstacle();
      s.lastSpawn = s.time;
    }

    if (s.time - s.lastColSpawn > 1500) {
      spawnCollectible();
      s.lastColSpawn = s.time;
    }

    const speedMultiplier = s.activePowerUp === 'slow' ? 0.5 : (1 + s.difficulty * 0.15); 

    
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      const obs = s.obstacles[i];
      obs.y += obs.speed * speedMultiplier;
      
      if (obs.type === 'moving') {
        obs.x += obs.vx * speedMultiplier;
        if (obs.x < 0 || obs.x > 100 - obs.width) obs.vx *= -1;
      }

      
      const hitPadX = pSizeVW * 0.3; 
      const hitPadY = pSizeVH * 0.2; 

      if (
        s.player.x + hitPadX < obs.x + obs.width &&
        s.player.x + pSizeVW - hitPadX > obs.x &&
        PLAYER_Y + hitPadY < obs.y + obs.height &&
        PLAYER_Y + pSizeVH - hitPadY > obs.y
      ) {
        handleCollision();
        s.obstacles.splice(i, 1);
        continue;
      }

      if (obs.y > 110) s.obstacles.splice(i, 1);
    }

    
    for (let i = s.collectibles.length - 1; i >= 0; i--) {
      const col = s.collectibles[i];
      col.y += col.speed * speedMultiplier;

      
      if (
        s.player.x < col.x + col.size &&
        s.player.x + pSizeVW > col.x &&
        PLAYER_Y < col.y + col.size &&
        PLAYER_Y + pSizeVH > col.y
      ) {
        if (col.type === 'orb') {
          audio.playOrb();
          const points = (10 + s.combo * 2) * (s.activePowerUp === 'double' ? 2 : 1);
          s.score += points;
          s.combo += 1;
          if (s.combo > s.maxCombo) s.maxCombo = s.combo;
          spawnParticles(col.x, col.y, '#00F5FF', 15, 1.5);
          spawnFloatingText(col.x, col.y, `+${points}`, '#00F5FF');
          if (s.combo > 1 && s.combo % 5 === 0) {
            spawnFloatingText(col.x, col.y - 5, `${s.combo}x COMBO!`, '#FFE600');
          }
        } else {
          audio.playPowerup();
          s.activePowerUp = col.type;
          s.powerUpTimer = 5000; 
          spawnParticles(col.x, col.y, '#FFE600', 25, 2);
          spawnFloatingText(col.x, col.y, col.type.toUpperCase(), '#FFE600');
        }
        s.collectibles.splice(i, 1);
        continue;
      }

      if (col.y > 110) {
        if (col.type === 'orb') s.combo = 0; 
        s.collectibles.splice(i, 1);
      }
    }

    
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      if (p.life <= 0) s.particles.splice(i, 1);
    }

    
    for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
      const t = s.floatingTexts[i];
      t.y += t.vy;
      t.life -= 0.015;
      if (t.life <= 0) s.floatingTexts.splice(i, 1);
    }

    
    s.score += deltaTime * 0.01 * s.difficulty * (s.activePowerUp === 'double' ? 2 : 1);

    
    if (Math.random() < 0.2) {
      setUiState({
        score: Math.floor(s.score),
        lives: s.lives,
        combo: s.combo,
        activePowerUp: s.activePowerUp,
        isShaking: s.isShaking,
        isPaused: s.isPaused
      });
    }
  };

  const draw = () => {
    if (!containerRef.current) return;
    const s = state.current;
    
    
    
    
    let playerEl = document.getElementById('game-player');
    if (!playerEl) {
      playerEl = document.createElement('div');
      playerEl.id = 'game-player';
      playerEl.className = 'player-ship';
      containerRef.current.appendChild(playerEl);
    }
    playerEl.style.transform = `translate(${s.player.x}vw, ${PLAYER_Y}vh)`;
    if (s.activePowerUp === 'shield') playerEl.classList.add('shield-active');
    else playerEl.classList.remove('shield-active');

    
    const obsContainer = document.getElementById('obs-container') || createContainer('obs-container');
    obsContainer.innerHTML = '';
    s.obstacles.forEach(obs => {
      if (isNaN(obs.x) || isNaN(obs.y)) return;
      const el = document.createElement('div');
      el.className = `obstacle obs-${obs.type}`;
      el.style.width = `${obs.width}vw`;
      el.style.height = `${obs.height}vh`;
      el.style.top = '-100px';
      el.style.left = '-100px';
      el.style.transform = `translate(calc(${obs.x}vw + 100px), calc(${obs.y}vh + 100px))`;
      obsContainer.appendChild(el);
    });

    
    const colContainer = document.getElementById('col-container') || createContainer('col-container');
    colContainer.innerHTML = '';
    s.collectibles.forEach(col => {
      if (isNaN(col.x) || isNaN(col.y)) return;
      const el = document.createElement('div');
      el.className = `collectible col-${col.type}`;
      el.style.width = `${col.size}vw`;
      el.style.height = `${col.size}vw`; 
      el.style.top = '-100px'; 
      el.style.left = '-100px';
      el.style.transform = `translate(calc(${col.x}vw + 100px), calc(${col.y}vh + 100px))`;
      colContainer.appendChild(el);
    });

    
    const partContainer = document.getElementById('part-container') || createContainer('part-container');
    partContainer.innerHTML = '';
    s.particles.forEach(p => {
      const el = document.createElement('div');
      el.className = 'particle';
      el.style.backgroundColor = p.color;
      el.style.boxShadow = `0 0 5px ${p.color}`;
      el.style.opacity = p.life;
      el.style.transform = `translate(${p.x}vw, ${p.y}vh) scale(${p.life})`;
      partContainer.appendChild(el);
    });

    
    const textContainer = document.getElementById('text-container') || createContainer('text-container');
    textContainer.innerHTML = '';
    s.floatingTexts.forEach(t => {
      const el = document.createElement('div');
      el.className = 'floating-text';
      el.innerText = t.text;
      el.style.color = t.color;
      el.style.opacity = t.life;
      el.style.transform = `translate(${t.x}vw, ${t.y}vh) scale(${0.5 + t.life * 0.5})`;
      textContainer.appendChild(el);
    });
  };

  const createContainer = (id) => {
    const el = document.createElement('div');
    el.id = id;
    containerRef.current.appendChild(el);
    return el;
  };

  const togglePause = () => {
    state.current.isPaused = !state.current.isPaused;
    setUiState(prev => ({ ...prev, isPaused: state.current.isPaused }));
    if (!state.current.isPaused) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
  };

  const gameLoop = time => {
    if (state.current.isPaused) return;

    if (lastTimeRef.current != null) {
      const deltaTime = time - lastTimeRef.current;
      updatePhysics(Math.min(deltaTime, 50));
      draw();
    }
    lastTimeRef.current = time;
    if (state.current.lives > 0 && !state.current.isPaused) {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => { 
      if (e.key === 'Escape') togglePause();
      else state.current.keys[e.key] = true; 
    };
    const handleKeyUp = (e) => { state.current.keys[e.key] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    requestRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  
  const handleTouchStart = (dir) => { state.current.keys[dir === 'left' ? 'ArrowLeft' : 'ArrowRight'] = true; };
  const handleTouchEnd = (dir) => { state.current.keys[dir === 'left' ? 'ArrowLeft' : 'ArrowRight'] = false; };

  return (
    <div className={`screen ${uiState.isShaking ? 'shake' : ''}`}>
      {uiState.isPaused && (
        <div className="screen screen-bg" style={{ zIndex: 100 }}>
          <h1>PAUSED</h1>
          <button className="btn" onClick={togglePause}>RESUME</button>
        </div>
      )}
      <div className="hud">
        <div className="hud-left">
          <div className="score">SCORE: {uiState.score}</div>
          <div className="lives">{'❤️'.repeat(uiState.lives)}</div>
        </div>
        <div className="hud-center">
          {uiState.combo > 1 && <div className="combo">x{uiState.combo} COMBO</div>}
          {uiState.activePowerUp && <div className="powerup-status">{uiState.activePowerUp.toUpperCase()} ACTIVE</div>}
        </div>
        <div className="hud-right">
          <div className="high-score">HI: {highScore}</div>
        </div>
      </div>
      
      {}
      <div ref={containerRef} className="game-layer" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, overflow: 'hidden' }} />
      
      <div className="touch-controls">
        <div className="touch-btn" onTouchStart={() => handleTouchStart('left')} onTouchEnd={() => handleTouchEnd('left')} onMouseDown={() => handleTouchStart('left')} onMouseUp={() => handleTouchEnd('left')} onMouseLeave={() => handleTouchEnd('left')}>&lt;</div>
        <div className="touch-btn" onTouchStart={() => handleTouchStart('right')} onTouchEnd={() => handleTouchEnd('right')} onMouseDown={() => handleTouchStart('right')} onMouseUp={() => handleTouchEnd('right')} onMouseLeave={() => handleTouchEnd('right')}>&gt;</div>
      </div>
    </div>
  );
}
