# WebHMI 软件设计说明书

## 1. 文档概述

### 1.1 编写目的

本文档用于说明 WebHMI Web 上位机的软件设计，面向研发交接、后续维护、协议联调和测试验证。文档重点描述当前仓库已经实现的架构、模块职责、数据模型、通信协议、状态同步、安全机制、构建运行方式和测试建议，不包含未实现功能的需求扩展。

### 1.2 项目定位

WebHMI 是一个面向音频 DSP 设备的跨平台 Web 上位机。系统通过浏览器原生硬件能力连接下位机设备，读取设备参数数据库，并提供实时调音、交互式 EQ 编辑、模式管理、配置导入导出、设备文档查看等能力。

当前项目基于 React、TypeScript、Vite 构建，支持：

- 浏览器 Web 应用运行。
- Electron 桌面应用封装。
- PWA standalone 运行形态。
- USB HID 与 Bluetooth LE 两种硬件通信方式。
- 在线设备模式与无设备演示模式。

### 1.3 关键代码入口

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| 应用入口 | [src/main.tsx](src/main.tsx) | 初始化字体、控制台代理、国际化、路由、错误边界，并启动生产环境反调试逻辑。 |
| 应用框架 | [src/App.tsx](src/App.tsx) | 提供导航栏、语言切换、全局 Toast、设备会话上下文。 |
| 首页 | [src/pages/Home.tsx](src/pages/Home.tsx) | 提供 USB、BLE、演示模式入口，并完成交互式设备选择。 |
| 调音页面 | [src/components/dsp/GenericTuningPage.tsx](src/components/dsp/GenericTuningPage.tsx) | 在线调音和演示调音的主页面，承载主要业务交互。 |
| 设备通信 | [src/device](src/device) | 设备传输、协议帧、RPC 会话、鉴权、队列和 DB patch 逻辑。 |
| 协议定义 | [webhmi.proto](webhmi.proto) | protobuf 数据模型与业务请求结构。 |
| 协议文档 | [protocol.md](protocol.md) | Web 上位机与固件通信协议说明。 |
| Electron 主进程 | [electron/main.cjs](electron/main.cjs) | 桌面封装、设备选择弹窗、权限处理。 |
| 构建配置 | [vite.config.ts](vite.config.ts) | Vite、PWA、代码分包、压缩和开发日志代理配置。 |

### 1.4 技术栈

| 类别 | 技术 |
| --- | --- |
| UI 框架 | React 19, React Router 7 |
| 开发语言 | TypeScript |
| 构建工具 | Vite 6, SWC React Plugin |
| 样式 | Tailwind CSS, Radix UI 风格组件, 自定义 CSS Module |
| DSP 可视化 | dsssp |
| 国际化 | i18next, react-i18next |
| 硬件通信 | WebHID, Web Bluetooth |
| 协议序列化 | protobufjs |
| 桌面封装 | Electron |
| PWA | vite-plugin-pwa |

## 2. 总体架构设计

### 2.1 分层架构

系统整体分为五层：

```text
┌─────────────────────────────────────────────────────────────┐
│ 表现层                                                       │
│ Home / Docs / DeviceDemo / DemoMode / Navbar / Dialogs       │
├─────────────────────────────────────────────────────────────┤
│ DSP 交互层                                                   │
│ GenericTuningPage / DspPanel / FilterCard / ParameterCard    │
├─────────────────────────────────────────────────────────────┤
│ 状态与业务层                                                 │
│ useTuningState / DeviceSessionContext / parameterRanges      │
├─────────────────────────────────────────────────────────────┤
│ 设备会话层                                                   │
│ useDeviceSession / useDeviceConnection / useDeviceAuth       │
│ useTuningQueue / WebhmiClient                                │
├─────────────────────────────────────────────────────────────┤
│ 协议传输层                                                   │
│ RpcSession / FrameStreamDecoder / HidTransport / BleTransport│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 表现层

表现层负责页面路由、布局、导航、文档展示和用户入口。

主要页面：

- `/`：首页，展示 USB、BLE、演示模式入口。
- `/device-demo`：真实设备调音页面，需要设备已选择且连接、鉴权、数据库读取完成。
- `/demo-mode`：无设备演示页面，使用本地模拟数据库。
- `/docs`：内置文档页面，支持中英文 Markdown 文档加载和右侧目录。
- `/changelog`：版本更新日志页面。

路由使用 hash router，适合静态部署、Electron 本地文件加载和 GitHub Pages 等场景。

### 2.3 DSP 交互层

DSP 交互层负责把设备 DB 中的音频参数转换为可操作 UI。

核心职责：

- 将 `webhmi.Eq` 转换为 `dsssp` 图表可识别的 `GraphFilter`。
- 绘制单个滤波器曲线、合成曲线、滤波器点和频响背景。
- 处理拖拽、滚轮调 Q、双击恢复默认、滤波器类型切换。
- 对参数输入控件做范围约束、步进控制和禁用状态处理。
- 根据设备返回字段动态显示或隐藏功能卡片。

关键组件：

- `GenericTuningPage`：调音页面总控，负责业务分区、动作绑定、导入导出、模式管理。
- `DspPanel`：EQ 图表与滤波器卡片容器。
- `FilterCard`：单个滤波器点的类型、频率、增益、Q 控件。
- `NumberControl`：带步进按钮的数值输入。
- `ToggleControl`：布尔参数开关。
- `ToggleGroupControl`：枚举参数切换。
- `PhaseInversionToggle`：相位反转开关。
- `CompressorGraph`：压缩器曲线预览。

### 2.4 状态与业务层

状态与业务层负责屏蔽在线设备模式与离线演示模式差异。

`useTuningState(isDemoMode)` 是页面侧统一入口：

- `isDemoMode = true` 时，使用本地 `INITIAL_DATA` 模拟设备数据库，所有修改只写入本地 React state。
- `isDemoMode = false` 时，使用 `DeviceSessionContext` 提供的真实设备状态和动作。

该设计让 `GenericTuningPage` 可以复用同一套 UI 与业务逻辑，同时服务真实设备调试和演示体验。

### 2.5 设备会话层

设备会话层负责连接、鉴权、数据库读取、参数写入、事件同步和断连清理。

核心 Hook：

- `useDeviceConnection`：管理 HID/BLE 连接生命周期。
- `useDeviceAuth`：执行设备鉴权和会话密钥协商。
- `useTuningQueue`：维护本地 DB 草稿和待发送 patch 队列。
- `useDeviceSession`：聚合连接、鉴权和调参队列，对页面暴露统一 state/actions。

页面看到的主要状态：

| 字段 | 说明 |
| --- | --- |
| `connected` | 是否已连接传输通道。 |
| `transport` | 当前传输方式，取值为 `hid`、`ble` 或 `null`。 |
| `busy` | 连接、鉴权、读取、写入等任一流程是否忙碌。 |
| `error` | 连接或业务错误。 |
| `authOk` | 鉴权状态，`true` 表示可调参。 |
| `authError` | 鉴权错误。 |
| `db` | 当前设备数据库草稿。 |
| `dbJson` | 用于调试展示的格式化数据库 JSON。 |
| `dirty` | 是否存在待发送 patch。 |
| `flushing` | 是否正在发送 patch。 |
| `flushError` | 最近一次发送错误。 |

### 2.6 协议传输层

协议传输层把业务请求转换为底层字节流，并对 HID/BLE 差异做统一抽象。

核心类型：

- `Transport`：统一传输接口，定义 `connect`、`disconnect`、`write`、`onBytes`。
- `HidTransport`：基于 WebHID，按 HID report size 分片发送。
- `BleTransport`：基于 Web Bluetooth GATT characteristic，默认按 20 字节分片发送，并处理 GATT busy retry。
- `RpcSession`：处理请求 ID、超时、响应匹配、事件分发、加解密和重放保护。
- `FrameStreamDecoder`：从任意字节流中恢复完整协议帧。
- `WebhmiClient`：业务 API 封装，负责 protobuf 编解码。

## 3. 功能设计

### 3.1 首页与设备连接

首页提供三个入口：

- USB：通过 WebHID 连接设备。
- BLE：通过 Web Bluetooth 连接设备。
- 演示模式：不连接硬件，进入本地模拟调音页面。

USB 连接流程：

1. 检查 `navigator.hid` 是否存在。
2. 使用 `HID_DEVICE_PROFILES` 生成 `requestDevice` filters。
3. 用户选择设备后写入 `selectedDevices`。
4. 调用 `actions.connectHid({ interactive: false })`。
5. 连接、鉴权、拉取 DB 成功后跳转 `/device-demo?transport=hid`。
6. 失败时显示 Toast，并留在首页。

BLE 连接流程：

1. 检查 `navigator.bluetooth` 是否存在。
2. 使用 `BLE_DEVICE_PROFILES` 生成 service filters。
3. 用户选择设备后写入 `selectedDevices`。
4. 调用 `actions.connectBle({ interactive: false })`。
5. 连接、鉴权、拉取 DB 成功后跳转 `/device-demo?transport=ble`。
6. 失败时显示 Toast，并留在首页。

支持的设备配置位于 [src/configs/deviceProfiles.ts](src/configs/deviceProfiles.ts)：

- HID profile 包含 `vendorId`、`productId`、`reportId`、`reportSize`、`usagePage`、`usage`。
- BLE profile 包含 `service`、`characteristic`、`notify`。

### 3.2 设备调音页面

设备调音页面由 `GenericTuningPage` 实现，在线设备和演示模式共用同一组件。

页面主 Tab 根据设备 DB 字段动态生成：

- System
- Music
- Mic
- Reverb
- Echo
- Main Output
- Sub Output
- Center
- Surround

如果某个 DB section 不存在，对应 Tab 不显示。这允许不同设备固件暴露不同能力集。

### 3.3 System 功能

System 面板负责全局设备参数和配置管理。

主要能力：

- 音乐、麦克风、效果音量。
- 全局静音。
- 面板锁定。
- BLE 名称查看和修改。
- 当前模式选择。
- 保存当前参数到指定模式。
- 重命名模式列表。
- 配置导入和导出。
- 唱歌/热舞场景相关参数。
- 默认音量启用及默认值。
- 音量上限设置。

关键设计：

- 音量和默认音量会根据设备提供的最大值动态收紧范围。
- 最大音量会根据默认音量动态收紧最小值，避免默认值高于最大值。
- `modeList` 由设备 DB 提供，页面不固定模式数量。
- 当前模式切换通过 `SetSystem.currentModeIndex` 执行，发送成功后会刷新数据库，保证页面显示的是切换后的真实参数。

### 3.4 Music 功能

Music 面板负责音乐输入链路参数。

主要能力：

- Music EQ。
- 输入增益。
- 蓝牙增益。
- U 盘增益。
- 音乐音调。
- 输入源选择。
- 低音、中音、中音频率、高音。
- 噪声门 gate、frameTime、atkTime、relTime。

输入源选项优先使用设备 DB 中的 `inputSelectList`，缺失时回退到前端默认列表：

- BT
- UDISK
- SPDIF
- COA
- USB
- AUX1
- AUX2

### 3.5 Mic 功能

Mic 面板负责麦克风输入链路参数。

主要能力：

- Mic A EQ。
- Mic B EQ。
- Mic A/B EQ 联调。
- Mic A/B 音量。
- FBX 反馈抑制模式。
- 低音、中音、中音频率、高音。
- 噪声门。
- 压缩器 threshold、ratio、attack、release、bypass。

Mic A/B EQ 联调设计：

- 开启联调时，会将当前选中麦克风 EQ 同步到另一只麦克风。
- EQ 点修改、bypass 修改和 reset 操作会同时作用于 A/B 两组 EQ。
- 联调状态写入 `micEqJointDebugging`。

### 3.6 Reverb 与 Echo 功能

Reverb 面板：

- Reverb EQ。
- 混响电平。
- 麦克风直达电平。
- 预延时。
- 混响时间。
- 混响电平相位反转。
- 直达声相位反转。

Echo 面板：

- Echo EQ。
- 回声电平。
- 麦克风直达电平。
- 预延时。
- 延时时间。
- 重复比率。
- 右声道预延时。
- 右声道延时。
- 回声电平相位反转。
- 直达声相位反转。

### 3.7 输出通道功能

输出通道包括：

- Main Output
- Sub Output
- Center
- Surround

每个输出通道包含三类能力：

- EQ：支持唱歌场景和热舞场景的独立 EQ。
- Output：输出音量、延时、静音、相位反转。
- Mixer：麦克风直达、音乐、混响、回声混音比例和相位反转。
- Compressor：压缩器参数和旁路。

输出控制模式：

- `OUTPUT_CONTROL_AUTO`：输出 EQ 与 Mixer 禁用。
- `OUTPUT_CONTROL_MANUAL`：输出 EQ 与 Mixer 可编辑。

场景模式：

- `OUTPUT_SCENE_SING`：操作 `singEq` 和 `singMixer`。
- `OUTPUT_SCENE_DANCE`：操作 `danceEq` 和 `danceMixer`。

### 3.8 EQ 交互功能

EQ 数据结构由设备 DB 中的 `Eq` 和 `EqPoint` 提供。

前端映射规则：

| protobuf FilterType | dsssp GraphFilter type |
| --- | --- |
| `Peak` | `PEAK` |
| `LowShelf` | `LOWSHELF2` |
| `HighShelf` | `HIGHSHELF2` |
| `LowPass` | `LOWPASS2` |
| `HighPass` | `HIGHPASS2` |
| `BandPass` | `BANDPASS` |
| `Notch` | `NOTCH` |

交互规则：

- 拖拽滤波器点修改频率和增益。
- 滚轮或卡片输入修改当前类型对应的 Q 值；Peak 使用 `peakQ`，其它类型使用共用 `q`。
- LowPass 与 HighPass 类型视为固定 Q 控件，Q 输入禁用，但切换类型时仍读取共用 `q`。
- 双击滤波器点恢复该点默认值。
- Reset 按钮恢复当前面板全部 EQ 默认值。
- Bypass 开关修改当前 EQ 的旁路状态。
- 桌面端显示所有滤波器卡片，移动端使用 Tab 切换单个滤波器卡片。

### 3.9 配置导出

导出流程：

1. 用户点击导出。
2. 页面根据 `deviceId` 和 `firmwareVersion` 生成默认文件名。
3. 用户确认文件名。
4. 前端深拷贝当前 `state.db`。
5. 删除 protobuf 内部 `_` 字段。
6. 删除 `db.system`，避免导出系统敏感项。
7. 使用 `webhmi.DeviceConfig.encode` 编码为二进制。
8. 创建 Blob 并下载为 `.webhmi` 文件。

导出文件类型：

```text
application/octet-stream
```

`.webhmi` 文件格式、兼容规则和安全注意事项见 [WEBHMI_CONFIG_FORMAT.md](WEBHMI_CONFIG_FORMAT.md)。

### 3.10 配置导入

导入流程：

1. 用户选择 `.webhmi` 文件。
2. 读取 ArrayBuffer。
3. 使用 `webhmi.DeviceConfig.decode` 解码。
4. 校验是否包含 `db`。
5. 校验 `deviceId`：
   - 导入文件和当前设备均存在 `deviceId`，且二者不一致时禁止导入。
6. 校验固件主版本：
   - 主版本不一致时禁止导入。
7. 校验完整版本：
   - 主版本一致但完整版本不一致时弹出警告，用户确认后继续。
8. 在线模式将导入数据转成 queue patch 并立即 flush。
9. 演示模式直接合并到本地模拟 DB。

该设计防止错误设备或不兼容固件导入参数导致设备异常。完整兼容矩阵见 [WEBHMI_CONFIG_FORMAT.md](WEBHMI_CONFIG_FORMAT.md)。

### 3.11 文档页面

文档页面使用 `import.meta.glob('../docs/**/*.md', { query: '?raw' })` 加载 Markdown 原文。

功能：

- 根据当前语言加载 `src/docs/zh` 或 `src/docs`。
- 找不到本地化文档时回退英文文档。
- 自动提取二级和三级标题，生成右侧目录。
- 支持中文标题 slug。
- 使用 `react-markdown`、`remark-gfm`、`rehype-slug` 渲染。

## 4. 数据模型设计

### 4.1 protobuf 总体结构

主数据模型位于 [webhmi.proto](webhmi.proto)。

```text
DeviceConfig
├── deviceId
├── firmwareVersion
└── DeviceDb
    ├── SystemDb
    ├── MusicDb
    ├── MicDb
    ├── ReverbDb
    ├── EchoDb
    ├── MainOutputDb
    ├── SubOutputDb
    ├── CenterDb
    └── SurroundDb
```

### 4.2 DeviceConfig

`DeviceConfig` 是上位机持有的完整配置快照。

| 字段 | 说明 |
| --- | --- |
| `deviceId` | 设备型号或设备标识，用于导入兼容性校验。 |
| `firmwareVersion` | 固件版本，用于导入兼容性校验。 |
| `db` | 设备参数数据库。 |

### 4.3 DeviceDb

`DeviceDb` 按业务域拆分参数：

| section | 说明 |
| --- | --- |
| `system` | 全局系统参数、音量、模式、BLE 名称、场景控制。 |
| `music` | 音乐输入、音调、噪声门、Music EQ。 |
| `mic` | 麦克风 A/B、反馈抑制、噪声门、压缩器。 |
| `reverb` | 混响参数与 Reverb EQ。 |
| `echo` | 回声参数与 Echo EQ。 |
| `mainOutput` | 主输出 EQ、Mixer、Output、Compressor。 |
| `subOutput` | 超低音输出 EQ、Mixer、Output、Compressor。 |
| `center` | 中置输出 EQ、Mixer、Output、Compressor。 |
| `surround` | 环绕输出 EQ、Mixer、Output、Compressor。 |

### 4.4 EQ 数据模型

`Eq` 包含：

- `point`：滤波器点数组。
- `bypass`：当前 EQ 是否旁路。
- `highPassTypeList`：高通位置允许的滤波器类型。
- `typeList`：中间滤波器位置允许的滤波器类型。
- `lowPassTypeList`：低通位置允许的滤波器类型。
- `minFreq/maxFreq/stepFreq`：频率范围。
- `minGain/maxGain/stepGain`：增益范围。
- `minQ/maxQ/stepQ`：非 Peak 类型共用 Q 值范围。
- `minPeakQ/maxPeakQ/stepPeakQ`：Peak 类型 Q 值范围。

`EqPoint` 包含：

- `index`：设备侧点位索引。
- `type`：滤波器类型。
- `freq`：频率，单位 Hz。
- `gain`：增益。
- `q`：非 Peak 类型共用 Q 值。
- `peakQ`：Peak 类型专用 Q 值。
- `defaultType/defaultFreq/defaultGain/defaultQ/defaultPeakQ`：恢复默认值时使用。

### 4.5 Patch 请求模型

设置类请求采用 patch 结构：

- 只发送发生变化的字段。
- 嵌套对象使用对应 `Patch` message。
- EQ 使用 `EqPatch`，以 `target + sceneMode + point.index` 定位。

常见请求：

| 请求 | 用途 |
| --- | --- |
| `SetSystemRequest` | 设置系统参数。 |
| `SetMusicRequest` | 设置音乐参数。 |
| `SetMicRequest` | 设置麦克风参数。 |
| `SetReverbRequest` | 设置混响参数。 |
| `SetEchoRequest` | 设置回声参数。 |
| `SetMainOutputRequest` | 设置主输出参数。 |
| `SetSubOutputRequest` | 设置超低音输出参数。 |
| `SetCenterRequest` | 设置中置输出参数。 |
| `SetSurroundRequest` | 设置环绕输出参数。 |
| `SetEqRequest` | 设置 EQ bypass 或点位参数。 |
| `ResetEqRequest` | 恢复 EQ 默认值。 |

## 5. 协议设计

### 5.1 消息 ID

消息 ID 定义位于 [src/device/proto/msgId.ts](src/device/proto/msgId.ts)。

| msg_id | 名称 | 说明 |
| --- | --- | --- |
| `0x0000` | `Auth` | 鉴权和会话密钥协商。 |
| `0x0001` | `GetDb` | 获取设备参数数据库。 |
| `0x0002` | `SetEq` | 设置 EQ 参数。 |
| `0x0003` | `SetSystem` | 设置系统参数。 |
| `0x0004` | `SetMusic` | 设置音乐参数。 |
| `0x0005` | `SetMic` | 设置麦克风参数。 |
| `0x0006` | `SetReverb` | 设置混响参数。 |
| `0x0007` | `SetEcho` | 设置回声参数。 |
| `0x0008` | `SetMainOutput` | 设置主输出参数。 |
| `0x0009` | `SetSubOutput` | 设置超低音输出参数。 |
| `0x000a` | `SetCenter` | 设置中置输出参数。 |
| `0x000b` | `SetSurround` | 设置环绕输出参数。 |
| `0x000c` | `SaveMode` | 保存当前参数到指定模式。 |
| `0x000d` | `ResetEq` | 重置 EQ。 |

### 5.2 数据帧格式

协议帧由 [src/device/protocol/frame.ts](src/device/protocol/frame.ts) 编解码。

```text
Magic(2) | ver(1) | hdr_len(1) | msg_id(2 LE) | flags(1)
payload_len(2 LE) | ext(N) | payload(M) | crc16(2 LE)
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `Magic` | 固定 `D5 5D`。 |
| `ver` | 协议版本，当前为 `0x01`。 |
| `hdr_len` | 头部长度，基础头为 7 字节，不含 Magic。 |
| `msg_id` | 业务消息 ID，小端。 |
| `flags` | 响应、事件、加密等标志位。 |
| `payload_len` | payload 长度，小端。 |
| `ext` | 扩展区，当前支持 `req_id`、`ivSync` 和 `result`。 |
| `payload` | 业务数据，Auth 除外均为 protobuf。 |
| `crc16` | 对 `ver` 到 payload 末尾做 CRC16-CCITT-FALSE。 |

### 5.3 Flags

| Flag | 值 | 说明 |
| --- | --- | --- |
| `FLAG_RESPONSE` | `1 << 0` | 请求期望响应，或当前帧是响应帧。 |
| `FLAG_EVENT` | `1 << 1` | 当前帧是设备主动事件。 |
| `FLAG_ENCRYPTED` | `1 << 2` | payload 已加密。 |

### 5.4 扩展区

扩展区采用 TLV 格式。

| Type | Length | 说明 |
| --- | --- | --- |
| `0x80` | `0x02` | `req_id`，用于请求响应匹配。 |
| `0x81` | `0x04` | `ivSync`，用于 AES-CTR counter 同步。 |
| `0x82` | `0x02` | `result`，设备响应帧的命令执行结果。 |

设备普通响应帧（设备到上位机，`FLAG_RESPONSE=1` 且 `FLAG_EVENT=0`）必须包含 `req_id` 和 `result`。`result=0x0000` 表示成功；非 0 表示设备拒绝或执行失败，`RpcSession` 会 reject 对应请求。

### 5.5 流式解码

`FrameStreamDecoder` 支持从 HID report 或 BLE characteristic notification 的任意分片中恢复完整帧。

处理策略：

- 累积输入 chunk。
- 搜索 Magic。
- 校验最小头长。
- 根据 `hdr_len` 和 `payload_len` 判断完整帧长度。
- 解码并校验 CRC。
- 解码失败时丢弃一个字节继续寻找 Magic，以提高抗噪声能力。

### 5.6 RPC 请求响应

`RpcSession.request` 负责：

- 分配非零 16 位 `req_id`。
- 编码协议帧。
- 写入 Transport。
- 按 `req_id` 等待响应。
- 默认超时 2000ms，GetDb section 读取使用 15000ms。
- 请求写入失败或超时会 reject。

无响应请求：

- SetEq、SetMusic、SetMic、SetReverb、SetEcho、SetMainOutput、SetSubOutput、SetCenter、SetSurround 默认 `expectResponse: false`。
- SetSystem 仅在 patch 包含 `bleName`、`panelLock`、`modeList`、`controlMode`、`sceneMode` 时期望响应；其他 System 字段默认无响应。
- SaveMode、ResetEq 作为关键命令期望响应。
- 当前模式切换通过 `SetSystem.currentModeIndex` 完成，不再使用独立切换模式消息。

### 5.7 GetDb 分段读取

`WebhmiClient.getDb` 按 section 逐段读取：

1. `SEC_SYSTEM`
2. `SEC_MUSIC`
3. `SEC_MIC`
4. `SEC_REVERB`
5. `SEC_ECHO`
6. `SEC_MAIN_OUTPUT`
7. `SEC_SUB_OUTPUT`
8. `SEC_CENTER`
9. `SEC_SURROUND`

每段响应中的 section payload 合并为一个完整 `DeviceConfig`。这样可以降低单帧 payload 大小，也便于固件按模块返回数据。

## 6. 安全设计

### 6.1 鉴权目标

鉴权用于确认当前连接的是可信设备，并在上位机与设备之间协商加密会话参数。

鉴权失败时：

- `authOk` 设置为 `false`。
- 写参数动作不会继续执行。
- 连接流程会主动断开。

### 6.2 握手流程

`WebhmiClient.authVerify` 执行以下流程：

1. 上位机生成临时 ECDH P-256 key pair。
2. 导出上位机 raw public key。
3. 去掉 raw key 的 `0x04` 前缀，得到 64 字节 `X || Y`。
4. 通过 `Auth` 请求发送给设备。
5. 设备返回 128 字节 payload：
   - 前 64 字节：设备临时公钥。
   - 后 64 字节：设备签名。
6. 上位机拼接 `clientPub || devicePub`。
7. 使用 `.env` 中 `VITE_AUTH_PUBLIC_KEY_B64` 导入 ECDSA P-256 公钥。
8. 验证设备签名。
9. 验签成功后，使用 ECDH 派生共享密钥。
10. 对共享密钥做 SHA-256。
11. 前 16 字节作为 AES session key，后 12 字节作为 base IV。
12. 调用 `RpcSession.enableEncryption` 启用加密。

### 6.3 加密传输

加密算法：

- AES-CTR
- counter 长度 128 bit
- IV 组成：`baseIv(12 bytes) || ivSync(4 bytes BE)`

计数器空间：

- 客户端发送：`0x00000000` 到 `0x7fffffff`。
- 设备发送：`0x80000000` 到 `0xffffffff`。

每次发送按 payload 占用的 AES block 数推进计数器，至少推进 1 个 block，避免空 payload 或短 payload 重用 counter。

### 6.4 重放保护

接收加密帧时：

- 必须包含 `ivSync` 扩展。
- `ivSync` 必须在设备计数器空间。
- `ivSync` 必须大于最后接受的设备计数器。
- 解密后根据明文长度推进 `lastRxFrameCounter`。

不满足条件的帧会被丢弃。

### 6.5 前端完整性与反调试

生产环境安全辅助逻辑：

- `startAntiDebug` 每秒触发一次 `debugger`。
- 构建配置中 `drop_debugger: false`，确保生产构建保留 debugger。
- `authVerify` 内包含 `SEC_VERIFY_V1_TOKEN`，并在生产环境检查函数体是否包含该 token，用于发现简单函数替换。

该机制只能提高篡改门槛，不能替代设备侧安全校验。

## 7. 状态同步设计

### 7.1 在线参数修改流程

```text
UI 控件修改
  ↓
actions.queue*
  ↓
useTuningQueue 更新本地 db 草稿
  ↓
pendingRef 合并 patch
  ↓
200ms 防抖和 200ms 节流
  ↓
flushNow 编码 Set 请求
  ↓
WebhmiClient protobuf encode
  ↓
RpcSession encodeFrame/encrypt/write
  ↓
设备应用参数
```

### 7.2 本地草稿

为了实现实时 UI 响应，`useTuningQueue` 在发送设备前先更新本地 `db`：

- section 参数通过 `applySectionPatch` 合并。
- EQ bypass 通过 `applyEqBypassPatch` 合并。
- EQ 点通过 `applyEqPointPatch` 以 `target + sceneMode + index` 定位合并。

页面显示始终读取本地草稿，因此用户拖动时不会等待设备响应。

### 7.3 Pending Patch 合并

Pending 结构：

```text
PendingPatches
├── system?
├── music?
├── mic?
├── reverb?
├── echo?
├── mainOutput?
├── subOutput?
├── center?
├── surround?
└── eq: Map<string, PendingEqTarget>
```

合并策略：

- 同一 section 的连续修改深度合并。
- 同一 EQ target、sceneMode、point.index 的连续修改合并为最后状态。
- 发送 EQ patch 前会与 `baseDbRef` 比较，只发送相对基线发生变化的字段。

### 7.4 防抖与节流

参数：

- `USER_DEBOUNCE_MS = 200`
- `USER_THROTTLE_MS = 200`

行为：

- 用户快速连续修改时，延迟到最近一次修改后 200ms 再发送。
- 长时间拖动时，至少按 200ms 节流发送一次，避免设备长时间没有更新。
- 如果已有发送进行中，设置 `flushRequestedRef`，发送完成后继续调度。

### 7.5 失败重试

发送失败时：

1. 当前发送快照重新合并回 pending。
2. `dirty` 保持 true。
3. `flushError` 记录错误信息。
4. 使用指数退避重试：
   - 首次 500ms。
   - 后续翻倍。
   - 最大 10000ms。

该设计避免临时通信失败导致用户修改丢失。

### 7.6 设备主动事件同步

设备主动上报事件由 `RpcSession` 根据 `FLAG_EVENT` 分发。

`useDeviceSession` 处理的事件：

- `SetMusic`
- `SetEq`
- `SetSystem`
- `SetMic`
- `SetReverb`
- `SetEcho`
- `SetMainOutput`
- `SetSubOutput`
- `SetCenter`
- `SetSurround`
- `SaveMode`

Set 类事件会解码 request payload 并 patch 本地 DB。`SetSystem.currentModeIndex` 代表当前模式切换，收到后触发 `refreshDb`，保证模式切换后所有参数重新对齐设备真实状态。

## 8. 连接与断连设计

### 8.1 HID Transport

`HidTransport` 基于 WebHID。

连接：

- 调用 `device.open()`。
- 监听 `inputreport`。
- 将 input report 转换为 `Uint8Array` chunk。

发送：

- 按 profile 中的 `reportSize` 分片。
- 每片不足部分补零。
- 调用 `device.sendReport(reportId, report)`。

断开：

- 移除 inputreport 监听。
- 调用 `device.close()`。

### 8.2 BLE Transport

`BleTransport` 基于 Web Bluetooth GATT。

连接：

- 调用 `device.gatt.connect()`。
- 获取 primary service。
- 获取 characteristic。
- 默认启动 notifications。
- 监听 `characteristicvaluechanged`。

发送：

- 默认按 20 字节 chunk 分片。
- 调用 `characteristic.writeValue`。
- 如果遇到 GATT operation in progress 类错误，会最多重试 8 次，每次间隔 20ms。

断开：

- 移除 characteristic notification 监听。
- 尝试 stopNotifications。
- 调用 `device.gatt.disconnect()`。

### 8.3 断连清理

断连触发源：

- HID：`navigator.hid.disconnect`。
- BLE：`gattserverdisconnected`。
- BLE 兜底：每 200ms 轮询 `device.gatt.connected`。

断连处理：

1. 清理传输监听。
2. 停止 RPC session。
3. reject 所有 in-flight 请求。
4. 清空 pending patch。
5. 清空本地 DB。
6. 重置鉴权状态。
7. 弹出设备断开 Toast。
8. 跳转首页。

## 9. Electron 与 PWA 设计

### 9.1 Electron 桌面封装

Electron 主进程位于 [electron/main.cjs](electron/main.cjs)。

主要职责：

- 创建 1280 x 800 主窗口。
- 启用 `WebBluetooth` feature。
- 开发环境加载 `http://localhost:3003`。
- 生产环境加载 `dist/index.html`。
- 处理 Web Bluetooth 设备选择事件。
- 处理 WebHID 设备选择事件。
- 自动授予 HID/Bluetooth 权限。
- 使用 `electron/picker.html` 显示自定义设备选择弹窗。

自定义设备弹窗：

- 支持 HID 和 BLE 两种类型。
- 根据主窗口 localStorage 中的 `webhmi_lang` 选择中文或英文文案。
- 设备列表更新时复用已有弹窗。
- 用户取消或关闭窗口时向选择回调返回空字符串。

### 9.2 PWA

PWA 配置位于 [vite.config.ts](vite.config.ts)。

配置：

- `registerType: autoUpdate`
- `display: standalone`
- `name: WebHMI`
- `short_name: WebHMI`
- theme/background color 为黑色。
- 包含 192 和 512 尺寸图标。

### 9.3 构建分包

Vite Rollup manual chunks：

- `vendor-react`：React、React DOM、React Router。
- `vendor-dsssp`：DSP 图表库。
- `vendor-proto`：设备 proto 相关代码。
- `vendor-docs`：Markdown 渲染相关依赖。
- `vendor-motion`：motion/framer-motion。

这样可以降低首包耦合，便于浏览器缓存大型依赖。

## 10. 国际化设计

国际化入口位于 [src/locales/i18n.ts](src/locales/i18n.ts)。

支持语言：

- `en`
- `zh-CN`

语言检测顺序：

1. localStorage，key 为 `webhmi_lang`。
2. 浏览器 navigator language。

语言变更时自动设置：

```text
document.documentElement.lang = "zh" | "en"
```

UI 文案：

- 导航、首页、Toast、错误、文档菜单、更新日志使用翻译 JSON。
- DSP 页面中大量参数标签通过 `uiTextKey(text)` 将英文标签转换为 snake_case key，再从 `uiText` 中查找翻译。
- 找不到翻译时回退原始英文标签。

## 11. 参数范围设计

参数范围由 [src/configs/parameterRanges.ts](src/configs/parameterRanges.ts) 管理。

设计原则：

- 前端提供安全默认范围。
- 如果设备 DB 中存在 `minX/maxX/stepX` 字段，优先使用设备返回范围。
- 如果设备返回范围非法，例如 min 大于 max 或 step 小于等于 0，则回退默认范围。
- 相关参数之间做额外约束，例如默认音量不能超过最大音量，最大音量不能低于默认音量。

主要默认范围：

| 参数 | 默认范围 |
| --- | --- |
| EQ freq | 20 到 20000 Hz，step 1 |
| EQ gain | -18 到 12，step 0.1 |
| EQ q | 0.1 到 25，step 0.1 |
| Level | 0 到 100，step 1 |
| Tone | -12 到 12，step 0.1 |
| Compressor threshold | -60 到 0，step 0.1 |
| Compressor ratio | 2 到 100，step 1 |
| Compressor attack | 0 到 500，step 1 |
| Compressor release | 50 到 3000，step 1 |

## 12. 构建与运行

### 12.1 NPM Scripts

| 命令 | 说明 |
| --- | --- |
| `npm run proto:gen` | 根据 `webhmi.proto` 生成 protobuf 静态 JS 和 d.ts。 |
| `npm run dev` | 启动 Vite 开发服务器。 |
| `npm run build` | 构建生产 Web 产物。 |
| `npm run build:github` | 以 GitHub Pages base 构建。 |
| `npm run build:landing` | 以 landing base 构建。 |
| `npm run preview` | 预览构建产物。 |
| `npm run dev:app` | 同时启动 Vite 和 Electron。 |
| `npm run build:app` | 构建 Web 产物并使用 electron-builder 打包。 |
| `npm run lint` | 运行 TypeScript 检查和 ESLint。 |
| `npm run lint:fix` | 运行 ESLint 自动修复。 |

`predev`、`prebuild`、`prelint` 会自动执行 `proto:gen`，确保生成代码与 proto 同步。

### 12.2 开发服务器

开发服务器配置：

- 端口：3003。
- `host: true`。
- `cors: true`。
- `open: true`。
- 提供 `/__log` 开发日志代理，用于把浏览器 console 输出转发到终端。

### 12.3 生产构建

生产构建使用 terser：

- 可通过 `VITE_DROP_CONSOLE=true` 移除 console。
- 保留 debugger，配合反调试逻辑。
- 开启 top level mangle。
- 移除注释。
- 不生成 sourcemap。

### 12.4 Electron 打包

electron-builder 配置：

- `appId: tech.webhmi.app`
- `productName: WebHMI`
- 输出目录：`release`
- 构建资源目录：`public`
- Windows target：`portable`

## 13. 错误处理与用户反馈

### 13.1 连接错误

首页连接失败时：

- 非用户取消类错误通过 destructive toast 显示。
- WebHID/WebBLE 不支持时使用 alert 提示。
- 未配置设备 profile 时使用 alert 提示。

### 13.2 路由保护

`RequireDeviceReady` 用于保护 `/device-demo`：

- 如果已有 `authOk === true` 且 DB 存在，渲染页面。
- 如果 URL 指定 transport 且存在已选设备，尝试静默重连。
- 如果无可重试设备，返回首页。
- 如果连接或鉴权失败，返回首页。

### 13.3 RPC 错误

RPC 层错误包括：

- session 未启动。
- 请求超时。
- 断连。
- 写入失败。
- 加密 counter 溢出。
- 解密失败。
- CRC 校验失败。

其中 CRC、解密和重放类错误会丢弃当前帧，不直接中断 session。

### 13.4 导入错误

导入错误通过 alert 或 Dialog 展示：

- 文件缺少 DB。
- protobuf 解码失败。
- 设备 ID 不匹配。
- 主版本不兼容。
- 次版本或补丁版本不一致。

## 14. 可维护性设计

### 14.1 传输扩展

设备传输通过 `Transport` 接口抽象。新增传输方式时，应实现：

```ts
interface Transport {
  readonly kind: TransportKind
  connect(): Promise<void>
  disconnect(): Promise<void>
  write(bytes: Uint8Array): Promise<void>
  onBytes(handler: TransportOnBytes): () => void
}
```

例如未来增加 Web Serial 或 WebSocket，只需要新增 Transport 实现，并在连接 Hook 中创建对应 `WebhmiClient`。

### 14.2 设备能力扩展

设备能力由 DB 字段决定：

- 字段存在时显示对应控件。
- 字段不存在时隐藏控件。
- 枚举列表存在时使用设备返回列表。
- 参数范围存在时使用设备范围。

因此新增设备型号时，固件只需按 proto 返回对应字段，前端可以自动适配大部分 UI。

### 14.3 协议扩展

新增业务请求建议遵循：

1. 在 `webhmi.proto` 增加 message。
2. 在 `MsgId` 增加消息 ID。
3. 运行 `npm run proto:gen`。
4. 在 `WebhmiClient` 增加业务方法。
5. 在 `useDeviceSession` 或 `useTuningQueue` 暴露对应 action。
6. 如设备会上报事件，在事件分发中加入 decode 和 patch 逻辑。

### 14.4 UI 扩展

新增参数控件建议：

- 优先复用 `ParameterCard`、`NumberControl`、`ToggleControl`、`ToggleGroupControl`。
- 参数 label 使用英文源字符串，并在翻译文件 `uiText` 中增加中英文。
- 禁用状态由 `baseDisabled`、section 是否存在和业务模式共同决定。
- 范围应接入 `parameterRanges`，避免硬编码在 JSX 中。

## 15. 测试建议

### 15.1 静态检查

推荐执行：

```bash
npm run lint
npm run build
```

说明：

- `npm run lint` 会先生成 proto，再运行 TypeScript 和 ESLint。
- `npm run build` 会验证生产构建、分包和 PWA 配置。

### 15.2 连接测试

USB HID：

- 支持浏览器中能看到目标设备。
- 正确过滤 VID/PID/usagePage/usage。
- 连接成功并读取 DB。
- 拔出设备后 Toast 提示并返回首页。
- 重新连接后可恢复调音。

BLE：

- 能扫描到指定 service 的设备。
- 能连接 service 和 characteristic。
- notification 能接收数据。
- writeValue 遇到 GATT busy 时能重试。
- 断开蓝牙后能清理状态并返回首页。

### 15.3 鉴权测试

场景：

- `.env` 缺失 `VITE_AUTH_PUBLIC_KEY_B64`。
- 公钥格式非法。
- 设备签名错误。
- Auth 响应长度不是 128。
- 握手成功后 Set 请求带加密 flag 和 ivSync。
- 收到旧 ivSync 的加密帧会被丢弃。

### 15.4 DB 与调参测试

场景：

- GetDb 九个 section 均能读取并合并。
- 缺失某个 section 时对应 Tab 不显示。
- 参数范围使用设备返回 min/max/step。
- 参数范围非法时回退默认值。
- System 音量、默认音量、最大音量约束正确。
- Music/Mic/Reverb/Echo 参数修改能进入 pending 并 flush。
- 输出自动模式下 EQ/Mixer 禁用。
- 输出手动模式下 EQ/Mixer 可编辑。

### 15.5 EQ 测试

场景：

- 拖拽点修改频率和增益。
- 修改 Q 值。
- 切换滤波器类型。
- LowPass/HighPass 固定 Q。
- 双击恢复单点默认。
- Reset 恢复整组 EQ 默认。
- Bypass 开关生效。
- Mic A/B 联调时变更同步到另一组 EQ。
- Sing/Dance 场景下输出 EQ 分别写入正确字段。

### 15.6 配置文件测试

场景：

- 导出文件扩展名为 `.webhmi`。
- 导出内容不包含 `db.system`。
- 合法配置能导入并应用。
- `deviceId` 不一致时禁止导入。
- 主版本不一致时禁止导入。
- 次版本或补丁版本不一致时弹警告，确认后可导入。
- 演示模式导入只更新本地模拟 DB。
- 在线模式导入会转为 queue patch 并 flush。

### 15.7 异常与重试测试

场景：

- Set 请求发送失败后 pending 不丢失。
- 失败后 500ms 起指数退避，最大 10s。
- 发送中继续修改参数时，发送完成后继续 flush。
- 设备主动事件能 patch 本地 DB。
- SetSystem.currentModeIndex 事件能触发整库刷新。

## 16. 已知边界与注意事项

- 本说明书描述当前代码实现，不代表固件侧全部能力。
- `protocol.md` 是协议说明，`webhmi.proto` 与前端代码是当前实现依据；若文档和实现不一致，应优先核对可运行代码与固件协议。
- 当前用户文档中支持设备列表只列出 HC6288 系列 USB；代码中还配置了 ESP32 HID/BLE profile，可视为调试或兼容 profile。
- 前端反调试和函数 token 检查只能增加篡改成本，不能作为唯一安全边界。
- 浏览器硬件 API 受系统、浏览器和用户授权限制，Safari、Firefox、iOS 系统浏览器存在能力限制。
- WebHID 和 Web Bluetooth 只能在安全上下文中使用，Electron 和 localhost 开发环境需要分别验证。

## 17. 优化落地记录

### 17.1 测试基线

项目新增轻量测试 runner：`scripts/test-runner.mjs`。该 runner 使用项目已有的 esbuild 将 TypeScript 测试打包到系统临时目录，再交给 Node.js 内置 test runner 执行，不新增外部测试依赖。

新增测试覆盖：

- 协议帧 encode/decode、CRC 错误、半包、粘包和噪声恢复。
- DB patch 深度合并、EQ patch 定位和最小化发送。
- 参数范围从设备 DB 派生和非法范围回退。
- DSP EQ 类型映射和面板状态生成。
- `.webhmi` 导出清理、默认文件名、设备 ID 校验和固件版本兼容性校验。
- RPC 请求响应匹配、事件分发、超时、断连、加密帧和重放丢弃。
- WebhmiClient protobuf 请求编码。

新增脚本：

- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

### 17.2 Electron 安全收紧

Electron 主窗口和设备选择弹窗改为：

- `nodeIntegration: false`
- `contextIsolation: true`
- 通过 `electron/preload.cjs` 暴露最小 IPC bridge。

权限处理从全量放行改为仅允许本应用 origin 的 HID/Bluetooth 权限。

### 17.3 结构拆分起点

以下逻辑已从 `GenericTuningPage` 提取为独立 hook 或工具：

- `src/components/dsp/useOutputScene.ts`
- `src/components/dsp/useConfigImportExport.ts`
- `src/components/dsp/useEqPanelState.ts`
- `src/components/dsp/MusicPanel.tsx`
- `src/components/dsp/MicPanel.tsx`
- `src/components/dsp/EffectPanel.tsx`
- `src/components/dsp/OutputPanel.tsx`
- `src/components/dsp/SystemPanel.tsx`

输出场景 helper 包含：

- `getSceneModeFromConfig`
- `getOutputEqForScene`
- `getOutputMixerForScene`
- `mixerPatchForScene`
- `useOutputScene`

导入导出 helper 包含：

- `cleanInternalFields`
- `buildExportConfig`
- `defaultExportFilename`
- `validateImportConfig`
- `encodeExportConfig`
- `useConfigImportExport`

EQ 状态 hook 包含：

- panel state 从 DB 派生。
- 拖拽期间的 UI 乐观更新。
- requestAnimationFrame 合并 UI patch。
- Mic A/B 联调同步。
- EQ 点变更和双击恢复默认的 action 分发。

`MusicPanel` 已承接 Music Tab 的 EQ 面板、输入源、音调、增益和噪声门 UI。`MicPanel` 已承接 Mic Tab 的 A/B EQ 选择、Mic EQ Link 联调复制、FBX、音调、噪声门和压缩器 UI。`EffectPanel` 已承接 Reverb/Echo Tab 的共用 EQ 面板和效果参数 UI，并通过 `kind` 区分 Reverb 与 Echo 的字段集合。

`OutputPanel` 已承接 Main/Sub/Center/Surround 四个输出 Tab，统一处理输出 EQ、Stereo/Mono Output、Mixer、Compressor 和 Auto 模式禁用逻辑。`SystemPanel` 已承接 System Tab，统一处理 BLE 名称、面板锁定、模式切换/保存/重命名、配置导入导出、Dance Mode、默认音量和音量限制。

这些拆分不改变 UI 行为，`GenericTuningPage` 现在主要负责读取 `useTuningState`、准备公共上下文、维护 Tab 可用性并组合各业务 Panel。

### 17.4 数据驱动维护点

以下配置与规则已集中化，便于测试和后续设备扩展：

- `src/configs/deviceProfiles.ts` 统一维护 HID/BLE profile、request filters、已选设备到 profile 的匹配逻辑。
- `src/components/dsp/visibilityRules.ts` 统一维护调音页 Tab 顺序、System 卡片显隐、Mic A/B 选择器显隐、输出 Auto 模式下 EQ/Mixer 禁用策略。
- `src/configs/parameterRanges.ts` 继续统一维护参数默认范围和设备 DB range fallback。
- `WEBHMI_CONFIG_FORMAT.md` 说明 `.webhmi` protobuf 文件结构、导入导出规则、固件版本兼容策略和安全注意事项。

新增 `scripts/mark-generated.mjs`，`npm run proto:gen` 在生成 protobuf 静态文件后会自动给 `src/device/proto/generated/webhmi.js` 和 `webhmi.d.ts` 添加“不手改”标注，并刷新 generated README。

相关测试覆盖 device profile helper、调音页显隐规则、参数范围、导入导出兼容校验。

### 17.5 生产日志

WebhmiClient 的 protobuf payload 日志默认只在开发环境输出。生产环境需要显式设置 `VITE_PROTOCOL_LOGS=true` 才会打印协议 payload，降低发行版泄露调音参数的风险。
