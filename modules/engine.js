
export const name = 'engine'

export class NerdiEngine{
    instructions = undefined
    isHalted = true

    snapshots = []

    memory = new Array(32)

    registers = undefined

    constructor(){
        this.clearMemory()
        this.resetRegisters()
    }

    resetRegisters = function(){
        this.registers = {
            programCounter: 0,
            accumulator: 0,
            carry: false,
            zero: false
        }
        this.snapshots = []
    }

    resetVariables = function(){
        if(this.snapshots.length > 0){
            const firstSnapshot = this.snapshots[0]
            this.memory = firstSnapshot.memory
        }
        this.resetRegisters()
    }

    resetMemory = function(){
        this.memory = Array(32)
        this.memory.fill(0x00)

        this.resetRegisters()
    }

    loadProgram = function(program) {
        this.registers.programCounter = 0
        this.isHalted = false
        this.instructions = program.instructions
        this.memory = program.initialMemory
        this.dataCells = program.dataCells
    }

    executeHaltInstruction = function(){
        this.isHalted = true
    }

    clearMemory = function(){
        this.memory.fill(0)
    }

    getVariableFromMemory(relativeAddress){
        return this.memory[relativeAddress]
    }

    getCurrentInstruction = function(){
        if(this.instructions == undefined){
            return undefined
        }
        return this.instructions[this.registers.programCounter]
    }

    executeAddInstruction = function(argumentAddress){
        const argumentValue = this.getVariableFromMemory(argumentAddress)
        const result = argumentValue + this.registers.accumulator

        this.registers.carry = result > 255
        this.registers.accumulator = result % 256
        this.registers.zero = (this.registers.accumulator == 0)
    }

    executeSubInstruction = function(argumentAddress){
        const argumentValue = this.getVariableFromMemory(argumentAddress)
        var result = argumentValue - this.registers.accumulator

        this.registers.carry = result < 0
        while(result < 0){
            result += 256
        }
        this.registers.accumulator = result
        this.registers.zero = (this.registers.accumulator == 0)
    }

    executeJmpInstruction = function(argumentAddress){
        this.registers.programCounter = argumentAddress
    }

    executeJmpCarryInstruction = function(argumentAddress){
        if(!this.registers.carry){
            return
        }
        this.executeJmpInstruction(argumentAddress)
    }

    executeJmpZeroInstruction = function(argumentAddress){
        if(!this.registers.zero){
            return
        }
        this.executeJmpInstruction(argumentAddress)
    }

    executeLoadInstruction = function(argumentAddress){
        this.registers.accumulator = this.getVariableFromMemory(argumentAddress);
    }

    executeStoreInstruction = function(argumentAddress){
        this.memory[argumentAddress] = this.registers.accumulator
    }

    restorePreviousSnapshot(){
        const newSnapshot = this.snapshots.pop()
        this.registers = newSnapshot.registers
        this.memory = newSnapshot.memory
    }

    executeInstruction = function(instructionByte){
        const instructionCallbacks = {
            halt: this.executeHaltInstruction,
            load: this.executeLoadInstruction,
            stor: this.executeStoreInstruction,
            add: this.executeAddInstruction,
            sub: this.executeSubInstruction,
            jmp: this.executeJmpInstruction,
            jmpc: this.executeJmpCarryInstruction,
            jmpz: this.executeJmpZeroInstruction
        }

        const registersCopy = JSON.parse(JSON.stringify(this.registers))
        registersCopy.programCounter--
        this.snapshots.push(
            new NerdiEngineSnapshot(
                registersCopy, 
                JSON.parse(JSON.stringify(this.memory))
            )
        )

        const maxSnapshotsLength = 32
        const lengthOverflow = this.snapshots.length - maxSnapshotsLength
        this.snapshots.splice(0, lengthOverflow)

        const opCode = instructionByte >> 5
        const argument = instructionByte & 0b00011111

        const callback = instructionCallbacks[Object.keys(instructionCallbacks)[opCode]]
        if(callback == undefined){
            throw `Instruction ${instruction.instruction} not found`
        }
        this.isHalted = false
        callback.call(this, argument)
    }

    executeNextInstruction = function() {
        const nextInstructionByte = this.memory[this.registers.programCounter]
        this.registers.programCounter++

        this.executeInstruction(nextInstructionByte)
    }

    disassembleMemory(){
        this.instructions = []
        this.dataCells = []
        this.codeCells = []

        const self = this

        function getDataCellByAddress(address){
            return self.dataCells.find(cell => cell.address == address)
        }

        function getCodeCellByAddress(address){
            return self.codeCells.find(cell => cell.address == address)
        }

        function getCellPoolForInstruction(instruction){
            if(instruction == 'halt'){
                return undefined
            }
            if(instruction.startsWith('jmp')){
                return self.codeCells
            }
            return self.dataCells
        }

        for(const byte of this.memory){
            const opCode = byte >> 5
            var argumentAddress = byte & 0b00011111

            const instructionOpCodes = [
                'halt',
                'load',
                'stor',
                'add',
                'sub',
                'jmp',
                'jmpc',
                'jmpz'
            ]

            const instruction = instructionOpCodes[opCode]
            if(instruction == undefined){
                break
            }

            const cellPool = getCellPoolForInstruction(instruction)

            if(cellPool != undefined){
                const existingCell = cellPool.find(cell => cell.address == argumentAddress)

                if(existingCell == undefined){
                    cellPool.push(new NerdiDataCell(
                        argumentAddress,
                        `ADDRESS_${argumentAddress.toString(16)}`,
                        this.memory[argumentAddress]
                    ))
                }
            }

            if(instruction == 'halt'){
                argumentAddress = undefined
            }

            const instructionObject = new NerdiInstruction(
                instruction,
                argumentAddress,
                undefined,
                this.instructions.length,
                this.instructions.length
            )
            
            instructionObject.instructionByte = byte

            this.instructions.push(instructionObject)
        }

        // cut out instruction starting from duplicate halt
        for(var i = 0; i < (this.instructions.length - 1); i++){
            if(this.instructions[i].instruction == 'halt' && this.instructions[i + 1].instruction == 'halt'){
                this.instructions.splice(i + 1)
                break
            }
        }

        // cut out instructions that target an address out of bounds
        for(var i = 0; i < this.instructions.length; i++){
            const instruction = this.instructions[i]
            const jumpTargetIsOutsideOfBounds = function(){
                if(instruction.instruction == 'halt'){
                    return false
                }
                const targetAddress = instruction.argument
                if(instruction.instruction.startsWith('jmp')){
                    if(targetAddress >= self.instructions.length){
                        return true
                    }
                    return false
                }

                if(targetAddress < self.instructions.length){
                    return true
                }

                const dataAddresses = self.dataCells.map(cell => cell.address)
                const memoryLimit = Math.max(...dataAddresses)
                if(targetAddress > memoryLimit){
                    return true
                }

                return false
            }()

            if(jumpTargetIsOutsideOfBounds){
                self.instructions.splice(i + 1)
                break
            }
        }

        for(const instruction of this.instructions){
            const cellPool = getCellPoolForInstruction(instruction.instruction)
            if(cellPool == undefined){
                continue
            }
            const argumentCell = cellPool.find(cell => cell.address == instruction.argument)
            if(argumentCell != undefined){
                instruction.argument = argumentCell.label
            }
        }

        for(const instruction of this.instructions){
            const instructionCell = getCodeCellByAddress(instruction.address)
            if(instructionCell != undefined){
                instruction.label = instructionCell.label
            }
        }
    }

    compileCode = function(codeText){
        function isLabelInstruction(label){
            return ['load', 'stor', 'add', 'sub', 'halt', 'jmp', 'jmpc', 'jmpz'].includes(label.toLowerCase())
        }

        var memoryOffset = 0
        const dataCells = []
        const codeCells = []

        const lines = codeText.split('\n')
        const instructions = []
        for(var lineNumber = 0; lineNumber < lines.length; lineNumber++){
            var line = lines[lineNumber]
            line = line
                .replace(/;.*$/, '') // remove comments
                .replaceAll(/\t/g, ' ') // replace tabs
                .replaceAll(/ {2,}/g, ' ') // replace multiple spaces
                .trim() // remove preceding and succeding spaces

            if(line == ''){
                // skip empty lines
                continue
            }

            const parts = line.split(' ')
            if(parts.length > 3){
                throw `too many elements in line ${lineNumber}`
            }

            var label = undefined
            var instruction = undefined
            var argument = undefined

            if(parts.length == 1){
                const value = parts[0]
                if(isLabelInstruction(value)){
                    instruction = parts[0]
                }else{
                    label = parts[0]
                }
            }else if(parts.length == 3){
                label = parts[0]
                instruction = parts[1]
                argument = parts[2]
            }else if(parts.length == 2){
                const lastPart = parts[1]
                const lastPartIsInstruction = isLabelInstruction(lastPart)

                if(lastPartIsInstruction){
                    label = parts[0]
                    instruction = parts[1]
                }else{
                    instruction = parts[0]
                    argument = parts[1]
                }
            }

            function parsePossibleNumber(value){
                const isArgumentNumber = (value.match(/^[0-8]+$/) != null)
                if(isArgumentNumber){
                    return parseInt(value, 8)
                }
                const isArgumentHexNumber = (value.match(/^0x[0-9a-f]+$/i) != null)
                if(isArgumentHexNumber){
                    return parseInt(value.substring(2), 16)
                }

                return value
            }

            if(argument != undefined){
                argument = parsePossibleNumber(argument)
            }

            if(instruction != undefined){
                instruction = instruction.toLowerCase()
            }

            if(instruction == 'org'){
                memoryOffset = argument
                continue
            }

            if(label != undefined){
                if(instruction == 'db'){
                    dataCells.push(new NerdiDataCell(dataCells.length, label, argument))
                    continue
                }else{
                    codeCells.push(new NerdiDataCell(instructions.length, label, argument))
                }
            }

            if(instruction != undefined){
                instructions.push(
                    new NerdiInstruction(
                        instruction,
                        argument,
                        label,
                        instructions.length,
                        lineNumber
                    )
                )
            }
        }

        const instructionOpCodes = [
            'halt',
            'load',
            'stor',
            'add',
            'sub',
            'jmp',
            'jmpc',
            'jmpz'
        ]

        var initialMemory = new Array(32)
        initialMemory.fill(0x00)

        function getCodeCellByLabel(label){
            return codeCells.find(codeCell => codeCell.label == label)
        }

        function getDataCellByLabel(label){
            return dataCells.find(dataCell => dataCell.label == label)
        }

        for(const dataCell of dataCells){
            dataCell.address += memoryOffset
        }

        for(const instruction of instructions){
            const indexOfInstruction = instructionOpCodes.indexOf(instruction.instruction)
            if(indexOfInstruction == -1){
                throw `Instruction ${instruction.instruction} unknown in line ${instruction.lineNumber + 1}`
            }
            instruction.instructionByte = indexOfInstruction << 5
            if(instruction.argument != undefined){
                var referedCell = function(){
                    if(instruction.instruction.startsWith('jmp')){
                        return getCodeCellByLabel(instruction.argument)
                    }else{
                        return getDataCellByLabel(instruction.argument)
                    }
                }()
                
                if(referedCell == undefined){
                    throw `Label ${instruction.argument} not found in line ${instruction.lineNumber}`
                }
                instruction.instructionByte |= referedCell.address
            }
        }

        for(const instruction of instructions){
            initialMemory[instruction.address] = instruction.instructionByte
        }

        for(const dataCell of dataCells){
            initialMemory[dataCell.address] = dataCell.value
        }

        return new NerdiProgram(initialMemory, instructions, codeCells, dataCells)
    }
}


export class NerdiInstruction{
    instruction = undefined
    argument = undefined
    label = undefined
    lineNumber = undefined
    address = undefined
    instructionByte = undefined

    constructor(instruction, argument, label, address, lineNumber){
        this.instruction = instruction
        this.argument = argument
        this.label = label
        this.address = address
        this.lineNumber = lineNumber
    }

    getTargetAddress = function(){
        if(!['load', 'stor', 'jmp', 'jmpc', 'jmpz'].includes(this.instruction)){
            return undefined
        }
        return this.instructionByte & 0b00011111
    }
}

export class NerdiProgram{
    constructor(initialMemory, instructions, codeCells, dataCells){
        this.instructions = instructions
        this.initialMemory = initialMemory
        this.codeCells = codeCells,
        this.dataCells = dataCells
    }
}

class NerdiEngineSnapshot{
    registers = undefined
    memory = undefined

    constructor(registers, memory){
        this.registers = registers
        this.memory = memory
    }
}

class NerdiDataCell{
    constructor(address, label, value){
        this.address = address
        this.label = label
        this.value = value
    }
}