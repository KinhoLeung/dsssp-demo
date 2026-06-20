# .webhmi 配置文件格式

`.webhmi` 文件是二进制 protobuf 数据，使用 `webhmi.proto` 中的 `webhmi.DeviceConfig` 编码。

## 顶层结构

```text
DeviceConfig
├── deviceId: string
├── firmwareVersion: string
└── db: DeviceDb
```

`db` 可以包含任意受支持的参数 section：

```text
system
music
mic
reverb
echo
mainOutput
subOutput
center
surround
```

导出时会刻意删除 `db.system`。System 数据包含设备本地设置，例如模式名称、当前模式、BLE 名称、音量限制等字段，不应该被无差别复制到其它设备。

## 导出规则

前端按以下步骤生成导出文件：

1. 深拷贝当前 `DeviceConfig`。
2. 删除 protobufjs 内部字段，即字段名以 `_` 开头的内容。
3. 删除 `db.system`。
4. 使用 `webhmi.DeviceConfig.encode` 编码。
5. 将二进制内容保存为 `<name>.webhmi`，文件类型为 `application/octet-stream`。

## 导入兼容规则

前端使用 `webhmi.DeviceConfig.decode` 解码文件，并在应用 patch 前进行兼容性校验：

| 条件 | 处理结果 |
| --- | --- |
| 缺少 `db` | 作为无效文件拒绝导入。 |
| 文件中的 `deviceId` 和当前设备 `deviceId` 都存在，且二者不一致 | 拒绝导入。 |
| 文件固件主版本和当前设备固件主版本不一致 | 拒绝导入。 |
| 主版本一致，但完整固件版本不一致 | 弹出警告，需要用户确认后继续。 |
| 设备一致且固件兼容 | 应用导入数据。 |

主版本解析规则：先移除版本号开头的 `v` 或 `V`，然后取第一个点号分隔片段。例如 `v1.2.3` 和 `1.4.0` 的主版本都是 `1`。

## 向前兼容

- 当前前端使用的 protobuf 解码器会忽略未知字段。
- 缺失的 section 会被跳过；UI 只会应用导入文件 `db` 中实际存在的 section。
- section 内缺失的字段不会作为变更发送。
- 参数范围校验仍然来自当前设备 DB，而不是导入文件。

## 安全注意事项

- 不要把 `.webhmi` 当作 JSON 编辑；它是 protobuf 二进制文件。
- 除非目标流程明确需要克隆设备本地设置，否则不要在共享预设中包含 `db.system`。
- 修改 `webhmi.proto` 时，需要同步更新本文档，并新增或调整导入导出测试。