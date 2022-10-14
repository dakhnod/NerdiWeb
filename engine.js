class NerdiEngine{
    values = {}
    instructions = []
    isHalted = false
    instructionCallbacks = {
        halt: this.executeHaltInstruction,
        load: this.executeLoadInstruction,
        store: this.executeStoreInstruction,
        add: this.executeAddInstruction,
        sub: this.executeSubInstruction,
        jmp: this.executeJmpInstruction,
        jmpc: this.executeJmpCarryInstruction,
        jmpz: this.executeJmpZeroInstruction
    }
    registers = {
        programCounter: 0,
        accumulator: undefined,
        carry: false,
        zero: false
    }

    loadInstructions = function(instructions) {
        this.instructions = instructions
        this.currentInstructionIndex = 0
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

        this.registers.carry = result < 255
        while(result < 0){
            result += 256
        }
        this.registers.accumulator = result
        this.registers.zero = (this.registers.accumulator == 0)
    }

    executeJmpInstruction = function(instruction){
        const targetValue = this.values[instruction.argument]
        this.registers.programCounter = targetValue
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
        const callback = this.instructionCallbacks[instruction.instruction]
        if(callback == undefined){
            throw `Instruction {instruction.instruction} not found`
        }
        callback(instruction)
    }

    executeNextInstruction = function() {
        currentInstructionIndex++
        const nextInstruction = this.instructions[currentInstructionIndex]

        this.executeInstruction(nextInstruction)
    }
}


class NerdiInstruction{
    instruction = undefined
    argument = undefined
    label = undefined

    constructor(instruction, argument, label){
        this.instruction = instruction
        this.argument = argument
        this.label = label
    }
}