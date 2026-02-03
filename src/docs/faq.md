# FAQ

Common questions and solutions encountered while using WebHMI are summarized here.

## Connection

### Q: Why do I get a "Compatible device not found" error after clicking "USB Connection"?

1. Ensure the device is powered on and correctly connected to the computer.
2. Check if the USB cable is damaged, or try a different USB port on your computer (direct motherboard ports are recommended).
3. Some systems may require specific drivers to recognize the device as an HID device, but in most cases (Windows/macOS), it is driver-free.

### Q: Browser says "WebHID/Web Bluetooth not supported"?

Please ensure you are using the latest version of **Google Chrome** or **Microsoft Edge**. Due to privacy and security restrictions, Firefox and Safari do not currently fully support these protocols.

### Q: Why can't Bluetooth find my device?

1. Ensure the device's Bluetooth is turned on and in "discoverable" mode.
2. check if the device is already occupied by another computer/phone/tablet or application.
3. Ensure your computer/phone/tablet's Bluetooth hardware is enabled.

## File Management

### Q: Can .webhmi files be used across different devices?

As long as the device model and major firmware version match, the configuration is compatible.
