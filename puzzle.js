import { puzzleData } from './database.js';

export class Puzzle {

    static puzzleDatabase = puzzleData;

    static puzzleRanges = [
        [[0, 10], [10, 20], [20, 30]], // 5 x 5
        [[30, 40], [40, 50], [50, 60]], // 6 x 6
        [[60, 70], [70, 80], [80, 90]], // 7 x 7
        [[90, 100], [100, 110], [110, 120]], // 8 x 8
        [[120, 130], [130, 140], [140, 150]], // 9 x 9
        [[150, 160], [160, 170], [170, 180]], // 10 x 10
        //[[180, 190], [190, 200], [200, 210]], // 11 x 11
        //[[210, 220], [220, 230], [230, 240]], // 12 x 12
    ];
    static lastPuzzle = -1;

    constructor(canvasId) {
        // Canvas setup
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        
        // High DPI scaling
        this.dpr = window.devicePixelRatio || 1;
        this.ctx.scale(this.dpr, this.dpr);
        
        // Grid properties
        this.rows = 5;
        this.cols = 5;
        this.cellSize = 70;
        this.dotSize = 6;
        this.margin = this.cellSize / 2;
        
        this.history = [];  // Stores tuples of [index, isHorizontal, edgeBefore, edgeAfter, forbiddenBefore, forbiddenAfter]
        this.historyPointer = -1;  // Points to current position in history

        // Game state
        this.initEdgeArrays();

        // Puzzle and solution strings
        this.puzzleString = null;
        this.solutionString = null;
    }

    initEdgeArrays() {
        // Horizontal edges: (rows + 1) × cols
        this.horizontalEdges = new Uint8Array((this.rows + 1) * this.cols);
        this.forbiddenHorizontalEdges = new Uint8Array((this.rows + 1) * this.cols);
        
        // Vertical edges: rows × (cols + 1)
        this.verticalEdges = new Uint8Array(this.rows * (this.cols + 1));
        this.forbiddenVerticalEdges = new Uint8Array(this.rows * (this.cols + 1));
        
        // Clues: rows × cols (0-4 = clue, 5 = no clue)
        this.clues = new Uint8Array(this.rows * this.cols).fill(5);
    }

    updateCanvasSize() {
        this.canvas.width = this.cols * this.cellSize + this.margin * 2;
        this.canvas.height = this.rows * this.cellSize + this.margin * 2;
        this.canvas.style.width = `${this.canvas.width / this.dpr}px`;
        this.canvas.style.height = `${this.canvas.height / this.dpr}px`;
        this.drawGrid();
    }

    drawGrid() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw square dots
        for (let i = 0; i <= this.rows; i++) {
            for (let j = 0; j <= this.cols; j++) {
                const x = j * this.cellSize + this.margin - this.dotSize/2;
                const y = i * this.cellSize + this.margin - this.dotSize/2;
                this.ctx.fillStyle = "#888";
                this.ctx.fillRect(x, y, this.dotSize, this.dotSize);
            }
        }

        // Draw edges
        this.drawAllEdges();
        this.drawAllForbiddenEdges();
        this.drawAllClues();
    }

    drawAllEdges() {
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 6;
        this.ctx.lineCap = "round";
        
        // Horizontal edges
        for (let y = 0; y <= this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.horizontalEdges[y * this.cols + x]) {
                    this.drawEdge(x, y, true);
                }
            }
        }
        
        // Vertical edges
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x <= this.cols; x++) {
                if (this.verticalEdges[y * (this.cols + 1) + x]) {
                    this.drawEdge(x, y, false);
                }
            }
        }
    }

    drawEdge(x, y, horizontal) {
        this.ctx.beginPath();
        if (horizontal) {
            this.ctx.moveTo(x * this.cellSize + this.margin, y * this.cellSize + this.margin);
            this.ctx.lineTo((x + 1) * this.cellSize + this.margin, y * this.cellSize + this.margin);
        } else {
            this.ctx.moveTo(x * this.cellSize + this.margin, y * this.cellSize + this.margin);
            this.ctx.lineTo(x * this.cellSize + this.margin, (y + 1) * this.cellSize + this.margin);
        }
        this.ctx.stroke();
    }

    drawAllForbiddenEdges() {
        this.ctx.strokeStyle = "#888";
        this.ctx.lineWidth = 2;
        
        // Horizontal forbidden edges
        for (let y = 0; y <= this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.forbiddenHorizontalEdges[y * this.cols + x]) {
                    this.drawForbiddenMark(x, y, true);
                }
            }
        }
        
        // Vertical forbidden edges
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x <= this.cols; x++) {
                if (this.forbiddenVerticalEdges[y * (this.cols + 1) + x]) {
                    this.drawForbiddenMark(x, y, false);
                }
            }
        }
    }

    drawForbiddenMark(x, y, horizontal) {
        const centerX = x * this.cellSize + this.margin + (horizontal ? this.cellSize/2 : 0);
        const centerY = y * this.cellSize + this.margin + (horizontal ? 0 : this.cellSize/2);
        const length = 6;
        
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - length, centerY - length);
        this.ctx.lineTo(centerX + length, centerY + length);
        this.ctx.moveTo(centerX + length, centerY - length);
        this.ctx.lineTo(centerX - length, centerY + length);
        this.ctx.stroke();
    }

    drawAllClues() {
        this.ctx.fillStyle = "black";
        this.ctx.font = `${this.cellSize * 0.6}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const clue = this.clues[y * this.cols + x];
                if (clue < 5) {
                    const centerX = x * this.cellSize + this.margin + this.cellSize/2;
                    const centerY = y * this.cellSize + this.margin + this.cellSize/2;
                    this.ctx.fillText(clue.toString(), centerX, centerY);
                }
            }
        }
    }

    handleClick(event, isRightClick){
        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * this.dpr;
        const y = (event.clientY - rect.top) * this.dpr;

        // row or column index
        const j = Math.floor((x - this.margin) / this.cellSize);
        const i = Math.floor((y - this.margin) / this.cellSize);

        // Pixel offset inside cell
        const relX = x - this.margin - (j + 1/2) * this.cellSize;
        const relY = y - this.margin - (i + 1/2) * this.cellSize;

        let index = 0;
        let horizontal = true;

        if(Math.abs(relX) >= Math.abs(relY)){
            horizontal = false;
            if(relX >= 0){
                if(!this.inBounds(i, 0, this.rows) || !this.inBounds(j + 1, 0, this.cols + 1)) return;
                index = i * (this.cols + 1) + j + 1;
            }else{
                if(!this.inBounds(i, 0, this.rows) || !this.inBounds(j, 0, this.cols + 1)) return;
                index = i * (this.cols + 1) + j;
            }
        }else{
            if(relY >= 0){
                if(!this.inBounds(i + 1, 0, this.rows + 1) || !this.inBounds(j, 0, this.cols)) return;
                index = (i + 1) * this.cols + j;
            }else{
                if(!this.inBounds(i, 0, this.rows + 1) || !this.inBounds(j, 0, this.cols)) return;
                index = i * this.cols + j;
            }
        }

        

        if(isRightClick){
            if(horizontal){
                this.addHistoryEntry(
                    index, horizontal, 
                    this.horizontalEdges[index], 0, 
                    this.forbiddenHorizontalEdges[index], 1 - this.forbiddenHorizontalEdges[index]
                );
                this.forbiddenHorizontalEdges[index] = 1 - this.forbiddenHorizontalEdges[index];
                this.horizontalEdges[index] = 0;
            }else{
                this.addHistoryEntry(
                    index, horizontal, 
                    this.verticalEdges[index], 0, 
                    this.forbiddenVerticalEdges[index], 1 - this.forbiddenVerticalEdges[index]
                );
                this.forbiddenVerticalEdges[index] = 1 - this.forbiddenVerticalEdges[index];
                this.verticalEdges[index] = 0;
            }
        }else{
            if(horizontal){
                this.addHistoryEntry(
                    index, horizontal, 
                    this.horizontalEdges[index], 1 - this.horizontalEdges[index], 
                    this.forbiddenHorizontalEdges[index], 0
                );
                this.horizontalEdges[index] = 1 - this.horizontalEdges[index];
                this.forbiddenHorizontalEdges[index] = 0;
            }else{
                this.addHistoryEntry(
                    index, horizontal, 
                    this.verticalEdges[index], 1 - this.verticalEdges[index], 
                    this.forbiddenVerticalEdges[index], 0
                );
                this.verticalEdges[index] = 1 - this.verticalEdges[index];
                this.forbiddenVerticalEdges[index] = 0;
            }
        }

        this.drawGrid();
    }

    handleClick2(event, isRightClick) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * this.dpr;
        const y = (event.clientY - rect.top) * this.dpr;

        // row or column index
        const j = Math.floor((x - this.margin) / this.cellSize);
        const i = Math.floor((y - this.margin) / this.cellSize);

        if(this.inBounds(i, 0, this.rows) && this.inBounds(j, 0, this.cols)){
            if(isRightClick){
                this.clues[i * this.cols + j] = (this.clues[i * this.cols + j] + 6 - 1) % 6;
            }else{
                this.clues[i * this.cols + j] = (this.clues[i * this.cols + j] + 1) % 6;
            }
            //console.log(this.clues[i * this.cols + j]);
            this.drawGrid();
        }
    }


    // Returns state string to compare with solution string
    getStateString(){
        let result = '';
        for(let i = 0; i < this.rows; i++){
            for(let j = 0; j < this.cols; j++){
                // Calculate the value according to the formula
                const value = 
                    this.horizontalEdges[i * this.cols + j] +
                    8 * this.verticalEdges[i * (this.cols + 1) + j] +
                    4 * this.horizontalEdges[(i + 1) * this.cols + j] +
                    2 * this.verticalEdges[i * (this.cols + 1) + j + 1];
                // Convert to character (0-15 → 'a'-'p')
                const charCode = 'a'.charCodeAt(0) + value;
                result += String.fromCharCode(charCode);
            }
        }
        return result;
    }

    setStateFromString(stateString) {
        // Check if the state string matches the puzzle dimensions
        if (stateString.length !== this.rows * this.cols) {
            console.error("State string length doesn't match puzzle dimensions");
            return false;
        }
    
        // Clear all edges first
        this.horizontalEdges.fill(false);
        this.verticalEdges.fill(false);
    
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const index = i * this.cols + j;
                const char = stateString.charAt(index);
                
                // Convert character back to value (a=0, b=1, ..., p=15)
                const value = char.charCodeAt(0) - 'a'.charCodeAt(0);
                
                if (value < 0 || value > 15) {
                    console.error(`Invalid character in state string: ${char}`);
                    return false;
                }
    
                // Decode the value into edge states
                if (value & 4) this.horizontalEdges[(i + 1) * this.cols + j] = true;
                if (value & 2) this.verticalEdges[i * (this.cols + 1) + j + 1] = true;
                if (value & 1) this.horizontalEdges[i * this.cols + j] = true;
                if (value & 8) this.verticalEdges[i * (this.cols + 1) + j] = true;
            }
        }
    
        // Redraw the puzzle to reflect the new state
        this.drawGrid();
        return true;
    }


    inBounds(i, mini, maxi) {
        return i >= mini && i < maxi;
    }

    loadPuzzle(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.initEdgeArrays();
        this.clearHistory();
        this.updateCanvasSize();
    }


    loadPuzzleFromCode(puzzleCode) {
        // Reset all edges and clues
        this.clearHistory();
        
        // Parse the puzzle code
        const parts = puzzleCode.split(':');
        if (parts.length !== 2) {
            console.error("Invalid puzzle code format");
            return false;
        }
        
        // Parse dimensions
        const dims = parts[0].split('x');
        if (dims.length !== 2) {
            console.error("Invalid dimensions format");
            return false;
        }
        
        this.cols = parseInt(dims[0]);
        this.rows = parseInt(dims[1]);
        
        // Reinitialize arrays with new dimensions
        this.initEdgeArrays();
        
        // Parse the clues
        const clueStr = parts[1];
        let index = 0;
        let i = 0;
        
        while (i < clueStr.length && index < this.clues.length) {
            const char = clueStr[i];
            
            if (char >= 'a' && char <= 'z') {
                // Skip spaces (a=1, b=2, ..., z=26)
                const skipCount = char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
                index += skipCount;
                i++;
            } else if (char >= '0' && char <= '4') {
                // Set clue (0-4)
                this.clues[index] = parseInt(char);
                index++;
                i++;
            } else if (char === '5') {
                // Explicit no-clue (though 5 is default)
                this.clues[index] = 5;
                index++;
                i++;
            } else {
                console.error(`Invalid character in puzzle code: ${char}`);
                return false;
            }
        }
        
        // Update canvas with new dimensions
        this.updateCanvasSize();
        return true;
    }

    getPuzzleCode() {
        // Start with dimensions
        let code = `${this.cols}x${this.rows}:`;
        
        let blankCount = 0;
        
        for (let i = 0; i < this.clues.length; i++) {
            const clue = this.clues[i];
            
            if (clue === 5 || clue === undefined) {
                // Count blank spaces
                blankCount++;
            } else {
                // Add blank space markers if needed
                while (blankCount > 0) {
                    // Use letters for blank spaces (a=1, b=2, etc.)
                    const skip = Math.min(blankCount, 26);
                    code += String.fromCharCode('a'.charCodeAt(0) + skip - 1);
                    blankCount -= skip;
                }
                
                // Add the clue
                code += clue.toString();
            }
        }
        
        // Add any remaining blank spaces at the end
        while (blankCount > 0) {
            const skip = Math.min(blankCount, 26);
            code += String.fromCharCode('a'.charCodeAt(0) + skip - 1);
            blankCount -= skip;
        }
        
        return code;
    }





    // ---- SETTING UP PUZZLE ----

    randomPuzzle(size, difficulty){
        const [a, b] = Puzzle.puzzleRanges[size - 5][difficulty];
        let index = Math.floor(Math.random() * (b - a)) + a;
        if(a <= this.lastPuzzle && this.lastPuzzle < b && index >= this.lastPuzzle){
            index += 1;
            if(index >= b) index = a;
        }
        this.puzzleString = Puzzle.puzzleDatabase[index][0];
        this.solutionString = Puzzle.puzzleDatabase[index][1];
        this.loadPuzzleFromCode(this.puzzleString);
        //console.log("Puzzle loaded:", index);
        this.lastPuzzle = index;
    }






    // ---- HISTORY IMPLEMENTATION ----

    clearHistory() {
        this.history = [];
        this.historyPointer = -1;
    }

    addHistoryEntry(index, isHorizontal, edgeBefore, edgeAfter, forbiddenBefore, forbiddenAfter) {
        // Remove all history after current pointer
        this.history = this.history.slice(0, this.historyPointer + 1);
        // Add new entry and move pointer
        this.history.push([index, isHorizontal, edgeBefore, edgeAfter, forbiddenBefore, forbiddenAfter]);
        this.historyPointer++;
    }

    undo() {
        if (this.historyPointer < 0) return false;
        const [index, isHorizontal, edgeBefore, edgeAfter, forbiddenBefore, forbiddenAfter] = this.history[this.historyPointer];
        // Restore previous state
        if (isHorizontal) {
            this.horizontalEdges[index] = edgeBefore;
            this.forbiddenHorizontalEdges[index] = forbiddenBefore;
        } else {
            this.verticalEdges[index] = edgeBefore;
            this.forbiddenVerticalEdges[index] = forbiddenBefore;
        }
        this.historyPointer--;
        this.drawGrid();
        return true;
    }

    redo() {
        if (this.historyPointer >= this.history.length - 1) return false;
        this.historyPointer++;
        const [index, isHorizontal, edgeBefore, edgeAfter, forbiddenBefore, forbiddenAfter] = this.history[this.historyPointer];
        // Apply the change again
        if (isHorizontal) {
            this.horizontalEdges[index] = edgeAfter;
            this.forbiddenHorizontalEdges[index] = forbiddenAfter;
        } else {
            this.verticalEdges[index] = edgeAfter;
            this.forbiddenVerticalEdges[index] = forbiddenAfter;
        }
        this.drawGrid();
        return true;
    }
}