(function(){
if(!window.Modes) window.Modes = {};
const Vf = {};

function makePotentialGrid(cols, rows, cell, foods){
  const U = new Float32Array(cols*rows);
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      let idx = y*cols+x; let val = 0;
      for(let f of foods){ const dx = (x - f.x), dy = (y - f.y); const d = Math.hypot(dx,dy); val += 1.0 / (d + 0.5); }
      U[idx] = val;
    }
  }
  return U;
}

Vf.initAll = function(game, env){
  game._vf = game._vf || {U:null, Vx:null, Vy:null, strength:1.0};
  game._vf.U = makePotentialGrid(env.cols, env.rows, env.cell, game.food);
  game._vf.Vx = new Float32Array(env.cols*env.rows); game._vf.Vy = new Float32Array(env.cols*env.rows);
}

Vf.updateAll = function(game, dt, env){
  if(game.mode !== 'vector') return;
  const vf = game._vf; if(!vf) return;
  // recompute potential
  vf.U = makePotentialGrid(env.cols, env.rows, env.cell, game.food);
  // compute gradients
  for(let y=1;y<env.rows-1;y++){
    for(let x=1;x<env.cols-1;x++){
      const idx = y*env.cols + x;
      const ux = (vf.U[idx+1] - vf.U[idx-1]) * 0.5;
      const uy = (vf.U[idx+env.cols] - vf.U[idx-env.cols]) * 0.5;
      vf.Vx[idx] = -ux * vf.strength; vf.Vy[idx] = -uy * vf.strength;
    }
  }
  // apply steering to head
  const hx = game.snake[0].x, hy = game.snake[0].y;
  const idx = (Math.max(1,Math.min(env.rows-2,hy)))*env.cols + Math.max(1,Math.min(env.cols-2,hx));
  const steerX = vf.Vx[idx] || 0, steerY = vf.Vy[idx] || 0;
  if(Math.abs(steerX) > Math.abs(steerY)){
    game.nextDir = steerX>0?{x:1,y:0}:{x:-1,y:0};
  } else {
    game.nextDir = steerY>0?{x:0,y:1}:{x:0,y:-1};
  }
}

Vf.renderAll = function(game, ctx, env){
  if(game.mode !== 'vector') return;
  const vf = game._vf; if(!vf || !vf.U) return;
  ctx.save(); ctx.globalAlpha = 0.85; for(let y=0;y<env.rows;y+=2){ for(let x=0;x<env.cols;x+=2){ const idx = y*env.cols + x; const vx = vf.Vx[idx], vy = vf.Vy[idx]; const sx = (x+0.5)*env.cell, sy=(y+0.5)*env.cell; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx + vx*env.cell*1.2, sy + vy*env.cell*1.2); ctx.stroke(); } }
  // heatmap (low res)
  for(let y=0;y<env.rows;y+=2){ for(let x=0;x<env.cols;x+=2){ const idx = y*env.cols + x; const v = Math.min(1, vf.U[idx]*0.8); ctx.fillStyle = `rgba(255,80,120,${v*0.08})`; ctx.fillRect(x*env.cell, y*env.cell, env.cell*2, env.cell*2); } }
  ctx.restore();
}

window.Modes = window.Modes || {};
window.Modes.vector = Vf;
})();
