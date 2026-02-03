import { Timeline } from "@/components/ui/timeline";
import { useTranslation } from "react-i18next";

export default function Changelog() {
  const { t } = useTranslation();
  const icons = ["🚀", "🔌", "📊", "🎛️", "💾", "📱", "📚"];
  const items = t("changelog.v1_0_0.items", { returnObjects: true }) as string[];

  const data = [
    {
      title: "2025.12.1",
      content: (
        <div>
          <p className="mb-4 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
            {t("changelog.v1_0_0.title")}
          </p>
          <div className="space-y-3">
            {items.map((text, idx) => (
              <div
                key={String(idx)}
                className="flex items-start gap-2 text-xs text-neutral-700 md:text-sm dark:text-neutral-300"
              >
                <span className="mt-1">{icons[idx] ?? "•"}</span>
                <span>{text}</span>
              </div>
            ))}
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
