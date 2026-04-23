class Player {
    constructor(game) {
        this.game = game;
        this.width = 60;
        this.height = 60;
        this.x = this.game.width * 0.5 - this.width * 0.5;
        this.y = this.game.height - this.height - 100;
        this.speed = 7;
        this.maxSpeed = 10;
    }
    draw() {
        this.game.ctx.save();
        this.game.ctx.fillStyle = 'cyan';
        // Simple spacecraft shape
        this.game.ctx.beginPath();
        this.game.ctx.moveTo(this.x + this.width * 0.5, this.y);
        this.game.ctx.lineTo(this.x + this.width, this.y + this.height);
        this.game.ctx.lineTo(this.x + this.width * 0.5, this.y + this.height * 0.8);
        this.game.ctx.lineTo(this.x, this.y + this.height);
        this.game.ctx.closePath();
        this.game.ctx.fill();
        this.game.ctx.strokeStyle = 'white';
        this.game.ctx.stroke();
        this.game.ctx.restore();
    }
    update() {
        if (this.game.keys.ArrowLeft || this.game.keys.left) {
            this.x -= this.speed;
        }
        if (this.game.keys.ArrowRight || this.game.keys.right) {
            this.x += this.speed;
        }

        // Constrain to canvas
        if (this.x < 0) this.x = 0;
        if (this.x > this.game.width - this.width) this.x = this.game.width - this.width;

        // Auto fire or fire on button? Let's do both
        if (this.game.keys.fire && this.game.spriteUpdate) {
            this.shoot();
        }
    }
    shoot() {
        const laser = this.game.getLaser();
        if (laser) laser.start(this.x + this.width * 0.5, this.y);
    }
}

class Laser {
    constructor(game) {
        this.game = game;
        this.width = 4;
        this.height = 20;
        this.x = 0;
        this.y = 0;
        this.speed = 15;
        this.free = true;
    }
    start(x, y) {
        this.x = x - this.width * 0.5;
        this.y = y;
        this.free = false;
    }
    reset() {
        this.free = true;
    }
    update() {
        if (!this.free) {
            this.y -= this.speed;
            if (this.y < -this.height) this.reset();

            // Check collision with enemies
            this.game.enemyPool.forEach(enemy => {
                if (!enemy.free && enemy.isAlive() && this.game.checkCollision(this, enemy)) {
                    enemy.lives--;
                    this.reset();
                }
            });
        }
    }
    draw() {
        if (!this.free) {
            this.game.ctx.save();
            this.game.ctx.fillStyle = 'gold';
            this.game.ctx.fillRect(this.x, this.y, this.width, this.height);
            this.game.ctx.restore();
        }
    }
}

class Game {
    constructor(canvas, ctx){
        this.canvas = canvas;
        this.ctx = ctx;
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.enemyPool = [];
        this.numberOfEnemies = 50;
        this.enemyTimer = 0;
        this.enemyInterval = 1000;

        this.laserPool = [];
        this.numberOfLasers = 20;
        this.createLaserPool();

        this.score = 0;
        this.lives;
        this.winningScore = 50;
        this.message1 = 'Run!';
        this.message2 = 'Or get eaten!';
        this.message3 = 'Press "ENTER" or "R" to start!';
        this.crewImage = document.getElementById('crewSprite');
        this.crewMembers = [];
        this.gameOver = true;
        this.debug = false;

        this.spriteTimer = 0;
        this.spriteInterval = 120;
        this.spriteUpdate = false;

        this.keys = {
            ArrowLeft: false,
            ArrowRight: false,
            left: false,
            right: false,
            fire: false
        };

        this.player = new Player(this);
 
        this.resize(window.innerWidth, window.innerHeight);
        this.initControls();

        // Process images for transparency
        this.processImages();
        this.createEnemyPool();
    }

    processImages() {
        const beetlemorph = document.getElementById('beetlemorph');
        const lobstermorph = document.getElementById('lobstermorph');
        
        const removeWhite = (img) => {
            const offscreen = document.createElement('canvas');
            const oCtx = offscreen.getContext('2d');
            offscreen.width = img.width;
            offscreen.height = img.height;
            oCtx.drawImage(img, 0, 0);
            const imageData = oCtx.getImageData(0, 0, offscreen.width, offscreen.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] > 220 && data[i+1] > 220 && data[i+2] > 220) {
                    data[i+3] = 0;
                }
            }
            oCtx.putImageData(imageData, 0, 0);
            return offscreen;
        };

        // We replace the source images with the processed ones
        this.beetlemorphImg = removeWhite(beetlemorph);
        this.lobstermorphImg = removeWhite(lobstermorph);
    }

    initControls() {
        this.resetButton = document.getElementById('resetButton');
        this.resetButton.addEventListener('click', e => this.start());
        
        this.fullScreenButton = document.getElementById('fullScreenButton');
        this.fullScreenButton.addEventListener('click', e => this.toggleFullScreen());

        window.addEventListener('resize', e => {
            this.resize(window.innerWidth, window.innerHeight);
        });

        window.addEventListener('keydown', e => {
            if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = true;
            if (e.code === 'Space') this.keys.fire = true;
        });

        window.addEventListener('keyup', e => {
            if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = false;
            if (e.code === 'Space') this.keys.fire = false;
            
            if (e.key === 'Enter' || e.key.toLowerCase() === 'r'){
                this.start();
            } else if (e.key.toLowerCase() === 'f'){
                this.toggleFullScreen();
            } else if (e.key.toLowerCase() === 'd'){
                this.debug = !this.debug;
            }
        });

        // Mobile buttons
        const bindMobile = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            const start = (e) => { e.preventDefault(); this.keys[key] = true; };
            const end = (e) => { e.preventDefault(); this.keys[key] = false; };
            el.addEventListener('touchstart', start, {passive: false});
            el.addEventListener('mousedown', start);
            el.addEventListener('touchend', end);
            el.addEventListener('mouseup', end);
            el.addEventListener('mouseleave', end);
        };

        bindMobile('btn-left', 'left');
        bindMobile('btn-right', 'right');
        bindMobile('btn-fire', 'fire');
    }

    start(){
        this.resize(window.innerWidth, window.innerHeight);
        this.score = 0;
        this.lives = 15;
        this.generateCrew();
        this.gameOver = false;
        this.player.x = this.width * 0.5 - this.player.width * 0.5;
        this.player.y = this.height - this.player.height - 100;
        
        this.enemyPool.forEach(enemy => enemy.reset());
        this.laserPool.forEach(laser => laser.reset());

        for (let i = 0; i < 2; i++){
            const enemy = this.getEnemy();
            if (enemy) enemy.start();
        }
    }
    generateCrew(){
        this.crewMembers = [];
        for (let i = 0; i < this.lives; i++){
            this.crewMembers.push({frameX: Math.floor(Math.random() * 5), frameY: Math.floor(Math.random() * 5)});
        }
    }
    resize(width, height){
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'white';
        this.ctx.font = '30px Bangers';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Update background based on orientation
        if (width < height) {
            this.canvas.style.backgroundImage = "url('space_flight_dep/background1080x1920.jpg')";
        } else {
            this.canvas.style.backgroundImage = "url('space_flight_dep/background1920x1080.jpg')";
        }

        if (this.player) {
            this.player.y = this.height - this.player.height - 120;
            if (this.player.x > this.width) this.player.x = this.width - this.player.width;
        }
    }
    toggleFullScreen() {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    checkCollision(rect1, rect2){
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        )
    }
    createEnemyPool(){
        for (let i = 0; i < this.numberOfEnemies; i++){
            const randomNumber = Math.random();
            if (randomNumber < 0.8){
                this.enemyPool.push(new Lobstermorph(this));
            } else {
                this.enemyPool.push(new Beetlemorph(this));
            }
         }
    }
    getEnemy(){
        for (let i = 0; i < this.enemyPool.length; i++){
            if (this.enemyPool[i].free) return this.enemyPool[i];
        }
    }
    createLaserPool() {
        for (let i = 0; i < this.numberOfLasers; i++) {
            this.laserPool.push(new Laser(this));
        }
    }
    getLaser() {
        for (let i = 0; i < this.laserPool.length; i++) {
            if (this.laserPool[i].free) return this.laserPool[i];
        }
    }
    handleEnemies(deltaTime){
        if (this.enemyTimer < this.enemyInterval){
            this.enemyTimer += deltaTime;
        } else {
            this.enemyTimer = 0;
            const enemy = this.getEnemy();
            if (enemy) enemy.start();
        }
    }
    triggerGameOver(){
        if (!this.gameOver){
            this.gameOver = true;
            if (this.lives < 1){
                this.message1 = 'Aargh!';
                this.message2 = 'The crew was eaten!';
            } else if (this.score >= this.winningScore){
                this.message1 = 'Well done!';
                this.message2 = 'You escaped the swarm!';
            }
        }
    }
    handleSpriteTimer(deltaTime){
        if (this.spriteTimer < this.spriteInterval){
            this.spriteTimer += deltaTime;
            this.spriteUpdate = false;
        } else {
            this.spriteTimer = 0;
            this.spriteUpdate = true;
        }
    }
    drawStatusText(){
        this.ctx.save();
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText('Score: ' + this.score, 20, 40);
        for (let i = 0; i < this.lives; i++){
            const w = 20;
            const h = 45;
            this.ctx.drawImage(this.crewImage, w * this.crewMembers[i].frameX, h * this.crewMembers[i].frameY, w, h, 20 + 16 * i, 60, w, h);
        }
        if (this.lives < 1 || this.score >= this.winningScore){
            this.triggerGameOver();
        }
        if (this.gameOver){
            this.ctx.textAlign = 'center';
            this.ctx.font = '80px Bangers';
            this.ctx.fillText(this.message1, this.width * 0.5, this.height * 0.5 - 25);
            this.ctx.font = '20px Bangers';
            this.ctx.fillText(this.message2, this.width * 0.5, this.height * 0.5 + 25);
            this.ctx.fillText(this.message3, this.width * 0.5, this.height * 0.5 + 50);
        }
        this.ctx.restore();
    }
    render(deltaTime){
        this.handleSpriteTimer(deltaTime);
        this.drawStatusText();
        
        if (!this.gameOver) {
            this.handleEnemies(deltaTime);
            this.player.update();
            this.player.draw();
        }

        this.laserPool.forEach(laser => {
            laser.update();
            laser.draw();
        });

        for (let i = this.enemyPool.length - 1; i >= 0; i--){
            this.enemyPool[i].update(deltaTime);
        }
        this.enemyPool.forEach(enemy => {
            enemy.draw();
        });
    }
}

window.addEventListener('load', function(){
    const canvas = document.getElementById('canvas1');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const game = new Game(canvas, ctx);

    let lastTime = 0;
    function animate(timeStamp){
        const deltaTime = timeStamp - lastTime;
        lastTime = timeStamp;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        game.render(deltaTime);
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
});