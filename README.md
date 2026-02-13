# pineTERM|
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Web Serial API](https://img.shields.io/badge/Web%20Serial%20API-Supported-green)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
[![Browser: Chrome](https://img.shields.io/badge/Browser-Chrome%20|%20Edge%20|%20Opera-orange)](https://caniuse.com/web-serial)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Online-success)](https://wespeakenglish.github.io/pineTERM/)

A modern, browser-based serial terminal for UART communication with microcontrollers, embedded devices, and IoT hardware. No installation required—just open in your browser and connect to your serial device.

![pineTERM Screenshot](https://github.com/WeSpeakEnglish/images/blob/main/pineterm.png)

## Features

- **Native Web Serial API** - Direct hardware communication without native applications
- **HEX and ASCII View Modes** - On-the-fly switchable HEX and ASCII terminal views with synchronized scrolling
- **Day/Night Themes** - Switch between dark and light modes with persistent preferences
- **Smart Input Handling** - Auto-formatting HEX input with real-time validation
- **JSON Command Sequences** - Automated testing with programmable command batches
- **Packet Timing Control** - Intelligent frame detection based on inter-byte timing
- **Log Export** - Save terminal output as timestamped text files
- **Responsive Design** - Works on desktop and tablet browsers

## Quick Start

### Requirements

- **Chrome 89+**, **Edge 89+**, or **Opera** (desktop only)
- USB-to-Serial adapter or native serial port
- Target device (Arduino, ESP32, Raspberry Pi Pico, etc.)

### Live Demo (No Installation Required!)

**Use it right now:** [https://wespeakenglish.github.io/pineTERM/](https://wespeakenglish.github.io/pineTERM/)

Simply open the link above in a supported browser, click **"Connect to UART"**, and select your device. That's it!

### Local Installation (Optional)

If you prefer to run locally:

```bash
git clone https://github.com/wespeakenglish/pineTERM.git
cd pineTERM
# Open index.html in Chrome/Edge/Opera
```

### Basic Usage
1. Connect: Click "Connect to UART" → Select your serial port → Configure baud rate
2. Send Data: Type HEX (48 65 6C 6C 6F) or ASCII (Hello) and click send
3. Monitor: View responses in both HEX and ASCII tabs
4. Export: Click "Export log" to save the session

### JSON Command Sequences
pineTERM supports automated command sequences via JSON files for testing and batch operations.

### JSON Schema
```json
[
  {
    "type": "ascii",
    "data": "AT+GMR",
    "times": 1,
    "preDelay": 0,
    "postDelay": 100
  }
]
```
### Field Reference

| Field       | Type    | Default  | Description                                                                 |
| ----------- | ------- | -------- | --------------------------------------------------------------------------- |
| `type`      | string  | required | `"ascii"` for text commands, `"hex"` for raw bytes                          |
| `data`      | string  | required | Command payload. For hex: space-separated bytes (e.g., `"FF FE 01 00"`)     |
| `times`     | integer | `1`      | Execution count: `0`=skip, `1`=once, `N`=repeat N times, `-1`=infinite loop |
| `preDelay`  | integer | `0`      | Milliseconds to wait before sending this command                            |
| `postDelay` | integer | `100`    | Milliseconds to wait after sending (inter-command gap)                      |

### Example: WiFi Module Configuration

```json
[
  { "type": "ascii", "data": "AT\r\n", "times": 0 },
  { "type": "ascii", "data": "AT+GMR\r\n", "times": 1, "postDelay": 500 },
  { "type": "ascii", "data": "AT+CWMODE=1\r\n", "times": 1, "postDelay": 1000 },
  { "type": "ascii", "data": "AT+CWJAP=\"MyNetwork\",\"MyPassword\"\r\n", "times": 1, "preDelay": 200, "postDelay": 5000 },
  { "type": "hex", "data": "FF FE 01 00", "times": 3, "postDelay": 300 },
  { "type": "ascii", "data": "PING\r\n", "times": 5, "postDelay": 1000 },
  { "type": "hex", "data": "AA 55 0D 0A", "times": -1, "preDelay": 50, "postDelay": 50 }
]
```

#### Command Flow:

1. Skip test command (times: 0)
2. Get firmware version, wait 500ms
3. Set station mode, wait 1s
4. Connect to WiFi with 5s timeout for connection
5. Send raw bytes 3 times with 300ms gaps
6. Send PING 5 times with 1s intervals
7. Infinite heartbeat loop (50ms delays)

### Loading JSON Files

1. Click "Select JSON" in the Send Command panel
2. Choose your .json file
3. Click "Send JSON Commands" to execute
4. Click "Stop" to halt execution

### Configuration Options

#### Serial Parameters

| Setting      | Options         | Default |
| ------------ | --------------- | ------- |
| Baud Rate    | 9600 - 921600   | 9600    |
| Data Bits    | 7, 8            | 8       |
| Stop Bits    | 1, 2            | 1       |
| Parity       | None, Even, Odd | None    |
| Flow Control | None, Hardware  | None    |

### Line Endings

Choose transmission termination:

- CR LF (\r\n) - Windows/DOS style
- LF (\n) - Unix/Linux style
- CR (\r) - Classic Mac style
- None - Raw data only

### Packet Timing

Enable "Separated less than X μSec treat like one package" to:

- Buffer rapid incoming bytes into single log entries
- Prevent frame fragmentation on high-speed streams
- Default: 5000μs (5ms) threshold

### Security & Privacy

- User Permission Required: Browser prompts for serial port access each session
- No Data Transmission: All communication stays local between browser and device
- No Storage: Logs are not saved unless explicitly exported by user
- HTTPS Required: Web Serial API requires secure context (localhost or HTTPS)

### Browser Compatibility

| Browser        | Support | Notes                                                   |
| -------------- | ------- | ------------------------------------------------------- |
| Chrome 89+     |  Full  | Windows, macOS, Linux, ChromeOS                         |
| Edge 89+       |  Full  | Windows, macOS, Linux                                   |
| Opera          |  Full  | Windows, macOS, Linux                                   |
| Firefox        |  None  | [Vote for implementation](https://connect.mozilla.org/) |
| Safari         |  None  | Not supported                                           |
| Chrome Android |  None  | USB serial unavailable on mobile                        |

###  Use Cases

- Embedded Development - Debug Arduino, ESP8266/32, STM32 firmware
- IoT Prototyping - Test AT command sets on WiFi/BLE modules
- Hardware Testing - Automated regression testing with JSON sequences
- Reverse Engineering - Analyze proprietary serial protocols
- Education - Teach serial communication without complex tools

###  Troubleshooting

| Issue                          | Solution                                                  |
| ------------------------------ | --------------------------------------------------------- |
| "Web Serial API not supported" | Use Chrome/Edge/Opera desktop, check version 89+          |
| Device not appearing           | Install USB-to-Serial drivers (CH340, CP2102, FTDI, etc.) |
| Garbled text                   | Verify baud rate matches device configuration             |
| JSON commands fail             | Validate JSON syntax, check console for errors            |

### Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (git checkout -b feature/amazing-feature)
3. Commit changes (git commit -m 'Add amazing feature')
4. Push to branch (git push origin feature/amazing-feature)
5. Open a Pull Request

### Acknowledgments
- Built with vanilla JavaScript—no frameworks, no dependencies
- Uses the Web Serial API standard
- Inspired by classic terminal emulators and modern web technologies
  
**Made with 💙 for hardware hackers**











