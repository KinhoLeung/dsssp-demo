import React from "react";
import { Timeline } from "@/components/ui/timeline";

export default function Changelog() {
  const data = [
    {
      title: "2025.12.1",
      content: (
        <div>
          <p className="mb-4 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
            WebHMI v1.0.0 - Official Launch
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">🚀</span>
              <span>WebHMI 平台正式发布，支持现代浏览器通过 WebHID 和 Web Bluetooth 与硬件设备直接交互。</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">🔌</span>
              <span>完善的连接管理：支持 USB (HID) 和蓝牙 (BLE) 双模连接，实现即插即用和无线调试。</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">📊</span>
              <span>实时信号可视化：提供专业的幅频响应曲线图，支持拖拽调节滤波器参数，同步反馈至硬件。</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">🎛️</span>
              <span>全参数控制：覆盖音乐、麦克风、反馈抑制、效果器及各通道输出参数的深度调节。</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">💾</span>
              <span>配置云同步与导出：支持将设备参数导出为 .webhmi 文件，或从本地文件快速恢复配置。</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">📱</span>
              <span>多端适配：优化的响应式设计，在 PC 和移动设备上均能获得流畅的操作体验。</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">📚</span>
              <span>内置帮助中心：提供详细的使用指南、支持设备列表及常见问题解答。</span>
            </div>
          </div>
        </div>
      ),
    },
  ];
  return (
    <div className="relative w-full overflow-clip">
      <Timeline data={data} />
    </div>
  );
}
