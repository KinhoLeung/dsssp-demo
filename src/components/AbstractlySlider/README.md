# Abstractly Slider (React)

把 `abstractly.io` 首页的金属竖向 slider 抽成了一个可复用的 React 组件，尽量保持原始视觉（外壳渐变、内板刻度、LED、金属手柄）。

## 使用

```jsx
import React from "react";
import { AbstractlySlider } from "./react/AbstractlySlider";

export function Example() {
  const [value, setValue] = React.useState(0);
  return <AbstractlySlider value={value} onChange={setValue} />;
}
```

## Props

- `value` / `defaultValue`: 当前值（0~100，默认 0）
- `onChange(nextValue)`
- `min` / `max` / `step`
- `ledOpacity`：LED 亮度（0~1）。不传时会用 `(value - min) / (max - min)` 自动计算
- `showLed`：是否显示顶部 LED（默认 `true`）
- `ledColor`：LED 亮灯颜色（支持 `#RGB/#RRGGBB`；其它 CSS 颜色会降级为纯色）
- `theme`：`"auto" | "light" | "dark"`（默认 `"auto"`，会跟随页面 `.dark` class）
- `disabled`

## 样式与资源

- 组件会在 `AbstractlySlider.tsx` 内部 `import "./AbstractlySlider.css"`（如果你的框架不允许在组件里引入全局 CSS，把这句移到入口文件即可）。
- 刻度背景：`react/AbstractlySlider/ab-slider-tickmarks.svg`
- 手柄 SVG：`react/AbstractlySlider/AbstractlySliderHandleBg.tsx`
