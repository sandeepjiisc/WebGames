(function(){
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let DPR = window.devicePixelRatio || 1;
function fitCanvas(){
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * DPR);
  canvas.height = Math.floor(rect.height * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize',fitCanvas);
fitCanvas();

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('high');
const lengthEl = document.getElementById('length');
const speedInput = document.getElementById('speed');
const hueInput = document.getElementById('hue');
const trailInput = document.getElementById('trail');
const speedLabel = document.getElementById('speedLabel');
const toggleGrid = document.getElementById('toggleGrid');
const toggleParticles = document.getElementById('toggleParticles');
const toggleSound = document.getElementById('toggleSound');

const tUp = document.getElementById('tUp');
const tDown = document.getElementById('tDown');
const tLeft = document.getElementById('tLeft');
const tRight = document.getElementById('tRight');

let GRID = 24; // number of cells along shorter axis
let cols, rows, cell;
function setGrid(){
  const w = canvas.width / DPR; const h = canvas.height / DPR;
  if(w>h){ cell = Math.max(12, Math.floor(h / GRID)); } else { cell = Math.max(12, Math.floor(w / GRID)); }
  cols = Math.floor(w / cell); rows = Math.floor(h / cell);
}
setGrid();

let soundOn = true, particlesOn = true, showGrid = false;
let hueBase = Number(hueInput.value);

let game;

function randInt(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function pick(array){return array[Math.floor(Math.random()*array.length)]}

function makeSound(type='blip', freq=440, dur=0.06){
  if(!soundOn) return;
  try{const ac = makeSound.ac || (makeSound.ac = new (window.AudioContext||window.webkitAudioContext)());
    const o = ac.createOscillator(); const g = ac.createGain(); o.connect(g); g.connect(ac.destination);
    o.type = type==='blip'?'sine':type==='square'?'square':'sawtooth'; o.frequency.value = freq;
    g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.12, ac.currentTime+0.01);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+dur);
    o.stop(ac.currentTime+dur+0.02);
  }catch(e){}
}

function newGame(){
  setGrid();
  game = {
    snake: [], dir: {x:1,y:0}, nextDir:null, alive:true, score:0, speed: Number(speedInput.value), timer:0,
    food:[], particles:[], tick:0, paused:false, trail: Number(trailInput.value), hue: Number(hueInput.value), mode: null
  };
  const startLen = 4;
  const sx = Math.floor(cols/2), sy = Math.floor(rows/2);
  for(let i=0;i<startLen;i++) game.snake.push({x:sx-i,y:sy});
  spawnFood(3);
  updateUI();
  // initialize mode if present
  if(window.Modes && window.Modes.initAll) window.Modes.initAll(game, {cols,rows,cell});
}

function updateUI(){
  scoreEl.textContent = game.score;
  lengthEl.textContent = game.snake.length;
  highEl.textContent = localStorage.getItem('snake_high')||0;
  speedLabel.textContent = game.speed<=6? 'Slow' : game.speed<=12 ? 'Normal' : game.speed<=18 ? 'Fast' : 'Insane';
}

function spawnFood(n=1){
  for(let i=0;i<n;i++){
    let t = Math.random();
    let types = ['apple','apple','apple','gold','speed','slow','shrink','grow'];
    let type = t<0.02? 'gold' : pick(types);
    let pos;
    while(true){pos = {x:randInt(0,cols-1), y:randInt(0,rows-1)}; if(!collidesSnake(pos) && !game.food.some(f=>f.x===pos.x && f.y===pos.y)) break;}
    game.food.push({x:pos.x,y:pos.y,type,ttl: randInt(8,20)});
  }
}
function collidesSnake(p){return game.snake.some(s=>s.x===p.x && s.y===p.y)}

function step(delta){
  if(!game || game.paused) return;
  // allow mode-specific updates (physics, vector field, etc)
  if(window.Modes && window.Modes.updateAll) window.Modes.updateAll(game, delta, {cols,rows,cell});

  game.timer += delta;
  const interval = 1/Math.max(4, game.speed/2); // seconds per move
  while(game.timer > interval){
    game.timer -= interval;
    game.tick++;
    // apply next direction
    if(game.nextDir){
      if(game.nextDir.x !== -game.dir.x || game.nextDir.y !== -game.dir.y) game.dir = game.nextDir;
      game.nextDir = null;
    }
    const head = {x: game.snake[0].x + game.dir.x, y: game.snake[0].y + game.dir.y};
    if(head.x<0) head.x = cols-1; if(head.x>=cols) head.x=0; if(head.y<0) head.y = rows-1; if(head.y>=rows) head.y=0;
    if(collidesSnake(head)) { game.alive=false; makeSound('sawtooth',120,0.25); game.paused=true; saveHigh(); return; }
    game.snake.unshift(head);
    let ate = null;
    for(let i=0;i<game.food.length;i++){
      const f = game.food[i]; if(f.x===head.x && f.y===head.y){ ate = f; game.food.splice(i,1); break; }
    }
    if(ate){ applyFoodEffect(ate); spawnParticles(head.x,head.y, ate); makeSound('square', 300 + game.snake.length*3, 0.06); }
    else game.snake.pop();
    // shrink TTL and maybe respawn
    for(let f of game.food){ f.ttl -= interval; }
    game.food = game.food.filter(f=> f.ttl>0);
    if(game.food.length < 3 && Math.random() < 0.45) spawnFood(1);
  }
}

function applyFoodEffect(f){
  if(f.type === 'gold'){ game.score += 50; game.speed = Math.min(30, game.speed + 2); }
  else if(f.type === 'speed'){ game.speed = Math.min(36, game.speed + 4); game.score += 8; }
  else if(f.type === 'slow'){ game.speed = Math.max(4, game.speed - 4); game.score += 6; }
  else if(f.type === 'shrink'){ if(game.snake.length>3) game.snake.splice(-3,3); game.score += 4; }
  else if(f.type === 'grow'){ for(let i=0;i<2;i++) game.snake.push({...game.snake[game.snake.length-1]}); game.score += 10; }
  else { game.score += 10; }
  updateUI(); saveHigh();
}

function saveHigh(){ const h = Number(localStorage.getItem('snake_high')||0); if(game.score > h) localStorage.setItem('snake_high', game.score); }

function spawnParticles(cx,cy, f){ if(!particlesOn) return; const count = f.type==='gold'? 30 : 12; for(let i=0;i<count;i++){ game.particles.push({x: (cx+0.5)*cell, y:(cy+0.5)*cell, vx:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*3, life: randInt(20,60), hue: (hueBase+Math.random()*120)%360, size: Math.random()*2+0.5 }); } }

function render(){
  fitCanvas(); setGrid();
  ctx.clearRect(0,0,canvas.width/DPR,canvas.height/DPR);
  // background gradient animated
  const w = canvas.width/DPR, h = canvas.height/DPR;
  const g = ctx.createLinearGradient(0,0,w,h);
  const t = Date.now()/10000;
  g.addColorStop(0, `hsl(${hueBase+30*t},30%,6%)`);
  g.addColorStop(0.5, `hsl(${(hueBase+60)%360},40%,9%)`);
  g.addColorStop(1, `hsl(${(hueBase+120)%360},30%,6%)`);
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

  // subtle grid
  if(showGrid){ ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth=1; for(let i=0;i<=cols;i++){ ctx.beginPath(); ctx.moveTo(i*cell,0); ctx.lineTo(i*cell,h); ctx.stroke(); } for(let j=0;j<=rows;j++){ ctx.beginPath(); ctx.moveTo(0,j*cell); ctx.lineTo(w,j*cell); ctx.stroke(); } }

  // trail fade
  ctx.fillStyle = `rgba(0,0,0,${game.trail})`;
  ctx.fillRect(0,0,w,h);

  // draw food
  for(let f of game.food){ const px = f.x*cell, py = f.y*cell; if(f.type==='gold'){ drawStar(px+cell/2,py+cell/2,cell*0.35,cell*0.15,6, `hsl(${(hueBase+60)%360},90%,60%)`); } else { // colorful apple
      const hf = (hueBase + (f.type==='speed'?120: f.type==='slow'?240:0) + (f.x*7+f.y*13))%360;
      const grad = ctx.createRadialGradient(px+cell*0.4,py+cell*0.35,1,px+cell/2,py+cell/2,cell*0.6);
      grad.addColorStop(0, `hsl(${hf},90%,60%)`);
      grad.addColorStop(1, `hsl(${(hf+40)%360},60%,35%)`);
      ctx.fillStyle = grad; roundRect(ctx, px+cell*0.12, py+cell*0.12, cell*0.76, cell*0.76, 6); ctx.fill();
    }
  }

  // draw snake with rainbow gradient along length
  const len = game.snake.length;
  for(let i=0;i<len;i++){
    const s = game.snake[i]; const x = s.x*cell, y = s.y*cell;
    const hue = (hueBase + (i/len)*360) % 360;
    ctx.fillStyle = `hsl(${hue},90%,55%)`;
    ctx.strokeStyle = `hsl(${hue},80%,30%)`;
    roundRect(ctx, x+2, y+2, cell-4, cell-4, 6);
    ctx.fill(); ctx.lineWidth=1; ctx.stroke();
  }

  // head glow
  if(game.snake.length>0){ const hSeg = game.snake[0]; const hx = hSeg.x*cell, hy=hSeg.y*cell; ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,0.06)`; ctx.ellipse(hx+cell/2,hy+cell/2,cell*0.9,cell*0.9,0,0,Math.PI*2); ctx.fill(); }

  // particles
  for(let i=game.particles.length-1;i>=0;i--){ const p = game.particles[i]; ctx.fillStyle = `hsl(${p.hue},90%,60%)`; ctx.globalAlpha = Math.max(0, p.life/60); ctx.beginPath(); ctx.arc(p.x, p.y, p.size,0,Math.PI*2); ctx.fill(); p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life--; if(p.life<=0) game.particles.splice(i,1); }
  ctx.globalAlpha = 1;

  // mode-specific rendering
  if(window.Modes && window.Modes.renderAll) window.Modes.renderAll(game, ctx, {cols,rows,cell});

  // HUD
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(8,8,160,64); ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.fillText('Score: '+game.score, 16,28); ctx.fillText('Length: '+game.snake.length, 16,46);
  if(game.paused){ ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(w/2-120,h/2-44,240,88); ctx.fillStyle='#fff'; ctx.font='20px system-ui'; ctx.fillText(game.alive? 'PAUSED' : 'GAME OVER', w/2-48, h/2); }
}

function roundRect(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

function drawStar(cx,cy,outer,inner, points, color){ ctx.save(); ctx.translate(cx,cy); ctx.beginPath(); for(let i=0;i<points*2;i++){ const r = (i%2===0)?outer:inner; const a = (Math.PI*2)*(i/(points*2)); ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); } ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore(); }

// input
const keyMap = {arrowup:{x:0,y:-1}, arrowdown:{x:0,y:1}, arrowleft:{x:-1,y:0}, arrowright:{x:1,y:0}, w:{x:0,y:-1}, s:{x:0,y:1}, a:{x:-1,y:0}, d:{x:1,y:0}};
window.addEventListener('keydown', e=>{
  if(e.key === ' '){ if(game) game.paused = !game.paused; e.preventDefault(); return; }
  const k = e.key.toLowerCase(); 
  if(keyMap[k] && game) { 
      game.nextDir = keyMap[k]; 
      if(k.startsWith('arrow')) e.preventDefault();
  }
});

// touch swipe
let touchStart = null;
canvas.addEventListener('touchstart', e=>{ const t=e.changedTouches[0]; touchStart = {x:t.clientX,y:t.clientY,time:Date.now()}; });
canvas.addEventListener('touchend', e=>{ const t=e.changedTouches[0]; if(!touchStart) return; const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y; if(Math.hypot(dx,dy)<30) return; if(Math.abs(dx)>Math.abs(dy)){ if(game) game.nextDir = dx>0?{x:1,y:0}:{x:-1,y:0}; } else { if(game) game.nextDir = dy>0?{x:0,y:1}:{x:0,y:-1}; } touchStart=null; });

tUp.addEventListener('click',()=>{ if(game) game.nextDir={x:0,y:-1}; }); tDown.addEventListener('click',()=>{ if(game) game.nextDir={x:0,y:1}; }); tLeft.addEventListener('click',()=>{ if(game) game.nextDir={x:-1,y:0}; }); tRight.addEventListener('click',()=>{ if(game) game.nextDir={x:1,y:0}; });

// UI events
startBtn.addEventListener('click', ()=>{ newGame(); if(game) game.paused=false; });
pauseBtn.addEventListener('click', ()=>{ if(!game) return; game.paused = !game.paused; });
speedInput.addEventListener('input', e=>{ if(!game) return; game.speed = Number(e.target.value); updateUI(); });
hueInput.addEventListener('input', e=>{ hueBase = Number(e.target.value); if(game) game.hue = hueBase; });
trailInput.addEventListener('input', e=>{ if(game) game.trail = Number(e.target.value); });
toggleGrid.addEventListener('click', ()=>{ showGrid = !showGrid; toggleGrid.textContent = showGrid? 'Grid: On' : 'Toggle Grid'; });
toggleParticles.addEventListener('click', ()=>{ particlesOn = !particlesOn; toggleParticles.textContent = particlesOn? 'Particles: On' : 'Particles: Off'; });
toggleSound.addEventListener('click', ()=>{ soundOn = !soundOn; toggleSound.textContent = soundOn? 'Sound: On' : 'Sound: Off'; });

// simple game loop
let last = performance.now()/1000;
function loop(tms){ const now = tms/1000; const dt = Math.min(0.1, now-last); last = now; if(game){ step(dt); render(); updateUI(); } requestAnimationFrame(loop); }
newGame(); requestAnimationFrame(loop);

// small helper: initial high score
if(!localStorage.getItem('snake_high')) localStorage.setItem('snake_high', '0');

})();
