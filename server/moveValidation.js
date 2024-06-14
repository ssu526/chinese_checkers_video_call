const CONSTANTS = require("./constants");

function getValidNextMoves(room) {
  let validNextMoves = [];
  const left = _getValidNextMoves_Left(room);
  const bottomRight = _getValidNextMoves_BottomRight(room);
  const bottomLeft = _getValidNextMoves_BottomLeft(room);
  const right = _getValidNextMoves_Right(room);
  const topLeft = _getValidNextMoves_TopLeft(room);
  const topRight = _getValidNextMoves_TopRight(room);

  validNextMoves = validNextMoves.concat(
    left,
    bottomRight,
    bottomLeft,
    right,
    topLeft,
    topRight
  );
  // console.log(validNextMoves)
  // validNextMoves = validNextMoves.filter(m => m !== undefined);

  return validNextMoves;
}

function _getValidNextMoves_Left(room) {
  const allow_single_step = room.allow_single_step;
  const gameboard = room.gameboard;
  const selected_piece = room.selected_piece;
  let row = selected_piece[0];
  let col = selected_piece[1];
  let validNextMoves = [];

  //LEFT (r, c-2)
  if (allow_single_step && col - 2 >= 0 && gameboard[row][col - 2].available) {
    validNextMoves.push([row, col - 2]);
  }

  let hop_over = [];
  let i = 2;

  while (col - i >= 0) {
    if (
      gameboard[row][col - i].type != "invalid" &&
      gameboard[row][col - i].available == false
    ) {
      hop_over[0] = row;
      hop_over[1] = col - i;
      break;
    }
    i = i + 2;
  }

  if (hop_over.length != 0) {
    let hopsNeeded = Math.abs(hop_over[1] - col);

    for (let k = 2; k <= hopsNeeded; k = k + 2) {
      if (
        hop_over[1] - k < 0 ||
        gameboard[row][hop_over[1] - k].available == false
      )
        return validNextMoves;
    }

    validNextMoves.push([row, hop_over[1] - hopsNeeded]);
  }

  return validNextMoves;
}

function _getValidNextMoves_Right(room) {
  const allow_single_step = room.allow_single_step;
  const gameboard = room.gameboard;
  const selected_piece = room.selected_piece;
  let row = selected_piece[0];
  let col = selected_piece[1];
  let validNextMoves = [];

  //RIGHT (r, c+2)
  if (
    allow_single_step &&
    col + 2 < CONSTANTS.NUM_OF_COLS &&
    gameboard[row][col + 2].available
  ) {
    validNextMoves.push([row, col + 2]);
  }

  let hop_over = [];
  let i = 2;

  while (col + i < CONSTANTS.NUM_OF_COLS) {
    if (
      gameboard[row][col + i].type != "invalid" &&
      gameboard[row][col + i].available == false
    ) {
      hop_over[0] = row;
      hop_over[1] = col + i;
      break;
    }
    i = i + 2;
  }

  if (hop_over.length != 0) {
    let hopsNeeded = Math.abs(hop_over[1] - col);

    for (let k = 2; k <= hopsNeeded; k = k + 2) {
      if (
        hop_over[1] + k >= CONSTANTS.NUM_OF_COLS ||
        gameboard[row][hop_over[1] + k].available == false
      )
        return validNextMoves;
    }

    validNextMoves.push([row, hop_over[1] + hopsNeeded]);
  }

  return validNextMoves;
}

function _getValidNextMoves_BottomLeft(room) {
  const allow_single_step = room.allow_single_step;
  const gameboard = room.gameboard;
  const selected_piece = room.selected_piece;
  let row = selected_piece[0];
  let col = selected_piece[1];
  let validNextMoves = [];

  //BOTTOM LEFT (r+1, c-1)
  if (
    allow_single_step &&
    row + 1 < CONSTANTS.NUM_OF_ROWS &&
    col - 1 >= 0 &&
    gameboard[row + 1][col - 1].available
  ) {
    validNextMoves.push([row + 1, col - 1]);
  }

  let hop_over = [];

  for (
    let i = 1, j = 1;
    i <= (CONSTANTS.NUM_OF_ROWS - row) / 2 && j < col / 2;
    i++, j++
  ) {
    if (
      gameboard[row + i][col - i].available == false &&
      gameboard[row + i][col - i].type != "invalid"
    ) {
      hop_over[0] = row + i;
      hop_over[1] = col - i;
      break;
    }
  }

  if (hop_over.length != 0) {
    let hopsNeeded = Math.abs(hop_over[1] - col);

    for (let k = 1; k <= hopsNeeded; k++) {
      if (
        hop_over[0] + k >= CONSTANTS.NUM_OF_ROWS ||
        hop_over[1] - k < 0 ||
        gameboard[hop_over[0] + k][hop_over[1] - k].available == false
      )
        return validNextMoves;
    }

    validNextMoves.push([hop_over[0] + hopsNeeded, hop_over[1] - hopsNeeded]);
  }

  return validNextMoves;
}

function _getValidNextMoves_BottomRight(room) {
  const allow_single_step = room.allow_single_step;
  const gameboard = room.gameboard;
  const selected_piece = room.selected_piece;
  let row = selected_piece[0];
  let col = selected_piece[1];
  let validNextMoves = [];

  //BOTTOM RIGHT (r+1, c+1)
  if (
    allow_single_step &&
    row + 1 < CONSTANTS.NUM_OF_ROWS &&
    col + 1 < CONSTANTS.NUM_OF_COLS &&
    gameboard[row + 1][col + 1].available
  ) {
    validNextMoves.push([row + 1, col + 1]);
  }

  let hop_over = [];

  for (
    let i = 1, j = 1;
    i <= (CONSTANTS.NUM_OF_ROWS - row) / 2 &&
    j < (CONSTANTS.NUM_OF_COLS - col) / 2;
    i++, j++
  ) {
    if (
      gameboard[row + i][col + i].available == false &&
      gameboard[row + i][col + i].type != "invalid"
    ) {
      hop_over[0] = row + i;
      hop_over[1] = col + i;
      break;
    }
  }

  if (hop_over.length != 0) {
    let hopsNeeded = hop_over[1] - col;

    for (let k = 1; k <= hopsNeeded; k++) {
      if (
        hop_over[0] + k >= CONSTANTS.NUM_OF_ROWS ||
        hop_over[1] + k >= CONSTANTS.NUM_OF_COLS ||
        gameboard[hop_over[0] + k][hop_over[1] + k].available == false
      )
        return validNextMoves;
    }

    validNextMoves.push([hop_over[0] + hopsNeeded, hop_over[1] + hopsNeeded]);
  }

  return validNextMoves;
}

function _getValidNextMoves_TopLeft(room) {
  const allow_single_step = room.allow_single_step;
  const gameboard = room.gameboard;
  const selected_piece = room.selected_piece;
  let row = selected_piece[0];
  let col = selected_piece[1];
  let validNextMoves = [];

  //TOP LEFT (r-1, c-1)
  if (
    allow_single_step &&
    row - 1 >= 0 &&
    col - 1 >= 0 &&
    gameboard[row - 1][col - 1].available
  ) {
    validNextMoves.push([row - 1, col - 1]);
  }

  let hop_over = [];

  for (let i = 1, j = 1; i <= row / 2 && j < col / 2; i++, j++) {
    if (
      gameboard[row - i][col - i].available == false &&
      gameboard[row - i][col - i].type != "invalid"
    ) {
      hop_over[0] = row - i;
      hop_over[1] = col - i;
      break;
    }
  }

  if (hop_over.length != 0) {
    let hopsNeeded = col - hop_over[1];

    for (let k = 1; k <= hopsNeeded; k++) {
      if (
        hop_over[0] - k < 0 ||
        hop_over[1] - k < 0 ||
        gameboard[hop_over[0] - k][hop_over[1] - k].available == false
      )
        return validNextMoves;
    }

    validNextMoves.push([hop_over[0] - hopsNeeded, hop_over[1] - hopsNeeded]);
  }

  return validNextMoves;
}

function _getValidNextMoves_TopRight(room) {
  const allow_single_step = room.allow_single_step;
  const gameboard = room.gameboard;
  const selected_piece = room.selected_piece;
  let row = selected_piece[0];
  let col = selected_piece[1];
  let validNextMoves = [];

  //TOP RIGHT (r-1, c+1)
  if (
    allow_single_step &&
    row - 1 >= 0 &&
    col + 1 < CONSTANTS.NUM_OF_COLS &&
    gameboard[row - 1][col + 1].available
  ) {
    validNextMoves.push([row - 1, col + 1]);
  }

  let hop_over = [];

  for (
    let i = 1, j = 1;
    i <= row / 2 && j < (CONSTANTS.NUM_OF_COLS - col) / 2;
    i++, j++
  ) {
    if (
      gameboard[row - i][col + i].available == false &&
      gameboard[row - i][col + i].type != "invalid"
    ) {
      hop_over[0] = row - i;
      hop_over[1] = col + i;
      break;
    }
  }

  if (hop_over.length != 0) {
    let hopsNeeded = hop_over[1] - col;

    for (let k = 1; k <= hopsNeeded; k++) {
      if (
        hop_over[0] - k < 0 ||
        hop_over[1] + k >= CONSTANTS.NUM_OF_COLS ||
        gameboard[hop_over[0] - k][hop_over[1] + k].available == false
      )
        return validNextMoves;
    }

    validNextMoves.push([hop_over[0] - hopsNeeded, hop_over[1] + hopsNeeded]);
  }

  return validNextMoves;
}

module.exports = getValidNextMoves;
