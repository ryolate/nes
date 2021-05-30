import React, { useRef, useEffect } from 'react'

const gameHook = (canvas: HTMLCanvasElement): {
    draw: () => void
    close: () => void
} => {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    // Paddle states
    const paddleHeight = 10;
    const paddleWidth = 75;
    let leftPressed: boolean
    let rightPressed: boolean
    let paddleX: number

    // Ball states
    const ballRadius = 10;
    let x: number
    let y: number
    let dx: number
    let dy: number

    // Block states
    const brickRowCount = 3;
    const brickColumnCount = 5;
    const brickWidth = 75;
    const brickHeight = 20;
    const brickPadding = 10;
    const brickOffsetTop = 30;
    const brickOffsetLeft = 30;
    let bricks: Array<Array<{ x: number, y: number, exists: boolean }>>

    // Game states
    let endMessage: string
    let score: number

    resetAllState()

    document.addEventListener("keydown", keydownListener)
    document.addEventListener("keyup", keyupListener)
    return {
        draw: draw,
        close: () => {
            document.removeEventListener("keydown", keydownListener)
            document.removeEventListener("keyup", keyupListener)
        }
    }

    function resetAllState() {
        resetBoardState()

        endMessage = ""
        score = 0
        bricks = [];
        for (let c = 0; c < brickColumnCount; c++) {
            bricks[c] = [];
            for (let r = 0; r < brickRowCount; r++) {
                bricks[c][r] = { x: 0, y: 0, exists: true };
            }
        }
    }

    function resetBoardState() {
        leftPressed = false
        rightPressed = false
        paddleX = (canvas.width - paddleWidth) / 2

        x = canvas.width / 2
        y = canvas.height - 30
        dx = 2
        dy = -2
    }

    function keydownListener(e: KeyboardEvent) {
        if (e.key == "j") leftPressed = true
        else if (e.key == "l") rightPressed = true
        else if (endMessage != "" && e.key == ' ') resetAllState()
    }

    function keyupListener(e: KeyboardEvent) {
        if (e.key == "j") leftPressed = false
        else if (e.key == "l") rightPressed = false
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (endMessage != "") {
            ctx.fillStyle = "#000"
            ctx.textAlign = 'center';
            ctx.font = '50px sans-serif';
            ctx.fillText(endMessage, canvas.width / 2, canvas.height / 2)
            ctx.font = '20px sans-serif';
            ctx.fillText("PRESS SPACE TO RESTART", canvas.width / 2, canvas.height / 2 + 50)
            return
        }

        drawPaddle()
        collisionDetection();
        drawBall()
        drawBricks()
        drawScore()

        updateState()
    }

    function drawPaddle() {
        ctx.beginPath()
        ctx.rect(paddleX, canvas.height - paddleHeight, paddleWidth, paddleHeight)
        ctx.fillStyle = "#0095DD"
        ctx.fill()
        ctx.closePath()
    }

    function drawBall() {
        ctx.beginPath()
        ctx.arc(x, y, ballRadius, 0, Math.PI * 2)
        ctx.fillStyle = "#0095DD"
        ctx.fill()
        ctx.closePath()
    }

    function drawBricks() {
        for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < brickRowCount; r++) {
                if (!bricks[c][r].exists) {
                    continue
                }
                var brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
                var brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
                bricks[c][r].x = brickX;
                bricks[c][r].y = brickY;
                ctx.beginPath();
                ctx.rect(brickX, brickY, brickWidth, brickHeight);
                ctx.fillStyle = "#0095DD";
                ctx.fill();
                ctx.closePath();
            }
        }
    }

    function drawScore() {
        ctx.font = "16px Arial";
        ctx.fillStyle = "#0095DD";
        ctx.fillText("Score: " + score, 8, 20);
    }

    function updateState() {
        if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) {
            dx *= -1
        }
        if (y + dy < ballRadius) {
            dy = -dy;
        } else if (y + dy > canvas.height - ballRadius) {
            if (x > paddleX && x < paddleX + paddleWidth) {
                dy = -dy;
            } else {
                endMessage = "GAME OVER"
            }
        }
        x += dx
        y += dy

        if (rightPressed && paddleX < canvas.width - paddleWidth) {
            paddleX += 7
        }
        else if (leftPressed && paddleX > 0) {
            paddleX -= 7
        }
    }

    function collisionDetection() {
        for (var c = 0; c < brickColumnCount; c++) {
            for (var r = 0; r < brickRowCount; r++) {
                var b = bricks[c][r]
                if (b.exists) {
                    if (x > b.x && x < b.x + brickWidth && y > b.y && y < b.y + brickHeight) {
                        dy = -dy
                        b.exists = false
                        score++
                        if (score == brickRowCount * brickColumnCount) {
                            endMessage = "YOU WIN!"
                        }
                    }
                }
            }
        }
    }
}

export const App = () => {
    let ref = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = ref.current!

        const g = gameHook(canvas)

        let reqId: number
        const render = () => {
            g.draw()
            reqId = requestAnimationFrame(render)
        }
        render()
        return () => {
            g.close()
            cancelAnimationFrame(reqId)
        }
    })

    return <><canvas
        ref={ref}
        width="480"
        height="320"
        style={{ backgroundColor: "#eee" }}
    ></canvas >
        <div>
            Use the keyboard to control: <b>J</b> to move left, <b>L</b> to move right
        </div>
    </>
}
