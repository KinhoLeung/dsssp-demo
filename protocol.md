# Web上位机与固件的通信协议

## 历史版本

| 版本   | 日期       | 变更内容 |
| ------ | ---------- | -------- |
| V1.0.0 | 2025.12.29 | 初始版本 |
|        |            |          |
|        |            |          |

## 1 协议约定

    本标准规定了固件与Web上位机通信的一般约定、数据帧格式、控制字定义、数据结构及传输规则。

### 1.1 版本号约定

    约版本号是对本规约不同版本的标识，由主版本major（架构级不兼容更新时递增）、次版本minor（新增向下兼容功能时递增）和补丁patch（BUG修复/优化时递增）三部分组成。

### 1.2 通信方式约定

## 2 通讯模式

该协议支持两种通讯模式：USB HID和BLE。

## 3 数据帧格式

### 3.1 总览

| magic | ver | hdr_len | msg_id | flags | len(u16) | ext... | payload | crc16 |
| ----- | --- | ------- | ------ | ----- | -------- | ------ | ------- | ----- |

* 字节序：Little-endian（小端）
* 传输方式：把 HID report / BLE notify 当作**字节流**喂给解包器
* 帧目标：从字节流中稳定找包头、拼出完整消息、校验完整性、输出一条完整帧

### 3.2 字段定义与用法

magic（2 bytes）

* 固定值：建议 `0xD5 0x5D`（可自定义，但一旦确定不要修改）
* 用途：

  * 在字节流中 **定位包头** （resync）
  * 当 CRC 校验失败或解析出错时，从下一个字节继续扫描 magic，恢复同步

ver（1 bytes）

* 协议主版本号
* v1 固定为：`0x01`
* 用途：
* 将来做**不兼容**升级时使用（例如彻底重排字段含义）

hdr_len（1 bytes）

* Header 长度（从 `ver` 开始，到 `ext` 结束）
* 用途：

  * 需要扩展 header 时（比如加密参数、分片参数），可以把 `hdr_len` 变大，并把扩展字段放进 `ext...`
  * 老版本解析器如果不认识 ext，可以直接 **跳过 ext** ，仍能读 payload（兼容）

msg_id（2 bytes）

* 消息/方法 ID（类似 RPC 的方法号）
* 用途：

  * 告诉上层业务：这条 payload 对应哪个“请求/响应/事件”的类型
  * **请求和响应使用同一个 msg_id** ，用 `ext.req_id`（见 ext TLV） 做匹配;`EVENT=1` 的帧不对应某个请求
* 例：

  * `0x0000` = Auth

> 注：msg_id 的具体分配由业务协议另行定义。

flags（1 bytes）

用于描述帧的“处理方式/语义开关”（布尔性质），bit 位定义如下：

* bit0 `RESPONSE`（ACK）：是否需要回应/是否为回应。上位机 → 设备：指设备是否需要回应这个 Request，0：不用回，1：需要回；设备 → 上位机：回应某个 Request 时应为 1，主动上报 `EVENT`=1 时必须为 0
* bit1 `EVENT`：1=设备主动上报（不对应某个请求），此时 `RESPONSE`应该0
* 其它：保留

> v1 初期最低实现：至少要支持 `RESPONSE`、`EVENT` 这两个位的解析（即使业务层暂时不用）。

len（2 bytes）

* payload 字节长度，范围：0~65535
* 用途：

  * 接收端在读到 header 后，就知道需要再收多少 payload 字节才能组成完整帧
  * 解决 BLE/HID 的分片问题（多次 notify/report 拼成一条消息）

ext（N bytes）

* 长度：`hdr_len - 7`
* v1：可选；不使用 ext 时长度为 0；携带 `req_id` 时 ext 长度为 4（hdr_len=11）
* 用途（未来扩展）：
* 当 flags 开了某些能力（FRAG/ENCRYPTED/COMPRESSED），需要附带参数时可放在 ext

  * 推荐扩展格式：TLV（t=1B, l=1B, v=l bytes）
* 兼容性规则：

  * 不认识的 ext 类型必须忽略（skip），不能导致解包失败

> TLV 是一种非常常见的可扩展编码格式，意思是：
>
> * **T = Type（类型/字段号）**
> * **L = Length（长度）**
> * **V = Value（值）**
>
> 最小 TLV 形式通常是：T (1 byte) | L (1 byte) | V (L bytes)

v1 约定的 ext TLV 类型：

* `0x80`：`req_id`，`L=2`，`V=u16 little-endian`。用于并发请求与响应匹配；请求与其响应必须携带相同 `req_id`

payload（len bytes）

* 业务数据
* 编码格式：protobuf 编码，除了Auth，其它都要用protobuf 编码

crc16（2 bytes）

* 用途：应用层完整性校验，防止分片拼包缺字节/错字节导致 payload 解码崩坏
* 推荐算法：**CRC16-CCITT-FALSE**

  * poly=0x1021, init=0xFFFF, refin=false, refout=false, xorout=0x0000
* 覆盖范围：从 `ver` 开始，到 `payload` 结束

  即 CRC 输入为：`ver | hdr_len | msg_id | flags | len | ext... | payload`

  **不含 magic，不含 crc16 本身**

## 4 msg_id 定义

控制字可供使用的有65,536个（0x0000—0xFFFF），可根据实际应用需求进行扩充，具体定义见下表：

| msg_id | 含义              | 说明                          |
| ------ | ----------------- | ----------------------------- |
| 0x0000 | Auth              | 认证设备，禁止第三方设备接入  |
| 0x0001 | GetDb             | 获取设备可配置数据数据库      |
| 0x0002 | SetEq             | 设置 EQ 参数（patch）         |
| 0x0003 | SetSystem         | 设置系统参数（patch）         |
| 0x0004 | SetMusic          | 设置 Music 参数（patch）      |
| 0x0005 | SetMic            | 设置 Mic 参数（patch）        |
| 0x0006 | SetReverb         | 设置 Reverb 参数（patch）     |
| 0x0007 | SetEcho           | 设置 Echo 参数（patch）       |
| 0x0008 | SetMainOutput     | 设置 MainOutput 参数（patch） |
| 0x0009 | SetSubOutput      | 设置 SubOutput 参数（patch）  |
| 0x000a | SetCenter         | 设置 Center 参数（patch）     |
| 0x000b | SetSurround       | 设置 Surround 参数（patch）   |
| 0x000c | SwitchCurrentMode | 切换当前模式                  |
| 0x000d | SaveMode          | 保存当前模式参数              |
| 0x000e | ResetEq           | 重置EQ参数                    |

## 5 payload 格式

### 5.1 认证（Auth） 0x0000

> Auth 的数据结构属于 **payload 层**（业务层）；外层仍然使用第 3 章定义的 framing 数据帧承载与分包。

#### 5.1.1 AuthChallenge（上位机→设备，msg_id=Auth，RESPONSE=1）

payload：

| nonce    |
| -------- |
| 32 bytes |

#### 5.1.2 AuthResponse（设备→上位机，msg_id=Auth，RESPONSE=1）

payload：

| sig_len | signature |
| ------- | --------- |
| 1 byte  | 64 bytes  |

说明：

- `sig_len`：当前固定为 `64`（ECDSA P-256 raw `r||s`）
- `signature`：raw `r||s`（64 bytes）

签名消息：

- `message = nonce`
- `signature = ECDSA P-256 over SHA-256(message)`（在 WebCrypto 中用 `ECDSA(SHA-256)` 验签）

### 5.2 获取数据库（GetDb） 0x0001

#### 5.2.1 GetDbRequest（上位机→设备，msg_id=GetDb，RESPONSE=1）

len:0

payload为空

#### 5.2.2 GetDbResponse（设备→上位机，msg_id=GetDb，RESPONSE=1）

整个数据库：payload 使用 protobuf 编码，对应 `webhmi.GetDbResponse`（定义见 `webhmi.proto`）

#### 5.2.3 数据库格式

下面 JSON 仅用于说明字段含义/结构示例（实际传输为 protobuf，`freq` 为 Hz 的 `uint32`）：

```
{
    "deviceId": "device demo",
    "firmwareVersion": "1.0.0",
    "db": {
        "system": {
            "bleName": "WebHMI",
            "panelLock": false,
            "mute": false,
            "musicMaxVolume": 80,
            "micMaxVolume": 80,
            "effectMaxVolume": 80,
            "musicDefaultVolume": 60,
            "micDefaultVolume": 60,
            "effectDefaultVolume": 60,
            "useDefaultVolume": false,
            "modeList": [
                "mode1",
                "mode2",
                "mode3"
            ],
            "currentModeIndex": 0,
            "musicVolume": 60,
            "micVolume": 60,
            "effectVolume": 60
        },
        "music": {
            "eq": {
                "point": [
                    {
                        "index": 0,
                        "type": "HighPass",
                        "freq": 20,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "HighPass",
                        "defaultFreq": 20,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    },
                    {
                        "index": 1,
                        "type": "Peak",
                        "freq": 666,
                        "gain": 6.0,
                        "q": 1.0,
                        "defaultType": "Peak",
                        "defaultFreq": 666,
                        "defaultGain": 6.0,
                        "defaultQ": 1.0
                    },
                    {
                        "index": 2,
                        "type": "LowPass",
                        "freq": 20000,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "LowPass",
                        "defaultFreq": 20000,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    }
                ],
                "bypass": false,
                "highPassTypeList": [
                    "HighPass"
                ],
                "typeList": [
                    "Peak",
                    "LowShelf",
                    "HighShelf"
                ],
                "lowPassTypeList": [
                    "LowPass"
                ]
            },
            "inputGain": 0,
            "btGain": 0,
            "udiskGain": 0,
            "musicPitch": 0.0,
            "inputSelect": "BT",
            "bass": 0.0,
            "mid": 0.0,
            "midFreq": 1000,
            "treble": 0.0,
            "noise": {
                "gate": -50.0,
                "frameTime": 2000,
                "atkTime": 500,
                "relTime": 300
            }
        },
        "mic": {
            "micAEq": {
                "eq": {
                    "point": [
                        {
                            "index": 0,
                            "type": "HighPass",
                            "freq": 20,
                            "gain": 0.0,
                            "q": 0.7,
                            "defaultType": "HighPass",
                            "defaultFreq": 20,
                            "defaultGain": 0.0,
                            "defaultQ": 0.7
                        },
                        {
                            "index": 1,
                            "type": "Peak",
                            "freq": 666,
                            "gain": 6.0,
                            "q": 1.0,
                            "defaultType": "Peak",
                            "defaultFreq": 666,
                            "defaultGain": 6.0,
                            "defaultQ": 1.0
                        },
                        {
                            "index": 2,
                            "type": "LowPass",
                            "freq": 20000,
                            "gain": 0.0,
                            "q": 0.7,
                            "defaultType": "LowPass",
                            "defaultFreq": 20000,
                            "defaultGain": 0.0,
                            "defaultQ": 0.7
                        }
                    ],
                    "bypass": false,
                    "highPassTypeList": [
                        "HighPass"
                    ],
                    "typeList": [
                        "Peak",
                        "LowShelf",
                        "HighShelf"
                    ],
                    "lowPassTypeList": [
                        "LowPass"
                    ]
                }
            },
            "micBEq": {
                "eq": {
                    "point": [
                        {
                            "index": 0,
                            "type": "HighPass",
                            "freq": 20,
                            "gain": 0.0,
                            "q": 0.7,
                            "defaultType": "HighPass",
                            "defaultFreq": 20,
                            "defaultGain": 0.0,
                            "defaultQ": 0.7
                        },
                        {
                            "index": 1,
                            "type": "Peak",
                            "freq": 666,
                            "gain": 6.0,
                            "q": 1.0,
                            "defaultType": "Peak",
                            "defaultFreq": 666,
                            "defaultGain": 6.0,
                            "defaultQ": 1.0
                        },
                        {
                            "index": 2,
                            "type": "LowPass",
                            "freq": 20000,
                            "gain": 0.0,
                            "q": 0.7,
                            "defaultType": "LowPass",
                            "defaultFreq": 20000,
                            "defaultGain": 0.0,
                            "defaultQ": 0.7
                        }
                    ],
                    "bypass": false,
                    "highPassTypeList": [
                        "HighPass"
                    ],
                    "typeList": [
                        "Peak",
                        "LowShelf",
                        "HighShelf"
                    ],
                    "lowPassTypeList": [
                        "LowPass"
                    ]
                }
            },
            "micEqJointDebugging": false,
            "micAVolume": 75,
            "micBVolume": 75,
            "micFBX": 0,
            "bass": 0.0,
            "mid": 0.0,
            "midFreq": 1000,
            "treble": 0.0,
            "noise": {
                "gate": -50.0,
                "frameTime": 2000,
                "atkTime": 500,
                "relTime": 300
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false
            }
        },
        "reverb": {
            "eq": {
                "point": [
                    {
                        "index": 0,
                        "type": "HighPass",
                        "freq": 20,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "HighPass",
                        "defaultFreq": 20,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    },
                    {
                        "index": 1,
                        "type": "Peak",
                        "freq": 666,
                        "gain": 6.0,
                        "q": 1.0,
                        "defaultType": "Peak",
                        "defaultFreq": 666,
                        "defaultGain": 6.0,
                        "defaultQ": 1.0
                    },
                    {
                        "index": 2,
                        "type": "LowPass",
                        "freq": 20000,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "LowPass",
                        "defaultFreq": 20000,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    }
                ],
                "bypass": false,
                "highPassTypeList": [
                    "HighPass"
                ],
                "typeList": [
                    "Peak",
                    "LowShelf",
                    "HighShelf"
                ],
                "lowPassTypeList": [
                    "LowPass"
                ]
            },
            "reverbLevel": 100,
            "micDirectLevel": 100,
            "reverbPredelay": 20,
            "reverbDecay": 2625,
            "reverbLevelPhaseInversion":false,
            "micDirectLevelPhaseInversion":false
        },
        "echo": {
            "eq": {
                "point": [
                    {
                        "index": 0,
                        "type": "HighPass",
                        "freq": 20,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "HighPass",
                        "defaultFreq": 20,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    },
                    {
                        "index": 1,
                        "type": "Peak",
                        "freq": 666,
                        "gain": 6.0,
                        "q": 1.0,
                        "defaultType": "Peak",
                        "defaultFreq": 666,
                        "defaultGain": 6.0,
                        "defaultQ": 1.0
                    },
                    {
                        "index": 2,
                        "type": "LowPass",
                        "freq": 20000,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "LowPass",
                        "defaultFreq": 20000,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    }
                ],
                "bypass": false,
                "highPassTypeList": [
                    "HighPass"
                ],
                "typeList": [
                    "Peak",
                    "LowShelf",
                    "HighShelf"
                ],
                "lowPassTypeList": [
                    "LowPass"
                ]
            },
            "echoLevel": 100,
            "micDirectLevel": 100,
            "echoPredelay": 0,
            "echoDelayTime": 200,
            "echoRepeat": 60,
            "echoRightPredelay": 0,
            "echoRightDelay": 0,
            "echoLevelPhaseInversion": false,
            "micDirectLevelPhaseInversion": false
        },
        "mainOutput": {
            "eq": {
                "point": [
                    {
                        "index": 0,
                        "type": "HighPass",
                        "freq": 20,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "HighPass",
                        "defaultFreq": 20,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    },
                    {
                        "index": 1,
                        "type": "Peak",
                        "freq": 666,
                        "gain": 6.0,
                        "q": 1.0,
                        "defaultType": "Peak",
                        "defaultFreq": 666,
                        "defaultGain": 6.0,
                        "defaultQ": 1.0
                    },
                    {
                        "index": 2,
                        "type": "LowPass",
                        "freq": 20000,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "LowPass",
                        "defaultFreq": 20000,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    }
                ],
                "bypass": false,
                "highPassTypeList": [
                    "HighPass"
                ],
                "typeList": [
                    "Peak",
                    "LowShelf",
                    "HighShelf"
                ],
                "lowPassTypeList": [
                    "LowPass"
                ]
            },
            "output": {
                "leftChannelVolume": 0.0,
                "rightChannelVolume": 0.0,
                "leftDelay": 0.0,
                "rightDelay": 0.0,
                "leftMute": false,
                "rightMute": false,
                "leftChannelVolumePhaseInversion": false,
                "rightChannelVolumePhaseInversion": false
            },
            "mixer": {
                "micDirectLevel": 100,
                "musicLevel": 100,
                "reverbLevel": 100,
                "echoLevel": 100,
                "micDirectLevelPhaseInversion": false,
                "musicLevelPhaseInversion": false,
                "reverbLevelPhaseInversion": false,
                "echoLevelPhaseInversion": false
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false
            }
        },
        "subOutput": {
            "eq": {
                "point": [
                    {
                        "index": 0,
                        "type": "HighPass",
                        "freq": 20,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "HighPass",
                        "defaultFreq": 20,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    },
                    {
                        "index": 1,
                        "type": "Peak",
                        "freq": 666,
                        "gain": 6.0,
                        "q": 1.0,
                        "defaultType": "Peak",
                        "defaultFreq": 666,
                        "defaultGain": 6.0,
                        "defaultQ": 1.0
                    },
                    {
                        "index": 2,
                        "type": "LowPass",
                        "freq": 20000,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "LowPass",
                        "defaultFreq": 20000,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    }
                ],
                "bypass": false,
                "highPassTypeList": [
                    "HighPass"
                ],
                "typeList": [
                    "Peak",
                    "LowShelf",
                    "HighShelf"
                ],
                "lowPassTypeList": [
                    "LowPass"
                ]
            },
            "output": {
                "volume": 0.0,
                "delay": 0.0,
                "mute": false,
                "volumePhaseInversion":false
            },
            "mixer": {
                "micDirectLevel": 100,
                "musicLevel": 100,
                "reverbLevel": 100,
                "echoLevel": 100,
                "micDirectLevelPhaseInversion": false,
                "musicLevelPhaseInversion": false,
                "reverbLevelPhaseInversion": false,
                "echoLevelPhaseInversion": false
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false
            }
        },
        "center": {
            "eq": {
                "point": [
                    {
                        "index": 0,
                        "type": "HighPass",
                        "freq": 20,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "HighPass",
                        "defaultFreq": 20,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    },
                    {
                        "index": 1,
                        "type": "Peak",
                        "freq": 666,
                        "gain": 6.0,
                        "q": 1.0,
                        "defaultType": "Peak",
                        "defaultFreq": 666,
                        "defaultGain": 6.0,
                        "defaultQ": 1.0
                    },
                    {
                        "index": 2,
                        "type": "LowPass",
                        "freq": 20000,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "LowPass",
                        "defaultFreq": 20000,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    }
                ],
                "bypass": false,
                "highPassTypeList": [
                    "HighPass"
                ],
                "typeList": [
                    "Peak",
                    "LowShelf",
                    "HighShelf"
                ],
                "lowPassTypeList": [
                    "LowPass"
                ]
            },
            "output": {
                "volume": 0.0,
                "delay": 0.0,
                "mute": false,
                "volumePhaseInversion":false
            },
            "mixer": {
                "micDirectLevel": 100,
                "musicLevel": 100,
                "reverbLevel": 100,
                "echoLevel": 100,
                "micDirectLevelPhaseInversion": false,
                "musicLevelPhaseInversion": false,
                "reverbLevelPhaseInversion": false,
                "echoLevelPhaseInversion": false
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false
            }
        },
        "surround": {
            "eq": {
                "point": [
                    {
                        "index": 0,
                        "type": "HighPass",
                        "freq": 20,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "HighPass",
                        "defaultFreq": 20,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    },
                    {
                        "index": 1,
                        "type": "Peak",
                        "freq": 666,
                        "gain": 6.0,
                        "q": 1.0,
                        "defaultType": "Peak",
                        "defaultFreq": 666,
                        "defaultGain": 6.0,
                        "defaultQ": 1.0
                    },
                    {
                        "index": 2,
                        "type": "LowPass",
                        "freq": 20000,
                        "gain": 0.0,
                        "q": 0.7,
                        "defaultType": "LowPass",
                        "defaultFreq": 20000,
                        "defaultGain": 0.0,
                        "defaultQ": 0.7
                    }
                ],
                "bypass": false,
                "highPassTypeList": [
                    "HighPass"
                ],
                "typeList": [
                    "Peak",
                    "LowShelf",
                    "HighShelf"
                ],
                "lowPassTypeList": [
                    "LowPass"
                ]
            },
            "output": {
                "leftChannelVolume": 0.0,
                "rightChannelVolume": 0.0,
                "leftDelay": 0.0,
                "rightDelay": 0.0,
                "leftMute": false,
                "rightMute": false,
                "leftChannelVolumePhaseInversion": false,
                "rightChannelVolumePhaseInversion": false
            },
            "mixer": {
                "micDirectLevel": 100,
                "musicLevel": 100,
                "reverbLevel": 100,
                "echoLevel": 100,
                "micDirectLevelPhaseInversion": false,
                "musicLevelPhaseInversion": false,
                "reverbLevelPhaseInversion": false,
                "echoLevelPhaseInversion": false
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false
            }
        }
    }
}

```

### 5.3 设置 EQ 参数（SetEq）0x0002

#### 5.3.1 SetEqRequest（上位机→设备，msg_id=SetEq 0x0002，RESPONSE=0）

payload：protobuf `webhmi.SetEqRequest`

#### 5.3.2 SetEqReport（设备→上位机，msg_id=SetEq 0x0002，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetEqRequest`

### 5.4 设置系统参数（SetSystem）0x0003

#### 5.4.1 SetSystemRequest（上位机→设备，msg_id=SetSystem 0x0003，RESPONSE=1）

payload：protobuf `webhmi.SetSystemRequest`

#### 5.4.2 SetSystemResponse（设备→上位机，msg_id=SetSystem 0x0003，RESPONSE=1）

payload：protobuf `webhmi.SetSystemRequest`

#### 5.4.3 SetSystemReport（设备→上位机，msg_id=SetSystem 0x0003，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetSystemRequest`

### 5.5 设置 Music 参数（SetMusic）0x0004

#### 5.5.1 SetMusicRequest（上位机→设备，msg_id=SetMusic 0x0004，RESPONSE=0）

payload：protobuf `webhmi.SetMusicRequest`

#### 5.5.2 SetMusicReport（设备→上位机，msg_id=SetMusic 0x0004，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetMusicRequest`

### 5.6 设置 Mic 参数（SetMic）0x0005

#### 5.6.1 SetMicRequest（上位机→设备，msg_id=SetMic 0x0005，RESPONSE=0）

payload：protobuf `webhmi.SetMicRequest`

#### 5.6.2 SetMicReport（设备→上位机，msg_id=SetMic 0x0005，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetMicRequest`

### 5.7 设置 Reverb 参数（SetReverb）0x0006

#### 5.7.1 SetReverbRequest（上位机→设备，msg_id=SetReverb 0x0006，RESPONSE=0）

payload：protobuf `webhmi.SetReverbRequest`

#### 5.7.2 SetReverbReport（设备→上位机，msg_id=SetReverb 0x0006，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetReverbRequest`

### 5.8 设置 Echo 参数（SetEcho）0x0007

#### 5.8.1 SetEchoRequest（上位机→设备，msg_id=SetEcho 0x0007，RESPONSE=0）

payload：protobuf `webhmi.SetEchoRequest`

#### 5.8.2 SetEchoReport（设备→上位机，msg_id=SetEcho 0x0007，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetEchoRequest`

### 5.9 设置 MainOutput 参数（SetMainOutput）0x0008

#### 5.9.1 SetMainOutputRequest（上位机→设备，msg_id=SetMainOutput 0x0008，RESPONSE=0）

payload：protobuf `webhmi.SetMainOutputRequest`

#### 5.9.2 SetMainOutputReport（设备→上位机，msg_id=SetMainOutput 0x0008，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetMainOutputRequest`

### 5.10 设置 SubOutput 参数（SetSubOutput）0x0009

#### 5.10.1 SetSubOutputRequest（上位机→设备，msg_id=SetSubOutput 0x0009，RESPONSE=0）

payload：protobuf `webhmi.SetSubOutputRequest`

#### 5.10.2 SetSubOutputReport（设备→上位机，msg_id=SetSubOutput 0x0009，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetSubOutputRequest`

### 5.11 设置 SubCenter 参数（SetCenter）0x000a

#### 5.11.1 SetCenterRequest（上位机→设备，msg_id=SetSubOutput 0x000a，RESPONSE=0）

payload：protobuf `webhmi.SetCenterRequest`

#### 5.11.2 SetCenterReport（设备→上位机，msg_id=SetCenter 0x000a，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetCenterRequest`

### 5.12 设置 Surround 参数（SetSurround）0x000b

#### 5.12.1 SetSurroundRequest（上位机→设备，msg_id=SetSurround 0x000b，RESPONSE=0）

payload：protobuf `webhmi.SetSurroundRequest`

#### 5.12.2 SetSurroundReport（设备→上位机，msg_id=SetSurround 0x000b，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetSurroundRequest`

### 5.13 切换当前模式（SwitchCurrentMode）0x000c

#### 5.13.1 SwitchCurrentModeRequest（上位机→设备，msg_id=SwitchCurrentMode 0x000c，RESPONSE=1）

payload：protobuf `webhmi.SwitchCurrentModeRequest`

#### 5.13.2 SwitchCurrentModeResponse（设备→上位机，msg_id=SwitchCurrentMode 0x000c，RESPONSE=1）

payload：protobuf `webhmi.SwitchCurrentModeResponse`

### 5.14 保存参数（SaveMode）0x000d

#### 5.14.1 SaveModeRequest（上位机→设备，msg_id=SaveMode 0x000d，RESPONSE=0）

payload：protobuf `webhmi.SaveModeRequest`

### 5.15 重置EQ参数（ResetEq）0x000e

#### 5.15.1 ResetEqRequest（上位机→设备，msg_id=ResetEq 0x000e，RESPONSE=0）

payload：protobuf `webhmi.ResetEqRequest`
