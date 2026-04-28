
        // Game State
        let gameState = 'start'; // start, playing, gameover
        let score = 0;
        let level = 1;
        let combo = 0;
        
        // Three.js Setup
        let scene, camera, renderer;
        let towerGroup;
        let ball;
        let platforms = [];
        let particles = [];
        
        // Constants
        const TOWER_RADIUS = 2;
        const PLATFORM_RADIUS = 4.5;
        const PLATFORM_HEIGHT = 0.5;
        const BALL_RADIUS = 0.4;
        const GRAVITY = -0.015;
        const BOUNCE_FORCE = 0.35;
        const PLATFORM_SPACING = 5;
        
        // Colors (Fruits)
        const FRUIT_THEMES = [
            { name: 'Watermelon', safe: 0xff6b81, danger: 0x2ed573, core: 0xffffff, bg: 0xffcccc },
            { name: 'Orange', safe: 0xffa502, danger: 0x2f3542, core: 0xffeaa7, bg: 0xffebb5 },
            { name: 'Kiwi', safe: 0x7bed9f, danger: 0x8b4513, core: 0xf1f2f6, bg: 0xdff9e3 },
            { name: 'Lemon', safe: 0xeccc68, danger: 0x3742fa, core: 0xffffff, bg: 0xfdf0cc },
            { name: 'Dragonfruit', safe: 0xffffff, danger: 0xff4757, core: 0x2f3542, bg: 0xfbd0d4 }
        ];
        let currentTheme = FRUIT_THEMES[0];

        // Physics Variables
        let ballVelocityY = 0;
        let isBouncing = false;
        let targetRotation = 0;
        let currentRotation = 0;
        
        // Input Variables
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let dragSensitivity = 0.01;

        init();
        animate();

        function init() {
            const container = document.getElementById('canvas-container');
            
            // Scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(currentTheme.bg);
            scene.fog = new THREE.FogExp2(currentTheme.bg, 15, 40);

            // Camera
            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
            camera.position.set(0, 5, 12);
            camera.lookAt(0, 0, 0);

            // Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(renderer.domElement);

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(10, 20, 10);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 1024;
            dirLight.shadow.camera.near = 0.5;
            dirLight.shadow.camera.far = 50;
            dirLight.shadow.camera.left = -10;
            dirLight.shadow.camera.right = 10;
            dirLight.shadow.camera.top = 10;
            dirLight.shadow.camera.bottom = -10;
            scene.add(dirLight);

            // Groups
            towerGroup = new THREE.Group();
            scene.add(towerGroup);

            // Create Ball
            const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
            const ballMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 100 });
            ball = new THREE.Mesh(ballGeo, ballMat);
            ball.castShadow = true;
            ball.position.set(0, 5, PLATFORM_RADIUS - 1);
            scene.add(ball);

            // Input Listeners
            window.addEventListener('resize', onWindowResize);
            
            // Touch/Mouse controls
            renderer.domElement.addEventListener('mousedown', onPointerDown);
            renderer.domElement.addEventListener('mousemove', onPointerMove);
            renderer.domElement.addEventListener('mouseup', onPointerUp);
            renderer.domElement.addEventListener('mouseleave', onPointerUp);
            
            renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: false });
            renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: false });
            renderer.domElement.addEventListener('touchend', onPointerUp);
            
            buildLevel();
        }

        function buildLevel() {
            // Clear existing
            while(towerGroup.children.length > 0){ 
                const obj = towerGroup.children[0];
                towerGroup.remove(obj); 
                if(obj.geometry) obj.geometry.dispose();
                if(obj.material) {
                    if(Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            }
            platforms = [];
            
            // Theme selection
            currentTheme = FRUIT_THEMES[(level - 1) % FRUIT_THEMES.length];
            scene.background.setHex(currentTheme.bg);
            scene.fog.color.setHex(currentTheme.bg);
            
            // Tower Core
            const numPlatforms = 10 + Math.min(level * 2, 30);
            const towerHeight = numPlatforms * PLATFORM_SPACING;
            
            const coreGeo = new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, towerHeight, 32);
            const coreMat = new THREE.MeshPhongMaterial({ color: currentTheme.core });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.position.y = -towerHeight / 2 + PLATFORM_SPACING;
            core.receiveShadow = true;
            core.castShadow = true;
            towerGroup.add(core);

            // Generate Platforms
            for (let i = 0; i < numPlatforms; i++) {
                const yPos = -i * PLATFORM_SPACING;
                
                // Don't add platform at very top or very bottom (win zone)
                if (i === 0) continue; 
                
                let isWinPlatform = (i === numPlatforms - 1);
                createPlatform(yPos, isWinPlatform, i);
            }
            
            // Reset state
            ball.position.set(0, 5, PLATFORM_RADIUS - 1.2);
            ballVelocityY = 0;
            combo = 0;
            targetRotation = 0;
            currentRotation = 0;
            towerGroup.rotation.y = 0;
            camera.position.y = ball.position.y + 7;
            
            document.getElementById('level-text').innerText = level;
        }

        function createPlatform(yPos, isWinPlatform, index) {
            const platformGroup = new THREE.Group();
            platformGroup.position.y = yPos;
            
            const segments = 12;
            const segmentAngle = (Math.PI * 2) / segments;
            
            // Calculate difficulty: more danger zones at higher levels
            let dangerCount = Math.min(1 + Math.floor(level / 3), 5); // Max 5 danger zones
            let gapCount = Math.min(1 + Math.floor(level / 5), 3);    // Max 3 gaps
            
            if (isWinPlatform) {
                dangerCount = 0;
                gapCount = 0;
            }

            let types = new Array(segments).fill('safe');
            
            // Assign gaps
            for(let i=0; i<gapCount; i++) {
                let idx;
                do { idx = Math.floor(Math.random() * segments); } while (types[idx] !== 'safe');
                types[idx] = 'gap';
            }
            
            // Assign danger zones (ensure they don't overwrite gaps)
            for(let i=0; i<dangerCount; i++) {
                let idx;
                do { idx = Math.floor(Math.random() * segments); } while (types[idx] !== 'safe');
                types[idx] = 'danger';
            }
            
            // Special case for first platform below player: ensure safe spot right below
            if (index === 1) {
                types[0] = 'safe'; // Front is safe
            }

            const mats = {
                safe: new THREE.MeshPhongMaterial({ color: isWinPlatform ? 0x2ed573 : currentTheme.safe }),
                danger: new THREE.MeshPhongMaterial({ color: currentTheme.danger }),
                core: new THREE.MeshPhongMaterial({ color: 0xffffff }) // Rind/Inner
            };

            for (let i = 0; i < segments; i++) {
                if (types[i] === 'gap') continue;

                // Create a slice
                const sliceGeo = new THREE.CylinderGeometry(PLATFORM_RADIUS, PLATFORM_RADIUS, PLATFORM_HEIGHT, 16, 1, false, i * segmentAngle, segmentAngle);
                
                // Adjust geometry to make it look like a fruit slice (hollow center)
                const sliceMesh = new THREE.Mesh(sliceGeo, mats[types[i]]);
                sliceMesh.castShadow = true;
                sliceMesh.receiveShadow = true;
                
                // Store type for collision logic
                sliceMesh.userData = { type: types[i], angleStart: i * segmentAngle, angleEnd: (i+1) * segmentAngle };
                
                platformGroup.add(sliceMesh);
                
                // Add inner "rind" detail if safe
                if (types[i] === 'safe' && !isWinPlatform) {
                    const rindGeo = new THREE.CylinderGeometry(PLATFORM_RADIUS + 0.1, PLATFORM_RADIUS + 0.1, PLATFORM_HEIGHT * 0.8, 16, 1, false, i * segmentAngle, segmentAngle);
                    const rind = new THREE.Mesh(rindGeo, mats.core);
                    platformGroup.add(rind);
                }
            }

            // Random initial rotation for platform
            platformGroup.rotation.y = Math.random() * Math.PI * 2;
            
            // Fix first platform rotation so ball lands on safe spot
            if (index === 1) {
                platformGroup.rotation.y = 0;
            }

            platformGroup.userData = { isWin: isWinPlatform, passed: false };
            towerGroup.add(platformGroup);
            platforms.push(platformGroup);
        }

        // --- Input Handling ---
        function onPointerDown(event) {
            if (gameState !== 'playing') return;
            isDragging = true;
            let clientX = event.touches ? event.touches[0].clientX : event.clientX;
            previousMousePosition = { x: clientX };
        }

        function onPointerMove(event) {
            if (gameState !== 'playing' || !isDragging) return;
            event.preventDefault(); // Prevent scrolling on mobile
            
            let clientX = event.touches ? event.touches[0].clientX : event.clientX;
            let deltaMove = clientX - previousMousePosition.x;
            
            targetRotation += deltaMove * dragSensitivity;
            previousMousePosition = { x: clientX };
        }

        function onPointerUp(event) {
            isDragging = false;
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        // --- Game Logic ---
        window.startGame = function() {
            document.getElementById('start-screen').style.display = 'none';
            score = 0;
            level = 1;
            document.getElementById('score-text').innerText = score;
            gameState = 'playing';
            buildLevel();
        }

        window.restartGame = function() {
            document.getElementById('game-over').style.display = 'none';
            score = 0;
            document.getElementById('score-text').innerText = score;
            gameState = 'playing';
            buildLevel();
        }

        function showSplashText(text, x, y, color) {
            const div = document.createElement('div');
            div.className = 'splash-text';
            div.innerText = text;
            div.style.left = x + 'px';
            div.style.top = y + 'px';
            div.style.color = color || '#fff';
            document.body.appendChild(div);
            setTimeout(() => div.remove(), 1000);
        }

        function breakPlatform(platform) {
            // Visual effect: explode pieces
            const pColor = currentTheme.safe;
            
            // Remove from tower
            towerGroup.remove(platform);
            
            // Create falling debris
            for(let i=0; i<8; i++) {
                const geo = new THREE.BoxGeometry(1, 0.5, 2);
                const mat = new THREE.MeshPhongMaterial({ color: pColor });
                const debris = new THREE.Mesh(geo, mat);
                debris.position.copy(platform.position);
                debris.position.x = (Math.random() - 0.5) * 6;
                debris.position.z = (Math.random() - 0.5) * 6;
                
                debris.userData = {
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: Math.random() * 0.2 + 0.1,
                    vz: (Math.random() - 0.5) * 0.2,
                    rx: Math.random() * 0.2,
                    ry: Math.random() * 0.2
                };
                scene.add(debris);
                particles.push(debris);
            }
        }

        function nextLevel() {
            gameState = 'start'; // pause briefly
            level++;
            
            // Convert ball 3d pos to 2d screen pos for text
            const vector = ball.position.clone();
            vector.project(camera);
            const x = (vector.x * .5 + .5) * window.innerWidth;
            const y = (-(vector.y * .5) + .5) * window.innerHeight;
            showSplashText("LEVEL UP!", x, y, '#2ed573');
            
            setTimeout(() => {
                buildLevel();
                gameState = 'playing';
            }, 1000);
        }

        function gameOver() {
            gameState = 'gameover';
            document.getElementById('final-score').innerText = score;
            document.getElementById('game-over').style.display = 'flex';
            
            // Shatter ball effect
            const pColor = 0xffffff;
            for(let i=0; i<10; i++) {
                const geo = new THREE.SphereGeometry(BALL_RADIUS/2, 8, 8);
                const mat = new THREE.MeshPhongMaterial({ color: pColor });
                const debris = new THREE.Mesh(geo, mat);
                debris.position.copy(ball.position);
                
                debris.userData = {
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: Math.random() * 0.3 + 0.2,
                    vz: (Math.random() - 0.5) * 0.3,
                    rx: 0, ry: 0
                };
                scene.add(debris);
                particles.push(debris);
            }
            ball.visible = false; // Hide main ball
        }

        function updatePhysics() {
            if (gameState !== 'playing') return;

            // Smooth Tower Rotation
            currentRotation += (targetRotation - currentRotation) * 0.3;
            towerGroup.rotation.y = currentRotation;

            // Ball Gravity
            ballVelocityY += GRAVITY;
            ball.position.y += ballVelocityY;

            // Camera follow
            let targetCameraY = ball.position.y + 6;
            if (camera.position.y > targetCameraY) {
                camera.position.y += (targetCameraY - camera.position.y) * 0.1;
            }

            // Check Platform Collisions
            let ballGlobalPos = new THREE.Vector3();
            ball.getWorldPosition(ballGlobalPos);

            // Ball's angle relative to the tower's center, taking tower rotation into account
            // Ball is always at z = PLATFORM_RADIUS - 1, x = 0 in world space
            // We need to find what angle of the tower is currently under the ball.
            // Since ball is at (0, y, +Z), its angle is Math.PI/2.
            // Subtract tower rotation to get local angle.
            let localAngle = Math.PI/2 - currentRotation;
            // Normalize to 0 -> 2PI
            localAngle = localAngle % (Math.PI * 2);
            if (localAngle < 0) localAngle += Math.PI * 2;

            let hitSomething = false;

            for (let i = 0; i < platforms.length; i++) {
                let pGroup = platforms[i];
                
                // If ball passes platform
                if (!pGroup.userData.passed && ball.position.y < pGroup.position.y) {
                    pGroup.userData.passed = true;
                    score += 10 + (combo * 5);
                    combo++;
                    document.getElementById('score-text').innerText = score;
                    
                    if (combo >= 3) {
                        // Visual cue for combo
                        ball.material.color.setHex(0xff4757);
                    }
                }

                // Check vertical intersection
                if (ballVelocityY < 0 && 
                    ball.position.y - BALL_RADIUS <= pGroup.position.y + PLATFORM_HEIGHT/2 && 
                    ball.position.y + BALL_RADIUS >= pGroup.position.y - PLATFORM_HEIGHT/2) {
                    
                    // Check horizontal intersection (which slice is under ball?)
                    // Local angle of the platform group
                    let pLocalAngle = (localAngle - pGroup.rotation.y) % (Math.PI * 2);
                    if (pLocalAngle < 0) pLocalAngle += Math.PI * 2;

                    let hitType = 'gap';
                    
                    // Iterate children (slices)
                    for (let j = 0; j < pGroup.children.length; j++) {
                        let slice = pGroup.children[j];
                        if (slice.userData && slice.userData.type) {
                            let start = slice.userData.angleStart;
                            let end = slice.userData.angleEnd;
                            
                            // Check if angle is within this slice
                            if (pLocalAngle >= start && pLocalAngle <= end) {
                                hitType = slice.userData.type;
                                break;
                            }
                        }
                    }

                    if (hitType !== 'gap') {
                        // We hit a solid surface
                        hitSomething = true;
                        
                        // Fix position so it doesn't sink
                        ball.position.y = pGroup.position.y + PLATFORM_HEIGHT/2 + BALL_RADIUS;
                        
                        if (pGroup.userData.isWin) {
                            nextLevel();
                            return;
                        }

                        if (hitType === 'danger') {
                            if (combo >= 3) {
                                // Super charged! Break the danger platform anyway!
                                breakPlatform(pGroup);
                                ballVelocityY = BOUNCE_FORCE;
                                combo = 0;
                                ball.material.color.setHex(0xffffff);
                                score += 50;
                                document.getElementById('score-text').innerText = score;
                                
                                // Splash
                                const vector = ball.position.clone();
                                vector.project(camera);
                                const sx = (vector.x * .5 + .5) * window.innerWidth;
                                const sy = (-(vector.y * .5) + .5) * window.innerHeight;
                                showSplashText("SMASH!", sx, sy, '#ff4757');
                            } else {
                                gameOver();
                                return;
                            }
                        } else if (hitType === 'safe') {
                            if (combo >= 3) {
                                // Break safe platform too if super charged
                                breakPlatform(pGroup);
                                ballVelocityY = BOUNCE_FORCE;
                                score += 20;
                                document.getElementById('score-text').innerText = score;
                            } else {
                                // Normal bounce
                                ballVelocityY = BOUNCE_FORCE;
                                
                                // Splat effect (scale animation logic handled in animate loop)
                                ball.scale.set(1.3, 0.7, 1.3);
                                
                                // Splash color matching fruit
                                const material = new THREE.MeshBasicMaterial({ color: currentTheme.safe, transparent: true, opacity: 0.8 });
                                const circleGeometry = new THREE.CircleGeometry(0.6, 16);
                                const splat = new THREE.Mesh(circleGeometry, material);
                                splat.rotation.x = -Math.PI / 2;
                                splat.position.set(0, pGroup.position.y + PLATFORM_HEIGHT/2 + 0.01, PLATFORM_RADIUS - 1.2);
                                
                                // Rotate splat to match tower rotation so it sticks
                                const splatGroup = new THREE.Group();
                                splatGroup.add(splat);
                                splatGroup.rotation.y = -currentRotation;
                                towerGroup.add(splatGroup);
                                
                                // Fade out splat over time
                                setTimeout(() => { towerGroup.remove(splatGroup); }, 2000);
                            }
                            
                            combo = 0;
                            ball.material.color.setHex(0xffffff);
                        }
                        
                        break; // Stop checking platforms
                    }
                }
            }

            // Ball squash/stretch recovery
            ball.scale.x += (1 - ball.scale.x) * 0.1;
            ball.scale.y += (1 - ball.scale.y) * 0.1;
            ball.scale.z += (1 - ball.scale.z) * 0.1;
        }

        function updateParticles() {
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                p.position.x += p.userData.vx;
                p.position.y += p.userData.vy;
                p.position.z += p.userData.vz;
                p.rotation.x += p.userData.rx;
                p.rotation.y += p.userData.ry;
                
                p.userData.vy += GRAVITY; // Gravity
                
                // Remove if far below
                if (p.position.y < camera.position.y - 20) {
                    scene.remove(p);
                    particles.splice(i, 1);
                }
            }
        }

        function animate() {
            requestAnimationFrame(animate);
            updatePhysics();
            updateParticles();
            renderer.render(scene, camera);
        }
    
