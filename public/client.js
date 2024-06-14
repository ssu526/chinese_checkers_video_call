const socket = io();
let roomId;
let localStream;
let peerConnections = {};

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

/************************************************************************************************/
/*                                     HANDLE CLICK EVENTS                                      */
/************************************************************************************************/
// Create a new room and join the room
btn_createRoom.addEventListener("click", () => {
  let playerName = input_PlayerName_create.value.trim();
  let roomCapacity = parseInt(select_numberOfPlayer.value);

  if (playerName) {
    socket.emit("createRoom", playerName, roomCapacity);
  } else {
    txt_errorMessage_create.innerHTML = "Please enter your name";
  }
});

// Join an existing room
btn_joinRoom.addEventListener("click", () => {
  let roomId = input_roomId.value;
  let playerName = input_PlayerName_join.value.trim();

  if (roomId && playerName) {
    socket.emit("joinRoom", roomId, playerName);
  } else {
    txt_errorMessage_join.innerHTML = "Please enter the room ID and your name.";
  }
});

// Click event on the canvas
canvas.addEventListener("click", (event) => {
  let canvasPosition = canvas.getBoundingClientRect();
  let click_x = event.clientX - canvasPosition.x; //Coordinate of the click event relative to the canvas
  let click_y = event.clientY - canvasPosition.y;
  let row = Math.floor(click_y / CELL_HEIGHT); //gameboard cell(row&col) corresponds to the canvas coordinate
  let col = Math.floor(click_x / CELL_WIDTH);

  socket.emit("click", roomId, row, col);
});

// Reset game
button_reset.addEventListener("click", () => {
  let resetConfirmation = confirm("Are you sure you want to reset the game?");

  if (resetConfirmation) {
    socket.emit("reset", roomId);
  }
});

// Player ends her turn
button_done.addEventListener("click", () => {
  socket.emit("endTurn", roomId);
});

roomidEl.addEventListener("click", () => {
  navigator.clipboard.writeText(roomId);
});

window.onbeforeunload = (e) => {
  if (roomId) {
    e.preventDefault();
    return "Are you sure you want to leave the game?";
  }
};

/************************************************************************************************/
/*                               HANDLE MESSAGES FROM SERVER                                    */
/************************************************************************************************/
socket.on("joined", (id, gameboard) => {
  roomId = id;
  drawGameboard(gameboard);
  showGameScreen();

  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then(async (stream) => {
      local_video.srcObject = stream;
      localStream = stream;

      socket.emit("newVideo", roomId);

      socket.on("newVideo", (remoteSocketId) => {
        createPeerConnection(remoteSocketId);
        peerConnections[remoteSocketId]
          .createOffer()
          .then((offer) => {
            peerConnections[remoteSocketId].setLocalDescription(offer);
            socket.emit("offer", offer, remoteSocketId);
          })
          .catch((err) => {
            console.error("Error creating offer:", err);
          });
      });
    })
    .catch((err) => {
      console.error("Error accessing media devices.", err);
    });
});

socket.on("announceNewPlayer", (playerNames) => {
  if (playerNames.length === 1) {
    waitingEl.innerHTML = `${playerNames} has joined.`;
  } else {
    let names = playerNames.join(", ");
    waitingEl.innerHTML = `${names} have joined.`;
  }

  waitingEl.innerHTML += "<br/></br/>Waiting for other players to join...";
});

socket.on("error", (message) => {
  txt_errorMessage_join.innerHTML = message; // room is full or room does not exist
});

socket.on(
  "startGame",
  (currentPlayerName, currentPlayerColor, currentSocket) => {
    waitingEl.style.display = "none";
    button_reset.style.visibility = "visible";
    button_done_text.innerHTML = currentPlayerName;
    button_done.style.backgroundColor = currentPlayerColor;
    button_done.style.display = "block";

    if (socket.id === currentSocket) {
      tip_text.style.display = "block";
      button_done.style.cursor = "pointer";
    } else {
      tip_text.style.display = "none";
      button_done.style.cursor = "default";
    }
  }
);

socket.on(
  "reset",
  (gameboard, currentPlayerName, currentPlayerColor, currentSocket) => {
    button_done_text.innerHTML = currentPlayerName;
    button_done.style.backgroundColor = currentPlayerColor;
    button_done.style.display = "block";

    if (socket.id === currentSocket) {
      tip_text.style.display = "block";
      button_done.style.cursor = "pointer";
    } else {
      tip_text.style.display = "none";
      button_done.style.cursor = "default";
    }
    drawGameboard(gameboard);
  }
);

socket.on("drawSelected", (x, y, playerColor) => {
  drawSelected(x, y, playerColor);
});

socket.on("drawCircle", (x, y, playerColor) => {
  drawCircle(x, y, playerColor);
});

socket.on("drawCircleWithBorder", (x, y, color) => {
  drawCircleWithBorder(x, y, color);
});

socket.on("showValidNextMoves", (validNextMoves, playerColor) => {
  showValidNextMoves(validNextMoves, playerColor);
});

socket.on("nextPlayer", (nextName, nextColor, nextSocket) => {
  button_done_text.innerHTML = nextName;
  button_done.style.backgroundColor = nextColor;
  if (socket.id === nextSocket) {
    tip_text.style.display = "block";
    button_done.style.cursor = "pointer";
  } else {
    tip_text.style.display = "none";
    button_done.style.cursor = "default";
  }
});

socket.on("allCompleted", () => {
  console.log("Game finished");
});

socket.on("offer", async (offer, id) => {
  if (!peerConnections[id]) {
    createPeerConnection(id);
  }

  try {
    await peerConnections[id].setRemoteDescription(
      new RTCSessionDescription(offer)
    );
    const answer = await peerConnections[id].createAnswer();
    await peerConnections[id].setLocalDescription(answer);
    socket.emit("answer", answer, id);
  } catch (error) {
    console.error("Error accepting offer:", error);
  }
});

socket.on("answer", async (answer, id) => {
  try {
    await peerConnections[id].setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  } catch (error) {
    console.error("Error accepting answer:", error);
  }
});

socket.on("candidate", async (candidate, id) => {
  try {
    await peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error("Error adding ice candidate:", error);
  }
});

socket.on("playerDisconnected", (playerDisconnected) => {
  let videoElement = document.getElementById(
    `remoteVideo_${playerDisconnected}`
  );
  if (videoElement) {
    videoElement.parentNode.removeChild(videoElement);
  }
});

/************************************************************************************************/
/*                                        HELPER FUNCTIONS                                      */
/************************************************************************************************/
function showGameScreen() {
  container_startScreen.style.display = "none";
  container_gameScreen.style.display = "flex";
  roomidEl.innerHTML = roomId;
}

function showValidNextMoves(validNextMoves, playerColor) {
  if (validNextMoves.length > 0) {
    validNextMoves.forEach((item) => {
      if (item.length > 0) {
        drawValidMove(item[1] * CELL_WIDTH, item[0] * CELL_HEIGHT, playerColor);
      }
    });
  }
}

function drawGameboard(gameboard) {
  for (let r = 0; r < NUM_OF_ROWS; r++) {
    for (let c = 0; c < NUM_OF_COLS; c++) {
      if (gameboard[r][c].type == COMMON) {
        drawCircleWithBorder(
          c * CELL_WIDTH,
          r * CELL_HEIGHT,
          gameboard[r][c].originalColor
        );
      } else {
        if (gameboard[r][c].isPlayer) {
          drawCircle(
            c * CELL_WIDTH,
            r * CELL_HEIGHT,
            gameboard[r][c].originalColor
          );
        } else if (
          gameboard[r][c].type != INVALID &&
          !gameboard[r][c].currentPlayer
        ) {
          drawCircleWithBorder(
            c * CELL_WIDTH,
            r * CELL_HEIGHT,
            gameboard[r][c].originalColor
          );
        }
      }
    }
  }
}

function drawCircle(x, y, color) {
  let gradient = ctx.createRadialGradient(x, y, RADIUS / 10, x, y, RADIUS * 2);
  gradient.addColorStop(0, "white");
  gradient.addColorStop(1, color);

  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.arc(x + RADIUS, y + RADIUS, RADIUS, 0, 2 * Math.PI); //need to add RADIUS to move the starting point, else some circles will be cut in half at the canvas border
  ctx.fill();
}

function drawCircleWithBorder(x, y, color) {
  ctx.beginPath();
  ctx.fillStyle = "WHITE";
  // ctx.strokeStyle = color;
  // ctx.lineWidth = 2.5;
  ctx.arc(x + RADIUS, y + RADIUS, RADIUS, 0, 2 * Math.PI);
  ctx.fill();
  // ctx.stroke();
}

function drawSelected(x, y, color) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.arc(x + RADIUS, y + RADIUS, RADIUS, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
}

function drawValidMove(x, y, color) {
  let gradient = ctx.createRadialGradient(x, y, RADIUS / 5, x, y, RADIUS * 5);
  gradient.addColorStop(0, "white");
  gradient.addColorStop(0.8, color);

  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.lineWidth = 4;
  ctx.arc(x + RADIUS, y + RADIUS, RADIUS, 0, 2 * Math.PI);
  ctx.fill();
}

function createPeerConnection(remoteSocketId) {
  peerConnections[remoteSocketId] = new RTCPeerConnection(configuration);

  peerConnections[remoteSocketId].onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", event.candidate, remoteSocketId);
    }
  };

  peerConnections[remoteSocketId].ontrack = (event) => {
    let remoteVideo = document.getElementById(`remoteVideo_${remoteSocketId}`);

    if (!remoteVideo) {
      remoteVideo = document.createElement("video");
      remoteVideo.id = `remoteVideo_${remoteSocketId}`;
      remoteVideo.autoplay = true;
      remoteVideo.playsinline = true;
      videos_container.appendChild(remoteVideo);

      if (document.getElementsByTagName("video").length === 3) {
        videos_container.classList.add("two_columns");
      }
    }
    remoteVideo.srcObject = event.streams[0];
  };

  localStream.getTracks().forEach((track) => {
    peerConnections[remoteSocketId].addTrack(track, localStream);
  });
}

video_toggle.addEventListener("click", () => {
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    video_toggle.textContent = "Video Off";
    video_toggle.classList.remove("video_on");
    video_toggle.classList.add("video_off");
  } else {
    videoTrack.enabled = true;
    video_toggle.textContent = "Video On";
    video_toggle.classList.remove("video_off");
    video_toggle.classList.add("video_on");
  }
});

audio_toggle.addEventListener("click", () => {
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    audio_toggle.textContent = "Mute";
    audio_toggle.classList.remove("unmute");
    audio_toggle.classList.add("mute");
  } else {
    audioTrack.enabled = true;
    audio_toggle.textContent = "Unmute";
    audio_toggle.classList.remove("mute");
    audio_toggle.classList.add("unmute");
  }
});
