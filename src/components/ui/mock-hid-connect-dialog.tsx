import { cn } from '@/lib/utils'

type MockHidConnectDialogProps = {
  className?: string
}

export function MockHidConnectDialog({
  className,
}: MockHidConnectDialogProps) {
  return (
    <div
      className={cn(
        'w-[460px] rounded-xl border border-white/10 bg-[#2f2f32] shadow-[0_12px_40px_rgba(0,0,0,0.55)]',
        className
      )}
      aria-hidden="true"
    >
      <div className="flex h-full min-h-0 flex-col px-3 pt-3">
        <div className="text-[10px] font-semibold leading-[14px] text-white">
          www.mchose.com.cn 想要连接到 HID 设备
        </div>

        <div className="mt-2 flex min-h-0 flex-1 flex-col rounded-sm border border-white/15 bg-[#2b2b2d]">
          <div className="flex h-5 items-center border-b border-white/10 bg-[#2f3d5f] px-3">
            <div className="text-[8px] font-medium tracking-wide text-white">
              MCHOSE X75 V2
            </div>
          </div>
          <div className="min-h-0 flex-1" />
        </div>

        <div className="mt-2 flex justify-end gap-1.5 pb-2">
          <div
            className="pointer-events-none select-none rounded-md border border-white/10 bg-[#2f55f0] px-3 py-1.5 text-[9px] font-semibold text-white"
            role="button"
            aria-disabled="true"
          >
            连接
          </div>
          <div
            className="pointer-events-none select-none rounded-md border border-white/15 bg-[#3a3a3c] px-3 py-1.5 text-[9px] font-semibold text-white"
            role="button"
            aria-disabled="true"
          >
            取消
          </div>
        </div>
      </div>
    </div>
  )
}
