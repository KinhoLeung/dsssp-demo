# DSSSP Demo 架构说明

## 总览
- 技术栈：React + TypeScript + Vite，Tailwind 做样式，核心音频/图形逻辑来自本地依赖 `dsssp`。
- 目标：提供滤波器参数编辑与频响可视化，并能通过 WebHID / WebBluetooth（或 Mock）下发到外设（当前以 ESP32S3 为实验对象）。

## UI 组成
- `src/App.tsx`：页面入口，持有整体状态（电源开关、滤波器数组、系数、活跃索引、拖拽状态）。负责：
  - 根据滤波事件更新 `filters`，在 `ended` 时重算 `coefficients`。
  - 在关机时隐藏滤波曲线，仅显示虚线响应。
  - 将当前滤波参数传给 `DevicePanel` 以便一键下发，并在参数变化时自动防抖下发到设备。
- 可视化区域：`dsssp` 提供的 `<FrequencyResponseGraph>` 中组合 `FilterGradient`、`FilterCurve`、`CompositeCurve`、`FilterPoint`、`PointerTracker`。
- 控制面板
  - `Header`：电源按钮（改变 `powered`）、预设选择（`Presets`，含左右切换与 Reset）。
  - `FilterCard`：单个滤波器的卡片，包含：
    - `FilterSelect`：滤波类型下拉，限制为允许列表。
    - `FilterInput` / `SliderInput`：频率、增益、Q 的输入/滑块，带零值禁用逻辑。
  - `DevicePanel`：设备连接与调试（见下）。

## 设备通信层
- Hook：`src/hooks/useDeviceLink.ts`
  - 管理状态：`status`（idle/connecting/connected/error）、`deviceName`、`transport`、`logs`、`lastError`。
  - 暴露操作：`connectHid`、`connectBle`、`connectMock`、`disconnect`、`sendBytes`、`sendJson`。
  - 协议：底层字节流使用 v1 framing（见 `src/utils/framing.ts`），`sendBytes/sendJson` 会自动封包；接收侧按 magic/len/CRC 解出完整帧后再交给业务（目前 payload 仍为原有 auth/JSON 数据）。
  - 日志：记录 TX/RX/INFO/ERROR，自动摘要 payload（可打印字符串或前 16 字节 hex）。
- 客户端实现：`src/devices`
  - `hidClient.ts`：基于 WebHID，支持 reportId、分包发送、inputreport 监听。
  - `bleClient.ts`：基于 Web Bluetooth，使用指定 service/tx/rx UUID，支持 chunk 写入和 notifications。
  - `mockClient.ts`：本地回环，便于 UI/链路调试。
  - `types.ts`：统一接口 `DeviceClient`（connect/send/onMessage 等），并定义日志类型。
- 配置：`src/configs/device.ts` 设定 HID 过滤器、reportId、packetSize，及 BLE 的 service/tx/rx UUID、maxChunkSize。按实际硬件调整即可。
- UI：`DevicePanel`
  - 连接按钮（HID/BLE/Mock/Disconnect），状态灯 + 名称展示。
  - 动作按钮：Ping（`{op:'ping', ts}`）、Send filters（`{op:'filters', payload:{filters, coefficients, sampleRate}}`）；滤波参数变化会自动 debounce 下发。
  - 日志面板：展示最近收发与错误。

## 配置与数据
- `src/configs/scale.ts`：频率/增益/Q 范围与采样率，用于 UI 限制与系数计算。
- `src/configs/presets.ts`：预设滤波器列表，`Presets` 组件加载与切换。
- `src/configs/device.ts`：设备通信参数（上文）。
- 样式：Tailwind + 局部 CSS Modules（如 `SliderInput.module.css`），`App.module.css` 用于背景叠加。

## 数据流与校验
- `FilterCard` 在 `onChange` 时传递 `FilterChangeEvent`，`App` 负责 clamp 到 `scale` 范围，再更新 `filters` 与 `coefficients`。
- `FilterSelect` 对 Safari 做兼容处理，隐藏部分字体符号。
- `SliderInput` 对 log/linear 滑块做映射，记录拖拽状态，仅在释放时触发 `ended`。

## 扩展与对接建议
- 需要定协议时：分配 `msg_id`/`flags` 并约定 payload 编码（protobuf/TLV 等）；当前 framing 已支持扩展头与兼容跳过 ext。
- 如需新增传输方式：实现新的 `DeviceClient`，再在 `useDeviceLink` 暴露对应 connect 方法即可。
- 如需常驻重连/缓存设备：在 `useDeviceLink` 里缓存最近设备信息（IndexedDB）并在加载时尝试静默重连。

## 开发与质量
- 运行：`npm run dev`，构建：`npm run build`。
- 质量：`npm run lint`（tsc + eslint）。当前无额外测试，建议后续为协议编码/解码添加单元测试或基于 Mock 的集成测试。

## 架构示意

```
React/Vite 页面
├─ App.tsx
│  ├─ Header（电源/预设）
│  ├─ DevicePanel（连接/Ping/发送）
│  └─ FrequencyResponseGraph（dsssp 可视化）
│     ├─ FilterGradient / FilterCurve / CompositeCurve
│     └─ FilterPoint / PointerTracker
└─ FilterCard 列表
   ├─ FilterSelect（类型）
   ├─ SliderInput + FilterInput（频率/增益/Q）
   └─ utils（噪声纹理）

通信层（Hook + 客户端）
├─ useDeviceLink
│  ├─ 管理状态：idle/connecting/connected/error
│  ├─ 发送：sendBytes / sendJson
│  └─ 日志：TX/RX/INFO/ERROR
└─ devices/
   ├─ hidClient（WebHID）
   ├─ bleClient（WebBluetooth）
   └─ mockClient（本地回环）

配置与数据
├─ configs/scale.ts（频率/增益/Q 范围、采样率）
├─ configs/presets.ts（预设滤波器）
└─ configs/device.ts（HID filters/reportId/packetSize；BLE service/tx/rx/maxChunk）

核心 DSP 库
└─ dsssp（滤波计算、可视化组件）
```
