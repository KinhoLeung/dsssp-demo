# Web上位机与固件的通信协议

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
* v1 初期固定填：`7`
* 用途：

  * 将来需要扩展 header 时（比如加密参数、分片参数），可以把 `hdr_len` 变大，并把扩展字段放进 `ext...`
  * 老版本解析器如果不认识 ext，可以直接 **跳过 ext** ，仍能读 payload（兼容）

msg_id（2 bytes）

* 消息/方法 ID（类似 RPC 的方法号）
* 用途：

  * 告诉上层业务：这条 payload 对应哪个“请求/响应/事件”的类型
  * 建议： **请求和响应使用同一个 msg_id** ，用 `flags.RESPONSE` 区分方向
* 例：

  * `0x0000` = Auth
  * `0x0001` = getCapabilities

> 注：msg_id 的具体分配由业务协议另行定义。

flags（1 bytes）

用于描述帧的“处理方式/语义开关”（布尔性质），bit 位定义如下：

* bit0 `RESPONSE`：0=请求，1=响应
* bit1 `EVENT`：1=设备主动上报（不对应某个请求）
* bit2 `FORMAT`：编码格式
* 其它：保留

> v1 初期最低实现：至少要支持 `RESPONSE`、`EVENT`、`FORMAT` 这三个位的解析（即使业务层暂时不用）。

len（2 bytes）

* payload 字节长度，范围：0~65535
* 用途：

  * 接收端在读到 header 后，就知道需要再收多少 payload 字节才能组成完整帧
  * 解决 BLE/HID 的分片问题（多次 notify/report 拼成一条消息）

ext（N bytes）

* 长度：`hdr_len - 7`
* v1 初期：不用，长度为 0
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

payload（len bytes）

* 业务数据
* 推荐内容：protobuf 编码结果（也可以先用 TLV/自定义结构过渡）
* 解码方式由业务层根据 `msg_id + flags` 决定

crc16（2 bytes）

* 用途：应用层完整性校验，防止分片拼包缺字节/错字节导致 payload 解码崩坏
* 推荐算法：**CRC16-CCITT-FALSE**

  * poly=0x1021, init=0xFFFF, refin=false, refout=false, xorout=0x0000
* 覆盖范围：从 `ver` 开始，到 `payload` 结束

  即 CRC 输入为：`ver | hdr_len | msg_id | flags | len | ext... | payload`

  **不含 magic，不含 crc16 本身**

## 4 magic 定义

控制字可供使用的有65,536个（0x0000—0xFFFF），可根据实际应用需求进行扩充，具体定义见下表：

| magic  | 含义              | 说明                         |
| ------ | ----------------- | ---------------------------- |
| 0x0000 | Auth              | 认证设备，禁止第三方设备接入 |
| 0x0001 | getCapabilities   | 发现能力，获取设备支持的功能 |
| 0x0002 | getCommonPara     |                              |
| 0x0003 | getMusicPara      |                              |
| 0x0004 | getReverbPara     |                              |
| 0x0005 | getEchoPara       |                              |
| 0x0006 | getMainOutputPara |                              |
| 0x0007 | getCenterPara     |                              |
| 0x0008 | getSubOutputPara  |                              |
| 0x0009 | getSurroundPara   |                              |
|        |                   |                              |
|        |                   |                              |
|        |                   |                              |
|        |                   |                              |
|        |                   |                              |
|        |                   |                              |
|        |                   |                              |

## 5 payload 格式

## 5 认证（Auth）业务 payload

> Auth 的数据结构属于 **payload 层**（业务层）；外层仍然使用第 3 章定义的 framing 数据帧承载与分包。

### 5.1 AuthChallenge（上位机→设备，msg_id=Auth）

payload：

| nonce    |
| -------- |
| 32 bytes |

### 5.2 AuthResponse（设备→上位机，msg_id=Auth，RESPONSE=1）

payload：

| sig_len | signature | info_len | info(TLV...)   |
| ------- | --------- | -------- | -------------- |
| 1 byte  | 64 bytes  | 1 byte   | info_len bytes |

说明：

- `sig_len`：当前固定为 `64`（ECDSA P-256 raw `r||s`）
- `signature`：raw `r||s`（64 bytes）
- `info_len`：后续 `info` TLV 字节数
- `info`：TLV 串（可选字段集合）

签名消息：

- `message = nonce || info_len || info`
- `signature = ECDSA P-256 over SHA-256(message)`（在 WebCrypto 中用 `ECDSA(SHA-256)` 验签）

### 5.3 TLV 编码与类型定义

TLV 格式为重复的：

- `T`（1 byte，字段类型/编号）
- `L`（1 byte，Value 的长度）
- `V`（L bytes，字段值）

注意：`0x10`、`0x01` 这些是 **T（类型号）**，不是长度；长度在紧随其后的 `L` 字节里。

已定义的 `T`：

- `0x10`：`device_id`，`V` 为 8 字节原始 bytes（通常来源于设备 MAC 派生）
- `0x01`：`firmwareVersion`，`V` 为 UTF-8 字符串（如 `"0.1.0"`）
