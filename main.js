import { NerdiInstruction, NerdiEngine, NerdiProgram } from './modules/engine.js'

const module = (function() {
    const engine = new NerdiEngine()
    const runCodeButton = $('#button-run-code')
    const runCodeStepButton = $('#button-run-code-step')
    const codeStepBackwardButton = $('#button-code-step-backward')
    const codeStepForwardButton = $('#button-code-step-forward')
    const codePauseButton = $('#button-code-pause')
    const codeStopButton = $('#button-code-stop')
    const codeStepPeriodSelectButton = $('#select-label-step-period')
    const divRegisters = $('#memory-registers')
    const divVariables = $('#memory-variables')
    const textCodeEdit = $('#code-text-edit')
    const textCodeReadOnly = $('#code-text-readonly')
    const divMemoryMap = $('#memory-map')
    var state = 'idle'

    var autoRunTimeout = undefined

    var stepPeriod = 1000

    function init(){
        runCodeButton.click(handleCodeCompileAndRun)
        runCodeStepButton.click(handleCodeCompileAndRunStep)
        codeStepBackwardButton.click(handleCodeStepBackward)
        codeStepForwardButton.click(handleCodeStepForward)
        codePauseButton.click(handleCodePause)
        codeStopButton.click(handleCodeStop)

        $('.select-step-period').click(handleStepPeriodSelect)

        const savedCode = localStorage.getItem('code_last')
        if(savedCode != undefined){
            textCodeEdit.val(savedCode)
        }

        drawUI()
    }

    function handleStepPeriodSelect(event){
        const period = Number(event.currentTarget.dataset['period'])
        console.log(period)
        stepPeriod = period
        codeStepPeriodSelectButton.text(`${stepPeriod / 1000}s`)
    }

    function handleCodePause(){
        stopAutoCodeRun()
        state = 'stepping'

        drawUI()
    }

    function drawUI(){
        const stateButtonsMap = {
            'idle': [
                runCodeButton,
                runCodeStepButton,
                codeStepPeriodSelectButton
            ],
            'running': [
                codePauseButton,
                codeStopButton
            ],
            'stepping': [
                runCodeButton,
                codeStepForwardButton,
                codeStopButton,
                codeStepPeriodSelectButton
            ]
        }

        const activeButtons  = stateButtonsMap[state]

        const buttons = $('.button-flow-control')
        buttons.prop('disabled', true)

        for(const activeButton of activeButtons){
            activeButton.prop('disabled', false)
        }

        if(state == 'stepping' && engine.snapshots.length > 0){
            codeStepBackwardButton.prop('disabled', false)
        }

        if(state == 'idle'){
            textCodeEdit.show()
            textCodeReadOnly.hide()
        }else if(['running', 'stepping'].includes(state)){
            textCodeEdit.hide()
            textCodeReadOnly.show()
        }

        if(['running', 'stepping'].includes(state)){
            displayCode()
        }

        displayRegisters()
        displayMemory()
        displayMemoryMap()
    }

    function displayError(text){
        $('#text-error').text(text)
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

    function displayMemoryMap(){
        if(engine.instructions == undefined){
            return
        }
        if(engine.values == undefined){
            return
        }
        var codeBytes = engine.instructions.map(instruction => instruction.instructionByte)
        const nullCodeByteCount = engine.memoryOffset - codeBytes.length
        codeBytes = codeBytes.concat(new Array(nullCodeByteCount).fill(0))

        const currentInstruction = engine.getCurrentInstruction()
        var targetAddress = -1
        if(currentInstruction != undefined && currentInstruction.argument != undefined){
            targetAddress = engine.labels[currentInstruction.argument]
            if(!currentInstruction.instruction.startsWith('jmp')){
                targetAddress += engine.memoryOffset
            }
        }

        const memoryBytes = Object.values(engine.values)

        const totalBytes = codeBytes.concat(memoryBytes)

        const bytesPerRow = 8

        const rowCount = Math.ceil(totalBytes.length / bytesPerRow)

        const tableNode = $('<table>')

        for(var currentRow = 0; currentRow < rowCount; currentRow++){
            const rowNode = $('<tr>')

            const bytesOffset = currentRow * bytesPerRow
            const bytesLeft = totalBytes.length - bytesOffset
            const bytesCount = Math.min(bytesPerRow, bytesLeft)

            const addressRow = $('<td>')
            var addressHex = Number(currentRow * bytesPerRow).toString(16)
            if(currentRow < 2){
                addressHex = `0${addressHex}`
            }

            addressRow.text(`0x${addressHex}`)

            addressRow.addClass('memory-cell')
            addressRow.addClass('memory-cell-address')
            rowNode.append(addressRow)

            for(var currentByte = 0; currentByte < bytesCount; currentByte++){
                const offsetIndex = currentByte + bytesOffset
                const byte = totalBytes[offsetIndex]
                const columnNode = $('<td>')
                columnNode.addClass('memory-cell')
                var text = byte.toString(16)
                if(byte < 16){
                    text = `0${text}`
                }
                columnNode.text(text)
                if(currentInstruction != undefined && currentInstruction.address == offsetIndex){
                    columnNode.addClass('memory-current-instruction')
                }
                if(targetAddress == offsetIndex){
                    columnNode.addClass('memory-current-argument')
                }
                rowNode.append(columnNode)
            }

            tableNode.append(rowNode)
        }

        divMemoryMap.empty()
        divMemoryMap.append(tableNode)

        console.log()
    }

    function displayRegisters(){
        divRegisters.empty()

        const mapText = {
            programCounter: 'PC',
            accumulator: 'Akkumulator',
        }

        for(const key in mapText){
            const div = $('<div>')
            div.addClass('d-block')

            const label = $('<label>')
            label.addClass('register-label')
            label.text(mapText[key])
            div.append(label)

            const edit = $('<input>')
            edit.addClass('register-number')
            edit.prop('type', 'number')

            if(state != 'stepping'){
                edit.prop('disabled', true)
            }

            edit.val(engine.registers[key])

            edit.change(function(event){
                engine.registers[key] = event.currentTarget.value
            })
            

            div.append(edit)

            divRegisters.append(div)
        }

        const mapBoolean = {
            carry: 'Carry',
            zero: 'Zero',
        }

        for(const key in mapBoolean){
            const div = $('<div>')
            div.addClass('d-block')

            const label = $('<label>')
            label.addClass('register-label')
            label.text(mapBoolean[key])
            div.append(label)

            const checkbox = $('<input>')
            checkbox.prop('type', 'checkbox')

            if(state != 'stepping'){
                checkbox.prop('disabled', true)
            }
            if(engine.registers[key]){
                checkbox.prop('checked', true)
            }

            const currentInstruction = engine.getCurrentInstruction()

            function highlightCheckboxIfImportant(){
                if(currentInstruction != undefined){
                    if(key == 'zero' && currentInstruction.instruction == 'jmpz'){
                        label.removeClass(`memory-current-argument-${!engine.registers.zero}`)
                        label.addClass(`memory-current-argument-${engine.registers.zero}`)
                    }
                    if(key == 'carry' && currentInstruction.instruction == 'jmpc'){
                        label.removeClass(`memory-current-argument-${!engine.registers.carry}`)
                        label.addClass(`memory-current-argument-${engine.registers.carry}`)
                    }
                }
            }

            checkbox.change(function(event){
                engine.registers[key] = event.currentTarget.checked
                highlightCheckboxIfImportant()
            })

            highlightCheckboxIfImportant()

            div.append(checkbox)

            divRegisters.append(div)
        }
    }

    function displayMemory(){
        const memory = engine.values

        divVariables.empty()

        const currentArgument = function(){
            const currentInstruction = engine.getCurrentInstruction()
            if(currentInstruction == undefined){
                return undefined
            }
            return currentInstruction.argument
        }()

        for(const key in memory){
            const spanNode = $('<span>')
            spanNode.text(`${key}: ${memory[key]}`)
            spanNode.addClass('d-block')
            if(currentArgument != undefined && key == currentArgument){
                spanNode.addClass('memory-current-argument')
            }
            divVariables.append(spanNode) 
        }
    }

    function getCompiledCodeFromTextArea(){
        const codeText = textCodeEdit.val()
        return compileCode(codeText)
    }

    function handleCodeStepBackward(){
        if(engine.snapshots.length == 0){
            console.error('no snapshots to go backward')
            return
        }

        engine.restorePreviousSnapshot()
        drawUI()
    }

    function handleCodeStepForward(){
        try{
            displayError('')
            engine.executeNextInstruction()
            if(engine.isHalted){
                state = 'idle'
            }
    
            drawUI()
        }catch(e){
            console.error(e)
            displayError(e)
            state = 'idle'
            drawUI()
        }
    }

    function handleCodeStop(){
        stopAutoCodeRun()
        state = 'idle'

        drawUI()
    }

    function stopAutoCodeRun(){
        if(autoRunTimeout == undefined){
            return
        }
        clearTimeout(autoRunTimeout)
        autoRunTimeout = undefined
    }

    function saveCodeToLocalStorage(){
        const codeText = textCodeEdit.val()
        localStorage.setItem('code_last', codeText)
    }

    function autoRunCodeStep(){
        try{
            engine.executeNextInstruction()
            if(engine.isHalted){
                state = 'idle'
            }else{
                autoRunTimeout = setTimeout(autoRunCodeStep, stepPeriod)
            }
            drawUI()
        }catch(e){
            console.error(e)
            displayError(e)
            state = 'idle'
            drawUI()
        }
    }

    function handleCodeCompileAndRun(){
        try{
            displayError('')
            if(state == 'stepping'){
                state = 'running'
                autoRunCodeStep()
                return
            }
            saveCodeToLocalStorage()
            state = 'running'
            const program = getCompiledCodeFromTextArea()
            engine.loadProgram(program)

            autoRunCodeStep()
        }catch(e){
            console.error(e)
            displayError(e)
            state = 'idle'
            drawUI()
        }
    }

    function handleCodeCompileAndRunStep(){
        try{
            displayError('')
            saveCodeToLocalStorage()
            state = 'stepping'
            const program = getCompiledCodeFromTextArea()
            engine.loadProgram(program)
            // engine.executeNextInstruction()
    
            if(engine.isHalted){
                state = 'idle'
            }
            drawUI()
        }catch(e){
            console.error(e)
            displayError(e)
            state = 'idle'
            drawUI()
        }
    }

    function compileCode(codeText){
        function isLabelInstruction(label){
            return ['load', 'stor', 'add', 'sub', 'halt', 'jmp', 'jmpc', 'jmpz'].includes(label.toLowerCase())
        }

        const labels = {}

        var currentMemoryAddress = 0
        var memoryOffset = 0
        const memoryInitial = {}

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
                    labels[label] = currentMemoryAddress
                    currentMemoryAddress++
                    memoryInitial[label] = argument
                    continue
                }else{
                    labels[label] = instructions.length
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
        for(instruction of instructions){
            if(instruction.instruction == 'db'){
                continue
            }

            const indexOfInstruction = instructionOpCodes.indexOf(instruction.instruction)
            if(indexOfInstruction == -1){
                throw `Instruction ${instruction.instruction} unknown in line ${instruction.lineNumber + 1}`
            }
            instruction.instructionByte = indexOfInstruction << 5
            if(instruction.argument != undefined){
                if(instruction.instruction.startsWith('jmp')){
                    // pointing to code part
                    const labelAddress = labels[instruction.argument]
                    instruction.instructionByte |= labelAddress
                }else if(instruction.argument != undefined){
                    // pointing to memory
                    const memoryAddress = labels[instruction.argument]
                    if(memoryAddress != undefined){
                        instruction.instructionByte |= (memoryAddress + memoryOffset)
                    }
                }
            }
        }

        return new NerdiProgram(instructions, memoryOffset, memoryInitial, labels)
    }

    return {
        init: init
    }
})()

$(document).ready(module.init)