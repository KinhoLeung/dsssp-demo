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
              <span>WebHMI platform officially launched, supporting direct interaction with hardware devices via WebHID and Web Bluetooth in modern browsers.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">🔌</span>
              <span>Robust Connection Management: Supports dual-mode connection (USB/HID and Bluetooth/BLE) for plug-and-play and wireless debugging.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">📊</span>
              <span>Real-time Signal Visualization: Provides professional magnitude-frequency response curves, supporting drag-and-drop filter adjustment with synchronized feedback to hardware.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">🎛️</span>
              <span>Full Parameter Control: In-depth adjustment for Music, Mic, Feedback Suppression, Effects, and all Output channels.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">💾</span>
              <span>Cloud Sync & Export: Support exporting device parameters as .webhmi files or restoring configuration from local files.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">📱</span>
              <span>Cross-platform Adaptation: Optimized responsive design for a smooth experience on both PC and mobile devices.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300">
              <span className="mt-1">📚</span>
              <span>Built-in Help Center: Provides detailed user guides, supported device lists, and FAQs.</span>
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
