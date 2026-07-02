# WebHMI WiFi / Cloud Relay Design Chat Export

Date: 2026-07-02

## 1. 增加 WiFi 连接方式

**User:**  
目前这个 web 上位机有 2 种连接设备的方式，分别是 webble 和 webhid，现在我想再增加一种：通过 wifi 去连接，有什么方案可以选择？

**Assistant:**  
当前项目已经有统一的 `Transport` 抽象，WebHID 和 BLE 都只是这个抽象的实现。WiFi 最舒服的做法是新增一个 `WifiTransport`，继续复用现有帧协议、RPC 和鉴权。

可选方案：

- 推荐：设备内置 WebSocket Server，前端通过 `ws://设备IP:端口/webhmi` 连接。
- 备选：HTTP REST + SSE。
- 备选：Electron 原生 TCP/UDP bridge。
- 备选：设备连云端，网页通过云端中转。
- 不建议第一版：WebRTC DataChannel。

建议架构：

```text
WebhmiClient
  -> RpcSession / Frame Protocol
    -> HidTransport
    -> BleTransport
    -> WifiTransport(WebSocket)
```

## 2. Vercel 在线网页与局域网 WebSocket

**User:**  
这个上位机目前是既可以在线（部署到了 vercel）也可以离线（PWA 和 Electron），如果使用 WebSocket 的话应该怎么做？设备那边的主控是 rk3506，我打算使用一个 esp32-c3 当作 wi-fi/蓝牙模块使用，esp32-c3 应该用什么模式？1: Station 模式 2: SoftAP 模式 3: SoftAP+Station 模式

**Assistant:**  
建议选 **SoftAP+Station 模式**，但策略上不是永远双开：

```text
首次/配网/救援：SoftAP + BLE
正常使用：Station
连不上路由器：自动回退 SoftAP
需要售后/重配：按键长按重新打开 SoftAP/BLE
```

WebSocket 架构：

```text
WebHMI
  -> WifiTransport(WebSocket)
    -> ESP32-C3 WebSocket Server
      -> UART/SPI
        -> RK3506
```

注意：Vercel 上的 `https://webhmi.tech` 页面不能稳定直连 `ws://192.168.x.x`，因为 HTTPS 页面访问明文局域网 WebSocket 会遇到 Mixed Content / Private Network Access 限制。

稳定入口建议：

- Electron：正式支持 WiFi WebSocket 直连设备。
- PWA/Vercel：不要强依赖 `ws://局域网IP`。
- 本地设备页面：`http://192.168.4.1` 可以连接 `ws://192.168.4.1`。
- 远程在线控制：走云端 WSS 中转。

## 3. Vercel 在线网页是否无法通过 WebSocket 访问

**User:**  
有点没看懂，部署在 vercel 上的在线网页无法通过 WebSocket 访问是吗？

**Assistant:**  
不是“WebSocket 都不能用”，而是：

```text
https://webhmi.tech              -> wss://公网服务器        可以
https://webhmi.tech              -> ws://192.168.1.88      高概率被拦/不可靠
https://webhmi.tech              -> wss://192.168.1.88     理论可行，但证书复杂
http://192.168.4.1 本地设备页面 -> ws://192.168.4.1       可行
Electron                         -> ws://192.168.1.88      可行性最高
```

所以 WebSocket 方案可以做，但“Vercel 在线网页直连 ESP32-C3 的 `ws://局域网IP`”不能作为稳定主路径。稳定主路径应该放在 Electron、本地设备页面，或者云端 `wss` 中转。

## 4. 最小云端 WSS 中转方案

**User:**  
你先仔细研究一下目前这个上位机的架构和设计，然后给我一个最小最简单的云端 WSS 中转方案

**Assistant:**  
现有架构关键点：

- `Transport` 已经把 HID/BLE 抽象成字节流。
- `RpcSession` 负责帧、请求 ID、事件、超时、加密。
- `WebhmiClient` 负责 protobuf 业务请求。
- 云端只要转发 `Uint8Array`，现有鉴权、加密、GetDb、调参队列都能复用。

最小云端 WSS 中转架构：

```text
Vercel WebHMI / PWA / Electron
        |
        | wss://relay.webhmi.tech/v1/ws?role=client&room=xxx
        v
Cloud WSS Relay
        ^
        | wss://relay.webhmi.tech/v1/ws?role=device&room=xxx
        |
ESP32-C3 WiFi 模块
        |
        | UART/SPI 透明转发 WebHMI frame
        |
RK3506 主控
```

推荐用 **Cloudflare Worker + Durable Object** 做 relay，而不是直接塞进 Vercel。

Relay 最小规则：

```text
一个 room 只允许：
- 1 个 device socket
- 1 个 client socket

client binary -> device
device binary -> client
```

中转服务不解析 protobuf，不理解设备协议。

## 5. 配对怎么做

**User:**  
能详细介绍下配对怎么做吗？

**Assistant:**  
配对解决两个问题：

1. 云端 relay 怎么知道哪个网页该连哪台设备。
2. 别人不能随便猜一个设备 ID 就接进来。

推荐模型：

```text
deviceId:      WEBHMI-HC6288-001234
pairingSecret: 128~256 bit 随机密钥
roomId:        SHA-256(deviceId + ":" + pairingSecret)
```

设备端和网页端连接同一个 room：

```text
wss://relay.webhmi.tech/v1/ws?role=device&room=<roomId>
wss://relay.webhmi.tech/v1/ws?role=client&room=<roomId>
```

但如果目标是极简，也可以不做安全配对。

## 6. 是否一定需要 UID

**User:**  
我想做得越简单越好，是不是无论怎么样都需要一个 UID？我觉得可以用 esp32-c3 的唯一 ID

**Assistant:**  
云端中转至少需要一个 UID/room key，否则 relay 不知道网页要找哪台设备。

ESP32-C3 的唯一 ID 可以用：

```text
deviceUid = ESP32-C3 的唯一 MAC / eFuse ID
```

但 UID 最好只是“地址”，不要当“密码”。如果不考虑安全，可以直接：

```text
设备端：
wss://relay.webhmi.tech/ws?role=device&uid=<esp32_uid>

网页端：
wss://relay.webhmi.tech/ws?role=client&uid=<esp32_uid>
```

## 7. 极致用户体验，不考虑安全

**User:**  
不用考虑安全，能用就行，我要的是极致的用户体验

**Assistant:**  
可以把“配对”简化成 **UID 直连**：

```text
roomId = ESP32-C3 唯一 ID
```

设备端：

```text
wss://relay.webhmi.tech/ws?role=device&uid=<esp32_uid>
```

网页端：

```text
wss://relay.webhmi.tech/ws?role=client&uid=<esp32_uid>
```

ESP32-C3 的 UID 可以直接用 Wi-Fi Station MAC：

```text
uid = HEX(mac)
deviceName = "WebHMI-" + 后 3 字节
```

## 8. 不要二维码，怎么让用户知道唯一 ID

**User:**  
不要二维码，有没有更简单的方法让用户知道 esp32-C3 的唯一 id 的方式？

**Assistant:**  
可选方式：

- BLE 广播 UID，网页自动发现。
- 把 UID 放进 SoftAP 名称。
- 印在设备外壳/铭牌上。
- 设备屏幕显示。

如果设备端都有屏幕，最低成本是屏幕显示：

```text
WebHMI ID: A1B2-C3D4-E5F6
```

## 9. 云端平台选择

**User:**  
设备端都有屏幕，放在屏幕显示就行，这样成本最低；然后还有其它的问题：我在网上找了一些支持 WebSocket 的后端：
Cloudflare Workers / Durable Objects
Fly.io
Railway
Render
自建 VPS
EMQX Cloud
HiveMQ Cloud
Supabase Realtime
我应该怎么选择？

**Assistant:**  
如果目标是不用考虑安全、最快能用、用户体验最顺：

- 第一推荐：EMQX Cloud / HiveMQ Cloud，用 MQTT over WSS，不用自己写云端 relay。
- 如果坚持裸 WebSocket：Cloudflare Workers + Durable Objects。
- Render/Railway/Fly.io/VPS 都能做普通 Node `ws` 服务，但需要自己管房间状态、扩容、运维。
- Supabase Realtime 不适合做设备透传 relay。

MQTT 方案 topic：

```text
webhmi/{uid}/down   // 网页 -> 设备
webhmi/{uid}/up     // 设备 -> 网页
webhmi/{uid}/status
```

最终建议：

```text
MVP：EMQX Cloud + MQTT over WSS
如果要纯 WSS：Cloudflare Durable Objects
```

## 10. EMQX / HiveMQ / Cloudflare 免费额度

**User:**  
先考虑 EMQX Cloud，HiveMQ Cloud，Cloudflare Durable Objects 这 3 个，它们有免费的额度吗？有多少？超过免费额度后怎么收费？

**Assistant:**  
大致对比：

| 平台 | 免费额度 | 超出后 |
| --- | --- | --- |
| EMQX Cloud Serverless | 100 万 session minutes/月、1 GB 流量/月、100 万 rule actions/月 | $2 / 百万 session minutes，$0.15 / GB，$0.25 / 百万 rule actions |
| HiveMQ Cloud Serverless FREE | 100 MQTT 连接、10 GB 流量/月 | 免费档通常需要升 paid plan |
| Cloudflare Durable Objects | 100,000 requests/天、13,000 GB-s/天 | 免费档超限会失败；付费 Workers $5/月起，之后按量 |

1 台设备 24 小时在线：

```text
60 * 24 * 30 = 43,200 session minutes/月
```

EMQX 免费 100 万 session minutes 大约够 23 台设备常久在线。

## 11. VPS 是否最划算，以及国内访问 Vercel

**User:**  
哪一种成本最低，买一台服务器自建 VPS 是不是最划算的？还有另外的问题：上位机部署到 vercel 的话，国内用户感觉会访问不到

**Assistant:**  
如果只看长期现金成本，自建 VPS 大概率最划算。

阶段建议：

| 阶段 | 最省钱选择 | 原因 |
| --- | --- | --- |
| 0-100 台测试 | HiveMQ Cloud Free / EMQX Free | 不用买服务器，不用运维 |
| 100 台左右开始常久在线 | VPS 开始有优势 | 固定 $4-$10/月，不按连接分钟收费 |
| 量产且国内用户为主 | 国内云/香港 VPS + 国内前端镜像 | 可达性比 Vercel 稳 |

国内访问 Vercel 确实不可控。建议：

```text
海外/通用版：
- Vercel 继续保留
- relay 可用 EMQX Cloud 或 VPS

国内版：
- 前端静态文件部署到腾讯云 COS + CDN / 阿里云 OSS + CDN
- MQTT/WSS 放香港 VPS 或国内云服务器
- 如果用中国大陆 CDN/服务器，域名需要 ICP 备案
```

没有 ICP 时，现实低成本方案：

```text
香港 VPS 一台
- 跑 WebHMI 静态页面
- 跑 Mosquitto/EMQX OSS
- 域名解析到这台 VPS
```

## 12. Cloudflare Durable Objects 免费额度是否够用

**User:**  
我怎么感觉 Cloudflare Durable Objects 的免费额度已经够用了？

**Assistant:**  
感觉没错。如果用 **Cloudflare Durable Objects + WebSocket Hibernation**，免费额度很可能已经够 MVP 甚至小规模试用。

关键计费点：

```text
- 建立一个 WebSocket 连接算 1 次 request
- incoming WebSocket message 按 20:1 折算 request
- outgoing WebSocket message 不收费
- WebSocket protocol ping 不收费
```

免费档每天约能撑：

```text
100,000 * 20 = 2,000,000 条 incoming WebSocket 消息/天
```

前提：一定要用 **WebSocket Hibernation API**，不要用普通 `ws.accept()` 长时间挂着。

推荐调整为：

```text
MVP：Cloudflare Durable Objects Free + WebSocket Hibernation
生产早期：继续用 Free，观察用量
需要避免免费额度触顶失败：升 Workers Paid，$5/月起
```

## 13. ESP32-C3 与 RK3506 通信设计

**User:**  
还有 ESP32-C3 这边应该怎么设计？特别是与 RK3506 的通讯

**Assistant:**  
把 ESP32-C3 设计成很薄的 **云端通信桥**：

```text
WebHMI 网页
  -> Cloudflare Durable Objects WSS Relay
    -> ESP32-C3
      -> UART
        -> RK3506
```

RK3506 继续负责：

```text
WebHMI 帧协议
Auth / ECDH / AES 加密
protobuf
设备 DB
调参逻辑
屏幕 UI
```

ESP32-C3 负责：

```text
读取唯一 UID
连接 WiFi
连接云端 WSS
WSS <-> RK3506 字节转发
把 UID / WiFi / 云端状态告诉 RK3506
```

RK3506 和 ESP32-C3 通信第一版建议用 UART：

```text
RK3506 TX -> ESP32-C3 RX
RK3506 RX <- ESP32-C3 TX
GND 共地
可选 RTS/CTS
```

参数：

```text
921600 baud 起步
8N1
有条件用 RTS/CTS
缓冲区 8KB~32KB
```

UART 上也走现有 WebHMI raw frame。

保留本地 msgId：

```text
0x7F00 ESP_HELLO
0x7F01 ESP_STATUS
0x7F02 ESP_GET_INFO
0x7F03 ESP_WIFI_SET
0x7F04 ESP_WIFI_RESET
0x7F05 ESP_REBOOT
```

## 14. 是否需要 AT 指令

**User:**  
这两通讯和控制不用 AT 指令吗？

**Assistant:**  
不用，也不建议用 AT 指令作为主方案。

AT 指令模型：

```text
RK3506 是主控
ESP32-C3 只是 WiFi modem
RK3506 通过 AT+CWMODE / AT+CWJAP / AT+WSOPEN / AT+WSSEND 控制 ESP
```

推荐模型：

```text
ESP32-C3 自己跑固件
自己连 WiFi
自己连 Cloudflare WSS
RK3506 只和 ESP 交换 WebHMI 原始帧 + 少量状态帧
```

AT 会把复杂网络状态机搬到 RK3506，包括 TLS、重连、binary payload 分片、文本响应解析等。推荐：

```text
ESP32-C3 自定义固件 + UART 二进制帧桥接 + 0x7Fxx 本地控制帧
```

## 15. RK3506 如何控制 ESP32-C3 连 WiFi

**User:**  
RK3506 做主控，怎么控制 ESP32-C3 连 wifi？

**Assistant:**  
RK3506 做主控时有两种方式：

```text
1. AT 指令：RK 直接发 AT+CWJAP
2. 自定义 ESP 固件：RK 发“业务命令”，ESP 自己执行 WiFi 连接
```

建议选 2。RK 发送高层命令：

```text
0x7F03 ESP_WIFI_SCAN
0x7F04 ESP_WIFI_CONNECT
0x7F05 ESP_WIFI_FORGET
0x7F06 ESP_AP_START
0x7F07 ESP_AP_STOP
0x7F08 ESP_REBOOT
```

最小 WiFi 连接流程：

```text
1. RK -> ESP: ESP_WIFI_SCAN
2. ESP -> RK: 返回 SSID 列表
3. 用户在 RK 屏幕选择 SSID，输入密码
4. RK -> ESP: ESP_WIFI_CONNECT(ssid, password)
5. ESP 尝试连接路由器
6. ESP -> RK: ESP_STATUS(wifi=connecting)
7. 连接成功
8. ESP -> RK: ESP_STATUS(wifi=connected, ip=192.168.1.88, rssi=-55)
9. ESP 保存 SSID/password 到 NVS
10. ESP 自动连接云端 WSS
```

更低成本用户体验：

```text
ESP 未配网或连接失败
  -> 自动开启 SoftAP：WebHMI-E5F6
  -> RK 屏幕显示热点名和 192.168.4.1
  -> 用户手机连热点并打开配网页
```

第一版建议：

```text
RK3506 不直接输入 WiFi 密码
ESP32-C3 自己提供 SoftAP 配网页
RK3506 屏幕只显示 UID、热点名、IP、联网状态
```

## 16. ESP32-C3 同时做 BLE

**User:**  
如果要在 esp-c3 把 ble 也做了，应该怎么搞比较合适

**Assistant:**  
建议 **ESP32-C3 同时做 BLE + WiFi 云桥**，但角色分清楚：

```text
BLE：本地近场连接 / 发现 / 可选配网
WiFi：连接云端 WSS relay
UART：和 RK3506 传 WebHMI 原始帧
```

架构：

```text
WebHMI WebBLE
   |
   | BLE GATT
   v
ESP32-C3
   |
   | UART raw WebHMI frame
   v
RK3506


WebHMI Cloud
   |
   | WSS
   v
Cloudflare Relay
   |
   | WSS
   v
ESP32-C3
   |
   | UART raw WebHMI frame
   v
RK3506
```

BLE GATT Server：

```text
Service UUID:        0x00FF
Data Characteristic: 0xFF01

properties:
- Write
- Write Without Response
- Notify
```

数据规则：

```text
WebHMI -> BLE write -> ESP32-C3 -> UART -> RK3506
RK3506 -> UART -> ESP32-C3 -> BLE notify -> WebHMI
```

重点：BLE 和云端不要同时控制 RK。ESP32-C3 做独占控制权：

```text
activeOwner = none | ble | cloud
```

建议优先级：

```text
本地 BLE > 云端 Cloud
```

最终推荐：

```text
ESP32-C3:
- BLE GATT Server，兼容当前 0x00FF / 0xFF01
- WiFi STA + Cloud WSS
- UART 921600 + RTS/CTS 连接 RK3506
- 只允许 BLE/Cloud 一个 active owner
- BLE/Cloud 数据都原样转发 WebHMI frame
- 0x7Fxx 本地帧通知 RK：UID、WiFi、Cloud、BLE、Client 状态
```

