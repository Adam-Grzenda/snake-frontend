let BACKEND = "http://localhost:8080";
let BACKEND_WS = "ws://localhost:8080/gameInfo"

let currentGame = new Game();
let socket;

function Coordinate(x, y) {
    this.x = x;
    this.y = y;
}

function Snake(coordinates, color) {
    this.coordinates = coordinates;
    this.color = color;
}

function Game(gameId, boardSize, snakes, apples, players) {
    this.gameId = gameId;
    this.boardSize = boardSize;
    this.snakes = snakes;
    this.apples = apples;
    this.players = players;
}


function createGame(boardSize) {
    fetch(`${BACKEND}/games`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({"boardSize": boardSize})
    }).then(response => response.json())
        .then(response => setGameIdAndJoin(response))
    ;
}


function createPlayer(name) {
    fetch(`${BACKEND}/players`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({"name": name})
    }).then(response => response.json())
        .then(response => setPlayerIdAndConnect(response))
}

function setGameIdAndJoin(game) {
    console.log(game);
    document.getElementById("gameId").value = game["gameId"];
    currentGame = game;
    joinGame(game.gameId, document.getElementById("playerId").value)
}

function setPlayerIdAndConnect(player) {
    console.log(player);
    connectWebSocket(player.id);
    document.getElementById("playerId").value = player["id"];
    document.getElementById("gameId").disabled = false
    document.getElementById("joinGame").disabled = false
    document.getElementById("createGame").disabled = false
}

const BACKGROUND_FILL_STYLE = "rgb(128,128,128)";

function drawGame(game) {
    let canvas = document.getElementById("board")
    let boardSize = game.boardSize;
    let width = canvas.offsetWidth;
    let fieldSize = width / boardSize;

    let context = canvas.getContext("2d");
    context.fillStyle = BACKGROUND_FILL_STYLE;
    context.fillRect(0, 0, width, width);

    for (let snake of game.snakes) {
        console.log(snake)
        context.fillStyle = "rgb(255,255,255)"
        for (let part of snake.parts) {
            context.fillRect(part.x * fieldSize, part.y * fieldSize, fieldSize, fieldSize)
        }
    }

    for (let apple of game.apples) {
        context.fillStyle = "rgb(255,0,0)"
        context.fillRect(apple.coordinates.x * fieldSize, apple.coordinates.y * fieldSize, fieldSize, fieldSize)
    }
}

function applyDelta(delta) {
    let canvas = document.getElementById("board")
    let width = canvas.offsetWidth;
    let fieldSize = width / currentGame.boardSize;

    let context = canvas.getContext("2d");

    console.log(delta);

    context.fillStyle = BACKGROUND_FILL_STYLE;
    for (let removePart of delta.removeParts) {
        context.fillRect(removePart.coordinates.x * fieldSize, removePart.coordinates.y * fieldSize, fieldSize, fieldSize)
    }

    context.fillStyle = "rgb(255,255,255)";
    for (let addPart of delta.addParts) {
        context.fillRect(addPart.coordinates.x * fieldSize, addPart.coordinates.y * fieldSize, fieldSize, fieldSize)
    }
}

function connectWebSocket(playerId) {
    socket = new WebSocket(
        `${BACKEND_WS}/${playerId}`
    )
    socket.onmessage = (event) => {
        applyDelta(JSON.parse(event.data));
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
        console.log(event.key);
        let direction = keyToDirection(event.key);
        if (direction !== "NONE") {
            socket.send(JSON.stringify({
                "direction": direction
            }))
        }
    }
)

function joinGame(gameId, playerId) {
    fetch(`${BACKEND}/games/${gameId}/players/${playerId}`,
        {
            method: 'POST'
        })
        .then(response => response.json())
        .then(response => {
            drawGame(response)
        })
}

function startGame(gameId) {
    fetch(`${BACKEND}/games/${gameId}`,
        {
            method: 'POST'
        }
    ).then(response => {
        console.log(response)
    })
}

function getGameById(gameId) {
    fetch(`${BACKEND}/games/${gameId}`).then(response => {
        console.log(response);
    })
}
