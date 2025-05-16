import { Puzzle } from './puzzle.js';

// Global reference to the Emscripten Module
let Module;
let puzzle, generator, solver;

async function initializeWasm() {
    try{
        // Initialize Emscripten module
        Module = await createMyModule();
        //console.log('WASM module loaded');
        
        // Enable WASM-dependent buttons
        document.getElementById("generatePuzzle").disabled = false;
        document.getElementById("solvePuzzle").disabled = false;
        
        return Module;
    }catch (error){
        //console.error('WASM initialization failed:', error);
        alert('Failed to load puzzle engine. Please refresh the page.');
        throw error;
    }
}

function initializePuzzles() {
    // ---- PUZZLE TAB ----
    puzzle = new Puzzle("puzzleCanvas");
    puzzle.loadPuzzle(5, 5);

    puzzle.canvas.addEventListener("click", (event) => puzzle.handleClick(event, false));
    puzzle.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        puzzle.handleClick(event, true);
    });

    // ---- GENERATOR TAB ----
    generator = new Puzzle("generatorCanvas");
    generator.loadPuzzle(5, 5);

    generator.canvas.addEventListener("click", (event) => generator.handleClick(event, false));
    generator.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        generator.handleClick(event, true);
    });

    // ---- SOLVER TAB ----
    solver = new Puzzle("solverCanvas");
    solver.loadPuzzle(5, 5);

    solver.canvas.addEventListener("click", (event) => solver.handleClick2(event, false));
    solver.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        solver.handleClick2(event, true);
    });
}

function setupEventListeners() {
    // Tab switching functionality
    document.querySelectorAll('.navbar li').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.navbar li').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Handle canvas visibility
            document.querySelectorAll('canvas').forEach(c => {
                c.style.display = (tabId === 'rules' || tabId === 'about') ? 'none' : 'block';
            });
        });
    });

    // Puzzle controls
    document.getElementById("puzzleDisplayNext").addEventListener("click", function(){
        const size = bound(parseInt(document.getElementById("puzzleSize").value), 5, 10);
        const difficulty = document.getElementById("puzzleDifficulty").value;
        document.getElementById("puzzleSize").value = size;
        puzzle.randomPuzzle(size, difficulty);
    });

    document.getElementById("puzzleDisplayCode").addEventListener("click", function() {
        // Get and validate input
        const puzzleString = document.getElementById("puzzleString").value.trim();
        if (!puzzleString) {
            alert("Puzzle code cannot be empty.");
            return;
        }
        const flag = puzzle.loadPuzzleFromCode(puzzleString);
        if (!flag) {
            alert("Incorrect puzzle code.");
            return;
        }

        // Check Module readiness
        if (!Module || !Module._count_sol) {
            alert("Puzzle solver not ready. Try refreshing the page.");
            return;
        }

        try {
            // Allocate memory for input
            const inputSize = Module.lengthBytesUTF8(puzzleString) + 1;
            const inputPtr = Module._malloc(inputSize);
            Module.stringToUTF8(puzzleString, inputPtr, inputSize);
            // Call C++ function
            const count = Module._count_sol(inputPtr);
            if (count === -1) alert("Invalid puzzle code!");
            else if (count === -2) alert("Error while checking solutions!");
            else if (count === 0) alert("No solution exists!");
            else if (count >= 2) alert("The solution is not unique!");

            const resultPtr = Module._sol_puzzle(inputPtr);
            const result = Module.UTF8ToString(resultPtr);
            puzzle.solutionString = result;
            // Free memory
            Module._free_string(resultPtr);
            Module._free(inputPtr);
        } catch (error) {
            console.error("Error:", error);
            alert("Failed to validate puzzle.");
        }
    });

    document.getElementById("puzzleCheck").addEventListener("click", function(){
        if(puzzle.getStateString() == puzzle.solutionString){
            alert("Puzzle is solved!");
        } else {
            alert("Not solved correctly!");
        }
    });

    document.getElementById('puzzleUndo').addEventListener('click', () => puzzle.undo());
    document.getElementById('puzzleRedo').addEventListener('click', () => puzzle.redo());

    // Generator controls
    document.getElementById("generatePuzzle").addEventListener("click", async function(){
        if (!Module?._gen_puzzle) {
            alert("Puzzle generator not ready. Try refreshing the page.");
            return;
        }

        const rows = bound(parseInt(document.getElementById("genRows").value), 5, 10);
        const cols = bound(parseInt(document.getElementById("genCols").value), 5, 10);
        document.getElementById("genRows").value = rows;
        document.getElementById("genCols").value = cols;
        const seed = Math.floor(Math.random() * 100);
        const diff = document.getElementById("genDifficulty").value;
        
        //console.log("Generating puzzle with rows:", rows, "cols:", cols, "diff:", diff, "seed:", seed);

        try {
            const messagePtr = Module._gen_puzzle(rows, cols, diff, seed);
            const message = Module.UTF8ToString(messagePtr);
            const [puzzleString, solutionString] = message.split(',');
            
            generator.loadPuzzleFromCode(puzzleString);
            generator.solutionString = solutionString;

            document.getElementById("generatedPuzzleString").value = puzzleString;
            
            Module._free_string(messagePtr);
        } catch(error) {
            console.error('Generation failed:', error);
            alert(`Failed to generate puzzle: ${error.message}`);
        }
    });
    document.getElementById('copyPuzzleString').addEventListener('click', async function() {
        try {
            const input = document.getElementById('generatedPuzzleString');
            await navigator.clipboard.writeText(input.value);
            
            // Visual feedback
            const button = this;
            const originalText = button.innerHTML;
            button.innerHTML = '✓ Copied!';
            button.disabled = true;
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    });

    // Solver controls
    document.getElementById("displayPuzzleSolver").addEventListener("click", function() {
        const rows = bound(parseInt(document.getElementById("solRows").value), 5, 10);
        const cols = bound(parseInt(document.getElementById("solCols").value), 5, 10);
        document.getElementById("solRows").value = rows;
        document.getElementById("solCols").value = cols;
        solver.loadPuzzle(rows, cols);
    });

    document.getElementById("solDisplayFromString").addEventListener("click", function() {
        const puzzleString = document.getElementById("solverString").value;
        solver.loadPuzzleFromCode(puzzleString);
    });

    document.getElementById("solvePuzzle").addEventListener("click", function() {
        //console.log("Solving puzzle with code:", solver.getPuzzleCode());

        const puzzleString = solver.getPuzzleCode();
        try {
            // Allocate memory for input
            const inputSize = Module.lengthBytesUTF8(puzzleString) + 1;
            const inputPtr = Module._malloc(inputSize);
            Module.stringToUTF8(puzzleString, inputPtr, inputSize);
            
            // Call C++ function
            const resultPtr = Module._sol_puzzle(inputPtr);
            
            // Get result and clean up
            const result = Module.UTF8ToString(resultPtr);
            //console.log("Solver result:", result);
            solver.setStateFromString(result);
            
            // Free memory
            Module._free_string(resultPtr);
            Module._free(inputPtr);
        } catch (error) {
            console.error("Error:", error);
        }
    });
}

// Main initialization
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize UI first
    initializePuzzles();
    setupEventListeners();
    
    //Seetup default puzzle
    const size = parseInt(document.getElementById("puzzleSize").value);
    const difficulty = document.getElementById("puzzleDifficulty").value;
    puzzle.randomPuzzle(size, difficulty);

    // Disable WASM-dependent buttons initially
    document.getElementById("generatePuzzle").disabled = true;
    document.getElementById("solvePuzzle").disabled = true;

    // Then load WASM
    try {
        await initializeWasm();
    } catch (error) {
        // Errors already handled in initializeWasm()
    }
});

function bound(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
}
