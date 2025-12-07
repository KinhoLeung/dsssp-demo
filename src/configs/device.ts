const deviceConfig = {
  hid: {
    filters: [] as HIDDeviceFilter[],
    reportId: 0,
    packetSize: 64
  },
  ble: {
    // ESP32 GATT demo: service 0xFFF0, write 0xFFF2, notify 0xFFF1
    serviceUuid:
      '0000fff0-0000-1000-8000-00805f9b34fb' as BluetoothServiceUUID,
    txCharacteristicUuid:
      '0000fff2-0000-1000-8000-00805f9b34fb' as BluetoothCharacteristicUUID,
    rxCharacteristicUuid:
      '0000fff1-0000-1000-8000-00805f9b34fb' as BluetoothCharacteristicUUID,
    maxChunkSize: 180
  }
}

export default deviceConfig
