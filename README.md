# pineTERM v1.0
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Web Serial API](https://img.shields.io/badge/Web%20Serial%20API-Supported-green)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
[![Browser: Chrome](https://img.shields.io/badge/Browser-Chrome%20|%20Edge%20|%20Opera-orange)](https://caniuse.com/web-serial)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Online-success)](https://wespeakenglish.github.io/pineTERM/)

A modern, browser-based serial terminal for UART communication with microcontrollers, embedded devices, and IoT hardware. No installation required—just open in your browser and connect to your serial device.

![pineTERM Screenshot](https://via.placeholder.com/800x400/1a1a2e/00d4ff?text=pineTERM+Interface)

## ✨ Features

- **🔌 Native Web Serial API** - Direct hardware communication without native applications
- **📊 Dual View Modes** - Simultaneous HEX and ASCII terminal views with synchronized scrolling
- **🎨 Day/Night Themes** - Switch between dark and light modes with persistent preferences
- **📋 Smart Input Handling** - Auto-formatting HEX input with real-time validation
- **📁 JSON Command Sequences** - Automated testing with programmable command batches
- **⏱️ Packet Timing Control** - Intelligent frame detection based on inter-byte timing
- **📤 Log Export** - Save terminal output as timestamped text files
- **📱 Responsive Design** - Works on desktop and tablet browsers

## 🚀 Quick Start

### Requirements

- **Chrome 89+**, **Edge 89+**, or **Opera** (desktop only)
- USB-to-Serial adapter or native serial port
- Target device (Arduino, ESP32, Raspberry Pi Pico, etc.)

### Live Demo (No Installation Required!)

**🌐 Use it right now:** [https://wespeakenglish.github.io/pineTERM/](https://wespeakenglish.github.io/pineTERM/)

Simply open the link above in a supported browser, click **"Connect to UART"**, and select your device. That's it!

### Local Installation (Optional)

If you prefer to run locally:

```bash
git clone https://github.com/wespeakenglish/pineTERM.git
cd pineTERM
# Open index.html in Chrome/Edge/Opera


