import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

import {
    useToast,
} from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function Toaster() {
    const { toasts, dismiss } = useToast()

    return (
        <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
            {toasts.map(function ({ id, title, description, action, type, variant, ...props }) {
                const isDestructive = variant === 'destructive' || type === 'destructive'
                const isSuccess = variant === 'success' || type === 'success'
                const isWarning = variant === 'warning' || type === 'warning'
                const isInfo = variant === 'info' || type === 'info'

                return (
                    <div
                        key={id}
                        className={cn(
                            'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all animate-in slide-in-from-top-full data-[state=open]:slide-in-from-top-full sm:slide-in-from-bottom-full',
                            isDestructive && 'border-destructive bg-destructive text-destructive-foreground',
                            isSuccess && 'border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100 dark:border-green-800',
                            isWarning && 'border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-800',
                            isInfo && 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800',
                            !isDestructive && !isSuccess && !isWarning && !isInfo && 'bg-background text-foreground'
                        )}
                        {...props}
                    >
                        <div className="flex gap-3 items-start">
                            {isSuccess && <CheckCircle2 className="size-5 shrink-0" />}
                            {isDestructive && <AlertCircle className="size-5 shrink-0" />}
                            {isWarning && <AlertTriangle className="size-5 shrink-0" />}
                            {(isInfo || (!isSuccess && !isDestructive && !isWarning)) && <Info className="size-5 shrink-0" />}

                            <div className="grid gap-1">
                                {title && <div className="text-sm font-semibold">{title}</div>}
                                {description && (
                                    <div className="text-sm opacity-90">{description}</div>
                                )}
                            </div>
                        </div>
                        {action}
                        <button
                            onClick={() => dismiss(id)}
                            className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}
