(function(){
if(!window.Modes) window.Modes = {};
const Hm = {};

Hm.initAll = function(game, env){
  if(!game._ham) game._ham = {};
  const cols = env.cols, rows = env.rows;
  // simple snake-like Hamiltonian for even cols: traverse rows back-and-forth
  const path = [];
  for(let y=0;y<rows;y++){
    if(y%2===0){ for(let x=0;x<cols;x++) path.push({x,y}); }
    else { for(let x=cols-1;x>=0;x--) path.push({x,y}); }
  }
  game._ham.path = path;
}

Hm.updateAll = function(game, dt, env){
  if(game.mode !== 'hamilton') return;
  const ham = game._ham; if(!ham) return;
  // follow path: compute next index for head
  const head = game.snake[0];
  // find the index of current head in path
  let idx = -1;
  for(let i=0;i<ham.path.length;i++){ const p = ham.path[i]; if(p.x===head.x && p.y===head.y){ idx=i; break; } }
  if(idx===-1){ // snap to nearest
    let best=0,bd=1e9; for(let i=0;i<ham.path.length;i++){ const p=ham.path[i]; const d = Math.abs(p.x-head.x)+Math.abs(p.y-head.y); if(d<bd){ bd=d; best=i; } } idx=best;
  }
  const next = ham.path[(idx+1)%ham.path.length]; game.nextDir = {x: next.x - head.x, y: next.y - head.y};
}

Hm.renderAll = function(game, ctx, env){
  if(game.mode !== 'hamilton') return;
  const ham = game._ham; if(!ham) return;
  ctx.save(); ctx.globalAlpha = 0.4; ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth=2; ctx.beginPath();
  for(let i=0;i<ham.path.length;i++){ const p = ham.path[i]; const x = (p.x+0.5)*env.cell, y=(p.y+0.5)*env.cell; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.stroke(); ctx.restore();
}

window.Modes = window.Modes || {};
window.Modes.hamilton = Hm;
})();
