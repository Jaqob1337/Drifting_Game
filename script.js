const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const messageElement = document.getElementById('message');
const gameContainer = document.getElementById('game-container');

let canvasWidth, canvasHeight;
let car;
let score = 0;
let input = { left: false, right: false };
let lastTime = 0;
let gameStarted = false;
let skidMarks = [];
const MAX_SKID_MARKS = 200; // Limit skid mark segments for performance

function resizeCanvas() {
    const containerRect = gameContainer.getBoundingClientRect();
    canvasWidth = canvas.width = containerRect.width;
    canvasHeight = canvas.height = containerRect.height;
    // Re-initialize or reposition elements if needed after resize
    if (car) {
        // Keep car centered or at its relative position if game is running
    } else {
        setupCar(); // Initial setup if car doesn't exist
    }
}

function setupCar() {
    car = {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        width: 20,
        height: 40,
        angle: -Math.PI / 2, // Start pointing up (0 is right, PI/2 is down)
        speed: 0,
        velocity: { x: 0, y: 0 }, // Actual movement vector
        acceleration: 0.08, // How quickly it gains speed
        maxSpeed: 4,        // Max forward speed
        turnSpeed: 0.06,    // How quickly it turns (radians per frame update)
        friction: 0.97,     // Slows down naturally (applied to velocity)
        driftAmount: 0.9,   // How much sideways velocity is retained (lower = more slide)
        color: '#ff4444',
        isDrifting: false
    };
}

function updateScore(points) {
    score += points;
    scoreElement.textContent = Math.floor(score);
}

function handleInputStart(event) {
    if (!gameStarted) {
        gameStarted = true;
        messageElement.classList.add('hidden');
        resetGame(); // Reset state when starting
        requestAnimationFrame(gameLoop);
    }

    const rect = canvas.getBoundingClientRect();
    const touchX = (event.touches ? event.touches[0].clientX : event.clientX) - rect.left;

    if (touchX < canvasWidth / 2) {
        input.left = true;
        input.right = false;
    } else {
        input.right = true;
        input.left = false;
    }
    event.preventDefault(); // Prevent default touch behavior (scrolling, zooming)
}

function handleInputEnd(event) {
    input.left = false;
    input.right = false;
    event.preventDefault();
}

function update(deltaTime) {
    if (!gameStarted) return;

    let turning = false;
    // --- Input & Turning ---
    if (input.left) {
        car.angle -= car.turnSpeed;
        turning = true;
    }
    if (input.right) {
        car.angle += car.turnSpeed;
        turning = true;
    }

    // --- Acceleration ---
    // Only accelerate when "gas" is implicitly pressed (maybe always, or only when turning?)
    // For simplicity, let's accelerate constantly for now
    car.speed += car.acceleration;
    if (car.speed > car.maxSpeed) {
        car.speed = car.maxSpeed;
    }

    // --- Calculate Forward Vector ---
    const forwardX = Math.cos(car.angle) * car.speed;
    const forwardY = Math.sin(car.angle) * car.speed;

    // --- Apply Forward Force to Velocity ---
    // This is a simplified model. Real physics is more complex.
    // We add the forward force and let friction handle the rest.
    car.velocity.x += forwardX * (deltaTime / 16.67); // Normalize force based on typical 60fps frame time
    car.velocity.y += forwardY * (deltaTime / 16.67);

    // --- Apply Friction / Drag ---
    car.velocity.x *= car.friction;
    car.velocity.y *= car.friction;

    // --- Rudimentary Drift Physics ---
    // Calculate the direction the car is actually moving
    const currentDir = Math.atan2(car.velocity.y, car.velocity.x);
    const speedMagnitude = Math.sqrt(car.velocity.x * car.velocity.x + car.velocity.y * car.velocity.y);

    // Calculate the difference between where the car points and where it moves
    let angleDiff = car.angle - currentDir;
    // Normalize angle difference to be between -PI and PI
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Determine if drifting (significant angle difference and moving)
    car.isDrifting = (Math.abs(angleDiff) > 0.5 && speedMagnitude > 1.5); // Thresholds are adjustable

    if (car.isDrifting) {
        // Reduce sideways velocity less than forward velocity for the "slide"
        // This is still very basic - doesn't properly model tire grip
        const forwardComponent = Math.cos(angleDiff) * speedMagnitude;
        const sidewaysComponent = Math.sin(angleDiff) * speedMagnitude * car.driftAmount; // Keep more sideways speed

        car.velocity.x = Math.cos(currentDir) * forwardComponent - Math.sin(currentDir) * sidewaysComponent;
        car.velocity.y = Math.sin(currentDir) * forwardComponent + Math.cos(currentDir) * sidewaysComponent;

        updateScore(1); // Score points while drifting
    }

    // --- Update Position ---
    car.x += car.velocity.x;
    car.y += car.velocity.y;


    // --- Boundaries ---
    if (car.x - car.width / 2 < 0) { car.x = car.width / 2; car.velocity.x *= -0.5; } // Bounce slightly
    if (car.x + car.width / 2 > canvasWidth) { car.x = canvasWidth - car.width / 2; car.velocity.x *= -0.5; }
    if (car.y - car.height / 2 < 0) { car.y = car.height / 2; car.velocity.y *= -0.5; }
    if (car.y + car.height / 2 > canvasHeight) { car.y = canvasHeight - car.height / 2; car.velocity.y *= -0.5; }


    // --- Add Skid Marks ---
    if (car.isDrifting && speedMagnitude > 1) {
        // Add skid mark points (simplified: just track rear axle points)
        const rearOffsetX = Math.cos(car.angle + Math.PI) * (car.height / 2); // Offset to back
        const rearOffsetY = Math.sin(car.angle + Math.PI) * (car.height / 2);
        skidMarks.push({ x: car.x + rearOffsetX, y: car.y + rearOffsetY, alpha: 1.0 });

        // Limit number of skid marks
        if (skidMarks.length > MAX_SKID_MARKS) {
            skidMarks.shift(); // Remove the oldest mark
        }
    }

     // Fade out skid marks
    skidMarks.forEach(mark => mark.alpha -= 0.01); // Adjust fade speed
    skidMarks = skidMarks.filter(mark => mark.alpha > 0); // Remove faded marks
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#6a6a6a'; // Asphalt color
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw Skid Marks
    ctx.lineWidth = 4; // Width of skid marks
    skidMarks.forEach(mark => {
        ctx.fillStyle = `rgba(40, 40, 40, ${mark.alpha * 0.8})`; // Dark grey, fades out
        ctx.beginPath();
        ctx.arc(mark.x, mark.y, ctx.lineWidth / 2, 0, Math.PI * 2); // Draw small circles
        ctx.fill();
    });


    // Draw Car
    ctx.save(); // Save current canvas state
    ctx.translate(car.x, car.y); // Move origin to car's center
    ctx.rotate(car.angle); // Rotate canvas around the new origin
    ctx.fillStyle = car.color;
    // Draw rectangle centered on the origin (which is now car.x, car.y)
    ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

    // Optional: Add details like headlights
    ctx.fillStyle = 'yellow';
    ctx.fillRect(car.width / 4, -car.height / 2, car.width / 4, 5);
    ctx.fillRect(-car.width / 2, -car.height / 2, car.width / 4, 5);

    ctx.restore(); // Restore canvas state to before translation/rotation
}

function gameLoop(timestamp) {
    if (!gameStarted) return;

    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (deltaTime > 0) { // Ensure deltaTime is valid
        update(deltaTime);
        draw();
    }

    requestAnimationFrame(gameLoop);
}

function resetGame() {
    setupCar();
    score = 0;
    scoreElement.textContent = score;
    input = { left: false, right: false };
    skidMarks = [];
    lastTime = performance.now(); // Reset timer
}

// --- Event Listeners ---
gameContainer.addEventListener('mousedown', handleInputStart);
gameContainer.addEventListener('mouseup', handleInputEnd);
gameContainer.addEventListener('mouseleave', handleInputEnd); // Stop turning if mouse leaves container

gameContainer.addEventListener('touchstart', handleInputStart, { passive: false }); // passive: false to allow preventDefault
gameContainer.addEventListener('touchend', handleInputEnd, { passive: false });
gameContainer.addEventListener('touchcancel', handleInputEnd, { passive: false });


window.addEventListener('resize', resizeCanvas);

// Initial Setup
resizeCanvas(); // Call initially to set size
// Don't start the game loop until the first interaction
// setupCar(); // Setup initial car state for display before start (optional)
// draw(); // Draw initial state (optional)