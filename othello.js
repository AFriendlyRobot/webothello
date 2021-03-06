var board = [];
var pieces = [];
var squares = [];

const RECT_WIDTH = 64;
const directions = ['ul', 'u', 'ur', 'r', 'dr', 'd', 'dl', 'l'];

var going = 'black';

var potentials = {};

var pointer = null;

var numWaiting = 0;

function init() {
	fillPieces();
	drawBoard();
	placePiece(3, 3, 'white');
	placePiece(4, 4, 'white');
	placePiece(3, 4, 'black');
	placePiece(4, 3, 'black');
	calcPossibleMoves();
	makePointer();
}

function addWaiting() {
	numWaiting += 1;
}

function removeWaiting() {
	numWaiting -= 1;
}

function isWaiting() {
	return (numWaiting > 0);
}

function fillPieces() {
	pieces = [];

	for (let r = 0; r < 8; r++) {
		pieces.push([]);
		for (let c = 0; c < 8; c++) {
			pieces[r].push(null);
		}
	}
}

// Draws the Othello board, registering event listeners
function drawBoard() {
	let gameDiv = $("#game");

	for (let i = 0; i < 8; i++) {
		board.push([]);
		squares.push([]);
		for (let j = 0; j < 8; j++) {
			board[i].push(0);
			let newBox = $(`<span id="${(i * 8) + j}" class="board-square">`);
			newBox.on('click', (event) => {
				registerClick(i, j);
			});

			squares[i].push(newBox);

			gameDiv.append(newBox);
		}
	}
}

function makePointer() {
	pointer = $('<div id="pointer-piece" class="piece black">');
	
	pointer.css('display', 'none');

	$('#game').on('mousemove', (event) => {
		pointer.css('display', 'block');
		pointer.css('left', `${event.clientX - 24}px`);
		pointer.css('top', `${event.clientY - 24}px`);
	});

	$('#game').on('mouseleave', (event) => {
		pointer.css('display', 'none');
	});

	$('body').append(pointer);
}

function canPlacePiece(row, col) {
	if (outOfBounds(row, col)) { return false; }

	let k = (row * 8) + col;

	if (!(k in potentials)) { return false; }

	return true;
}

function placePiece(row, col, color) {
	if (board[row][col] !== 0) { return; } // Don't overwrite

	board[row][col] = (color === 'white') ? 1 : -1;
	$(squares[row][col]).addClass('occupied');

	drawPiece(row, col, color);
}

function drawPiece(row, col, color) {
	// let { x, y } = rowColToXY(row, col);
	let { deltaX, deltaY } = rowColToDeltas(row, col);

	// let newPiece = $(`<span class="piece ${color}" style="left: ${x}px; top: ${y}px;">`);
	let newTransform = `transform: translate(${deltaX}px, ${deltaY}px);`;
	let newPiece = $(`<span class="piece ${color}" style="${newTransform}">`);

	$("#game").append(newPiece);

	pieces[row][col] = newPiece;
}

function rowColToXY(row, col) {
	let x = (col * 64) + 8;
	let y = (row * (64)) + 8;

	return { x, y };
}

function rowColToDeltas(row, col) {
	const baseX = -56;
	const baseY = 8;

	let xd = baseX + ((col - 7) * 64);
	let yd = baseY + ((row - 7) * 64);

	return { deltaX: xd, deltaY: yd };
}

async function registerClick(row, col) {
	if (isWaiting()) {
		return;
	}

	let check = canPlacePiece(row, col);
	if (!check) {
		console.warn("Invalid move");
		return;
	}

	placePiece(row, col, going);

	let promises = [];

	for (let direct in potentials[(row * 8) + col]) {
		let { rdelta, cdelta } = deltasFromDirection(direct);
		promises.push(flipPosition(row+rdelta, col+cdelta, board[row][col], direct));
	}

	// Ugly synchronization
	for (let i = 0; i < promises.length; i++) {
		await promises[i];
	}

	swapGoing();
	calcPossibleMoves();

	if (Object.getOwnPropertyNames(potentials).length === 0) {
		swapGoing();
		calcPossibleMoves();

		if (Object.getOwnPropertyNames(potentials).length === 0) {
			endGame();
		}
	}
}

function swapGoing() {
	if (going === 'white') {
		going = 'black';
		pointer.removeClass('white');
		pointer.addClass('black');
	} else {
		going = 'white';
		pointer.removeClass('black');
		pointer.addClass('white');
	}

	$("#going-title").text(`${going.slice(0,1).toUpperCase() + going.slice(1)} turn`);
}

// TODO some broken edge cases?
function calcPossibleMoves() {
	let original = (going === 'white') ? 1 : -1;
	let opCheck = original * -1;

	potentials = {};

	for (let row = 0; row < 8; row++) {
		for (let col = 0; col < 8; col++) {
			$(squares[row][col]).removeClass('valid');

			k = (row * 8) + col;

			let isValid = false;

			if (board[row][col] !== 0) { continue; }

			for (let direct of directions) {
				let { rdelta, cdelta } = deltasFromDirection(direct);

				let newR = row + rdelta;
				let newC = col + cdelta;

				if (outOfBounds(newR, newC)) { continue; }

				if (board[newR][newC] === opCheck) {
					let validLoc = checkPosition(newR, newC, original, direct);

					if (validLoc) {
						isValid = true;

						if (!(k in potentials)) {
							potentials[k] = {};
						}

						potentials[k][direct] = true;
					}
				}
			}

			if (isValid) {
				squares[row][col].addClass('valid');
			}
		}
	}
}

function countPieces() {
	return board.map((row) => row.reduce((t, v) => t + Math.abs(v))).reduce((t, v) => t + v);
}

function checkPosition(row, col, origin, direction) {
	if (outOfBounds(row, col)) { return false; }

	if (board[row][col] === origin) {
		return true;
	} else if (board[row][col] === 0) {
		return false;
	} else {
		let { rdelta, cdelta } = deltasFromDirection(direction);
		newR = row + rdelta;
		newC = col + cdelta;

		return checkPosition(newR, newC, origin, direction);
	}
}


// TODO: The error seems to be because of the timeout. Need a way to handle asynchronous behavior
//       e.g. await finished flipping
async function flipPosition(row, col, origin, direction) {
	let { rdelta, cdelta } = deltasFromDirection(direction);

	if (outOfBounds(row, col) || board[row][col] === origin) {
		// doneFlipping();
		return;
	}

	let originClass = (origin === 1) ? 'white' : 'black';
	let otherClass = (origin === 1) ? 'black' : 'white';

	board[row][col] = origin;
	// $(pieces[row][col]).removeClass(otherClass);
	// $(pieces[row][col]).addClass(originClass);
	flipPiece(pieces[row][col], otherClass, originClass);

	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(flipPosition(row+rdelta, col+cdelta, origin, direction));
		}, 100);
	});
}

function flipPiece(piece, original, destination) {
	$(piece).addClass('transition');
	addWaiting();
	setTimeout(() => {
		$(piece).removeClass(original);
		$(piece).addClass(destination);
		$(piece).removeClass('transition');
		removeWaiting();
	}, 150);
}

function deltasFromDirection(direct) {
	let rdelta = 0;
	let cdelta = 0;

	if (direct.match(/u/g)) {
		rdelta = -1;
	} else if (direct.match(/d/g)) {
		rdelta = 1;
	}

	if (direct.match(/l/g)) {
		cdelta = -1;
	} else if (direct.match(/r/g)) {
		cdelta = 1;
	}

	return { rdelta, cdelta };
}

function endGame() {
	let w = 0;
	let b = 0;

	for (let row = 0; row < 8; row++) {
		for (let col = 0; col < 8; col++) {
			if (board[row][col] === 1) {
				w += 1;
			} else if (board[row][col] === -1) {
				b += 1;
			}
		}
	}

	if (w === b) {
		alert('Tie game!');
	} else {
		let winner = (w > b) ? 'White' : 'Black';
		alert(`${winner} wins!`);
	}

	$('#pointer-piece').remove();

	$('html, body').css('cursor', 'default');
}

function outOfBounds(row, col) {
	return (row < 0 || row > 7) || (col < 0 || col > 7);
}

window.onload = () => {
	init();
}