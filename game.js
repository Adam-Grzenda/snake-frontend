let BACKEND = "http://localhost:8080";
let BACKEND_WS = "ws://localhost:8080/gameInfo"

const BACKGROUND_FILL_STYLE = "rgb(128,128,128)";
const APPLE_FILL_STYLE = "rgb(255,0,0)";

let snakes = new Map();
let players = new Map();
function Player(id, name, score, status) {
    this.id = id;
    this.name = name;
    this.score = score;
    this.status = status;
    return this;
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
    canvas.width = Math.min(container.offsetWidth, container.offsetHeight);
    canvas.height = Math.min(container.offsetWidth, container.offsetHeight);
}

async function createGame() {
    await fetch(`${BACKEND}/games`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({"boardSize": 10})
    })
        .then(response => response.json())
        .then(response => {
            game = response;
            console.log("created game: " + game["gameId"]);
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
    console.log("created player: " + player["id"] + " joining game with id: " + game["gameId"]);

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
        setCanvasSize()
        drawGame(currentGame);
    })
    collapseBoardButton.click();

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

function connectWebSocket(playerId) {
    socket = new WebSocket(
        `${BACKEND_WS}/${playerId}`
    )
    socket.onmessage = (event) => {
        applyDelta(JSON.parse(event.data))
    }
}

function disconnectWebSocket() {
    socket.close();
    console.log("Disconnected player WEBSOCKET session");
}

function drawGame(game) {
    setCanvasSize();
    let canvas = document.getElementById("board")
    let boardSize = game.boardSize;
    let width = canvas.offsetWidth;
    let fieldSize = width / boardSize;

    let context = canvas.getContext("2d");
    context.fillStyle = BACKGROUND_FILL_STYLE;
    context.fillRect(0, 0, width, width);

    for (let snake of game.snakes) {
        context.fillStyle = getSnakeColor(snake);
        for (let part of snake.parts) {
            context.fillRect(part.x * fieldSize, part.y * fieldSize, fieldSize, fieldSize)
        }
    }

    for (let apple of game.apples) {
        context.fillStyle = APPLE_FILL_STYLE;
        context.fillRect(apple.coordinates.x * fieldSize, apple.coordinates.y * fieldSize, fieldSize, fieldSize)
    }
}

function keyToDirection(key) {
    switch (key) {
        case "ArrowUp":
            return "UP";
        case "ArrowDown":
            return "DOWN";
        case "ArrowLeft":
            return "LEFT";
        case "ArrowRight":
            return "RIGHT";
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
            socket.send(JSON.stringify({
                "direction": direction
            }))
        }
    }
)


function getSnakeColor(snake) {
    let color = snake.color;
    return `rgb(${color.r},${color.g},${color.b})`;
}

function showError(message) {
    let myToast = document.getElementById("errorToast");
    myToast.querySelector('.toast-body').innerHTML = message;
    let toast = new bootstrap.Toast(myToast, {})
    toast.show()
}

function applyDelta(delta) {
    let canvas = document.getElementById("board")
    let width = canvas.offsetWidth;
    let fieldSize = width / game.boardSize;

    let context = canvas.getContext("2d");

    for (let newSnake of delta.addSnakes) {
        let player = new Player(newSnake.player.id, newSnake.player.name, 0, "CONNECTED");
        players.set(player.id, player);
        snakes.set(newSnake.id, newSnake)
    }

    for (let removedSnake of delta.removeSnakes) {
        console.log("removing: " + removedSnake + "\n currentPlayerId: " + currentPlayerId);
        if (removedSnake.player.id === currentPlayerId) {
            alert("You lost");
        }

        let player = players.get(removedSnake.player.id);
        player.status = "DEAD";
        snakes.delete(removedSnake.id)
    }

    context.fillStyle = BACKGROUND_FILL_STYLE;

    let pointBalance = new Map();

    for (let removePart of delta.removeParts) {

        if (removePart.type === "SNAKE") {
            pointBalance.set(removePart.id, pointBalance.has(removePart.id) ? pointBalance.get(removePart.id) - 1 : -1);
        }

        context.fillRect(removePart.coordinates.x * fieldSize, removePart.coordinates.y * fieldSize, fieldSize, fieldSize)
    }

    for (let addPart of delta.addParts) {
        if (addPart.type === "SNAKE") {
            pointBalance.set(addPart.id, pointBalance.has(addPart.id) ? pointBalance.get(addPart.id) + 1 : 1);
        }
        context.fillStyle = addPart.type === "SNAKE" ? getSnakeColor(snakes.get(addPart.id)) : APPLE_FILL_STYLE;
        context.fillRect(addPart.coordinates.x * fieldSize, addPart.coordinates.y * fieldSize, fieldSize, fieldSize)
    }

    pointBalance.forEach((v, k) => {
        if (v !== 0) {
            let playerId = snakes.get(k).player.id;
            players.get(playerId).score += v;
        }
    })

    // console.log(players)
}

function startGame() {
    fetch(`${BACKEND}/games/${game["gameId"]}`,
        {
            method: 'POST'
        }
    ).then(response => {
        // console.log(response)
    })
}
