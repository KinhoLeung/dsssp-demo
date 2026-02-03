# User Guide

Welcome to **WebHMI**! This guide will help you quickly understand the core features, operational flows, and how to efficiently tune your audio devices using WebHMI.

## 1. Getting Started

### Platform & Browser Compatibility

Since WebHMI relies on underlying hardware communication protocols (WebHID and Web Bluetooth API), its connectivity depends on the combined support of the operating system and the browser.

#### Desktop (PC / Mac / Linux)

| OS          | Recommended Browser | USB (WebHID) | Bluetooth (WebBLE) | Remarks                                 |
| :---------- | :------------------ | :----------: | :----------------: | :-------------------------------------- |
| **Windows** | Chrome / Edge       |      ✅       |         ✅          | Windows 10 (1809) or later recommended  |
| **macOS**   | Chrome / Edge       |      ✅       |         ✅          |                                         |
| **Linux**   | Chrome / Edge       |      ✅       |         ✅          | udev rules may be needed for HID access |

#### Mobile (Phone / Tablet)

| OS               | Browser Status         |  USB  | Bluetooth | Suggestion                                                   |
| :--------------- | :--------------------- | :---: | :-------: | :----------------------------------------------------------- |
| **Android**      | Chrome / Edge          |   ❌   |     ✅     | Bluetooth is recommended for tuning                          |
| **iOS / iPadOS** | Safari                 |   ❌   |     ❌     | OS limitations; native low-level communication not supported |
| **iOS / iPadOS** | **Bluefy** (3rd party) |   ❌   |     ✅     | Try the Bluefy browser from the App Store for BLE            |

> **Important Notes**:
> * **Unsupported Browsers**: Safari (Desktop & Mobile), Firefox, Internet Explorer, and all legacy non-Chromium browsers.
> * **In-App Browsers**: "Built-in browsers" in apps like WeChat or Facebook usually disable hardware interfaces. If opened within these apps, please select "Open in Browser" from the top-right menu.

### Connecting Your Device

From the home page, you can choose one of three ways to enter the control interface:

1. **USB Connection**: Connect via USB cable using the WebHID protocol for high-speed, stable communication.
2. **Bluetooth Connection (BLE)**: Search and pair with supported Bluetooth devices using native Web Bluetooth.
3. **Demo Mode**: If you don't have physical hardware on hand, use Demo Mode to experience the full functional interface.

## 2. Core Features

WebHMI provides professional-grade audio processing tools, covering the entire chain from input gain to output limiting.

### Interactive EQ (Equalizer)

A powerful EQ system is available for Music, Mic, and all output channels:

* **Visual Graph**: Real-time display of the frequency response curve.
* **Drag-and-Drop**: Adjust Frequency (Freq) and Gain directly by dragging nodes on the curve.
* **Precision Tuning**: Adjust Q-value (bandwidth) and switch filter types (e.g., Peak, LowShelf, HighShelf, LowPass, HighPass, etc.).
* **Double-Click to Reset**: Double-click a node to quickly restore default settings.

## 3. Advanced Operations

### Configuration Management

Easily migrate settings between different devices:

* **Export (.webhmi)**: Save all current parameters (excluding sensitive system settings) as a local file.
* **Import**: Load configuration from a local file. The system automatically verifies firmware version compatibility and provides risk warnings.

### Real-time Synchronization

All operations are **sent in real-time**. As you move sliders or drag EQ points on the web page, the connected device updates instantly, achieving a "what you see is what you get" tuning experience.
