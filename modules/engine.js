
export const name = 'engine'

export class NerdiEngine{
    values = {}
    instructions = []
    isHalted = false

    registers = {
        programCounter: 0,
        accumulator: undefined,
        carry: false,
        zero: false
    }

    loadInstructions = function(instructions) {
        this.registers.programCounter = 0
        this.isHalted = false
        this.values = {}
        for(const instruction of instructions){
            if(instruction.instruction == 'db'){
                this.values[instruction.label] = instruction.argument
            }
        }

        // remove all 'db' calls
        this.instructions = instructions.filter(instruction => instruction.instruction != 'db')
    }

    executeHaltInstruction = function(instruction){
        this.isHalted = true
    }

    executeAddInstruction = function(instruction){
        if(this.registers.accumulator == null){
            throw 'Accumulator not loaded. Use LOAD instruction';
        }

        const argumentValue = this.values[instruction.argument]
        const result = this.registers.accumulator + argumentValue

        this.registers.carry = result > 255
        this.registers.accumulator = result % 256
        this.registers.zero = (this.registers.accumulator == 0)
    }

    executeSubInstruction = function(instruction){
        if(this.registers.accumulator == null){
            throw 'Accumulator not loaded. Use LOAD instruction';
        }

        const argumentValue = this.values[instruction.argument]
        const result = this.registers.accumulator - argumentValue

        this.registers.carry = result < 0
        while(result < 0){
            result += 256
        }
        this.registers.accumulator = result
        this.registers.zero = (this.registers.accumulator == 0)
    }

    executeJmpInstruction = function(instruction){
        const targetLabel = instruction.argument
        const targetInstructionIndex = this.instructions.findIndex(
            instruction => instruction.label == targetLabel
        )
        if(targetInstructionIndex == -1){
            throw `Jump index ${targetInstructionIndex} not found`
        }
        this.registers.programCounter = targetInstructionIndex
    }

    executeJmpCarryInstruction = function(instruction){
        if(!this.registers.carry){
            return
        }
        this.executeJmpInstruction(instruction)
    }

    executeJmpZeroInstruction = function(instruction){
        if(!this.registers.zero){
            return
        }
        this.executeJmpInstruction(instruction)
    }

    executeLoadInstruction = function(instruction){
        const value = this.values[instruction.argument];
        this.registers.accumulator = value
    }

    executeStoreInstruction = function(instruction){
        if(this.registers.accumulator == undefined){
            throw 'Accumulator not loaded. Use LOAD to load something into accumulator'
        }
        this.values[instruction.argument] = this.registers.accumulator
    }

    executeInstruction = function(instruction){
        const instructionCallbacks = {
            halt: this.executeHaltInstruction,
            load: this.executeLoadInstruction,
            store: this.executeStoreInstruction,
            add: this.executeAddInstruction,
            sub: this.executeSubInstruction,
            jmp: this.executeJmpInstruction,
            jmpc: this.executeJmpCarryInstruction,
            jmpz: this.executeJmpZeroInstruction
        }

        const callback = instructionCallbacks[instruction.instruction]
        if(callback == undefined){
            throw `Instruction ${instruction.instruction} not found`
        }
        callback.call(this, instruction)
    }

    executeNextInstruction = function() {
        const nextInstruction = this.instructions[this.registers.programCounter]
        this.registers.programCounter++

        this.executeInstruction(nextInstruction)
    }

    getCurrentInstruction = function(){
        return this.instructions[this.registers.programCounter]
    }
}


export class NerdiInstruction{
    instruction = undefined
    argument = undefined
    label = undefined
    lineNumber = undefined

    constructor(instruction, argument, label, lineNumber){
        this.instruction = instruction
        this.argument = argument
        this.label = label
        this.lineNumber = lineNumber
    }
}