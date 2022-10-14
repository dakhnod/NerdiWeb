import { NerdiInstruction, NerdiEngine } from './modules/engine.js'

const module = (function() {
    const engine = new NerdiEngine()
    const runCodeButton = $('#button-run-code')
    const runCodeStepButton = $('#button-run-code-step')
    const codeStepButton = $('#button-code-step')
    const codeStopButton = $('#button-code-stop')
    const textRegisters = $('#text-registers')
    const textMemory = $('#text-memory')
    const textCodeEdit = $('#code-text-edit')
    const textCodeReadOnly = $('#code-text-readonly')
    var state = 'idle'

    function init(){
        runCodeButton.click(handleCodeCompileAndRun)
        runCodeStepButton.click(handleCodeCompileAndRunStep)
        codeStepButton.click(handleCodeStep)
        codeStopButton.click(handleCodeStop)

        drawUI()
    }

    function drawUI(){
        if(state == 'idle'){
            runCodeButton.prop('disabled', false)
            runCodeStepButton.prop('disabled', false)
            codeStepButton.prop('disabled', true)
            codeStopButton.prop('disabled', true)

            textCodeEdit.show()
            textCodeReadOnly.hide()
        }else if(state == 'stepping'){
            runCodeButton.prop('disabled', true)
            runCodeStepButton.prop('disabled', true)
            codeStepButton.prop('disabled', false)
            codeStopButton.prop('disabled', false)

            textCodeEdit.hide()
            textCodeReadOnly.show()
            displayCode()
        }else if(state == 'running'){
            runCodeButton.prop('disabled', true)
            runCodeStepButton.prop('disabled', true)
            codeStepButton.prop('disabled', true)
            codeStopButton.prop('disabled', true)

            textCodeEdit.show()
            textCodeReadOnly.hide()
        }

        displayRegisters()
        displayMemory()
    }

    function displayCode(){
        const codeText = textCodeEdit.val()
        var codeTextReadOnly = ''
        const lines = codeText.split('\n')
        const currentInstruction = engine.getCurrentInstruction()
        for(var currentLine = 0; currentLine < lines.length; currentLine++){
            const line = lines[currentLine]
            if(currentLine == currentInstruction.lineNumber){
                codeTextReadOnly += `<mark class="code-line">${line}</mark><br>`
            }else{
                codeTextReadOnly += `${line}<br>`
            }
        }
        textCodeReadOnly.html(codeTextReadOnly)
    }

    function displayRegisters(){
        const registers = engine.registers

        const registerText = `PC: ${registers.programCounter}<br>Accumulator: ${registers.accumulator}<br>Carry: ${registers.carry}<br>Zero: ${registers.zero}`

        textRegisters.html(registerText)
    }

    function displayMemory(){
        const memory = engine.values

        var memoryText = 'Memory<br>'
        for(const key in memory){
            memoryText += `<br>${key}: ${memory[key]}`
        }

        textMemory.html(memoryText)
    }

    function getCompiledCodeFromTextArea(){
        const codeText = textCodeEdit.val()
        return compileCode(codeText)
    }

    function handleCodeStep(){
        engine.executeNextInstruction()
        if(engine.isHalted){
            state = 'idle'
        }

        drawUI()
    }

    function handleCodeStop(){
        state = 'idle'

        drawUI()
    }

    function handleCodeCompileAndRun(){
        state = 'running'
        drawUI()
        const instructions = getCompiledCodeFromTextArea()
        engine.loadInstructions(instructions)
        var instructionsCount = 0
        for(;;instructionsCount++){
            engine.executeNextInstruction()
            if(instructionsCount > 1000){
                console.log('Exceeded 1000 steps')
                break
            }
        }
        state = 'idle'
        drawUI()
    }

    function handleCodeCompileAndRunStep(){
        state = 'stepping'
        const instructions = getCompiledCodeFromTextArea()
        engine.loadInstructions(instructions)
        // engine.executeNextInstruction()

        if(engine.isHalted){
            state = 'idle'
        }
        drawUI()
    }

    function compileCode(codeText){
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
                instruction = parts[0]
            }else if(parts.length == 3){
                label = parts[0]
                instruction = parts[1]
                argument = parts[2]
            }else if(parts.length == 2){
                const lastPart = parts[1]
                const lastPartIsInstruction = ['load', 'store', 'add', 'sub', 'halt', 'jmp', 'jmpc', 'jmpz'].includes(lastPart.toLowerCase())

                if(lastPartIsInstruction){
                    label = parts[0]
                    instruction = parts[1]
                }else{
                    instruction = parts[0]
                    argument = parts[1]
                }
            }

            const isArgumentNumber = (argument != undefined) && (argument.match(/^[0-8]+$/) != null)
            if(isArgumentNumber){
                argument = parseInt(argument, 8)
            }

            if(instruction == 'end'){
                // ignore instruction END
                continue
            }

            instructions.push(
                new NerdiInstruction(
                    instruction.toLowerCase(),
                    argument,
                    label,
                    lineNumber
                )
            )
        }

        return instructions
    }

    return {
        init: init
    }
})()

$(document).ready(module.init)