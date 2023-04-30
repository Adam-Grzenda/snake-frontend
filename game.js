let BACKEND = "http://localhost:8080";
let BACKEND_WS = "ws://localhost:8080/gameInfo"

const BACKGROUND_FILL_STYLE = "rgb(128,128,128)";
const APPLE_FILL_STYLE = "rgb(255,0,0)";

let snakes = new Map();

function Player(id, name, score, status) {
    this.id = id;
    this.name = name;
    this.score = score;
    this.status = status;
    return this;
}

function Snake(id, playerNick, r, g, b, length) {
    this.id = id;
    this.playerName = playerNick;
    this.r = r;
    this.g = g;
    this.b = b;
    this.length = length;
}


let nickInput = document.getElementById("nick");
let gameIdInput = document.getElementById("game-id");
let joinGameBtn = document.getElementById("join-game-btn");
let createGameBtn = document.getElementById("create-game-btn");

let collapseFormButton = document.getElementById("collapseFormButton");
let collapseBoardButton = document.getElementById("collapseGameButton");

let sidebarGameId = document.getElementById("game-id-display");


let player = null;
let game = null;
let socket = null;

function onClickGameId() {
    navigator.clipboard.writeText(document.getElementById("game-id-display").textContent.trim()).then()
}

nickInput.addEventListener("input", function () {
    let nickValid = nickInput.value.length > 0;
    createGameBtn.disabled = !nickValid
})

gameIdInput.addEventListener("input", function () {
    joinGameBtn.disabled = nickInput.value.length === 0 || gameIdInput.value.length === 0;
})

function setCanvasSize() {
    let container = document.getElementById("game-board");
    let canvas = document.getElementById("board");
    console.log(container.offsetWidth + " " + container.offsetHeight)
    canvas.width = 800;
    canvas.height = 800;
}

async function createGame() {
    await fetch(`${BACKEND}/games`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({"boardSize": 20})
    })
        .then(response => response.json())
        .then(response => {
            game = response;
            console.log(`Created game: ${game["gameId"]}`);
            gameIdInput.value = game["gameId"];
        })
    await joinGameSession();
}

async function joinGameSession() {
    if (player == null || player["name"] !== nickInput.value) {
        player = await createPlayer(nickInput.value);
    }

    game = {"gameId": gameIdInput.value};
    sidebarGameId.textContent = game["gameId"]

    if (!game["gameId"]) {
        return;
    }

    connectWebSocket(player["id"]);
    console.log(`Created player: ${player["id"]} joining game with id ${game["gameId"]}`);

    socket.onopen = (
        (event) => {
            console.log("Successfully connected to player session")
            joinGame().catch(e => {
                showError("Invalid game ID")
                disconnectWebSocket()
            })
        }
    )
}

async function joinGame() {
    let currentGame = await fetch(`${BACKEND}/games/${game["gameId"]}/players/${player["id"]}`,
        {
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Game not found");
            }
            return response.json()
        })

    game = currentGame;
    collapseFormButton.click();
    document.getElementById("game-board").addEventListener('shown.bs.collapse', function () {
        drawGame(currentGame);
    })
    collapseBoardButton.click();

}


function disconnectWebSocket() {
    socket.close();
    console.log("Disconnected player WEBSOCKET session");
}

function drawGame(game) {
    snakes = new Map();
    setCanvasSize();

    function drawCheckeredBackground(can, nRow, nCol) {
        var ctx = can.getContext("2d");
        var w = can.width;
        var h = can.height;

        nRow = nRow || 8;    // default number of rows
        nCol = nCol || 8;    // default number of columns

        w /= nCol;            // width of a block
        h /= nRow;            // height of a block

        for (var i = 0; i < nRow; ++i) {
            for (var j = 0, col = nCol / 2; j < col; ++j) {
                ctx.rect(2 * j * w + (i % 2 ? 0 : w), i * h, w, h);
            }
        }

        ctx.fill();
    }

    var canvas = document.getElementById("board");
    drawCheckeredBackground(canvas, game.boardSize, game.boardSize);

    for (let snake of game.snakes) {
        snakes.set(snake.id, new Snake(snake.id, snake.player.name, snake.color.r, snake.color.g, snake.color.b, snake.parts.length))
        let color = `rgb(${snake.color.r},${snake.color.g},${snake.color.b})`;
        for (let part of snake.parts) {
            drawPart(part.x, part.y, color);
        }
    }

    for (let apple of game.apples) {
        drawPart(apple.coordinates.x, apple.coordinates.y, APPLE_FILL_STYLE)
    }
}

function keyToDirection(key) {
    switch (key) {
        case "ArrowUp":
            return 0;
        case "ArrowDown":
            return 1;
        case "ArrowLeft":
            return 2;
        case "ArrowRight":
            return 3;
        default:
            return "NONE"
    }
}

document.addEventListener(
    "keydown",
    (event) => {
        if (socket == null) {
            return;
        }
        let direction = keyToDirection(event.key);
        if (direction !== "NONE") {
            let value = new Uint8Array(1);
            value[0] = direction;
            socket.send(value);
        }
    }
)

function showError(message) {
    let myToast = document.getElementById("errorToast");
    myToast.querySelector('.toast-body').innerHTML = message;
    let toast = new bootstrap.Toast(myToast, {})
    toast.show()
}

function drawPart(x, y, color) {
    let canvas = document.getElementById("board")
    let width = canvas.width;
    let fieldSize = width / game.boardSize;
    let context = canvas.getContext("2d");
    context.fillStyle = color;
    context.fillRect(x * fieldSize, y * fieldSize, fieldSize, fieldSize);
}

function addPlayer(data) {
    let nickLength = data.getUint8(1);
    let nick = "";
    for (let i = 0; i < nickLength; i++) {
        nick += String.fromCharCode(data.getUint8(2 + i));
    }

    let snakeId = data.getUint8(2 + nickLength);
    let r = data.getUint8(2 + nickLength + 1);
    let g = data.getUint8(2 + nickLength + 2);
    let b = data.getUint8(2 + nickLength + 3);

    let x = data.getUint8(2 + nickLength + 4);
    let y = data.getUint8(2 + nickLength + 5);

    console.log(`New player joined: ${nick}, snakeId: ${snakeId}, color: (${r}, ${g}, ${b}), head: (${x}, ${y})`);
    snakes.set(snakeId, new Snake(snakeId, nick, r, g, b, 1));
    drawPart(x, y, `rgb(${r},${g},${b})`)
}

function applyBinaryDelta(data) {
    function getPartColor(elementId) {
        if (elementId === 255) {
            return APPLE_FILL_STYLE;
        }

        let snake = snakes.get(elementId);
        if (!snake) {
            console.error(`Snake with id: ${elementId} Not found`);
            return "rgb(0,0,0)";
        }
        return `rgb(${snake.r},${snake.g},${snake.b})`;
    }

    let deadSnakeIds = new Set();
    let pointBalance = new Map();

    function addPoint(elementId) {
        pointBalance.set(elementId, pointBalance.has(elementId) ? pointBalance.get(elementId) + 1 : 1);
    }

    function removePoint(elementId) {
        pointBalance.set(elementId, pointBalance.has(elementId) ? pointBalance.get(elementId) - 1 : -1);
    }

    for (let deltaN = 1; deltaN + 4 <= data.byteLength; deltaN += 4) {
        let operationType = data.getUint8(deltaN);
        let elementId = data.getUint8(deltaN + 1);
        let x = data.getUint8(deltaN + 2);
        let y = data.getUint8(deltaN + 3);

        let color = getPartColor(elementId);
        console.log(`Handling delta, type: ${operationType}, elementId: ${elementId}, x: ${x}, y: ${y}, color: ${color}`)

        switch (operationType) {
            case 1:
                addPoint(elementId);
                drawPart(x, y, color);
                break;
            case 2:
                deadSnakeIds.add(elementId);
            case 0:
                removePoint(elementId);
                if (elementId !== 255) {
                    drawPart(x, y, BACKGROUND_FILL_STYLE);
                }
                break;
        }
    }

    for (let balance of pointBalance.entries()) {
        if (balance.value >= 2) {
            let snake = snakes.get(balance.key);
            if (!snake) {
                console.error("Unknown snake with point balance");
                continue;
            }
            snake.length += balance.value - 1;
        }
    }

    if (deadSnakeIds.length !== 0) {
        for (let snakeId of deadSnakeIds) {
            let snake = snakes.get(snakeId);
            if (snake.playerName === player.name) {
                console.log("You lose");    //todo
            } else {
                console.log(`Player: ${snake.playerName} lost`);
            }
        }
    }

}

function endGame() {
    console.log("Game ended");
    collapseBoardButton.click();
    collapseFormButton.click();
}

function pauseGame(data) {
    console.log(`Game paused by snake id: ${data.getUint8(1)}`)
}

function parseEvent(bytearray) {
    let data = new DataView(bytearray);
    let messageType = data.getUint8(0);

    console.log(`Message received with type: ${messageType}`);

    switch (messageType) {
        case 0:
            addPlayer(data);
            break;
        case 1:
            applyBinaryDelta(data);
            break;
        case 2:
            pauseGame(data);
            break;
        case 3:
            endGame()
            break;
    }
}

function connectWebSocket(playerId) {
    socket = new WebSocket(
        `${BACKEND_WS}/${playerId}`
    )
    socket.binaryType = 'arraybuffer'

    socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
            parseEvent(event.data);
        } else {
            console.log("Wrong data format")
        }
    }
}


function changeGameState() {
    function startGame() {
        fetch(`${BACKEND}/games/${game["gameId"]}`,
            {
                method: 'POST'
            }
        ).then(response => {
            console.log(`Started game with ID: ${game["gameId"]}`);
        })
    }

    switch (game.status) {
        case "NEW":
            startGame();
            break;
    }



    startGame();
}

async function createPlayer(nick) {
    return fetch(`${BACKEND}/players`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({"name": nick})
    }).then(
        response => response.json()
    )
        .then(player => {
            return player;
        });
}

