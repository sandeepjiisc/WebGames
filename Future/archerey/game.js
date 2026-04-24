const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 400 }, debug: false }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);
let bow, arrow, target, bg;
let isDragging = false;
let level = 1;
let score = 0;
let scoreText, levelText, instructionText;
let startDragPoint = null;

function preload() {
    this.load.image('bg', 'assets/bg.png');
    this.load.image('target', 'assets/target.png');
    this.load.image('arrow', 'assets/arrow.png');
    this.load.image('bow', 'assets/bow.png');
}

function create() {
    document.getElementById('loading').style.display = 'none';

    this.add.image(400, 300, 'bg');

    // Physics group for target
    target = this.physics.add.staticImage(700, 400, 'target');

    bow = this.add.image(100, 400, 'bow');
    bow.setOrigin(0.5, 0.5);

    arrow = this.physics.add.sprite(100, 400, 'arrow');
    arrow.body.allowGravity = false;
    arrow.setCollideWorldBounds(false);

    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#fff', stroke: '#000', strokeThickness: 3 });
    levelText = this.add.text(16, 45, 'Level: 1', { fontSize: '24px', fill: '#fff', stroke: '#000', strokeThickness: 3 });
    instructionText = this.add.text(16, 75, 'Drag mouse/touch left to draw bow. Release to fire.', { fontSize: '16px', fill: '#fff', stroke: '#000', strokeThickness: 2 });

    this.input.on('pointerdown', (pointer) => {
        if (!arrow.body.allowGravity) {
            isDragging = true;
            startDragPoint = { x: pointer.x, y: pointer.y };
        }
    });

    this.input.on('pointermove', (pointer) => {
        if (isDragging) {
            let dx = pointer.x - startDragPoint.x;
            let dy = pointer.y - startDragPoint.y;
            let angle = Math.atan2(dy, dx);

            // Bow aiming mechanic (reversed because pulling back aims forward)
            bow.rotation = angle + Math.PI;
            arrow.rotation = angle + Math.PI;

            // Visual pullback
            let pullbackX = Math.max(-60, dx * 0.3);
            bow.x = 100 + pullbackX;
            bow.y = 400 + dy * 0.1;
            arrow.x = bow.x;
            arrow.y = bow.y;
        }
    });

    this.input.on('pointerup', (pointer) => {
        if (isDragging) {
            isDragging = false;
            let dx = startDragPoint.x - pointer.x;
            let dy = startDragPoint.y - pointer.y;

            if (dx > 20) { // minimum draw length
                arrow.body.allowGravity = true;
                let power = Math.min(Math.sqrt(dx*dx + dy*dy) * 6, 1500);
                let angle = arrow.rotation;

                arrow.setVelocity(Math.cos(angle) * power, Math.sin(angle) * power);
            } else {
                resetArrow(); // Snap back if draw too short
            }

            // Reset bow visual
            bow.x = 100;
            bow.y = 400;
            bow.rotation = 0;
        }
    });

    this.physics.add.overlap(arrow, target, hitTarget, null, this);
}

function update() {
    if (arrow.body.allowGravity) {
        // Arrow points to velocity trajectory
        arrow.rotation = Math.atan2(arrow.body.velocity.y, arrow.body.velocity.x);
    }

    // Reset if out of bounds
    if (arrow.x > 850 || arrow.y > 700 || arrow.y < -200) {
        resetArrow();
    }
}

function hitTarget(a, t) {
    let dist = Phaser.Math.Distance.Between(a.x, a.y, t.x, t.y);
    let maxDist = 50 * t.scale;

    if (dist < maxDist) {
        // Calculate points based on closeness to bullseye
        let points = Math.max(10 - Math.floor(dist / (maxDist / 10)), 1) * 10;
        score += points;
        scoreText.setText('Score: ' + score);

        level++;
        levelText.setText('Level: ' + level);

        // Increase Difficulty: change position and shrink target
        t.setPosition(Phaser.Math.Between(400, 750), Phaser.Math.Between(200, 500));
        t.setScale(Math.max(0.2, 1 - (level * 0.05)));
        t.refreshBody();

        // Floating point text
        let ptsText = this.add.text(t.x, t.y - 40, '+' + points, { fontSize: '24px', fill: '#ff0', stroke: '#000', strokeThickness: 4 });
        this.tweens.add({
            targets: ptsText,
            y: t.y - 100,
            alpha: 0,
            duration: 1000,
            onComplete: () => ptsText.destroy()
        });
    }
    resetArrow();
}

function resetArrow() {
    arrow.body.allowGravity = false;
    arrow.setVelocity(0, 0);
    arrow.setPosition(100, 400);
    arrow.rotation = 0;
    bow.rotation = 0;
}
