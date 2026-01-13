const CRC16_CCITT_FALSE_POLY = 0x1021
const CRC16_CCITT_FALSE_INIT = 0xffff

export const crc16CcittFalse = (bytes: Uint8Array): number => {
  let crc = CRC16_CCITT_FALSE_INIT

  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8
    for (let j = 0; j < 8; j++) {
      const msb = crc & 0x8000
      crc = (crc << 1) & 0xffff
      if (msb) crc ^= CRC16_CCITT_FALSE_POLY
    }
  }

  return crc & 0xffff
}

