import { NerdiInstruction, NerdiEngine } from './modules/engine.js'

const module = (function() {
    const engine = new NerdiEngine()
    const runCodeButton = $('#button-run-code')
    const runCodeStepButton = $('#button-run-code-step')
    const codeStepButton = $('#button-code-step')
    var state = 'idle'

    function init(){
        runCodeButton.click(handleCodeCompileAndRun)
        runCodeStepButton.click(handleCodeCompileAndRunStep)

        drawUI()
    }

    function drawUI(){
        if(state == 'idle'){
            runCodeButton.prop('disabled', false)
            runCodeStepButton.prop('disabled', false)
            codeStepButton.prop('disabled', true)
        }if(state == 'stepping'){
            runCodeButton.prop('disabled', true)
            runCodeStepButton.prop('disabled', true)
            codeStepButton.prop('disabled', false)
        }if(state == 'running'){
            runCodeButton.prop('disabled', true)
            runCodeStepButton.prop('disabled', true)
            codeStepButton.prop('disabled', true)
        }
    }

    function getCompiledCodeFromTextArea(){
        const codeText = $('#code-text').val()
        return compileCode(codeText)
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
        engine.executeNextInstruction()
        drawUI()
    }

    function compileCode(codeText){
        const lines = codeText.split('\n')
        const instructions = []
        var lineNumber = 1
        for(var line of lines){
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
                    label
                )
            )
            lineNumber++
        }

        return instructions
    }

    return {
        init: init
    }
})()

$(document).ready(module.init)