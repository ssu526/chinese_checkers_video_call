const CONSTANTS = require("./constants");
const getValidNextMoves = require("./moveValidation");
const socketio = require("socket.io");

/************************************************************************************************/
/*                                         APP SETUP                                            */
/************************************************************************************************/
const express = require("express");
const app = express();
app.use(express.static("public"));
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT);

app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
const io = socketio(server);
const rooms = {};
const socket_room_mapping = {};

/************************************************************************************************/
/*                                 HANDLE MESSAGES FROM CLIENT                                  */
/************************************************************************************************/
io.on("connection", (socket) => {
  socket.on("createRoom", (playerName, roomCapacity) => {
    let roomId = generateRandomId();
    while (roomId in rooms) {
      roomId = generateRandomId();
    }

    rooms[roomId] = {
      capacity: roomCapacity,
      colors: getPlayerColors(roomCapacity),
      playerNames: [playerName],
      sockets: [socket.id],
      completed: [false], // true when a player finished or left the game
      gameboard: [],
      currentPlayer: 0,
      selected_piece: [],
      allow_single_step: true,
      validNextMoves: [],
      gameStarted: false,
    };
    rooms[roomId].gameboard = initGameboard(rooms[roomId].colors);

    socket.join(roomId);
    socket_room_mapping[socket.id] = roomId;
    socket.emit(
      "joined",
      roomId,
      rooms[roomId].gameboard,
      rooms[roomId].capacity
    );
  });

  socket.on("joinRoom", (roomId, playerName) => {
    if (rooms[roomId] !== undefined) {
      let currentNumberOfPlayers = rooms[roomId].playerNames.length;

      if (rooms[roomId].capacity === currentNumberOfPlayers) {
        socket.emit("error", "Room is full");
      } else {
        // update the room with the new player
        rooms[roomId].playerNames.push(playerName);
        rooms[roomId].completed.push(false);
        rooms[roomId].sockets.push(socket.id);

        // Subscribe the socket to the room
        socket.join(roomId);
        socket_room_mapping[socket.id] = roomId;
        socket.emit("joined", roomId, rooms[roomId].gameboard);
        io.to(roomId).emit("announceNewPlayer", rooms[roomId].playerNames);

        // Start game after all players have joined the room
        if (rooms[roomId].capacity === rooms[roomId].playerNames.length) {
          const currentPlayerName = rooms[roomId].playerNames[0];
          const currentPlayerColor = rooms[roomId].colors[0];
          const currentSocket = rooms[roomId].sockets[0];
          rooms[roomId].gameStarted = true;

          io.to(roomId).emit(
            "startGame",
            currentPlayerName,
            currentPlayerColor,
            currentSocket
          );
        }
      }
    } else {
      socket.emit("error", "Room does not exist");
    }
  });

  socket.on("click", (roomId, row, col) => {
    let currentPlayer = rooms[roomId].currentPlayer;
    let socketIdForCurrentPlayer = rooms[roomId].sockets[currentPlayer];

    // Only the current player can make moves
    if (rooms[roomId].gameStarted && socket.id === socketIdForCurrentPlayer) {
      handleClick(roomId, row, col);
    }
  });

  socket.on("endTurn", (roomId) => {
    // All players has completed
    let numberOfCompletion = rooms[roomId].completed.filter(
      (x) => x === true
    ).length;
    if (numberOfCompletion === rooms[roomId].capacity) {
      io.to(roomId).emit("allCompleted");
      return;
    }

    let currentPlayer = rooms[roomId].currentPlayer;
    let socketIdForCurrentPlayer = rooms[roomId].sockets[currentPlayer];

    // Only the current player can end the current round
    if (socket.id === socketIdForCurrentPlayer) {
      goToNextPlayer(roomId);
    }
  });

  socket.on("reset", (roomId) => {
    rooms[roomId].completed = rooms[roomId].completed.map((c) => false);
    rooms[roomId].currentPlayer = 0;
    rooms[roomId].allow_single_step = true;
    rooms[roomId].validNextMoves = [];
    rooms[roomId].selected_piece = [];

    const gameboard = initGameboard(rooms[roomId].colors);
    rooms[roomId].gameboard = gameboard;
    const currentPlayerName = rooms[roomId].playerNames[0];
    const currentPlayerColor = rooms[roomId].colors[0];
    const currentSocket = rooms[roomId].sockets[0];

    io.to(roomId).emit(
      "reset",
      gameboard,
      currentPlayerName,
      currentPlayerColor,
      currentSocket
    );
  });

  socket.on("newVideo", (roomId) => {
    rooms[roomId].sockets.forEach((socketId) => {
      if (socketId !== socket.id) {
        io.to(socketId).emit("newVideo", socket.id);
      }
    });
  });

  socket.on("offer", (offer, id) => {
    socket.to(id).emit("offer", offer, socket.id);
  });

  socket.on("answer", (answer, id) => {
    socket.to(id).emit("answer", answer, socket.id);
  });

  socket.on("candidate", (candidate, id) => {
    socket.to(id).emit("candidate", candidate, socket.id);
  });

  socket.on("disconnect", () => {
    const roomId = socket_room_mapping[socket.id];
    if (!roomId) return;
    const index = rooms[roomId].sockets.indexOf(socket.id);
    rooms[roomId].completed[index] = true;
    io.to(roomId).emit("playerDisconnected", socket.id);

    for (const item of rooms[roomId].completed) {
      if (!item) {
        if (socket.id === rooms[roomId].sockets[rooms[roomId].currentPlayer]) {
          goToNextPlayer(roomId);
        }
        return;
      }
    }

    delete rooms[roomId];
    delete socket_room_mapping[socket.id];

    // console.log(Object.keys(rooms).length);
  });
});

/************************************************************************************************/
/*                                     HELPER FUNCTIONS                                         */
/************************************************************************************************/

// Game logic
function handleClick(roomId, row, col) {
  const currentPlayer = rooms[roomId].currentPlayer;
  const gameboard = rooms[roomId].gameboard;
  const playerColor = rooms[roomId].colors[currentPlayer];
  const selected_piece = rooms[roomId].selected_piece;

  /******************** If all players or the current player completed the game ************/
  let numberOfCompletion = rooms[roomId].completed.filter(
    (x) => x === true
  ).length;

  if (numberOfCompletion === rooms[roomId].capacity) {
    io.to(roomId).emit("allCompleted");
    return;
  }

  if (rooms[roomId].completed[currentPlayer]) {
    goToNextPlayer(roomId);
    return;
  }

  /******************** If selected_piece is empty, the click event is for selecting a game piece ************/
  let y = row * CONSTANTS.CELL_HEIGHT; // x and y are upper-left coordinates of the gameboard cell
  let x = col * CONSTANTS.CELL_WIDTH;

  if (selected_piece.length === 0) {
    //Player can only select her own piece
    if (gameboard[row][col].currentColor !== playerColor) return;

    // Draw the selected piece
    rooms[roomId].selected_piece = [row, col];
    io.to(roomId).emit("drawSelected", x, y, playerColor);

    // Get the valid next moves for the selected piece
    let validNextMoves = getValidNextMoves(rooms[roomId]);
    if (validNextMoves.length > 0) {
      io.to(roomId).emit("showValidNextMoves", validNextMoves, playerColor);
      rooms[roomId].validNextMoves = validNextMoves;
    }
    rooms[roomId].allow_single_step = false;

    return;
  }

  /************** If selected_piece is not empty, the click event is for moving the selected piece to the cell clicked ***********/
  let original_row = selected_piece[0];
  let original_col = selected_piece[1];
  let validDestination = false; // true if the cell clicked is in the validNextMoves array
  let currentValidNextMoves = rooms[roomId].validNextMoves;

  if (currentValidNextMoves.length != 0) {
    currentValidNextMoves.forEach((item) => {
      if (item.length > 0 && row == item[0] && col == item[1])
        validDestination = true;
    });

    // If the cell clicked is in the validNextMoves array, update the gameboard and the room
    if (validDestination) {
      const playerColor = rooms[roomId].colors[currentPlayer];

      //Reset valid cells back to empty cells since the player has made her move
      currentValidNextMoves.forEach((item) => {
        let x = item[1] * CONSTANTS.CELL_WIDTH;
        let y = item[0] * CONSTANTS.CELL_HEIGHT;
        let color = gameboard[item[0]][item[1]].originalColor;
        io.to(roomId).emit("drawCircleWithBorder", x, y, color);
      });

      //Place selected piece to the cell clicked
      gameboard[row][col].available = false;
      gameboard[row][col].currentColor = playerColor;
      io.to(roomId).emit("drawSelected", x, y, playerColor);

      //set the oringinal cell of the selected piece to an empty cell since it has moved
      let original_col_coor = original_col * CONSTANTS.CELL_WIDTH;
      let original_row_coor = original_row * CONSTANTS.CELL_HEIGHT;
      let original_color = gameboard[original_row][original_col].originalColor;
      io.to(roomId).emit(
        "drawCircleWithBorder",
        original_col_coor,
        original_row_coor,
        original_color
      );

      gameboard[original_row][original_col].available = true;
      gameboard[original_row][original_col].currentColor =
        gameboard[original_row][original_col].originalColor;

      // Reset the properties in the room object
      rooms[roomId].selected_piece = [row, col];
      rooms[roomId].validNextMoves = [];

      // Check if the current player has completed
      let completed = checkCompletion(playerColor, gameboard);

      if (completed) {
        const numOfCompletion = rooms[roomId].completed.filter(
          (item) => item == true
        ).length;

        if (numOfCompletion == 0) {
          const winnerName = rooms[roomId].playerNames[currentPlayer];
          io.to(roomId).emit("winner", winnerName);
        }
        rooms[roomId].completed[currentPlayer] = true;

        // Check if all players have completed
        let numberOfCompletion = rooms[roomId].completed.filter(
          (x) => x === true
        ).length;
        if (numberOfCompletion === rooms[roomId].capacity) {
          io.to(roomId).emit("allCompleted");
          return;
        }

        goToNextPlayer(roomId);
        return;
      }

      //Check if the move is a one-step move, if it is, player's turn ends
      if (
        (Math.abs(original_row - row) == 1 &&
          Math.abs(original_col - col) == 1) ||
        (Math.abs(original_row - row) == 2 &&
          Math.abs(original_col - col) == 0) ||
        (Math.abs(original_row - row) == 0 && Math.abs(original_col - col) == 2)
      ) {
        io.to(roomId).emit("drawCircle", x, y, playerColor);
        return;
      }

      let validNextMoves = getValidNextMoves(rooms[roomId]);
      rooms[roomId].validNextMoves = validNextMoves;

      if (validNextMoves.length == 0) {
        io.to(roomId).emit("drawCircle", x, y, playerColor);
        return;
      }

      io.to(roomId).emit("showValidNextMoves", validNextMoves, playerColor);
    }
  }
}

// Given the capacity of the room, return the color for each of the players
function getPlayerColors(capacity) {
  let gamePlayerColors = [];

  switch (capacity) {
    case 2:
      gamePlayerColors = [
        CONSTANTS.PLAYERS_COLOR[0],
        CONSTANTS.PLAYERS_COLOR[1],
      ];
      break;
    case 3:
      gamePlayerColors = [
        CONSTANTS.PLAYERS_COLOR[0],
        CONSTANTS.PLAYERS_COLOR[5],
        CONSTANTS.PLAYERS_COLOR[4],
      ];
      break;
    case 4:
      gamePlayerColors = [
        CONSTANTS.PLAYERS_COLOR[0],
        CONSTANTS.PLAYERS_COLOR[1],
        CONSTANTS.PLAYERS_COLOR[5],
        CONSTANTS.PLAYERS_COLOR[2],
      ];
      break;
    case 6:
      gamePlayerColors = [
        CONSTANTS.PLAYERS_COLOR[0],
        CONSTANTS.PLAYERS_COLOR[3],
        CONSTANTS.PLAYERS_COLOR[5],
        CONSTANTS.PLAYERS_COLOR[1],
        CONSTANTS.PLAYERS_COLOR[4],
        CONSTANTS.PLAYERS_COLOR[2],
      ];
      break;
  }

  return gamePlayerColors;
}

// Initialize the gameboard(2D matrix where each entry is an object representing the state of a space on the gameboard)
function initGameboard(playerColors) {
  let gameboard = [];

  //INITIALIZE ALL CELLS
  for (let r = 0; r < CONSTANTS.NUM_OF_ROWS; r++) {
    gameboard[r] = [];
    for (let c = 0; c < CONSTANTS.NUM_OF_COLS; c++) {
      gameboard[r][c] = {
        type: CONSTANTS.INVALID,
        originalColor: CONSTANTS.INVALID_CELL,
        currentColor: CONSTANTS.INVALID_CELL,
        available: false,
        isPlayer: false,
      };
    }
  }

  //INITIALIZE GAME ZONES - PLAYER ZONES
  for (let i = 0; i < CONSTANTS.PLAYER_ZONES.length; i++) {
    for (let j = 0; j < CONSTANTS.PLAYER_ZONES[i].length; j++) {
      let row = CONSTANTS.PLAYER_ZONES[i][j][0];
      let col = CONSTANTS.PLAYER_ZONES[i][j][1];

      if (playerColors.includes(CONSTANTS.PLAYERS_COLOR[i])) {
        gameboard[row][col] = {
          type: CONSTANTS.PLAYER,
          originalColor: CONSTANTS.PLAYERS_COLOR[i],
          currentColor: CONSTANTS.PLAYERS_COLOR[i],
          available: false,
          isPlayer: true,
        };
      } else {
        gameboard[row][col] = {
          type: CONSTANTS.PLAYER,
          originalColor: CONSTANTS.AVAILABLE_COLOR,
          currentColor: CONSTANTS.AVAILABLE_COLOR,
          available: true,
          isPlayer: false,
        };
      }
    }
  }

  //INITIALIZE GAME ZONES - COMMON ZONE
  CONSTANTS.COMMON_ZONE.forEach((cell) => {
    let row = cell[0];
    let col = cell[1];
    gameboard[row][col] = {
      type: CONSTANTS.COMMON,
      originalColor: CONSTANTS.COMMON_CELL,
      currentColor: CONSTANTS.COMMON_CELL,
      available: true,
      isPlayer: false,
    };
  });

  return gameboard;
}

// Find the next player after the current player ends her turn
function goToNextPlayer(roomId) {
  let currentPlayer = rooms[roomId].currentPlayer;
  let selected_piece = rooms[roomId].selected_piece;
  let gameboard = rooms[roomId].gameboard;
  let playerColor = rooms[roomId].colors[currentPlayer];

  // Special case: player selected a piece & valid moves are shown, but player decided to end her turn without making any moves
  if (selected_piece.length != 0) {
    let y = selected_piece[0] * CONSTANTS.CELL_HEIGHT;
    let x = selected_piece[1] * CONSTANTS.CELL_WIDTH;
    io.to(roomId).emit("drawCircle", x, y, playerColor);

    rooms[roomId].validNextMoves.forEach((item) => {
      let y = item[0] * CONSTANTS.CELL_HEIGHT;
      let x = item[1] * CONSTANTS.CELL_WIDTH;
      let playerColor = gameboard[item[0]][item[1]].originalColor;
      io.to(roomId).emit("drawCircleWithBorder", x, y, playerColor);
    });
  }

  const capacity = rooms[roomId].capacity;
  const numOfCompletion = rooms[roomId].completed.filter(
    (item) => item == true
  ).length;
  let nextPlayer = (currentPlayer + 1) % capacity;

  //Skip the player who has completed
  while (numOfCompletion != capacity && rooms[roomId].completed[nextPlayer]) {
    nextPlayer = (nextPlayer + 1) % capacity;
  }

  const nextName = rooms[roomId].playerNames[nextPlayer];
  const nextColor = rooms[roomId].colors[nextPlayer];
  const nextSocket = rooms[roomId].sockets[nextPlayer];

  rooms[roomId].currentPlayer = nextPlayer;
  rooms[roomId].selected_piece = [];
  rooms[roomId].allow_single_step = true;
  rooms[roomId].validNextMoves = [];

  io.to(roomId).emit("nextPlayer", nextName, nextColor, nextSocket);
}

// Return true if all the pieces of the given player color has reached their destination
function checkCompletion(playerColor, gameboard) {
  let count = CONSTANTS.DESTINATION[playerColor].filter(
    (cell) => gameboard[cell[0]][cell[1]].currentColor == playerColor
  ).length;
  return count == 10;
}

// Return a random number to be used as the room ID
function generateRandomId() {
  const characters = "abcdefghijklmnopqrstABCDEFGHIJKLMNOPQRST0123456789";
  const length = 10;
  let randomId = "";

  for (let i = 0; i < length; i++) {
    let randomNumber = Math.floor(Math.random() * characters.length);
    randomId += characters[randomNumber];
  }

  return randomId;
}
