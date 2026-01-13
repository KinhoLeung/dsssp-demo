let selectedHidDevice: HIDDevice | null = null
let selectedBleDevice: BluetoothDevice | null = null

export const setSelectedHidDevice = (device: HIDDevice | null) => {
  selectedHidDevice = device
}

export const getSelectedHidDevice = () => selectedHidDevice

export const setSelectedBleDevice = (device: BluetoothDevice | null) => {
  selectedBleDevice = device
}

export const getSelectedBleDevice = () => selectedBleDevice

