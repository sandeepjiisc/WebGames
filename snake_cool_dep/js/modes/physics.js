(function(){
if(!window.Modes) window.Modes = {};
const Ph = {};

Ph.initAll = function(game, env){
  // prepare physics state placeholder
  game._physics = game._physics || { particles: [], mass: 1, k: 200, damping: 12, iterations: 2 };
  // initialize particle positions from snake cells
  const arr = [];
  for(let i=0;i<game.snake.length;i++){
    const s = game.snake[i]; arr.push({x: (s.x+0.5)*env.cell, y: (s.y+0.5)*env.cell, vx:0, vy:0});
  }
  game._physics.particles = arr;
}

Ph.updateAll = function(game, dt, env){
  if(game.mode !== 'physics') return;
  const ph = game._physics; if(!ph) return;
  const L0 = env.cell; const k = ph.k; const m = ph.mass; const damping = ph.damping;
  // forces
  for(let i=0;i<ph.particles.length;i++) ph.particles[i].fx = ph.particles[i].fy = 0;
  for(let i=0;i<ph.particles.length-1;i++){
    const a = ph.particles[i], b = ph.particles[i+1];
    const dx = b.x - a.x, dy = b.y - a.y; const dist = Math.hypot(dx,dy)||1;
    const diff = dist - L0; const nx = dx/dist, ny = dy/dist;
    const fs = -k * diff;
    a.fx += fs * nx; a.fy += fs * ny;
    b.fx -= fs * nx; b.fy -= fs * ny;
  }
  // integrate semi-implicit
  for(let p of ph.particles){
    // damping
    const ax = p.fx / m - damping * p.vx / m;
    const ay = p.fy / m - damping * p.vy / m;
    p.vx += ax * dt; p.vy += ay * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  // iterative constraint projection
  for(let it=0; it<ph.iterations; it++){
    for(let i=0;i<ph.particles.length-1;i++){
      const a = ph.particles[i], b = ph.particles[i+1];
      const dx = b.x - a.x, dy = b.y - a.y; const dist = Math.hypot(dx,dy)||1;
      const diff = (dist - L0)/dist * 0.5;
      const ox = dx * diff, oy = dy * diff;
      b.x -= ox; b.y -= oy; a.x += ox; a.y += oy;
    }
  }
  // update discrete snake cells from head particle
  // head follows player input by snapping toward next cell
  const head = ph.particles[0];
  const hx = Math.floor(head.x / env.cell), hy = Math.floor(head.y / env.cell);
  // ensure within bounds
  if(hx<0||hy<0||hx>=env.cols||hy>=env.rows){ head.x = ((hx+env.cols)%env.cols+0.5)*env.cell; head.y = ((hy+env.rows)%env.rows+0.5)*env.cell; }
  // update game.snake positions by mapping particle positions to nearest cells
  for(let i=0;i<game.snake.length;i++){
    const p = ph.particles[i]; game.snake[i].x = Math.floor(p.x / env.cell); game.snake[i].y = Math.floor(p.y / env.cell);
  }
}

Ph.renderAll = function(game, ctx, env){
  if(game.mode !== 'physics') return;
  const ph = game._physics; if(!ph) return;
  // draw springs
  ctx.save(); ctx.lineWidth = 2; for(let i=0;i<ph.particles.length-1;i++){
    const a = ph.particles[i], b = ph.particles[i+1]; ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  // draw particles
  for(let i=0;i<ph.particles.length;i++){
    const p = ph.particles[i]; ctx.fillStyle = `hsl(${(i/ph.particles.length)*360},90%,55%)`; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(3, env.cell*0.25), 0, Math.PI*2); ctx.fill(); }
  ctx.restore();
}

window.Modes = window.Modes || {};
window.Modes.physics = Ph;

})();
