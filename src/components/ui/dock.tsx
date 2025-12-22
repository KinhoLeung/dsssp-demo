import React, {
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import type { MotionProps } from "motion/react"

import { cn } from "@/lib/utils"

type DockActivationMode = "automatic" | "manual"

type DockTabsContextValue = {
  activeValue?: string
  setValue?: (value: string) => void
  baseId?: string
}

const DockTabsContext = React.createContext<DockTabsContextValue | null>(null)

const composeEventHandlers = <E extends React.SyntheticEvent>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void
) => {
  return (event: E) => {
    theirs?.(event)
    if (!event.defaultPrevented) {
      ours(event)
    }
  }
}

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string
  iconSize?: number
  iconMagnification?: number
  disableMagnification?: boolean
  iconDistance?: number
  direction?: "top" | "middle" | "bottom"
  separatorIndices?: number[]
  separatorClassName?: string
  tabs?: boolean
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  activationMode?: DockActivationMode
  loop?: boolean
  ariaLabel?: string
  children: React.ReactNode
}

const DEFAULT_SIZE = 40
const DEFAULT_MAGNIFICATION = 60
const DEFAULT_DISTANCE = 140
const DEFAULT_DISABLEMAGNIFICATION = false
const DEFAULT_ACTIVATION_MODE: DockActivationMode = "automatic"
const DEFAULT_LOOP = true
const DEFAULT_SEPARATOR_CLASS =
  "h-full w-px shrink-0 bg-black/10 dark:bg-white/20"

const dockVariants = cva(
  "supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 mx-auto mt-8 flex h-[58px] w-max items-center justify-center gap-2 rounded-2xl border p-2 backdrop-blur-md"
)

const toSafeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_")

export interface DockTabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

const DockTabs = ({
  value,
  defaultValue,
  onValueChange,
  children,
}: DockTabsProps) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
  const isControlled = value !== undefined
  const activeValue = isControlled ? value : uncontrolledValue
  const baseId = useId()

  const setValue = useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue)
      }
      onValueChange?.(nextValue)
    },
    [isControlled, onValueChange]
  )

  return (
    <DockTabsContext.Provider value={{ activeValue, setValue, baseId }}>
      {children}
    </DockTabsContext.Provider>
  )
}

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      iconSize = DEFAULT_SIZE,
      iconMagnification = DEFAULT_MAGNIFICATION,
      disableMagnification = DEFAULT_DISABLEMAGNIFICATION,
      iconDistance = DEFAULT_DISTANCE,
      direction = "middle",
      separatorIndices,
      separatorClassName,
      tabs = false,
      value,
      defaultValue,
      onValueChange,
      activationMode = DEFAULT_ACTIVATION_MODE,
      loop = DEFAULT_LOOP,
      ariaLabel,
      ...props
    },
    ref
  ) => {
    const context = useContext(DockTabsContext)
    const mouseX = useMotionValue(Infinity)
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
    const tabRefs = useRef<Array<HTMLDivElement | null>>([])
    const baseId = useId()
    const tabsEnabled =
      tabs || value !== undefined || defaultValue !== undefined || !!context

    const tabValues = useMemo(() => {
      let tabIndex = 0
      return React.Children.toArray(children).reduce<string[]>((acc, child) => {
        if (
          React.isValidElement<DockIconProps>(child) &&
          child.type === DockIcon
        ) {
          const fallbackValue =
            child.key !== null && child.key !== undefined
              ? String(child.key)
              : String(tabIndex)
          const itemValue = child.props.value ?? fallbackValue
          acc.push(itemValue)
          tabIndex += 1
        }
        return acc
      }, [])
    }, [children])
    const tabValuesKey = tabValues.join("|")
    const activeValue = tabsEnabled
      ? context?.setValue
        ? context.activeValue
        : value ?? uncontrolledValue
      : undefined
    const resolvedActiveValue = tabsEnabled
      ? activeValue ?? tabValues[0]
      : undefined
    const resolvedBaseId = context?.baseId ?? baseId

    const setValue = useCallback(
      (nextValue: string) => {
        if (!tabsEnabled) return
        if (context?.setValue) {
          context.setValue(nextValue)
          return
        }
        if (value === undefined) {
          setUncontrolledValue(nextValue)
        }
        onValueChange?.(nextValue)
      },
      [tabsEnabled, context, value, onValueChange]
    )

    useEffect(() => {
      if (!tabsEnabled || context?.setValue || value !== undefined) return
      if (tabValues.length === 0) return
      if (!activeValue || !tabValues.includes(activeValue)) {
        setUncontrolledValue(tabValues[0])
      }
    }, [tabsEnabled, context, value, activeValue, tabValuesKey, tabValues])

    useEffect(() => {
      if (!tabsEnabled || !context?.setValue) return
      if (tabValues.length === 0) return
      if (!activeValue || !tabValues.includes(activeValue)) {
        context.setValue(tabValues[0])
      }
    }, [tabsEnabled, context, activeValue, tabValuesKey, tabValues])

    const renderChildren = () => {
      const items = React.Children.toArray(children)
      const separatorPositions = new Set(separatorIndices ?? [])
      const rendered: React.ReactNode[] = []
      let tabIndex = 0

      const renderSeparator = (index: number) => (
        <span
          key={`separator-${index}`}
          aria-hidden="true"
          className={cn(DEFAULT_SEPARATOR_CLASS, separatorClassName)}
        />
      )

      const focusTabByIndex = (nextIndex: number, shouldActivate: boolean) => {
        const tabCount = tabValues.length
        if (tabCount === 0) return
        let targetIndex = nextIndex
        if (loop) {
          if (targetIndex < 0) targetIndex = tabCount - 1
          if (targetIndex >= tabCount) targetIndex = 0
        } else {
          targetIndex = Math.max(0, Math.min(tabCount - 1, targetIndex))
        }
        tabRefs.current[targetIndex]?.focus()
        if (shouldActivate) {
          setValue(tabValues[targetIndex])
        }
      }

      items.forEach((child, index) => {
        if (separatorPositions.has(index)) {
          rendered.push(renderSeparator(index))
        }

        if (
          React.isValidElement<DockIconProps>(child) &&
          child.type === DockIcon
        ) {
          const currentTabIndex = tabIndex
          const fallbackValue =
            child.key !== null && child.key !== undefined
              ? String(child.key)
              : String(tabIndex)
          const itemValue = child.props.value ?? fallbackValue
          const safeValue = toSafeId(itemValue)
          const tabId = resolvedBaseId
            ? `${resolvedBaseId}-tab-${safeValue}`
            : undefined
          const panelId = resolvedBaseId
            ? `${resolvedBaseId}-panel-${safeValue}`
            : undefined
          const isActive = tabsEnabled && itemValue === resolvedActiveValue
          const tabProps = tabsEnabled
            ? {
                role: "tab",
                id: tabId,
                "aria-selected": isActive,
                "aria-controls": panelId,
                "data-state": isActive ? "active" : "inactive",
                "data-dock-tab": "true",
                tabIndex: isActive ? 0 : -1,
                ref: (node: HTMLDivElement | null) => {
                  tabRefs.current[currentTabIndex] = node
                },
                onClick: composeEventHandlers(child.props.onClick, () => {
                  setValue(itemValue)
                }),
                onFocus: composeEventHandlers(child.props.onFocus, () => {
                  if (activationMode === "automatic") {
                    setValue(itemValue)
                  }
                }),
                onKeyDown: composeEventHandlers(
                  child.props.onKeyDown,
                  (event: React.KeyboardEvent<HTMLDivElement>) => {
                    switch (event.key) {
                      case "ArrowRight":
                        event.preventDefault()
                        focusTabByIndex(
                          currentTabIndex + 1,
                          activationMode === "automatic"
                        )
                        break
                      case "ArrowLeft":
                        event.preventDefault()
                        focusTabByIndex(
                          currentTabIndex - 1,
                          activationMode === "automatic"
                        )
                        break
                      case "Home":
                        event.preventDefault()
                        focusTabByIndex(0, activationMode === "automatic")
                        break
                      case "End":
                        event.preventDefault()
                        focusTabByIndex(
                          tabValues.length - 1,
                          activationMode === "automatic"
                        )
                        break
                      case "Enter":
                      case " ":
                        event.preventDefault()
                        setValue(itemValue)
                        break
                      default:
                        break
                    }
                  }
                ),
              }
            : {}

          rendered.push(
            React.cloneElement(child, {
              ...child.props,
              mouseX: mouseX,
              size: iconSize,
              magnification: iconMagnification,
              disableMagnification: disableMagnification,
              distance: iconDistance,
              ...tabProps,
            })
          )
          tabIndex += 1
          return
        }

        rendered.push(child)
      })

      if (separatorPositions.has(items.length)) {
        rendered.push(renderSeparator(items.length))
      }

      return rendered
    }

    return (
      <motion.div
        ref={ref}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        {...props}
        role={tabsEnabled ? "tablist" : undefined}
        aria-orientation={tabsEnabled ? "horizontal" : undefined}
        aria-label={ariaLabel}
        className={cn(dockVariants({ className }), {
          "items-start": direction === "top",
          "items-center": direction === "middle",
          "items-end": direction === "bottom",
        })}
      >
        {renderChildren()}
      </motion.div>
    )
  }
)

Dock.displayName = "Dock"
DockTabs.displayName = "DockTabs"

export interface DockIconProps
  extends Omit<MotionProps & React.HTMLAttributes<HTMLDivElement>, "children"> {
  size?: number
  magnification?: number
  disableMagnification?: boolean
  distance?: number
  mouseX?: MotionValue<number>
  value?: string
  tooltip?: React.ReactNode
  tooltipSide?: "top" | "bottom" | "left" | "right"
  tooltipClassName?: string
  className?: string
  children?: React.ReactNode
  props?: PropsWithChildren
}

const DockIcon = React.forwardRef<HTMLDivElement, DockIconProps>(
  (
    {
      size = DEFAULT_SIZE,
      magnification = DEFAULT_MAGNIFICATION,
      disableMagnification,
      distance = DEFAULT_DISTANCE,
      mouseX,
      tooltip,
      tooltipSide = "top",
      tooltipClassName,
      className,
      children,
      ...props
    },
    forwardedRef
  ) => {
    const ref = useRef<HTMLDivElement>(null)
    const padding = Math.max(6, size * 0.2)
    const defaultMouseX = useMotionValue(Infinity)
    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        ref.current = node
        if (typeof forwardedRef === "function") {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      },
      [forwardedRef]
    )

    const distanceCalc = useTransform(mouseX ?? defaultMouseX, (val: number) => {
      const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
      return val - bounds.x - bounds.width / 2
    })

    const targetSize = disableMagnification ? size : magnification

    const sizeTransform = useTransform(
      distanceCalc,
      [-distance, 0, distance],
      [size, targetSize, size]
    )

    const scaleSize = useSpring(sizeTransform, {
      mass: 0.1,
      stiffness: 150,
      damping: 12,
    })

    const tooltipPositionClass = {
      top: "bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-2 origin-top",
      left: "right-full top-1/2 -translate-y-1/2 mr-2 origin-right",
      right: "left-full top-1/2 -translate-y-1/2 ml-2 origin-left",
    }[tooltipSide]

    return (
      <motion.div
        ref={setRefs}
        style={{ width: scaleSize, height: scaleSize, padding }}
        className={cn(
          "group relative flex aspect-square cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10",
          disableMagnification && "hover:bg-muted-foreground",
          className
        )}
        {...props}
      >
        <div>{children}</div>
        {tooltip ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-xs text-white opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 dark:bg-white/90 dark:text-black",
              "scale-95",
              tooltipPositionClass,
              tooltipClassName
            )}
          >
            {tooltip}
          </span>
        ) : null}
      </motion.div>
    )
  }
)

DockIcon.displayName = "DockIcon"

export interface DockPanelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  forceMount?: boolean
}

const DockPanel = React.forwardRef<HTMLDivElement, DockPanelProps>(
  ({ value, forceMount = false, className, ...props }, ref) => {
    const context = useContext(DockTabsContext)
    const hasContext = !!context?.setValue || context?.activeValue !== undefined
    const isActive = hasContext ? context?.activeValue === value : true
    const safeValue = toSafeId(value)
    const panelId = context?.baseId
      ? `${context.baseId}-panel-${safeValue}`
      : undefined
    const tabId = context?.baseId
      ? `${context.baseId}-tab-${safeValue}`
      : undefined
    const shouldRender = forceMount || !hasContext || isActive

    if (!shouldRender) {
      return null
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId}
        data-state={isActive ? "active" : "inactive"}
        hidden={hasContext ? !isActive : false}
        className={cn(className)}
        {...props}
      />
    )
  }
)

DockPanel.displayName = "DockPanel"

export { Dock, DockIcon, DockPanel, DockTabs, dockVariants }
