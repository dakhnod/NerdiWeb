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
    const codeRegistersResetButton = $('#button-registers-reset')
    const codeVariablesResetButton = $('#button-variables-reset')
    const codeMemoryResetButton = $('#button-memory-reset')
    const divRegisters = $('#memory-registers')
    const divVariables = $('#memory-variables')
    const textCodeEdit = $('#code-text-edit')
    const textCodeReadOnly = $('#code-text-readonly')
    const divMemoryMap = $('#memory-map')
    var state = 'idle'

    var autoRunTimeout = undefined

    var stepPeriod = 1000

    var displayDisassembledCode = true

    var cellBoxes = []

    function init(){
        compileCodeButton.click(handleCodeCompile)
        runCodeButton.click(handleCodeRun)
        runCodeStepButton.click(handleCodeCompileAndRunStep)
        codeStepBackwardButton.click(handleCodeStepBackward)
        codeStepForwardButton.click(handleCodeStepForward)
        codePauseButton.click(handleCodePause)
        codeStopButton.click(handleCodeStop)
        codeRegistersResetButton.click(handleRegistersReset)
        codeVariablesResetButton.click(handleVariablesReset)
        codeMemoryResetButton.click(handleMemoryReset)

        engine.disassembleMemory()

        $('.select-step-period').click(handleStepPeriodSelect)

        $('.textarea-auto-scale').each(function(){
            this.setAttribute('style', `height: ${this.scrollHeight}px;`)
        }).on('input', function(){
            return
            this.style.height = 0
            this.style.height = `${this.scrollHeight}px`
        }).on('keydown', function(event){
            console.log(event)
            if (event.key == 'Tab') {
                event.preventDefault();
                var start = this.selectionStart;
                var end = this.selectionEnd;
            
                // set textarea value to: text before caret + tab + text after caret
                this.value = this.value.substring(0, start) +
                  "\t" + this.value.substring(end);
            
                // put caret at right position again
                this.selectionStart = this.selectionEnd = start + 1;
            }
        })

        const savedCode = localStorage.getItem('code_last')
        if(savedCode != undefined){
            textCodeEdit.val(savedCode)
            textCodeEdit.trigger('input')
        }

        $('#input-file-read').change(function(event){
            try{
                const file = this.files[0]
                const name = file.name.toLowerCase()
                if(!name.endsWith('.txt') && !name.endsWith('.nerdi')){
                    throw 'File must end with .txt or .nerdi'
                }

                const reader = new FileReader()
                reader.addEventListener('load', function(event){
                    const text = this.result
                    textCodeEdit.val(text)
                })
                reader.readAsText(file)
            }catch(e){
                displayError(e)
            }
            this.value = ''
        })

        $('#input-file-write').click(function(event){
            var element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(textCodeEdit.val()));
            element.setAttribute('download', 'nerdi.txt');
          
            element.style.display = 'none';
            document.body.appendChild(element);
          
            element.click();
          
            document.body.removeChild(element);
        })

        drawUI()
    }

    function handleMemoryReset(){
        engine.resetMemory()
        drawUI()
    }

    function handleRegistersReset(){
        engine.resetRegisters()
        drawUI()
    }

    function handleVariablesReset(){
        engine.resetVariables()
        drawUI()
    }

    function handleStepPeriodSelect(event){
        const period = Number(event.currentTarget.dataset['period'])
        stepPeriod = period
        if(period == 0){
            codeStepPeriodSelectButton.text(`instant`)
            return
        }
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
                codeStepPeriodSelectButton,
                codeMemoryResetButton
            ],
            'running': [
                codePauseButton,
                codeStopButton
            ],
            'stepping': [
                runCodeButton,
                codeStepForwardButton,
                codeStopButton,
                codeStepPeriodSelectButton,
                codeRegistersResetButton,
                codeVariablesResetButton,
                codeMemoryResetButton
            ]
        }

        const activeButtons  = stateButtonsMap[state]

        const buttons = $('.button-flow-control')
        buttons.prop('disabled', true)

        for(const activeButton of activeButtons){
            activeButton.prop('disabled', false)
        }

        if(state == 'stepping'){
            codeStepBackwardButton.prop('disabled', engine.snapshots.length == 0)
            codeVariablesResetButton.prop('disabled', engine.snapshots.length == 0)
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
            if(!displayDisassembledCode){
                const codeText = textCodeEdit.val()
                return codeText.split('\n')
            }

            return engine.instructions.map(function(instruction){
                var line = ''
                // removing in favour of addresses
                /*
                if(instruction.label != undefined){
                    const label = instruction.label
                    line = `${label}${line.substring(label.length)}`
                }
                */
                line += `${instruction.instruction.toUpperCase()} `
                const targetAddress = instruction.getTargetAddress()
                if(targetAddress != undefined){
                    line += `0x${targetAddress.toString(16)}`
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

        cellBoxes = []

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
                columnNode.click(event => {
                    columnNode.unbind('click')
                    const edit = $('<input>')
                    edit.type = 'text'
                    edit.addClass('memory-cell-edit')
                    edit.val(byte.toString(16))
                    columnNode.html(edit)
                    edit.change(event => {
                        try{
                            const value = event.currentTarget.value
                            var valueInt = Number.parseInt(value, 16)
                            if(value == ''){
                                // throw 'Value cannot be empty'
                                valueInt = 0
                            }
                            /*
                            if(valueInt > 0xff){
                                throw 'Value cannot be larget than 0xff'
                            }
                            if(valueInt < 0x00){
                                throw 'Value cannot be smaller than 0x00'
                            }
                            */
                            valueInt = Math.min(valueInt, 0xff)
                            valueInt = Math.max(valueInt, 0x00)
                            engine.memory[offsetIndex] = valueInt
                            engine.disassembleMemory()
                            displayDisassembledCode = true
                            displayError('')
                            drawUI()
                        }catch(e){
                            displayError(e)
                        }
                    }).on('keydown', function(event){
                        if(event.key != 'Tab'){
                            return
                        }
                        event.preventDefault()
                        $(this).change()
                        const nextNode = cellBoxes[offsetIndex + 1]
                        if(nextNode == undefined){
                            console.error('pressed tab in last box')
                            return
                        }
                        nextNode.click()
                    })
                    edit.focus()
                    edit.select()
                })
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
                cellBoxes.push(columnNode)
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
            // edit.prop('type', 'number')

            if(state != 'stepping'){
                edit.prop('disabled', true)
            }

            edit.val(engine.registers[key].toString(16))

            edit.change(function(event){
                engine.registers[key] = parseInt(event.currentTarget.value, 16)
                drawUI()
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
            displayDisassembledCode = false

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
            engine.resetRegisters()
            if(stepPeriod > 0){
                // handle delayed execution
                autoRunCodeStep()
                return
            }
            const instructionsLimit = 1000
            var currentInstruction = 0
            while (true){
                engine.executeNextInstruction()
                if(engine.isHalted){
                    state = 'idle'
                    break
                }
                if(currentInstruction > instructionsLimit){
                    throw 'Reached limit of 1000 instructions. Possible infinite loop detected.'
                }
                currentInstruction++
            }
            drawUI()
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
            engine.resetRegisters()
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