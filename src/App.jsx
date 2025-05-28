import { useState, useEffect, useCallback, useRef } from "react";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const EMPTY = 0;

// Tetris pieces (tetrominoes)
const PIECES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: "bg-cyan-400",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "bg-yellow-400",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "bg-purple-400",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: "bg-green-400",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: "bg-red-400",
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "bg-blue-400",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "bg-orange-400",
  },
};

const PIECE_TYPES = Object.keys(PIECES);

export default function App() {
  const [board, setBoard] = useState(() =>
    Array(BOARD_HEIGHT)
      .fill()
      .map(() => Array(BOARD_WIDTH).fill({ type: EMPTY, color: "" }))
  );
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPiece, setCurrentPiece] = useState(null);
  const [nextPiece, setNextPiece] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  const gameLoopRef = useRef();
  const dropTimeRef = useRef(1000);
  const lastDropRef = useRef(0);

  // Initialize empty board
  const createEmptyBoard = () =>
    Array(BOARD_HEIGHT)
      .fill()
      .map(() => Array(BOARD_WIDTH).fill({ type: EMPTY, color: "" }));

  // Generate random piece
  const generatePiece = () => {
    const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
    return {
      type,
      shape: PIECES[type].shape,
      color: PIECES[type].color,
      x:
        Math.floor(BOARD_WIDTH / 2) -
        Math.floor(PIECES[type].shape[0].length / 2),
      y: 0,
    };
  };

  // Rotate piece matrix
  const rotatePiece = (piece) => {
    const rotated = piece.shape[0].map((_, i) =>
      piece.shape.map((row) => row[i]).reverse()
    );
    return { ...piece, shape: rotated };
  };

  // Check collision
  const isValidMove = (piece, board, dx = 0, dy = 0) => {
    return piece.shape.every((row, y) =>
      row.every((cell, x) => {
        if (cell === 0) return true;
        const newX = piece.x + x + dx;
        const newY = piece.y + y + dy;
        return (
          newX >= 0 &&
          newX < BOARD_WIDTH &&
          newY < BOARD_HEIGHT &&
          (newY < 0 || board[newY][newX].type === EMPTY)
        );
      })
    );
  };

  // Place piece on board
  const placePiece = (piece, board) => {
    const newBoard = board.map((row) => [...row]);
    piece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell && piece.y + y >= 0) {
          newBoard[piece.y + y][piece.x + x] = {
            type: piece.type,
            color: piece.color,
          };
        }
      });
    });
    return newBoard;
  };

  // Clear completed lines
  const clearLines = (board) => {
    const newBoard = board.filter((row) =>
      row.some((cell) => cell.type === EMPTY)
    );
    const linesCleared = BOARD_HEIGHT - newBoard.length;

    while (newBoard.length < BOARD_HEIGHT) {
      newBoard.unshift(Array(BOARD_WIDTH).fill({ type: EMPTY, color: "" }));
    }

    return { newBoard, linesCleared };
  };

  // Move piece
  const movePiece = useCallback(
    (dx, dy) => {
      if (!currentPiece || gameOver || isPaused) return false;

      if (isValidMove(currentPiece, board, dx, dy)) {
        setCurrentPiece((prev) => ({
          ...prev,
          x: prev.x + dx,
          y: prev.y + dy,
        }));
        return true;
      }
      return false;
    },
    [currentPiece, board, gameOver, isPaused]
  );

  // Rotate current piece
  const rotatePieceAction = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;

    const rotated = rotatePiece(currentPiece);
    if (isValidMove(rotated, board)) {
      setCurrentPiece(rotated);
    }
  }, [currentPiece, board, gameOver, isPaused]);

  // Drop piece to bottom
  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;

    let dropDistance = 0;
    while (isValidMove(currentPiece, board, 0, dropDistance + 1)) {
      dropDistance++;
    }

    setCurrentPiece((prev) => ({ ...prev, y: prev.y + dropDistance }));
    setScore((prev) => prev + dropDistance * 2);
  }, [currentPiece, board, gameOver, isPaused]);

  // Game loop
  const gameLoop = useCallback(
    (timestamp) => {
      if (!gameStarted || gameOver || isPaused) return;

      if (timestamp - lastDropRef.current > dropTimeRef.current) {
        if (!movePiece(0, 1)) {
          // Piece can't move down, place it
          const newBoard = placePiece(currentPiece, board);
          const { newBoard: clearedBoard, linesCleared } = clearLines(newBoard);

          setBoard(clearedBoard);
          setLines((prev) => prev + linesCleared);
          setScore((prev) => prev + linesCleared * 100 * level);

          // Check for game over
          if (currentPiece.y <= 0) {
            setGameOver(true);
            return;
          }

          // Spawn new piece
          setCurrentPiece(nextPiece);
          setNextPiece(generatePiece());
        }
        lastDropRef.current = timestamp;
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    },
    [
      gameStarted,
      gameOver,
      isPaused,
      currentPiece,
      nextPiece,
      board,
      movePiece,
      level,
    ]
  );

  // Update level and speed
  useEffect(() => {
    const newLevel = Math.floor(lines / 10) + 1;
    setLevel(newLevel);
    dropTimeRef.current = Math.max(50, 1000 - (newLevel - 1) * 100);
  }, [lines]);

  // Start game loop
  useEffect(() => {
    if (gameStarted && !gameOver && !isPaused) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameLoop, gameStarted, gameOver, isPaused]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!gameStarted || gameOver) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          movePiece(-1, 0);
          break;
        case "ArrowRight":
          e.preventDefault();
          movePiece(1, 0);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (movePiece(0, 1)) {
            setScore((prev) => prev + 1);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          rotatePieceAction();
          break;
        case " ":
          e.preventDefault();
          hardDrop();
          break;
        case "p":
        case "P":
          setIsPaused((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [movePiece, rotatePieceAction, hardDrop, gameStarted, gameOver]);

  // Start new game
  const startNewGame = () => {
    setBoard(createEmptyBoard());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setIsPaused(false);
    setGameStarted(true);
    const first = generatePiece();
    const second = generatePiece();
    setCurrentPiece(first);
    setNextPiece(second);
    dropTimeRef.current = 1000;
    lastDropRef.current = 0;
  };

  // Render board with current piece
  const renderBoard = () => {
    const displayBoard = board.map((row) => [...row]);

    // Add current piece to display board
    if (currentPiece) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (
            cell &&
            currentPiece.y + y >= 0 &&
            currentPiece.y + y < BOARD_HEIGHT
          ) {
            displayBoard[currentPiece.y + y][currentPiece.x + x] = {
              type: currentPiece.type,
              color: currentPiece.color,
            };
          }
        });
      });
    }

    return displayBoard;
  };

  const displayBoard = renderBoard();

  return (
    <div className="min-h-[100svh] bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 md:p-4 flex items-center justify-center">
      <div className="w-full max-w-lg mx-auto bg-gray-800 md:rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="hidden bg-gradient-to-r from-purple-600 to-blue-600 p-4">
          <h1 className="text-2xl font-bold text-white text-center">TETRIS</h1>
        </div>

        <div className="p-4 space-y-2">
          {gameStarted && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  disabled={gameOver}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  {isPaused ? "RESUME" : "PAUSE"}
                </button>
                <button
                  onClick={startNewGame}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  NEW GAME
                </button>
              </div>
            </div>
          )}

          {/* Game Info */}
          <div className="grid grid-cols-3 gap-4 mb-4 text-white text-center">
            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-300">SCORE</div>
              <div className="text-lg font-bold">{score.toLocaleString()}</div>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-300">LINES</div>
              <div className="text-lg font-bold">{lines}</div>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-300">LEVEL</div>
              <div className="text-lg font-bold">{level}</div>
            </div>
          </div>

          {/* Game Board and Next Piece */}
          <div className="flex gap-4">
            {/* Game Board */}
            <div className="flex-1">
              <div
                className="bg-black rounded-lg p-3 relative"
                style={{ aspectRatio: "10/20" }}
              >
                <div className="grid grid-cols-10 gap-px h-full min-h-[500px]">
                  {displayBoard.flat().map((cell, i) => (
                    <div
                      key={i}
                      className={`rounded-sm border border-gray-800 ${
                        cell.type === EMPTY
                          ? "bg-gray-900"
                          : `${cell.color} border-white border-opacity-30 shadow-inner`
                      }`}
                    />
                  ))}
                </div>

                {/* Game Over Overlay */}
                {gameOver && (
                  <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center rounded-lg">
                    <div className="text-center text-white">
                      <div className="text-xl font-bold mb-2">GAME OVER</div>
                      <div className="text-sm">
                        Final Score: {score.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pause Overlay */}
                {isPaused && !gameOver && (
                  <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center rounded-lg">
                    <div className="text-white text-xl font-bold">PAUSED</div>
                  </div>
                )}
              </div>
            </div>

            {/* Next Piece */}
            <div className="w-24">
              <div className="bg-gray-700 rounded p-2 mb-4">
                <div className="text-xs text-gray-300 text-center mb-2">
                  NEXT
                </div>
                <div className="bg-black rounded p-3 h-20 flex items-center justify-center">
                  {nextPiece && (
                    <div
                      className="grid gap-px"
                      style={{
                        gridTemplateColumns: `repeat(${nextPiece.shape[0].length}, 1fr)`,
                      }}
                    >
                      {nextPiece.shape.flat().map((cell, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-sm ${
                            cell
                              ? `${nextPiece.color} border border-white border-opacity-30`
                              : ""
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 space-y-3">
            {!gameStarted && (
              <button
                onClick={startNewGame}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                START GAME
              </button>
            )}

            {/* Mobile Controls */}
            {gameStarted && (
              <div className="grid grid-cols-5 md:grid-cols-3 gap-2 mt-4">
                <button
                  onClick={() => movePiece(-1, 0)}
                  className="bg-blue-600 select-none hover:bg-blue-700 text-white font-bold py-3 rounded text-xl"
                >
                  ←
                </button>
                <button
                  onClick={rotatePieceAction}
                  className="bg-purple-600 select-none hover:bg-purple-700 text-white font-bold py-3 rounded"
                >
                  ↻
                </button>
                <button
                  onClick={() => movePiece(1, 0)}
                  className="bg-blue-600 select-none hover:bg-blue-700 text-white font-bold py-3 rounded text-xl"
                >
                  →
                </button>
                <button
                  onClick={() => {
                    if (movePiece(0, 1)) setScore((prev) => prev + 1);
                  }}
                  className="bg-green-600 select-none hover:bg-green-700 text-white font-bold py-3 rounded"
                >
                  ↓
                </button>
                <button
                  onClick={hardDrop}
                  className="bg-red-600 select-none hover:bg-red-700 text-white font-bold py-3 rounded text-sm"
                >
                  DROP
                </button>
                <div></div>
              </div>
            )}

            {/* Instructions */}
            <div className="text-xs text-gray-400 hidden md:block text-center space-y-1">
              <div>Desktop: Arrow keys to move, Space to drop, P to pause</div>
              <div>Mobile: Use buttons below</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
