// Contra Web Clone
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const scoreElement = document.getElementById('p1-score');
const livesContainer = document.getElementById('lives');

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let lives = 3;
let keys = { w: false, a: false, s: false, d: false, space: false };
let frameCount = 0;

// Entities
let player;
let bullets = [];
let enemies = [];
let particles = [];
let platforms = [];

// Constants
const GRAVITY = 0.5;
const GROUND_Y = 500;

class Player {
    constructor() {
        this.width = 30;
        this.height = 60;
        this.x = 100;
        this.y = GROUND_Y - this.height;
        this.vx = 0;
        this.vy = 0;
        this.speed = 4;
        this.jumpForce = -12;
        this.isJumping = false;
        this.isDucking = false;
        this.direction = 1; // 1 = right, -1 = left
        this.color = '#ff0000';
        this.lastShot = 0;
        this.fireRate = 15; // frames between shots
        this.invincible = 0;
    }

    update() {
        if (this.invincible > 0) this.invincible--;

        // Horizontal movement
        if (keys.a && !this.isDucking) {
            this.vx = -this.speed;
            this.direction = -1;
        } else if (keys.d && !this.isDucking) {
            this.vx = this.speed;
            this.direction = 1;
        } else {
            this.vx = 0;
        }

        // Ducking
        if (keys.s && !this.isJumping) {
            this.isDucking = true;
            this.height = 30;
        } else {
            this.isDucking = false;
            this.height = 60;
            // Adjust y if coming out of duck
            if (this.y + this.height > GROUND_Y) {
                this.y = GROUND_Y - this.height;
            }
        }

        // Jumping
        if (keys.w && !this.isJumping && !this.isDucking) {
            this.vy = this.jumpForce;
            this.isJumping = true;
        }

        // Apply gravity
        this.vy += GRAVITY;

        // Apply velocity
        this.x += this.vx;
        this.y += this.vy;

        // Floor collision
        if (this.y + this.height > GROUND_Y) {
            this.y = GROUND_Y - this.height;
            this.vy = 0;
            this.isJumping = false;
        }

        // Screen bounds
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;

        // Firing
        if (keys.space && frameCount - this.lastShot > this.fireRate) {
            this.shoot();
        }
    }

    shoot() {
        let bx = this.direction === 1 ? this.x + this.width : this.x;
        let by = this.isDucking ? this.y + 15 : this.y + 20;

        bullets.push(new Bullet(bx, by, this.direction * 10, 0, '#ffff00', true));
        this.lastShot = frameCount;
    }

    draw() {
        // Blinking if invincible
        if (this.invincible > 0 && Math.floor(frameCount / 5) % 2 === 0) return;

        ctx.fillStyle = this.color;

        // Draw body
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Draw head/hair
        ctx.fillStyle = '#ffcc00'; // Blonde hair
        ctx.fillRect(this.x + 5, this.y - 10, 20, 15);

        // Draw gun
        ctx.fillStyle = '#888';
        if (this.direction === 1) {
            ctx.fillRect(this.x + this.width - 5, this.isDucking ? this.y + 10 : this.y + 15, 25, 8);
        } else {
            ctx.fillRect(this.x - 20, this.isDucking ? this.y + 10 : this.y + 15, 25, 8);
        }
    }

    die() {
        if (this.invincible > 0) return;

        createExplosion(this.x + this.width/2, this.y + this.height/2, '#ff0000');
        lives--;
        updateLivesDisplay();

        if (lives < 0) {
            gameState = 'GAMEOVER';
            gameOverScreen.style.display = 'flex';
        } else {
            this.x = 100;
            this.y = GROUND_Y - 60;
            this.invincible = 120; // 2 seconds at 60fps
        }
    }
}

class Bullet {
    constructor(x, y, vx, vy, color, isPlayerObj) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 4;
        this.color = color;
        this.isPlayerObj = isPlayerObj;
        this.active = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.active = false;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 50;
        this.type = type; // 0: runner, 1: shooter
        this.vx = type === 0 ? -3 : 0;
        this.active = true;
        this.color = '#00ff00';
        this.lastShot = 0;
    }

    update() {
        if (this.type === 0) {
            this.x += this.vx;
        } else if (this.type === 1) {
            // Face player
            let dir = player.x < this.x ? -1 : 1;
            if (frameCount - this.lastShot > 90 && Math.random() > 0.5) {
                // Shoot at player roughly
                let angle = Math.atan2((player.y + player.height/2) - (this.y + 20), (player.x + player.width/2) - this.x);
                let speed = 5;
                bullets.push(new Bullet(this.x + (dir === 1 ? this.width : 0), this.y + 20, Math.cos(angle)*speed, Math.sin(angle)*speed, '#ff00ff', false));
                this.lastShot = frameCount;
            }
        }

        if (this.x + this.width < -100 || this.x > canvas.width + 100) {
            this.active = false;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        if (this.type === 1) {
            // Draw gun
            ctx.fillStyle = '#555';
            let dir = player.x < this.x ? -1 : 1;
            if (dir === 1) {
                ctx.fillRect(this.x + this.width, this.y + 15, 20, 6);
            } else {
                ctx.fillRect(this.x - 20, this.y + 15, 20, 6);
            }
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 30 + Math.random() * 20;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw() {
        ctx.globalAlpha = this.life / 50;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

// Helpers
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateScore(points) {
    score += points;
    let scoreStr = score.toString().padStart(7, '0');
    scoreElement.innerText = scoreStr;
}

function updateLivesDisplay() {
    livesContainer.innerHTML = '';
    for (let i = 0; i < Math.max(0, lives); i++) {
        let life = document.createElement('div');
        life.className = 'life-icon';
        livesContainer.appendChild(life);
    }
}

function checkCollisions() {
    // Player bullets hitting enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        if (!b.isPlayerObj) continue;

        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (b.x > e.x && b.x < e.x + e.width && b.y > e.y && b.y < e.y + e.height) {
                createExplosion(e.x + e.width/2, e.y + e.height/2, '#ffaa00');
                b.active = false;
                e.active = false;
                updateScore(100);
                break;
            }
        }
    }

    // Enemy bullets hitting player
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        if (b.isPlayerObj) continue;

        if (b.x > player.x && b.x < player.x + player.width && b.y > player.y && b.y < player.y + player.height) {
            b.active = false;
            player.die();
        }
    }

    // Player touching enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (player.x < e.x + e.width && player.x + player.width > e.x &&
            player.y < e.y + e.height && player.y + player.height > e.y) {
            player.die();
        }
    }
}

function spawnEnemies() {
    if (frameCount % 120 === 0) {
        // Spawn runner
        let spawnX = Math.random() > 0.5 ? -30 : canvas.width + 30;
        let enemy = new Enemy(spawnX, GROUND_Y - 50, 0);
        enemy.vx = spawnX < 0 ? 3 : -3;
        enemies.push(enemy);
    }

    if (frameCount % 200 === 0 && Math.random() > 0.5) {
        // Spawn shooter
        let spawnX = canvas.width - 50;
        enemies.push(new Enemy(spawnX, GROUND_Y - 50, 1));
    }
}

function drawBackground() {
    // Sky
    ctx.fillStyle = '#000033';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mountains
    ctx.fillStyle = '#003300';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(200, 300);
    ctx.lineTo(400, GROUND_Y);
    ctx.lineTo(600, 250);
    ctx.lineTo(800, GROUND_Y);
    ctx.fill();

    // Ground
    ctx.fillStyle = '#228B22'; // Forest green
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    // Ground detail
    ctx.fillStyle = '#006400';
    ctx.fillRect(0, GROUND_Y, canvas.width, 10);
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.fillRect(i - (frameCount * 2) % 40, GROUND_Y + 10, 20, canvas.height - GROUND_Y);
    }
}

// Input handling
window.addEventListener('keydown', (e) => {
    let key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if (e.code === 'Space') keys.space = true;

    if (e.key === 'Enter') {
        if (gameState === 'START') {
            startGame();
        } else if (gameState === 'GAMEOVER') {
            gameState = 'START';
            gameOverScreen.style.display = 'none';
            startScreen.style.display = 'flex';
        }
    }
});

window.addEventListener('keyup', (e) => {
    let key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
    if (e.code === 'Space') keys.space = false;
});

function startGame() {
    gameState = 'PLAYING';
    startScreen.style.display = 'none';
    score = 0;
    lives = 3;
    frameCount = 0;
    updateScore(0);
    updateLivesDisplay();

    player = new Player();
    bullets = [];
    enemies = [];
    particles = [];
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'PLAYING') {
        frameCount++;

        drawBackground();
        spawnEnemies();

        player.update();
        player.draw();

        bullets.forEach(b => { b.update(); b.draw(); });
        bullets = bullets.filter(b => b.active);

        enemies.forEach(e => { e.update(); e.draw(); });
        enemies = enemies.filter(e => e.active);

        particles.forEach(p => { p.update(); p.draw(); });
        particles = particles.filter(p => p.life > 0);

        checkCollisions();
    } else if (gameState === 'START' || gameState === 'GAMEOVER') {
        // Just draw a static background
        drawBackground();
    }

    requestAnimationFrame(gameLoop);
}

// Start
updateLivesDisplay();
gameLoop();
