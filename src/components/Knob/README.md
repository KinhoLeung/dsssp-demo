# React + TypeScript 版本 Knob

已把原来的可拖拽音量旋钮逻辑改成 React 组件（TypeScript + Pointer Events），并尽量保留原来的视觉样式与刻度高亮效果。

## 使用

把下面 3 个文件拷到你的 React(支持 TSX) 项目里：

- `react/Knob.tsx`
- `react/Knob.module.css`
- `react/noise.png`

然后直接使用：

```tsx
import * as React from "react";
import { Knob } from "./Knob";

export function App() {
  const [value, setValue] = React.useState(0);
  return <Knob value={value} onChange={setValue} aria-label="Knob" />;
}
```

想要还原原始 demo 的“拖动即播放并控制 audio.volume”行为，可以参考 `react/Example.tsx`。

## Props

- `value?: number` / `defaultValue?: number`：受控/非受控值
- `min?: number`（默认 `0`）、`max?: number`（默认 `100`）、`step?: number`（默认 `1`）
- `log?: boolean`（默认 `false`）：开启以 10 为底的对数刻度（适合频率等参数；要求 `min`/`max` 都大于 `0`）
- `numTicks?: number`（默认 `27`）
- `minLabel?: string`（默认 `"Min"`）、`maxLabel?: string`（默认 `"Max"`）
- `theme?: "auto" | "light" | "dark"`（默认 `"auto"`，会跟随页面 `.dark` class）
- `disabled?: boolean`
- `onChange?: (value: number) => void`
- `aria-label?: string`（默认 `"Knob"`）
- `className?: string`、`style?: React.CSSProperties`
