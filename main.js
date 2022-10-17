import { NerdiInstruction, NerdiEngine, NerdiProgram } from './modules/engine.js'

const module = (function() {
    const engine = new NerdiEngine()
    const compileCodeButton = $('#button-code-compile')
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
        compileCodeButton.click(handleCodeCompile)
        runCodeButton.click(handleCodeRun)
        runCodeStepButton.click(handleCodeCompileAndRunStep)
        codeStepBackwardButton.click(handleCodeStepBackward)
        codeStepForwardButton.click(handleCodeStepForward)
        codePauseButton.click(handleCodePause)
        codeStopButton.click(handleCodeStop)

        $('.select-step-period').click(handleStepPeriodSelect)

        $('.textarea-auto-scale').each(function(){
            this.setAttribute('style', `height: ${this.scrollHeight}px;`)
        }).on('input', function(){
            this.style.height = 0
            this.style.height = `${this.scrollHeight}px`
        })

        const savedCode = localStorage.getItem('code_last')
        if(savedCode != undefined){
            textCodeEdit.val(savedCode)
            textCodeEdit.trigger('input')
        }

        drawUI()
    }

    function handleStepPeriodSelect(event){
        const period = Number(event.currentTarget.dataset['period'])
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
                compileCodeButton,
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
        displayVariables()
        displayMemoryMap()
    }

    function displayError(text){
        $('#text-error').text(text)
    }

    function displayCode(){
        const self = this
        const lines = function(){
            if(false){
                const codeText = textCodeEdit.val()
                return codeText.split('\n')
            }

            return engine.instructions.map(function(instruction){
                var line = ''
                if(instruction.label != undefined){
                    line += `${instruction.label} `
                }
                line += `${instruction.instruction} `
                if(instruction.argument != undefined){
                    line += instruction.argument
                }
                return line
            })
        }()

        var codeTextReadOnly = ''
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
        var targetAddress = -1
        const currentInstruction = engine.getCurrentInstruction()
        if(currentInstruction != undefined){
            targetAddress = currentInstruction.getTargetAddress()
        }
        const totalBytes = engine.memory

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
                if(engine.registers.programCounter == offsetIndex){
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

    function displayVariables(){
        const dataCells = engine.dataCells

        divVariables.empty()

        const currentArgument = function(){
            const currentInstruction = engine.getCurrentInstruction()
            if(currentInstruction == undefined){
                return undefined
            }
            return currentInstruction.argument
        }()

        if(dataCells == undefined){
            return
        }

        for(const dataCell of dataCells){
            const spanNode = $('<span>')
            const value = engine.memory[dataCell.address]
            spanNode.text(`${dataCell.label}: 0x${value.toString(16)}`)
            spanNode.addClass('d-block')
            if(currentArgument != undefined && dataCell.label == currentArgument){
                spanNode.addClass('memory-current-argument')
            }
            divVariables.append(spanNode) 
        }
    }

    function getCompiledCodeFromTextArea(){
        const codeText = textCodeEdit.val()
        return engine.compileCode(codeText)
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

    function handleCodeCompile(){
        try{
            displayError('')
            saveCodeToLocalStorage()
            const program = getCompiledCodeFromTextArea()
            engine.loadProgram(program)

            engine.disassembleMemory()

            drawUI()
        }catch(e){
            console.error(e)
            displayError(e)
            state = 'idle'
            drawUI()
        }
    }

    function handleCodeRun(){
        try{
            displayError('')
            state = 'running'
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
            state = 'stepping'
            drawUI()
        }catch(e){
            console.error(e)
            displayError(e)
            state = 'idle'
            drawUI()
        }
    }

    return {
        init: init
    }
})()

$(document).ready(module.init)