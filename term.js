function addCustomBaud(inp){const s=document.getElementById('baudRate'),v=parseInt(inp.value);if(v&&v>0&&v<=10000000){let e=Array.from(s.options).find(o=>o.value==v);if(!e){e=document.createElement('option');e.value=v;e.text=v;s.insertBefore(e,s.options[s.length-1]);}s.value=v;}inp.style.display='none';s.style.display='block';if(!v||v<1||v>10000000)s.value='9600';}
function showTimeoutWarning(show){const el=document.getElementById('connTimeout');if(el)el.style.display=show?'inline':'none';}
function forceDisconnect(){console.log('Force disconnect');disconnect(true);}

let port = null;
let reader = null;
let writer = null;
let readLoop = null;
let isConnected = false;
let rxBytes = 0;
let txBytes = 0;
let jsonCommands = null;
let jsonRunning  = false;  // true while a JSON sequence is executing

// Timing/buffering variables
let receiveBuffer = [];
let lastReceiveTime = 0;
let bufferTimeout = null;

// Full log storage for export functionality
let fullHexLog = [];
let fullAsciiLog = [];

// Performance optimization: Batch DOM updates
let pendingLogEntries = [];
let logFlushScheduled = false;
const LOG_FLUSH_INTERVAL = 50; // ms - batch updates every 50ms
const MAX_BUFFER_SIZE = 16384; // Max bytes to buffer before forced flush

// Field counters for unique IDs
let hexFieldCount = 0;
let asciiFieldCount = 0;

// Check browser support
if (!('serial' in navigator)) {
    alert('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
}

// HEX Input handling - Auto-format and validate
function setupHexInput(input) {
    input.addEventListener('input', function(e) {
        const cursorPosition = this.selectionStart;
        const originalLength = this.value.length;

        // Remove all non-hex characters and spaces
        let value = this.value.replace(/[^0-9A-Fa-f\s]/g, '').toUpperCase();

        // Remove existing spaces
        value = value.replace(/\s/g, '');

        // Insert space every 2 characters (no length limit)
        let formatted = '';
        for (let i = 0; i < value.length; i += 2) {
            if (i > 0) formatted += ' ';
            formatted += value.substring(i, i + 2);
        }

        this.value = formatted;

        // Adjust cursor position
        const newLength = this.value.length;
        let newCursorPosition = cursorPosition;

        // If characters were added (space insertion), move cursor accordingly
        if (newLength > originalLength) {
            newCursorPosition = cursorPosition + 1;
        } else if (newLength < originalLength) {
            // Characters were removed
            newCursorPosition = cursorPosition - (originalLength - newLength);
        }

        // Ensure cursor doesn't go beyond input length
        newCursorPosition = Math.min(newCursorPosition, this.value.length);
        this.setSelectionRange(newCursorPosition, newCursorPosition);
    });

    // Prevent invalid characters on keypress
    input.addEventListener('keypress', function(e) {
        const char = String.fromCharCode(e.which);
        // Allow only hex digits (0-9, A-F, a-f) and control keys
        if (!/[0-9A-Fa-f]/.test(char) && e.which !== 8 && e.which !== 32 && e.which !== 13) {
            e.preventDefault();
        }
    });

    // Handle paste - clean up pasted content
    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');

        // Clean pasted content - keep only hex digits (no length limit)
        const cleaned = pastedText.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();

        // Format with spaces
        let formatted = '';
        for (let i = 0; i < cleaned.length; i += 2) {
            if (i > 0) formatted += ' ';
            formatted += cleaned.substring(i, i + 2);
        }

        // Insert at cursor position
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const currentValue = this.value.replace(/\s/g, '');
        const beforeCursor = currentValue.substring(0, start);
        const afterCursor = currentValue.substring(end);
        const newValue = beforeCursor + cleaned + afterCursor;

        // Reformat (no length limit)
        let finalFormatted = '';
        for (let i = 0; i < newValue.length; i += 2) {
            if (i > 0) finalFormatted += ' ';
            finalFormatted += newValue.substring(i, i + 2);
        }

        this.value = finalFormatted;
    });

    // Handle Enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const btn = input.parentElement.querySelector('button:not(.btn-add):not(.btn-remove)');
            if (btn) btn.click();
        }
    });
}

// Setup ASCII input handling
function setupAsciiInput(input) {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const btn = input.parentElement.querySelector('button:not(.btn-add):not(.btn-remove)');
            if (btn) btn.click();
        }
    });
}

// Initialize inputs on page load
document.addEventListener('DOMContentLoaded', function() {
    // Setup original inputs
    const originalHexInput = document.querySelector('.hex-input');
    const originalAsciiInput = document.querySelector('.ascii-input');

    if (originalHexInput) setupHexInput(originalHexInput);
    if (originalAsciiInput) setupAsciiInput(originalAsciiInput);

    updateExportButtonCount();
});

function getLineEnding() {
    const selected = document.querySelector('input[name="lineEnding"]:checked').value;
    switch(selected) {
        case 'crlf': return '\r\n';
        case 'lf': return '\n';
        case 'cr': return '\r';
        default: return '';
    }
}

function switchTab(tab) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update terminal bodies
    document.getElementById('hexTerminal').classList.toggle('active', tab === 'hex');
    document.getElementById('asciiTerminal').classList.toggle('active', tab === 'ascii');

    // Update export button count when switching tabs
    updateExportButtonCount();
}

// Add new HEX input field
function addHexField() {
    hexFieldCount++;
    const container = document.getElementById('dynamicFields');

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'dynamic-field';
    fieldDiv.id = `hex-field-${hexFieldCount}`;
    fieldDiv.innerHTML = `
        <span class="field-label">HEX ${hexFieldCount}</span>
        <input type="text" class="hex-input-dynamic" placeholder="50 51 52 (HEX bytes separated by space)" maxlength="200">
        <button onclick="sendHex(this)">Send HEX</button>
        <button class="btn-remove" onclick="removeField('${fieldDiv.id}')" title="Remove field">×</button>
    `;

    container.appendChild(fieldDiv);

    // Setup input handling for the new field
    const input = fieldDiv.querySelector('.hex-input-dynamic');
    setupHexInput(input);
    input.focus();
}

// Add new ASCII input field
function addAsciiField() {
    asciiFieldCount++;
    const container = document.getElementById('dynamicFields');

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'dynamic-field';
    fieldDiv.id = `ascii-field-${asciiFieldCount}`;
    fieldDiv.innerHTML = `
        <span class="field-label">ASCII ${asciiFieldCount}</span>
        <input type="text" class="ascii-input-dynamic" placeholder="Enter ASCII text">
        <button onclick="sendAscii(this)">Send ASCII</button>
        <button class="btn-remove" onclick="removeField('${fieldDiv.id}')" title="Remove field">×</button>
    `;

    container.appendChild(fieldDiv);

    // Setup input handling for the new field
    const input = fieldDiv.querySelector('.ascii-input-dynamic');
    setupAsciiInput(input);
    input.focus();
}

// Remove a dynamic field
function removeField(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.remove();
    }
}

async function toggleConnection(){
    const btn=document.getElementById('connectBtn');
    if(!isConnected){
		flushReceiveBuffer();
        try{
            port=await navigator.serial.requestPort();
            let baudRate=parseInt(document.getElementById('baudRate').value);
            const customBaud=document.getElementById('customBaud');
            if(customBaud&&customBaud.style.display!=='none'&&customBaud.value)baudRate=parseInt(customBaud.value);
            if(!baudRate||baudRate<1||baudRate>10000000){alert('Invalid baud rate (1-10,000,000)');return;}
            const options={baudRate:baudRate,dataBits:parseInt(document.getElementById('dataBits').value),stopBits:parseInt(document.getElementById('stopBits').value),parity:document.getElementById('parity').value,flowControl:document.getElementById('flowControl').value,bufferSize:8192};
            await port.open(options);
			if(port.readable){
                const flushReader=port.readable.getReader();
                await flushReader.cancel();
                flushReader.releaseLock();
            }
            writer=port.writable.getWriter();
            reader=port.readable.getReader();
            isConnected=true;
            btn.textContent='Disconnect';
            btn.classList.add('danger');
            updateStatus(true);
            showTimeoutWarning(false);
            readLoop=readData();
            document.querySelectorAll('.connection-row select, .connection-row input').forEach(s=>s.disabled=true);
        }catch(err){
            console.error('Connection error:',err);
            // Skip alert if user cancelled port selection
            if(err.name!=='NotFoundError'&&!err.message?.includes('No port selected')){
                alert('Failed to connect: '+err.message);
            }
            await disconnect();
        }
    }else{await disconnect();}
}

async function disconnect(force=false) {
    const btn=document.getElementById('connectBtn');
    btn.disabled=true;
    isConnected=false;
    updateStatus(false);
    showTimeoutWarning(false);

    if(bufferTimeout){clearTimeout(bufferTimeout);bufferTimeout=null;}
    receiveBuffer=[];

    if(reader){
        try{
            const cancelPromise=reader.cancel();
            const timeoutPromise=new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),2000));
            await Promise.race([cancelPromise,timeoutPromise]);
        }catch(e){console.warn('Reader cancel failed:',e);}
        try{reader.releaseLock();}catch(e){}
        reader=null;
    }

    if(writer){
        try{writer.releaseLock();}catch(e){}
        writer=null;
    }

    if(port){
        try{
            const closePromise=port.close();
            const timeoutPromise=new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),3000));
            await Promise.race([closePromise,timeoutPromise]);
        }catch(e){
            console.warn('Port close failed:',e);
            if(port&&'forget'in port)try{await port.forget();}catch(e2){}
        }
        port=null;
    }

    btn.textContent='Connect to UART';
    btn.classList.remove('danger');
    btn.disabled=false;
    document.querySelectorAll('.connection-row select, .connection-row input').forEach(s=>s.disabled=false);
}

async function readData() {
    let stuckTimer=null;
    try{
        while(isConnected&&reader){
            stuckTimer=setTimeout(()=>{if(isConnected)showTimeoutWarning(true);},5000);
            let result;
            try{result=await reader.read();}finally{clearTimeout(stuckTimer);}
            const{value,done}=result;
            if(done)break;
            if(value&&value.length>0){
                showTimeoutWarning(false);
                const now=Date.now();
                const timingEnabled=document.getElementById('enableTiming').checked;
                const timingThreshold=parseInt(document.getElementById('timingValue').value)||50000;
                if(timingEnabled){
                    const timeSinceLast=(now-lastReceiveTime);
                    if(timeSinceLast>timingThreshold&&receiveBuffer.length>0)flushReceiveBuffer();
                    if(receiveBuffer.length+value.length>MAX_BUFFER_SIZE)flushReceiveBuffer();
                    receiveBuffer.push(...value);
                    lastReceiveTime=now;
                    if(bufferTimeout)clearTimeout(bufferTimeout);
                    bufferTimeout=setTimeout(()=>{if(receiveBuffer.length>0)flushReceiveBuffer();},Math.max(timingThreshold+10,50));
                }else{processReceivedData(value);}
            }
            await new Promise(resolve=>setTimeout(resolve,0));
        }
    }catch(err){
        if(isConnected){
            console.error('Read error:',err);
            if(err.name==='NetworkError'||err.message.includes('device disconnected')){await disconnect();}
            else{showTimeoutWarning(true);setTimeout(()=>{if(isConnected)showTimeoutWarning(false);},3000);}
        }
    }finally{if(stuckTimer)clearTimeout(stuckTimer);}
}

function flushReceiveBuffer() {
    if (receiveBuffer.length === 0) return;

    const data = new Uint8Array(receiveBuffer);
    processReceivedData(data);
    receiveBuffer = [];
}

function processReceivedData(data) {
    rxBytes += data.length;
    updateStats();

    // Queue data for batched logging instead of immediate DOM update
    queueLogData(data, 'rx');
}

// Batched logging system to prevent UI freezing
function queueLogData(data, direction) {
    pendingLogEntries.push({ data, direction, timestamp: Date.now() });

    // Schedule flush if not already scheduled
    if (!logFlushScheduled) {
        logFlushScheduled = true;
        setTimeout(flushLogBuffer, LOG_FLUSH_INTERVAL);
    }

    // Force flush if buffer gets too large
    if (pendingLogEntries.length > 50 || 
        pendingLogEntries.reduce((sum, e) => sum + e.data.length, 0) > MAX_BUFFER_SIZE) {
        if (logFlushScheduled) {
            clearTimeout(flushLogBuffer);
        }
        flushLogBuffer();
    }
}

function flushLogBuffer() {
    logFlushScheduled = false;

    if (pendingLogEntries.length === 0) return;

    const entries = pendingLogEntries.splice(0); // Clear pending array
    const fragmentHex = document.createDocumentFragment();
    const fragmentAscii = document.createDocumentFragment();
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3 
    });

    entries.forEach(entry => {
        const { data, direction } = entry;

        // HEX view
        const hexStr = Array.from(data)
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');

        const hexEntry = document.createElement('div');
        hexEntry.className = 'log-entry';
        hexEntry.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="direction ${direction}">${direction.toUpperCase()}</span>
            <span class="data hex">${hexStr}</span>
        `;
        fragmentHex.appendChild(hexEntry);

        // Store in full log for export
        fullHexLog.push(hexEntry.cloneNode(true));

        // ASCII view
        const asciiStr = Array.from(data)
            .map(b => {
                if (b >= 32 && b <= 126) return String.fromCharCode(b);
                if (b === 10) return '␊';
                if (b === 13) return '␍';
                if (b === 9) return '␉';
                return '·';
            })
            .join('');

        const asciiEntry = document.createElement('div');
        asciiEntry.className = 'log-entry';
        asciiEntry.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="direction ${direction}">${direction.toUpperCase()}</span>
            <span class="data">${asciiStr}</span>
        `;
        fragmentAscii.appendChild(asciiEntry);

        // Store in full log for export
        fullAsciiLog.push(asciiEntry.cloneNode(true));
    });

    const hexTerminal = document.getElementById('hexTerminal');
    const asciiTerminal = document.getElementById('asciiTerminal');

    hexTerminal.appendChild(fragmentHex);
    asciiTerminal.appendChild(fragmentAscii);

    // Apply line limit (throttled)
    applyLineLimit();

    // Update export button with current line count
    updateExportButtonCount();

    // Auto scroll using requestAnimationFrame for smooth performance
    if (document.getElementById('autoScroll').checked) {
        requestAnimationFrame(() => {
            hexTerminal.scrollTop = hexTerminal.scrollHeight;
            asciiTerminal.scrollTop = asciiTerminal.scrollHeight;
        });
    }
}

function applyLineLimit() {
    const maxLines = parseInt(document.getElementById('maxLines').value) || 0;
    if (maxLines <= 0) return; // 0 means unlimited

    const hexTerminal = document.getElementById('hexTerminal');
    const asciiTerminal = document.getElementById('asciiTerminal');

    // Remove excess entries from DOM (keep last maxLines)
    // Use batch removal for better performance
    if (hexTerminal.children.length > maxLines) {
        const toRemove = hexTerminal.children.length - maxLines;
        for (let i = 0; i < toRemove && hexTerminal.firstChild; i++) {
            hexTerminal.removeChild(hexTerminal.firstChild);
        }
    }
    if (asciiTerminal.children.length > maxLines) {
        const toRemove = asciiTerminal.children.length - maxLines;
        for (let i = 0; i < toRemove && asciiTerminal.firstChild; i++) {
            asciiTerminal.removeChild(asciiTerminal.firstChild);
        }
    }

    // No limit on export arrays - they keep growing until clearTerminal() is called
    // This allows export to contain complete session history regardless of display limit
}

// Update export button to show line count
function updateExportButtonCount() {
    const activeTab = document.getElementById('hexTerminal').classList.contains('active') ? 'hex' : 'ascii';
    const count = activeTab === 'hex' ? fullHexLog.length : fullAsciiLog.length;
    const exportBtn = document.querySelector('button[onclick="exportLog()"]');
    if (exportBtn) {
        exportBtn.textContent = `Export log (${count} packets)`;
    }
}

// Legacy function - kept for compatibility but now uses batching
function logData(data, direction) {
    queueLogData(data, direction);
}

async function sendHex(btnElement) {
    if (!isConnected) {
        alert('Please connect to UART first');
        return;
    }

    // Find the input field associated with this button
    const row = btnElement.closest('.send-row, .dynamic-field');
    const input = row.querySelector('.hex-input, .hex-input-dynamic');

    if (!input) return;

    const inputValue = input.value.trim();
    if (!inputValue) return;

    try {
        const hexPairs = inputValue.split(/\s+/).filter(p => p.length > 0);
        const bytes = hexPairs
            .map(b => parseInt(b, 16))
            .filter(b => !isNaN(b) && b >= 0 && b <= 255);

        if (bytes.length === 0) {
            alert('Invalid HEX input');
            return;
        }

        // Validate that all hex pairs are complete (2 characters each)
        const invalidPairs = hexPairs.filter(p => p.length !== 2 || isNaN(parseInt(p, 16)));
        if (invalidPairs.length > 0) {
            alert(`Invalid HEX pairs: ${invalidPairs.join(', ')}`);
            return;
        }

        const data = new Uint8Array(bytes);
        const ending = getLineEnding();
        if (ending) {
            const endingBytes = new TextEncoder().encode(ending);
            const combined = new Uint8Array(data.length + endingBytes.length);
            combined.set(data);
            combined.set(endingBytes, data.length);
            await writer.write(combined);
            txBytes += combined.length;
            logData(combined, 'tx');
        } else {
            await writer.write(data);
            txBytes += data.length;
            logData(data, 'tx');
        }

        updateStats();
        // Input stays after sending - NOT clearing
    } catch (err) {
        console.error('Send error:', err);
        alert('Failed to send: ' + err.message);
    }
}

async function sendAscii(btnElement) {
    if (!isConnected) {
        alert('Please connect to UART first');
        return;
    }

    // Find the input field associated with this button
    const row = btnElement.closest('.send-row, .dynamic-field');
    const input = row.querySelector('.ascii-input, .ascii-input-dynamic');

    if (!input) return;

    const inputValue = input.value;
    const ending = getLineEnding();
    const text = inputValue + ending;

    try {
        const data = new TextEncoder().encode(text);
        await writer.write(data);
        txBytes += data.length;
        updateStats();
        logData(data, 'tx');
        // Input stays after sending - NOT clearing
    } catch (err) {
        console.error('Send error:', err);
        alert('Failed to send: ' + err.message);
    }
}

function handleJsonSelect(input) {
    const file = input.files[0];
    if (file) {
        document.getElementById('jsonFileName').value = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                jsonCommands = JSON.parse(e.target.result);
                console.log('JSON commands loaded:', jsonCommands);
            } catch (err) {
                alert('Invalid JSON file');
                jsonCommands = null;
            }
        };
        reader.readAsText(file);
    }
}

async function sendJsonCommands() {
    if (!isConnected) {
        alert('Please connect to UART first');
        return;
    }

    if (!jsonCommands) {
        alert('Please select a valid JSON file first');
        return;
    }

    if (jsonRunning) return;
    jsonRunning = true;
    document.getElementById('sendJsonBtn').disabled = true;
    document.getElementById('stopJsonBtn').style.display = '';

    try {
        if (Array.isArray(jsonCommands)) {
            for (const cmd of jsonCommands) {
                if (!jsonRunning) break;

                let data;
                let preDelay  = 0;
                let postDelay = 100; // default inter-command gap
                let times     = 1;   // times: 0=skip, 1=once, N=N times, -1=infinite

                if (typeof cmd === 'string') {
                    data = new TextEncoder().encode(cmd + getLineEnding());
                } else if (cmd.type === 'hex') {
                    const bytes = cmd.data.split(/\s+/).map(b => parseInt(b, 16));
                    data = new Uint8Array(bytes);
                    if (typeof cmd.preDelay  === 'number') preDelay  = cmd.preDelay;
                    if (typeof cmd.postDelay === 'number') postDelay = cmd.postDelay;
                    if (typeof cmd.times     === 'number') times     = cmd.times;
                } else {
                    data = new TextEncoder().encode(cmd.data + getLineEnding());
                    if (typeof cmd.preDelay  === 'number') preDelay  = cmd.preDelay;
                    if (typeof cmd.postDelay === 'number') postDelay = cmd.postDelay;
                    if (typeof cmd.times     === 'number') times     = cmd.times;
                }

                if (times === 0) continue; // skip this command

                const infinite = (times === -1);
                let i = 0;
                while (jsonRunning && (infinite || i < times)) {
                    if (preDelay > 0) await new Promise(r => setTimeout(r, preDelay));
                    if (!jsonRunning) break;

                    await writer.write(data);
                    txBytes += data.length;
                    logData(data, 'tx');
                    updateStats();

                    if (postDelay > 0) await new Promise(r => setTimeout(r, postDelay));
                    if (!infinite) i++;

                    // Yield to main thread every iteration
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        } else {
            alert('JSON must be an array of commands');
        }
    } catch (err) {
        console.error('JSON send error:', err);
        alert('Failed to send JSON commands: ' + err.message);
    } finally {
        jsonRunning = false;
        document.getElementById('sendJsonBtn').disabled = false;
        document.getElementById('stopJsonBtn').style.display = 'none';
    }
}

function stopJsonCommands() {
    jsonRunning = false;
}

function updateStatus(connected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const isDayTheme = document.body.classList.contains('day');

    if (connected) {
        dot.classList.add('connected');
        text.textContent = `Connected (${document.getElementById('baudRate').value} baud)`;
        // Dark green for day theme, bright green for night theme
        text.style.color = isDayTheme ? '#1a7a3a' : '#2ed573';
    } else {
        dot.classList.remove('connected');
        text.textContent = 'Disconnected';
        // Dark red for day theme, light gray for night theme
        text.style.color = isDayTheme ? '#dc3545' : '#e0e0e0';
    }
}

function updateStats() {
    document.getElementById('rxCount').textContent = `${rxBytes} bytes`;
    document.getElementById('txCount').textContent = `${txBytes} bytes`;
}

function clearTerminal() {
    document.getElementById('hexTerminal').innerHTML = '';
    document.getElementById('asciiTerminal').innerHTML = '';
    fullHexLog = [];
    fullAsciiLog = [];
    pendingLogEntries = [];

    // Reset export button text
    const exportBtn = document.querySelector('button[onclick="exportLog()"]');
    if (exportBtn) {
        exportBtn.textContent = 'Export log (0 lines)';
    }
}

function exportLog() {
    const activeTab = document.getElementById('hexTerminal').classList.contains('active') ? 'hex' : 'ascii';
    // Use full log arrays instead of DOM for export
    const entries = activeTab === 'hex' ? fullHexLog : fullAsciiLog;
    let log = '';

    entries.forEach(entry => {
        const timestamp = entry.querySelector('.timestamp').textContent;
        const direction = entry.querySelector('.direction').textContent;
        const data = entry.querySelector('.data').textContent;
        log += `[${timestamp}] ${direction}: ${data}\n`;
    });

    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uart-log-${activeTab}-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// Cleanup on page unload
window.addEventListener('beforeunload',async()=>{if(isConnected)await disconnect();});
window.addEventListener('visibilitychange',()=>{if(document.hidden&&isConnected)console.log('Page hidden');});

// ── Theme toggle ──────────────────────────────────────────────────
let isDayTheme = false;

function toggleTheme() {
    isDayTheme = !isDayTheme;
    document.body.classList.toggle('day', isDayTheme);
    document.getElementById('themeIcon').textContent  = isDayTheme ? '☀️' : '🌙';
    document.getElementById('themeLabel').textContent = isDayTheme ? 'Day' : 'Night';
    try { localStorage.setItem('pineTERM-theme', isDayTheme ? 'day' : 'night'); } catch(e) {}
    // Refresh status colors immediately
    updateStatus(isConnected);
}

// Restore saved theme on load
try {
    if (localStorage.getItem('pineTERM-theme') === 'day') toggleTheme();
} catch(e) {}

async function insertCommitDate() {
    const apiUrl = "https://api.github.com/repos/WeSpeakEnglish/pineTERM/commits?per_page=1";
    try {
        const res = await fetch(apiUrl, {
            headers: { "Accept": "application/vnd.github+json" }
        });
        if (!res.ok) throw new Error("GitHub API error: " + res.status);
        const data = await res.json();
        const iso = data[0]?.commit?.committer?.date;
        if (!iso) {
            document.getElementById("commit-date").innerHTML = "Last commit: Unknown";
            return;
        }
        const d = new Date(iso);
        const pad = (n) => n.toString().padStart(2, "0");
        const formatted = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ` + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        document.getElementById("commit-date").innerHTML = `Last commit: ${formatted}`;
    } 
    catch (err) {
        console.error(err);
        document.getElementById("commit-date").innerHTML = " repository";
    }
}


























