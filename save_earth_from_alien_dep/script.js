class Planet {
    constructor(game){
        this.game = game;
        this.x = this.game.width * 0.5;
        this.y = this.game.height * 0.5;
        this.radius = 80;
        this.image = document.getElementById('planet');
    }
    draw(context){
        context.drawImage(this.image, this.x - 100, this.y - 100);
        if (this.game.debug){
            context.beginPath();
            context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            context.stroke();
        }
    }
    update() {
        this.x = this.game.width * 0.5;
        this.y = this.game.height * 0.5;
    }
}

class Player {
    constructor(game){
        this.game = game;
        this.x = this.game.width * 0.5;
        this.y = this.game.height * 0.5;
        this.radius = 40;
        this.image = document.getElementById('player');
        this.aim;
        this.angle = 0;
    }
    draw(context){
        context.save();
        context.translate(this.x, this.y);
        context.rotate(this.angle);
        context.drawImage(this.image, -this.radius, -this.radius);
        if (this.game.debug){
            context.beginPath();
            context.arc(0, 0, this.radius, 0, Math.PI * 2);
            context.stroke();
        }
        context.restore();
    }
    update(){
        this.aim = this.game.calcAim(this.game.planet, this.game.mouse);
        this.x = this.game.planet.x + (this.game.planet.radius + this.radius) * this.aim[0];
        this.y = this.game.planet.y + (this.game.planet.radius + this.radius) * this.aim[1];
        this.angle = Math.atan2(this.aim[3], this.aim[2]);
    }
    shoot(){
        const projectile = this.game.getProjectile();
        if (projectile) projectile.start(this.x + this.radius * this.aim[0], this.y + this.radius * this.aim[1],this.aim[0], this.aim[1]);
    }
}

class Projectile {
    constructor(game){
        this.game = game;
        this.x;
        this.y;
        this.radius = 5;
        this.speedX = 1;
        this.speedY = 1;
        this.speedModifier = 5;
        this.free = true;
    }
    start(x, y, speedX, speedY){
        this.free = false;
        this.x = x;
        this.y = y;
        this.speedX = speedX * this.speedModifier;
        this.speedY = speedY * this.speedModifier;
    }
    reset(){
        this.free = true;
    }
    draw(context){
        if (!this.free){
            context.save();
            context.beginPath();
            context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            context.fillStyle = 'gold';
            context.fill();
            context.restore();
        }
    }
    update(){
        if (!this.free){
            this.x += this.speedX;
            this.y += this.speedY;
        }
        // reset if outside the visible game area
        if (this.x < 0 || this.x > this.game.width ||
            this.y < 0 || this.y > this.game.height){
                this.reset();
            }
    }
}

class Enemy {
    constructor(game){
        this.game = game;
        this.x = 0;
        this.y = 0;
        this.radius = 40;
        this.width = this.radius * 2;
        this.height = this.radius * 2;
        this.speedX = 0;
        this.speedY = 0;
        this.speedModifier = Math.random() * 0.7 + 0.1;
        this.angle = 0;
        this.collided = false;
        this.free = true;
    }
    start(){
        this.free = false;
        this.collided = false;
        this.frameX = 0;
        this.lives = this.maxLives;
        this.frameY = Math.floor(Math.random() * 4);
        if (Math.random() < 0.5){
            this.x = Math.random() * this.game.width;
            this.y = Math.random() < 0.5 ? -this.radius : this.game.height + this.radius;
        } else {
            this.x = Math.random() < 0.5 ? -this.radius : this.game.width + this.radius;
            this.y = Math.random() * this.game.height;
        } 
        const aim = this.game.calcAim(this, this.game.planet);
        this.speedX = aim[0] * this.speedModifier;
        this.speedY = aim[1] * this.speedModifier;
        this.angle = Math.atan2(aim[3], aim[2]) + Math.PI * 0.5;
    }
    reset(){
        this.free = true;
    }
    hit(damage){
        this.lives -= damage;
        if (this.lives >= 1) this.frameX++;
    }
    draw(context){
        if (!this.free){
            context.save();
            context.translate(this.x, this.y);
            context.rotate(this.angle);
            context.drawImage(this.image, this.frameX * this.width, this.frameY * this.height, this.width, this.height, -this.radius, -this.radius, this.width, this.height);
            if (this.game.debug){
                context.beginPath();
                context.arc(0, 0, this.radius, 0, Math.PI * 2);
                context.stroke();
                context.fillStyle = 'white';
                context.fillText(this.lives, 0, 0);
            }
            context.restore();
        }
    }
    update(){
        if (!this.free){
            this.x += this.speedX;
            this.y += this.speedY;
            // check collision enemy / planet
            if (this.game.checkCollision(this, this.game.planet) && this.lives >= 1){
                this.lives = 0;
                this.speedX = 0;
                this.speedY = 0;
                this.collided = true;
                this.game.lives--;
            }
            // check collision enemy / player
            if (this.game.checkCollision(this, this.game.player) && this.lives >= 1){
                this.lives = 0;
                this.collided = true;
                this.game.lives--;
            }
            // check collision enemy / projectiles
            this.game.projectilePool.forEach(projectile => {
                if (!projectile.free && this.game.checkCollision(this, projectile) && this.lives >= 1){
                    projectile.reset();
                    this.hit(1);
                }
            });
            // sprite animation
            if (this.lives < 1 && this.game.spriteUpdate) {
                this.frameX++;
            }
            if (this.frameX > this.maxFrame) {
                this.reset();
                if (!this.collided && !this.game.gameOver) this.game.score += this.maxLives;
            }
        } 
    }
}

class Asteroid extends Enemy {
    constructor(game){
        super(game);
        this.image = game.asteroidImg;
        this.frameX = 0;
        this.frameY = Math.floor(Math.random() * 4);
        this.maxFrame = 7;
        this.lives = 1;
        this.maxLives = this.lives;
    }
}

class Lobstermorph extends Enemy {
    constructor(game){
        super(game);
        this.image = game.lobstermorphImg;
        this.frameX = 0;
        this.frameY = Math.floor(Math.random() * 4);
        this.maxFrame = 14;
        this.lives = 8;
        this.maxLives = this.lives;
    }
}

class Beetlemorph extends Enemy {
    constructor(game){
        super(game);
        this.image = game.beetlemorphImg;
        this.frameX = 0;
        this.frameY = Math.floor(Math.random() * 4);
        this.maxFrame = 3;
        this.lives = 1;
        this.maxLives = this.lives;
    }
}

class Rhinomorph extends Enemy {
    constructor(game){
        super(game);
        this.image = game.rhinomorphImg;
        this.frameX = 0;
        this.frameY = Math.floor(Math.random() * 4);
        this.maxFrame = 6;
        this.lives = 4;
        this.maxLives = this.lives;
    }
}

class Game {
    constructor(canvas, ctx){
        this.canvas = canvas;
        this.ctx = ctx;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.debug = false;

        this.processImages();

        this.planet = new Planet(this);
        this.player = new Player(this);

        this.projectilePool = [];
        this.numberOfProjectiles = 20;
        this.createProjectilePool();

        this.enemyPool = [];
        this.numberOfEnemies = 20;
        this.createEnemyPool();
        
        this.enemyTimer = 0;
        this.enemyInterval = 1200;

        this.spriteUpdate = false;
        this.spriteTimer = 0;
        this.spriteInterval = 150;
        this.score = 0;
        this.winningScore = 50;
        this.lives = 10;
        this.gameOver = true;

        this.mouse = {
            x: this.width * 0.5,
            y: this.height * 0.5
        }

        this.initControls();
        this.resize(window.innerWidth, window.innerHeight);
    }

    processImages() {
        const removeWhite = (id) => {
            const img = document.getElementById(id);
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

        this.asteroidImg = removeWhite('asteroid');
        this.lobstermorphImg = removeWhite('lobstermorph');
        this.beetlemorphImg = removeWhite('beetlemorph');
        this.rhinomorphImg = removeWhite('rhinomorph');
    }

    initControls() {
        const handleInput = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = clientX - rect.left;
            this.mouse.y = clientY - rect.top;
        };

        window.addEventListener('mousemove', e => handleInput(e.clientX, e.clientY));
        window.addEventListener('mousedown', e => {
            handleInput(e.clientX, e.clientY);
            if (!this.gameOver) this.player.shoot();
        });

        window.addEventListener('touchstart', e => {
            handleInput(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: false});

        window.addEventListener('touchmove', e => {
            e.preventDefault();
            handleInput(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: false});

        window.addEventListener('keyup', e => {
            if (e.key.toLowerCase() === 'd') this.debug = !this.debug;
            else if (e.key === 'Enter' || e.key.toLowerCase() === 'r') this.start();
            else if (e.key === ' ' || e.key.toLowerCase() === 'f') this.toggleFullScreen();
            else if (e.code === 'Space') {
                if (!this.gameOver) this.player.shoot();
            }
        });

        document.getElementById('resetButton').addEventListener('click', () => this.start());
        document.getElementById('fullScreenButton').addEventListener('click', () => this.toggleFullScreen());
        
        const shootBtn = document.getElementById('btn-shoot');
        const triggerShoot = (e) => {
            e.preventDefault();
            if (!this.gameOver) this.player.shoot();
        };
        shootBtn.addEventListener('touchstart', triggerShoot, {passive: false});
        shootBtn.addEventListener('mousedown', triggerShoot);

        window.addEventListener('resize', () => this.resize(window.innerWidth, window.innerHeight));
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        if (this.planet) this.planet.update();
        
        this.ctx.strokeStyle = 'white';
        this.ctx.fillStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.font = '30px Helvetica';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
    }

    toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }

    start() {
        this.score = 0;
        this.lives = 10;
        this.gameOver = false;
        this.enemyPool.forEach(enemy => enemy.reset());
        this.projectilePool.forEach(p => p.reset());
    }

    render(context, deltaTime){
        this.planet.draw(context);
        this.drawStatusText(context);
        
        if (!this.gameOver) {
            this.player.update();
            this.player.draw(context);

            this.projectilePool.forEach(projectile => {
                projectile.draw(context);
                projectile.update();
            });

            this.enemyPool.forEach(enemy => {
                enemy.draw(context);
                enemy.update();
            });

            if (this.enemyTimer < this.enemyInterval){
                this.enemyTimer += deltaTime;
            } else {
                this.enemyTimer = 0;
                const enemy = this.getEnemy();
                if (enemy) enemy.start();
            }
        }

        if (this.spriteTimer < this.spriteInterval){
            this.spriteTimer += deltaTime;
            this.spriteUpdate = false;
        } else {
            this.spriteTimer = 0;
            this.spriteUpdate = true;
        }

        if (this.score >= this.winningScore || this.lives < 1){
            this.gameOver = true;
        }
    }

    drawStatusText(context){
        context.save();
        context.textAlign = 'left';
        context.font = '30px Impact';
        context.fillStyle = 'white';
        context.fillText('Score: ' + this.score, 20, 40);
        for (let i = 0; i < this.lives; i++){
            context.fillRect(20 + 15 * i, 60, 10, 30);
        }
        if (this.gameOver){
            context.textAlign = 'center';
            let message1;
            let message2;
            if (this.score >= this.winningScore){
                message1 = 'You win!';
                message2 = 'Your score is ' + this.score + '!';
            } else if (this.lives < 1) {
                message1 = 'You lose!';
                message2 = 'Try again!';
            } else {
                message1 = 'Save Earth!';
                message2 = 'Press R, Space or 🔥 to Start';
            }
            context.font = '100px Impact';
            context.fillText(message1, this.width * 0.5, this.height * 0.5 - 50);
            context.font = '50px Impact';
            context.fillText(message2, this.width * 0.5, this.height * 0.5 + 50);
        }
        context.restore();
    }
    calcAim(a, b){
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.hypot(dx, dy);
        const aimX = dx / distance * -1;
        const aimY = dy / distance * -1;
        return [ aimX, aimY, dx, dy ];
    }
    checkCollision(a, b){
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.hypot(dx, dy);
        const sumOfRadii = a.radius + b.radius;
        return distance < sumOfRadii;
    }
    createProjectilePool(){
        for (let i = 0; i < this.numberOfProjectiles; i++){
            this.projectilePool.push(new Projectile(this));
        }
    }
    getProjectile(){
        for (let i = 0; i < this.projectilePool.length; i++){
            if (this.projectilePool[i].free) return this.projectilePool[i];
        }
    }
    createEnemyPool(){
        for (let i = 0; i < this.numberOfEnemies; i++){
            let randomNumber = Math.random();
            if (randomNumber < 0.25){
                this.enemyPool.push(new Asteroid(this));
            } else if (randomNumber < 0.5) {
                this.enemyPool.push(new Beetlemorph(this));
            } else if (randomNumber < 0.75) {
                this.enemyPool.push(new Rhinomorph(this));
            } else {
                this.enemyPool.push(new Lobstermorph(this));
            }
        }
    }
    getEnemy(){
        for (let i = 0; i < this.enemyPool.length; i++){
            if (this.enemyPool[i].free) return this.enemyPool[i];
        }
    }
}

window.addEventListener('load', function(){
    const canvas = document.getElementById('canvas1');
    const ctx = canvas.getContext('2d');
    
    const game = new Game(canvas, ctx);

    let lastTime = 0;
    function animate(timeStamp){
        const deltaTime = timeStamp - lastTime;
        lastTime = timeStamp;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        game.render(ctx, deltaTime);
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
});