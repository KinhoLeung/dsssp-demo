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

* bit0 `RESPONSE`（ACK）：是否需要回应/是否为回应
* bit1 `EVENT`：1=设备主动上报
* bit2 `ENCRYPTED`：1=Payload 已被 AES-128-CTR 加密
* 其它：保留

> 启用 `ENCRYPTED` 后，`payload` 字段承载的是密文。`len` 表示密文长度（AES-CTR 模式下密文长度=明文长度）。

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
* `0x81`：`iv_sync`，`L=4`，`V=u32 little-endian`。**当 ENCRYPTED=1 时必须存在**。携带本次加密使用的帧计数器（Frame Counter, 32-bit）。

payload（len bytes）

* 业务数据
* 编码格式：protobuf 编码（加密开启时为 protobuf 的密文）

crc16（2 bytes）

* 用途：应用层完整性校验，防止分片拼包缺字节/错字节导致 payload 解码崩坏
* 推荐算法：**CRC16-CCITT-FALSE**

  * poly=0x1021, init=0xFFFF, refin=false, refout=false, xorout=0x0000
* 覆盖范围：从 `ver` 开始，到 `payload` 结束

  即 CRC 输入为：`ver | hdr_len | msg_id | flags | len | ext... | payload`

  **不含 magic，不含 crc16 本身，当 ENCRYPTED=1 时计算的是密文的 CRC**

## 4 msg_id 定义

控制字可供使用的有65,536个（0x0000—0xFFFF），可根据实际应用需求进行扩充，具体定义见下表：

| msg_id | 含义              | 说明                          |
| ------ | ----------------- | ----------------------------- |
| 0x0000 | Auth              | 认证设备 + 密钥协商 (ECDH)    |
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

## 5 安全机制与交互流程

### 5.1 安全传输约定 (Security Contract)

#### 5.1.1 密钥派生

双发通过 ECDH 算出 Shared Secret (32 bytes) 后，按如下方式派生会话参数：

* **MasterSecret** = SharedSecret (32 bytes)
* **KeyBlock** = SHA256(MasterSecret) (32 bytes)
* **SessionKey** = KeyBlock[0...15] (16 bytes, for AES-128)
* **SessionBaseIV** = KeyBlock[16...27] (12 bytes)

#### 5.1.2 加密算法

* **算法**：AES-128-CTR (TinyCrypt: `tc_ctr_mode`)
* **IV 构造** (16 bytes)：
  `SessionBaseIV (12B) || FrameCounter (4B Big-Endian)`
  * 每次加密一个新的 Frame，使用一个新的 `FrameCounter`。
  * `FrameCounter` 必须放在 `ext` (0x81) 字段中明文传输。
* **Counter 空间划分 (重要)**：
  为了防止双向通信使用相同的 Key 和 IV 导致密钥流重用 (Keystream Reuse)，双方必须使用互不重叠的 Counter 空间：
  * **上位机发送 (Client Tx)**：初始值 `0x00000000`，范围 `0 ~ 0x7FFFFFFF` (最高位为0)。
  * **设备发送 (Device Tx)**：初始值 `0x80000000`，范围 `0x80000000 ~ 0xFFFFFFFF` (最高位为1)。
* **Anti-Replay (防重放)**：
  * 接收端维护 `LastRxCounter`。
  * 收到新包时，必须满足 `FrameCounter > LastRxCounter` 且 `FrameCounter` 位于对方的合法区间内。
  * 若不满足（乱序或重放），丢弃该包。
  * 握手重新连接时，Counter 重置为各自的初始值。

### 5.2 握手与密钥协商 (Handshake)

连接建立后，必须首先执行 **Auth (0x0000)** 指令。

1. **Client Hello**:

   * 上位机生成临时密钥 `(ClientPriv, ClientPub)`。
   * 发送 `Auth Request`，Payload = `ClientPub`。
   * 状态：**明文**
2. **Server Hello & Sign**:

   * 固件接收 `ClientPub`。
   * 固件生成临时密钥 `(DevicePriv, DevicePub)`。
   * 计算 `SharedSecret = ECDH(DevicePriv, ClientPub)`。
   * 派生密钥 `KeyBlock = SHA256(SharedSecret)` -> `SessionKey`, `SessionIV`。
   * 签名 `Sig = ECDSA(IdentityPriv, ClientPub || DevicePub)`。
   * 发送 `Auth Response`，Payload = `DevicePub + Sig`。
   * **Action**: 固件端**立即**初始化 AES-CTR 状态（Tx/Rx Counter = SessionIV），后续收发均加密。
3. **Client Finish**:

   * 上位机接收 `DevicePub` 和 `Sig`。
   * 验签 `Verify(RootPubKey, Sig, ClientPub || DevicePub)`。
   * 计算 `SharedSecret = ECDH(ClientPriv, DevicePub)`。
   * 派生密钥 `KeyBlock = SHA256(SharedSecret)` -> `SessionKey`, `SessionIV`。
   * **Action**: 上位机初始化 AES-CTR 状态，握手已完成。

### 5.3 加密通信 (Secure Transport)

握手完成后，后续所有指令（如 `GetDb`, `SetSystem` 等）均应开启加密。

1. **发送方**:

   * 准备明文 Payload。
   * `Cipher = AES-CTR(Key, TxCtr, Payload)`。
   * `TxCtr` 增加对应 Block 数。
   * 组帧发送，Header 中设置 `ENCRYPTED=1`。
2. **接收方**:

   * 收到帧，发现 `ENCRYPTED=1`。
   * `Plain = AES-CTR(Key, RxCtr, Cipher)`。
   * `RxCtr` 增加对应 Block 数。
   * 解析 Plain 为 Protobuf 数据并执行。

### 5.4 异常处理与鲁棒性

得益于显式帧计数器（Explicit Frame Counter），通信链路对丢包和乱序具有天然的鲁棒性。

* **丢包 (Packet Loss)**：若发生丢包，接收端仅丢失对应的数据帧。后续到达的帧由于携带了正确的 Counter，依然能被正确解密和处理。**不会导致通信中断或乱码。**
* **乱序与重放 (Reorder & Replay)**：接收端会检查 `FrameCounter > LastRxCounter`。若收到旧包（乱序到达或恶意重放），协议栈将直接**丢弃**该帧，不影响会话状态。
* **数据损坏 (CRC Error)**：若 CRC校验失败，说明数据在传输中受损。策略为**静默丢弃**当前帧，等待上位机重试（如有超时机制）。
* **仅在以下严重情况断开连接**：
  * Auth 握手失败（签名无效）。
  * 收到无法解析的指令序列导致设备状态机异常。

## 6 payload 格式

### 6.1 认证（Auth） 0x0000

> Auth 的数据结构属于 **payload 层**（业务层）；外层仍然使用第 3 章定义的 framing 数据帧承载与分包。
> **Auth 过程必须明文传输 (old flags ENCRYPTED=0)**。

#### 6.1.1 AuthChallenge（上位机→设备，msg_id=Auth，RESPONSE=1）

payload：

| client_pub_key (P-256 Raw Key X\|\|Y) |
| ------------------------------------- |
| 64 bytes                              |

* 上位机生成一对临时的 ECDH P-256 密钥对。
* Payload 为上位机的公钥（不含 0x04 前缀，直接 X(32B) \|\| Y(32B)）。

#### 6.1.2 AuthResponse（设备→上位机，msg_id=Auth，RESPONSE=1）

payload：

| device_pub_key | signature |
| -------------- | --------- |
| 64 bytes       | 64 bytes  |

说明：

* `device_pub_key`: 设备生成的临时 ECDH 公钥（X\|\|Y）。
* `signature`: 设备使用**身份私钥**对 `(client_pub_key || device_pub_key)` 进行的 ECDSA 签名（r\|\|s）。
* **收到此帧后，上位机应立即验证签名并计算共享密钥。**

### 6.2 获取数据库（GetDb） 0x0001

#### 6.2.1 GetDbRequest（上位机→设备，msg_id=GetDb，RESPONSE=1）

payload 使用 protobuf 编码，对应 `webhmi.GetDbRequest`（定义见 `webhmi.proto`），其中 `section` 字段用于请求特定分包模块数据以实现流式获取。

#### 6.2.2 GetDbResponse（设备→上位机，msg_id=GetDb，RESPONSE=1）

分包模块数据库数据：payload 使用 protobuf 编码，对应 `webhmi.GetDbResponse`（定义见 `webhmi.proto`）。`GetDbResponse` 使用 `oneof payload`，设备端每次响应只填充一个与 `section` 对应的模块字段，不返回完整 `DeviceDb`。

`section` 与 `payload` 字段对应关系：

| section | payload 字段 |
| ------- | ------------ |
| `SEC_SYSTEM` | `system` |
| `SEC_MUSIC` | `music` |
| `SEC_MIC` | `mic` |
| `SEC_REVERB` | `reverb` |
| `SEC_ECHO` | `echo` |
| `SEC_MAIN_OUTPUT` | `mainOutput` |
| `SEC_SUB_OUTPUT` | `subOutput` |
| `SEC_CENTER` | `center` |
| `SEC_SURROUND` | `surround` |

示例：请求 `SEC_MUSIC` 时，设备端响应的逻辑结构如下（实际传输为 protobuf）：

```json
{
    "deviceId": "device demo",
    "firmwareVersion": "1.0.0",
    "section": "SEC_MUSIC",
    "music": {
        "eq": {},
        "inputGain": 0,
        "btGain": 0,
        "udiskGain": 0
    }
}
```

设备端实现时应避免在栈上声明完整 `DeviceConfig` 或完整 `DeviceDb` 作为 `GetDbResponse` 的工作缓冲；`GetDbResponse` 只需要承载当前 section 的 oneof payload。

#### 6.2.3 数据库结构

下面 JSON 仅用于说明完整数据库字段含义/结构示例。它对应 Web 上位机导入/导出 `.webhmi` 配置文件时使用的 protobuf `webhmi.DeviceConfig`，不是设备端单次 `GetDbResponse` 的通信格式。

范围/步进字段采用 `minXxx` / `maxXxx` / `stepXxx` 命名，由设备端随对应 section 的 `GetDbResponse.payload` 下发，用于约束 Web 上位机控件。上位机在 Set* 请求中只提交实际参数值，不提交这些 UI 元数据。

全局输出模式由 `SystemDb.controlMode` 和 `SystemDb.sceneMode` 表示：`controlMode` 可取 `OUTPUT_CONTROL_AUTO` / `OUTPUT_CONTROL_MANUAL`，`sceneMode` 可取 `OUTPUT_SCENE_SING` / `OUTPUT_SCENE_DANCE`。默认值为 `OUTPUT_CONTROL_MANUAL` 和 `OUTPUT_SCENE_SING`。当 `controlMode` 为 `OUTPUT_CONTROL_AUTO` 时，上位机应禁止用户直接调整主输出、超低音输出、中置输出、环绕输出的 EQ 与 Mixer 参数。

```json
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
            "effectVolume": 60,
            "minMusicMaxVolume": 0,
            "maxMusicMaxVolume": 80,
            "stepMusicMaxVolume": 1,
            "minMicMaxVolume": 0,
            "maxMicMaxVolume": 80,
            "stepMicMaxVolume": 1,
            "minEffectMaxVolume": 0,
            "maxEffectMaxVolume": 80,
            "stepEffectMaxVolume": 1,
            "minMusicDefaultVolume": 0,
            "maxMusicDefaultVolume": 80,
            "stepMusicDefaultVolume": 1,
            "minMicDefaultVolume": 0,
            "maxMicDefaultVolume": 80,
            "stepMicDefaultVolume": 1,
            "minEffectDefaultVolume": 0,
            "maxEffectDefaultVolume": 80,
            "stepEffectDefaultVolume": 1,
            "minMusicVolume": 0,
            "maxMusicVolume": 80,
            "stepMusicVolume": 1,
            "minMicVolume": 0,
            "maxMicVolume": 80,
            "stepMicVolume": 1,
            "minEffectVolume": 0,
            "maxEffectVolume": 80,
            "stepEffectVolume": 1,
            "controlMode": "OUTPUT_CONTROL_MANUAL",
            "sceneMode": "OUTPUT_SCENE_SING"
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
                ],
                "minFreq": 20,
                "maxFreq": 20000,
                "stepFreq": 1,
                "minGain": -18.0,
                "maxGain": 12.0,
                "stepGain": 0.1,
                "minQ": 0.1,
                "maxQ": 25.0,
                "stepQ": 0.1
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
                "relTime": 300,
                "minGate": -90.0,
                "maxGate": -50.0,
                "stepGate": 0.1,
                "minFrameTime": 1,
                "maxFrameTime": 5000,
                "stepFrameTime": 1,
                "minAtkTime": 1,
                "maxAtkTime": 3000,
                "stepAtkTime": 1,
                "minRelTime": 1,
                "maxRelTime": 3000,
                "stepRelTime": 1
            },
            "inputSelectList":[
                "BT",
                "UDISK",
                "SPDIF",
                "USB",
                "AUX1",
                "AUX2"
            ],
            "minInputGain": -10,
            "maxInputGain": 0,
            "stepInputGain": 1,
            "minBtGain": -10,
            "maxBtGain": 0,
            "stepBtGain": 1,
            "minUdiskGain": -10,
            "maxUdiskGain": 0,
            "stepUdiskGain": 1,
            "minMusicPitch": -12.5,
            "maxMusicPitch": 12.5,
            "stepMusicPitch": 0.1,
            "minBass": -12.0,
            "maxBass": 12.0,
            "stepBass": 0.1,
            "minMid": -12.0,
            "maxMid": 12.0,
            "stepMid": 0.1,
            "minMidFreq": 20,
            "maxMidFreq": 20000,
            "stepMidFreq": 1,
            "minTreble": -12.0,
            "maxTreble": 12.0,
            "stepTreble": 0.1
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
                    ],
                    "minFreq": 20,
                    "maxFreq": 20000,
                    "stepFreq": 1,
                    "minGain": -18.0,
                    "maxGain": 12.0,
                    "stepGain": 0.1,
                    "minQ": 0.1,
                    "maxQ": 25.0,
                    "stepQ": 0.1
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
                    ],
                    "minFreq": 20,
                    "maxFreq": 20000,
                    "stepFreq": 1,
                    "minGain": -18.0,
                    "maxGain": 12.0,
                    "stepGain": 0.1,
                    "minQ": 0.1,
                    "maxQ": 25.0,
                    "stepQ": 0.1
                }
            },
            "micEqJointDebugging": false,
            "micAVolume": 75,
            "micBVolume": 75,
            "micFBX": "Off",
            "bass": 0.0,
            "mid": 0.0,
            "midFreq": 1000,
            "treble": 0.0,
            "noise": {
                "gate": -50.0,
                "frameTime": 2000,
                "atkTime": 500,
                "relTime": 300,
                "minGate": -90.0,
                "maxGate": -50.0,
                "stepGate": 0.1,
                "minFrameTime": 1,
                "maxFrameTime": 5000,
                "stepFrameTime": 1,
                "minAtkTime": 1,
                "maxAtkTime": 3000,
                "stepAtkTime": 1,
                "minRelTime": 1,
                "maxRelTime": 3000,
                "stepRelTime": 1
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false,
                "minThreshold": -60,
                "maxThreshold": 0,
                "stepThreshold": 0.1,
                "minRatio": 2,
                "maxRatio": 100,
                "stepRatio": 1,
                "minAttack": 0,
                "maxAttack": 500,
                "stepAttack": 1,
                "minRelease": 50,
                "maxRelease": 3000,
                "stepRelease": 1
            },
            "fbxModeList":[
                "Off",
                "Level1",
                "Level2",
                "Level3",
                "Level4",
                "Level5",
                "Level6"
            ],
            "minMicAVolume": 0,
            "maxMicAVolume": 100,
            "stepMicAVolume": 1,
            "minMicBVolume": 0,
            "maxMicBVolume": 100,
            "stepMicBVolume": 1,
            "minBass": -12.0,
            "maxBass": 12.0,
            "stepBass": 0.1,
            "minMid": -12.0,
            "maxMid": 12.0,
            "stepMid": 0.1,
            "minMidFreq": 20,
            "maxMidFreq": 20000,
            "stepMidFreq": 1,
            "minTreble": -12.0,
            "maxTreble": 12.0,
            "stepTreble": 0.1
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
                ],
                "minFreq": 20,
                "maxFreq": 20000,
                "stepFreq": 1,
                "minGain": -18.0,
                "maxGain": 12.0,
                "stepGain": 0.1,
                "minQ": 0.1,
                "maxQ": 25.0,
                "stepQ": 0.1
            },
            "reverbLevel": 100,
            "micDirectLevel": 100,
            "reverbPredelay": 20,
            "reverbDecay": 2625,
            "reverbLevelPhaseInversion":false,
            "micDirectLevelPhaseInversion":false,
            "minReverbLevel": 0,
            "maxReverbLevel": 100,
            "stepReverbLevel": 1,
            "minMicDirectLevel": 0,
            "maxMicDirectLevel": 100,
            "stepMicDirectLevel": 1,
            "minReverbPredelay": 0,
            "maxReverbPredelay": 200,
            "stepReverbPredelay": 1,
            "minReverbDecay": 0,
            "maxReverbDecay": 5000,
            "stepReverbDecay": 1
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
                ],
                "minFreq": 20,
                "maxFreq": 20000,
                "stepFreq": 1,
                "minGain": -18.0,
                "maxGain": 12.0,
                "stepGain": 0.1,
                "minQ": 0.1,
                "maxQ": 25.0,
                "stepQ": 0.1
            },
            "echoLevel": 100,
            "micDirectLevel": 100,
            "echoPredelay": 0,
            "echoDelayTime": 200,
            "echoRepeat": 60,
            "echoRightPredelay": 0,
            "echoRightDelay": 0,
            "echoLevelPhaseInversion": false,
            "micDirectLevelPhaseInversion": false,
            "minEchoLevel": 0,
            "maxEchoLevel": 100,
            "stepEchoLevel": 1,
            "minMicDirectLevel": 0,
            "maxMicDirectLevel": 100,
            "stepMicDirectLevel": 1,
            "minEchoPredelay": 0,
            "maxEchoPredelay": 250,
            "stepEchoPredelay": 1,
            "minEchoDelayTime": 0,
            "maxEchoDelayTime": 500,
            "stepEchoDelayTime": 1,
            "minEchoRepeat": 0,
            "maxEchoRepeat": 90,
            "stepEchoRepeat": 1,
            "minEchoRightPredelay": 0,
            "maxEchoRightPredelay": 50,
            "stepEchoRightPredelay": 1,
            "minEchoRightDelay": -50,
            "maxEchoRightDelay": 50,
            "stepEchoRightDelay": 1
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
                ],
                "minFreq": 20,
                "maxFreq": 20000,
                "stepFreq": 1,
                "minGain": -18.0,
                "maxGain": 12.0,
                "stepGain": 0.1,
                "minQ": 0.1,
                "maxQ": 25.0,
                "stepQ": 0.1
            },
            "output": {
                "leftChannelVolume": 0.0,
                "rightChannelVolume": 0.0,
                "leftDelay": 0.0,
                "rightDelay": 0.0,
                "leftMute": false,
                "rightMute": false,
                "leftChannelVolumePhaseInversion": false,
                "rightChannelVolumePhaseInversion": false,
                "minLeftChannelVolume": -70.0,
                "maxLeftChannelVolume": 12.0,
                "stepLeftChannelVolume": 0.1,
                "minRightChannelVolume": -70.0,
                "maxRightChannelVolume": 12.0,
                "stepRightChannelVolume": 0.1,
                "minLeftDelay": 0.0,
                "maxLeftDelay": 50.0,
                "stepLeftDelay": 0.1,
                "minRightDelay": 0.0,
                "maxRightDelay": 50.0,
                "stepRightDelay": 0.1
            },
            "mixer": {
                "micDirectLevel": 100,
                "musicLevel": 100,
                "reverbLevel": 100,
                "echoLevel": 100,
                "micDirectLevelPhaseInversion": false,
                "musicLevelPhaseInversion": false,
                "reverbLevelPhaseInversion": false,
                "echoLevelPhaseInversion": false,
                "minMicDirectLevel": 0,
                "maxMicDirectLevel": 100,
                "stepMicDirectLevel": 1,
                "minMusicLevel": 0,
                "maxMusicLevel": 100,
                "stepMusicLevel": 1,
                "minReverbLevel": 0,
                "maxReverbLevel": 100,
                "stepReverbLevel": 1,
                "minEchoLevel": 0,
                "maxEchoLevel": 100,
                "stepEchoLevel": 1
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false,
                "minThreshold": -60,
                "maxThreshold": 0,
                "stepThreshold": 0.1,
                "minRatio": 2,
                "maxRatio": 100,
                "stepRatio": 1,
                "minAttack": 0,
                "maxAttack": 500,
                "stepAttack": 1,
                "minRelease": 50,
                "maxRelease": 3000,
                "stepRelease": 1
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
                ],
                "minFreq": 20,
                "maxFreq": 20000,
                "stepFreq": 1,
                "minGain": -18.0,
                "maxGain": 12.0,
                "stepGain": 0.1,
                "minQ": 0.1,
                "maxQ": 25.0,
                "stepQ": 0.1
            },
            "output": {
                "volume": 0.0,
                "delay": 0.0,
                "mute": false,
                "volumePhaseInversion":false,
                "minVolume": -70.0,
                "maxVolume": 24.0,
                "stepVolume": 0.1,
                "minDelay": 0.0,
                "maxDelay": 50.0,
                "stepDelay": 0.1
            },
            "mixer": {
                "micDirectLevel": 100,
                "musicLevel": 100,
                "reverbLevel": 100,
                "echoLevel": 100,
                "micDirectLevelPhaseInversion": false,
                "musicLevelPhaseInversion": false,
                "reverbLevelPhaseInversion": false,
                "echoLevelPhaseInversion": false,
                "minMicDirectLevel": 0,
                "maxMicDirectLevel": 100,
                "stepMicDirectLevel": 1,
                "minMusicLevel": 0,
                "maxMusicLevel": 100,
                "stepMusicLevel": 1,
                "minReverbLevel": 0,
                "maxReverbLevel": 100,
                "stepReverbLevel": 1,
                "minEchoLevel": 0,
                "maxEchoLevel": 100,
                "stepEchoLevel": 1
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false,
                "minThreshold": -60,
                "maxThreshold": 0,
                "stepThreshold": 0.1,
                "minRatio": 2,
                "maxRatio": 100,
                "stepRatio": 1,
                "minAttack": 0,
                "maxAttack": 500,
                "stepAttack": 1,
                "minRelease": 50,
                "maxRelease": 3000,
                "stepRelease": 1
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
                ],
                "minFreq": 20,
                "maxFreq": 20000,
                "stepFreq": 1,
                "minGain": -18.0,
                "maxGain": 12.0,
                "stepGain": 0.1,
                "minQ": 0.1,
                "maxQ": 25.0,
                "stepQ": 0.1
            },
            "output": {
                "volume": 0.0,
                "delay": 0.0,
                "mute": false,
                "volumePhaseInversion":false,
                "minVolume": -70.0,
                "maxVolume": 12.0,
                "stepVolume": 0.1,
                "minDelay": 0.0,
                "maxDelay": 50.0,
                "stepDelay": 0.1
            },
            "mixer": {
                "micDirectLevel": 100,
                "musicLevel": 100,
                "reverbLevel": 100,
                "echoLevel": 100,
                "micDirectLevelPhaseInversion": false,
                "musicLevelPhaseInversion": false,
                "reverbLevelPhaseInversion": false,
                "echoLevelPhaseInversion": false,
                "minMicDirectLevel": 0,
                "maxMicDirectLevel": 100,
                "stepMicDirectLevel": 1,
                "minMusicLevel": 0,
                "maxMusicLevel": 100,
                "stepMusicLevel": 1,
                "minReverbLevel": 0,
                "maxReverbLevel": 100,
                "stepReverbLevel": 1,
                "minEchoLevel": 0,
                "maxEchoLevel": 100,
                "stepEchoLevel": 1
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false,
                "minThreshold": -60,
                "maxThreshold": 0,
                "stepThreshold": 0.1,
                "minRatio": 2,
                "maxRatio": 100,
                "stepRatio": 1,
                "minAttack": 0,
                "maxAttack": 500,
                "stepAttack": 1,
                "minRelease": 50,
                "maxRelease": 3000,
                "stepRelease": 1
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
                ],
                "minFreq": 20,
                "maxFreq": 20000,
                "stepFreq": 1,
                "minGain": -18.0,
                "maxGain": 12.0,
                "stepGain": 0.1,
                "minQ": 0.1,
                "maxQ": 25.0,
                "stepQ": 0.1
            },
            "output": {
                "leftChannelVolume": 0.0,
                "rightChannelVolume": 0.0,
                "leftDelay": 0.0,
                "rightDelay": 0.0,
                "leftMute": false,
                "rightMute": false,
                "leftChannelVolumePhaseInversion": false,
                "rightChannelVolumePhaseInversion": false,
                "minLeftChannelVolume": -70.0,
                "maxLeftChannelVolume": 12.0,
                "stepLeftChannelVolume": 0.1,
                "minRightChannelVolume": -70.0,
                "maxRightChannelVolume": 12.0,
                "stepRightChannelVolume": 0.1,
                "minLeftDelay": 0.0,
                "maxLeftDelay": 50.0,
                "stepLeftDelay": 0.1,
                "minRightDelay": 0.0,
                "maxRightDelay": 50.0,
                "stepRightDelay": 0.1
            },
            "mixer": {
                "micDirectLevel": 100,
                "musicLevel": 100,
                "reverbLevel": 100,
                "echoLevel": 100,
                "micDirectLevelPhaseInversion": false,
                "musicLevelPhaseInversion": false,
                "reverbLevelPhaseInversion": false,
                "echoLevelPhaseInversion": false,
                "minMicDirectLevel": 0,
                "maxMicDirectLevel": 100,
                "stepMicDirectLevel": 1,
                "minMusicLevel": 0,
                "maxMusicLevel": 100,
                "stepMusicLevel": 1,
                "minReverbLevel": 0,
                "maxReverbLevel": 100,
                "stepReverbLevel": 1,
                "minEchoLevel": 0,
                "maxEchoLevel": 100,
                "stepEchoLevel": 1
            },
            "compressor": {
                "threshold": -1.0,
                "ratio": 10,
                "attack": 50,
                "release": 200,
                "bypass": false,
                "minThreshold":-60,
                "maxThreshold":0,
                "stepThreshold": 0.1,
                "minRatio":2,
                "maxRatio":100,
                "stepRatio":1,
                "minAttack":0,
                "maxAttack":500,
                "stepAttack":1,
                "minRelease": 50,
                "maxRelease": 3000,
                "stepRelease": 1
            }
        }
    }
}
```

### 6.3 设置 EQ 参数（SetEq）0x0002

#### 6.3.1 SetEqRequest（上位机→设备，msg_id=SetEq 0x0002，RESPONSE=0）

payload：protobuf `webhmi.SetEqRequest`

#### 6.3.2 SetEqReport（设备→上位机，msg_id=SetEq 0x0002，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetEqRequest`

### 6.4 设置系统参数（SetSystem）0x0003

#### 6.4.1 SetSystemRequest（上位机→设备，msg_id=SetSystem 0x0003，RESPONSE=1）

payload：protobuf `webhmi.SetSystemRequest`

`SetSystemRequest.controlMode` 用于切换自动/手动输出控制模式，`SetSystemRequest.sceneMode` 用于切换唱歌/热舞场景模式。两者均为 patch 字段，只在需要变更时携带。

#### 6.4.2 SetSystemResponse（设备→上位机，msg_id=SetSystem 0x0003，RESPONSE=1）

payload：protobuf `webhmi.SetSystemRequest`

#### 6.4.3 SetSystemReport（设备→上位机，msg_id=SetSystem 0x0003，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetSystemRequest`

### 6.5 设置 Music 参数（SetMusic）0x0004

#### 6.5.1 SetMusicRequest（上位机→设备，msg_id=SetMusic 0x0004，RESPONSE=0）

payload：protobuf `webhmi.SetMusicRequest`

#### 6.5.2 SetMusicReport（设备→上位机，msg_id=SetMusic 0x0004，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetMusicRequest`

### 6.6 设置 Mic 参数（SetMic）0x0005

#### 6.6.1 SetMicRequest（上位机→设备，msg_id=SetMic 0x0005，RESPONSE=0）

payload：protobuf `webhmi.SetMicRequest`

#### 6.6.2 SetMicReport（设备→上位机，msg_id=SetMic 0x0005，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetMicRequest`

### 6.7 设置 Reverb 参数（SetReverb）0x0006

#### 6.7.1 SetReverbRequest（上位机→设备，msg_id=SetReverb 0x0006，RESPONSE=0）

payload：protobuf `webhmi.SetReverbRequest`

#### 6.7.2 SetReverbReport（设备→上位机，msg_id=SetReverb 0x0006，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetReverbRequest`

### 6.8 设置 Echo 参数（SetEcho）0x0007

#### 6.8.1 SetEchoRequest（上位机→设备，msg_id=SetEcho 0x0007，RESPONSE=0）

payload：protobuf `webhmi.SetEchoRequest`

#### 6.8.2 SetEchoReport（设备→上位机，msg_id=SetEcho 0x0007，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetEchoRequest`

### 6.9 设置 MainOutput 参数（SetMainOutput）0x0008

#### 6.9.1 SetMainOutputRequest（上位机→设备，msg_id=SetMainOutput 0x0008，RESPONSE=0）

payload：protobuf `webhmi.SetMainOutputRequest`

#### 6.9.2 SetMainOutputReport（设备→上位机，msg_id=SetMainOutput 0x0008，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetMainOutputRequest`

### 6.10 设置 SubOutput 参数（SetSubOutput）0x0009

#### 6.10.1 SetSubOutputRequest（上位机→设备，msg_id=SetSubOutput 0x0009，RESPONSE=0）

payload：protobuf `webhmi.SetSubOutputRequest`

#### 6.10.2 SetSubOutputReport（设备→上位机，msg_id=SetSubOutput 0x0009，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetSubOutputRequest`

### 6.11 设置 Center 参数（SetCenter）0x000a

#### 6.11.1 SetCenterRequest（上位机→设备，msg_id=SetCenter 0x000a，RESPONSE=0）

payload：protobuf `webhmi.SetCenterRequest`

#### 6.11.2 SetCenterReport（设备→上位机，msg_id=SetCenter 0x000a，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetCenterRequest`

### 6.12 设置 Surround 参数（SetSurround）0x000b

#### 6.12.1 SetSurroundRequest（上位机→设备，msg_id=SetSurround 0x000b，RESPONSE=0）

payload：protobuf `webhmi.SetSurroundRequest`

#### 6.12.2 SetSurroundReport（设备→上位机，msg_id=SetSurround 0x000b，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SetSurroundRequest`

### 6.13 切换当前模式（SwitchCurrentMode）0x000c

#### 6.13.1 SwitchCurrentModeRequest（上位机→设备，msg_id=SwitchCurrentMode 0x000c，RESPONSE=1）

payload：protobuf `webhmi.SwitchCurrentModeRequest`

#### 6.13.2 SwitchCurrentModeResponse（设备→上位机，msg_id=SwitchCurrentMode 0x000c，RESPONSE=1）

payload：protobuf `webhmi.SwitchCurrentModeResponse`

#### 6.13.3 SwitchCurrentModeReport（设备→上位机，msg_id=SwitchCurrentMode 0x000c，RESPONSE=0，EVENT=1）

payload：protobuf `webhmi.SwitchCurrentModeResponse`

### 6.14 保存模式（SaveMode）0x000d

#### 6.14.1 SaveModeRequest（上位机→设备，msg_id=SaveMode 0x000d，RESPONSE=0）

payload：protobuf `webhmi.SaveModeRequest`

### 6.15 重置EQ参数（ResetEq）0x000e

#### 6.15.1 ResetEqRequest（上位机→设备，msg_id=ResetEq 0x000e，RESPONSE=0）

payload：protobuf `webhmi.ResetEqRequest`
