import * as React from 'react'

import { cn } from '@/lib/utils'

type NumberFieldContextValue = {
  inputId: string
  inputRef: React.MutableRefObject<HTMLInputElement | null>
  inputValue: string
  setInputValue: React.Dispatch<React.SetStateAction<string>>
  commitInputValue: () => void
  stepBy: (direction: 1 | -1) => void
  value?: number
  min?: number
  max?: number
  step: number
  disabled?: boolean
  required?: boolean
  readOnly?: boolean
  name?: string
  invalid?: boolean
}

const NumberFieldContext = React.createContext<NumberFieldContextValue | null>(
  null
)

const useNumberFieldContext = (component: string) => {
  const context = React.useContext(NumberFieldContext)
  if (!context) {
    throw new Error(`${component} must be used within <NumberField />`)
  }
  return context
}

const clamp = (value: number, min?: number, max?: number) => {
  let nextValue = value
  if (min !== undefined) {
    nextValue = Math.max(nextValue, min)
  }
  if (max !== undefined) {
    nextValue = Math.min(nextValue, max)
  }
  return nextValue
}

const MAX_STEP_PRECISION = 6

const getStepPrecision = (step: number) => {
  if (!Number.isFinite(step) || step <= 0) return 0

  const absStep = Math.abs(step)
  const tolerance = Math.max(Number.EPSILON * 100, absStep * 1e-6)

  for (let precision = 0; precision <= MAX_STEP_PRECISION; precision += 1) {
    const rounded = Number(absStep.toFixed(precision))
    if (Math.abs(rounded - absStep) <= tolerance) {
      return precision
    }
  }

  return MAX_STEP_PRECISION
}

const normalizeStep = (step: number) => {
  if (!Number.isFinite(step) || step <= 0) return 1
  const precision = getStepPrecision(step)
  const normalized = Number(step.toFixed(precision))
  return normalized > 0 ? normalized : step
}

const normalizeValue = (
  value: number,
  step: number,
  min?: number,
  max?: number
) => {
  const safeStep = normalizeStep(step)
  const clamped = clamp(value, min, max)
  const stepBase = min ?? 0
  const steps = Math.round((clamped - stepBase) / safeStep)
  const snapped = stepBase + steps * safeStep
  const precision = getStepPrecision(safeStep)
  const factor = Math.pow(10, precision)
  return Math.round(snapped * factor) / factor
}

const parseNumber = (value: string) => {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const formatNumber = (value?: number, step?: number) => {
  if (value === undefined || Number.isNaN(value)) return ''
  if (step !== undefined) {
    const safeStep = normalizeStep(step)
    const precision = getStepPrecision(safeStep)
    const factor = Math.pow(10, precision)
    const rounded = Math.round(value * factor) / factor
    return String(rounded)
  }
  return String(value)
}

export interface NumberFieldProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number | undefined) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  required?: boolean
  readOnly?: boolean
  name?: string
  id?: string
  invalid?: boolean
}

const NumberField = React.forwardRef<HTMLDivElement, NumberFieldProps>(
  (
    {
      className,
      value,
      defaultValue,
      onValueChange,
      min,
      max,
      step = 1,
      disabled,
      required,
      readOnly,
      name,
      id,
      invalid,
      ...props
    },
    ref
  ) => {
    const inputId = React.useId()
    const resolvedId = id ?? inputId
    const inputRef = React.useRef<HTMLInputElement>(null)
    const isControlled = value !== undefined

    const [internalValue, setInternalValue] = React.useState<number | undefined>(
      defaultValue
    )
    const currentValue = isControlled ? value : internalValue

    const [inputValue, setInputValue] = React.useState(
      formatNumber(currentValue, step)
    )

    React.useEffect(() => {
      setInputValue(formatNumber(currentValue, step))
    }, [currentValue, step])

    const updateValue = React.useCallback(
      (nextValue: number | undefined) => {
        if (nextValue === undefined) {
          if (!isControlled) {
            setInternalValue(undefined)
          }
          setInputValue('')
          onValueChange?.(undefined)
          return
        }
        const normalized = normalizeValue(nextValue, step, min, max)
        if (!isControlled) {
          setInternalValue(normalized)
        }
        setInputValue(formatNumber(normalized, step))
        onValueChange?.(normalized)
      },
      [isControlled, max, min, onValueChange, step]
    )

    const commitInputValue = React.useCallback(() => {
      const parsed = parseNumber(inputValue)
      if (parsed === undefined) {
        if (inputValue.trim() === '') {
          updateValue(undefined)
          return
        }
        setInputValue(formatNumber(currentValue))
        return
      }
      updateValue(parsed)
    }, [currentValue, inputValue, updateValue])

    const stepBy = React.useCallback(
      (direction: 1 | -1) => {
        if (disabled || readOnly) return
        const parsed = parseNumber(inputValue)
        const safeStep = normalizeStep(step)
        const base =
          parsed ??
          currentValue ??
          (min !== undefined ? min : 0)
        const nextValue = base + safeStep * direction
        updateValue(nextValue)
      },
      [currentValue, disabled, inputValue, min, readOnly, step, updateValue]
    )

    return (
      <NumberFieldContext.Provider
        value={{
          inputId: resolvedId,
          inputRef,
          inputValue,
          setInputValue,
          commitInputValue,
          stepBy,
          value: currentValue,
          min,
          max,
          step,
          disabled,
          required,
          readOnly,
          name,
          invalid,
        }}
      >
        <div
          data-slot="number-field"
          data-disabled={disabled ? 'true' : undefined}
          data-invalid={invalid ? 'true' : undefined}
          className={cn('group grid gap-2', className)}
          ref={ref}
          {...props}
        />
      </NumberFieldContext.Provider>
    )
  }
)
NumberField.displayName = 'NumberField'

export type NumberFieldGroupProps = React.HTMLAttributes<HTMLDivElement>

const NumberFieldGroup = React.forwardRef<HTMLDivElement, NumberFieldGroupProps>(
  ({ className, ...props }, ref) => {
    const context = useNumberFieldContext('NumberFieldGroup')
    const groupRef = React.useRef<HTMLDivElement | null>(null)

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        groupRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    React.useEffect(() => {
      const element = groupRef.current
      if (!element) return
      const handleWheel = (event: WheelEvent) => {
        if (context.disabled || context.readOnly) return
        if (event.deltaY === 0) return
        event.preventDefault()
        const direction: 1 | -1 = event.deltaY < 0 ? 1 : -1
        context.stepBy(direction)
      }
      element.addEventListener('wheel', handleWheel, { passive: false })
      return () => element.removeEventListener('wheel', handleWheel)
    }, [context.disabled, context.readOnly, context.stepBy])

    return (
      <div
        data-slot="number-field-group"
        className={cn(
          'focus-within:border-ring focus-within:ring-ring/50 border-input has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 has-aria-invalid:border-destructive relative rounded-md border transition-shadow focus-within:ring-[3px]',
          className
        )}
        ref={setRefs}
        {...props}
      />
    )
  }
)
NumberFieldGroup.displayName = 'NumberFieldGroup'

export type NumberFieldLabelProps = React.ComponentPropsWithoutRef<'label'>

const NumberFieldLabel = React.forwardRef<HTMLLabelElement, NumberFieldLabelProps>(
  ({ className, htmlFor, ...props }, ref) => {
    const context = useNumberFieldContext('NumberFieldLabel')

    return (
      <label
        data-slot="number-field-label"
        className={cn(
          'aria-invalid:text-destructive flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          className
        )}
        htmlFor={htmlFor ?? context.inputId}
        ref={ref}
        {...props}
      />
    )
  }
)
NumberFieldLabel.displayName = 'NumberFieldLabel'

export type NumberFieldInputProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'type' | 'value' | 'defaultValue'
>

const NumberFieldInput = React.forwardRef<HTMLInputElement, NumberFieldInputProps>(
  ({ className, onChange, onBlur, onKeyDown, inputMode, ...props }, ref) => {
    const context = useNumberFieldContext('NumberFieldInput')
    const ariaInvalid =
      context.invalid ||
        props['aria-invalid'] === true ||
        props['aria-invalid'] === 'true'
        ? 'true'
        : undefined

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        context.inputRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [context.inputRef, ref]
    )

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      context.setInputValue(event.target.value)
      onChange?.(event)
    }

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      context.commitInputValue()
      onBlur?.(event)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        context.commitInputValue()
      }
      onKeyDown?.(event)
    }

    return (
      <input
        {...props}
        data-slot="number-field-input"
        className={cn(
          'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md bg-transparent px-3 py-1 text-center text-base shadow-xs transition-colors outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        id={context.inputId}
        name={context.name}
        type="number"
        inputMode={inputMode ?? 'decimal'}
        min={context.min}
        max={context.max}
        step={normalizeStep(context.step)}
        required={context.required}
        readOnly={context.readOnly}
        aria-invalid={ariaInvalid}
        disabled={context.disabled}
        value={context.inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        ref={setRefs}
      />
    )
  }
)
NumberFieldInput.displayName = 'NumberFieldInput'

export type NumberFieldDecrementTriggerProps =
  React.ButtonHTMLAttributes<HTMLButtonElement>

const NumberFieldDecrementTrigger = React.forwardRef<
  HTMLButtonElement,
  NumberFieldDecrementTriggerProps
>(({ className, onClick, disabled, ...props }, ref) => {
  const context = useNumberFieldContext('NumberFieldDecrementTrigger')
  const parsed = parseNumber(context.inputValue)
  const currentValue = parsed ?? context.value
  const isAtMin =
    currentValue !== undefined &&
    context.min !== undefined &&
    currentValue <= context.min
  const isDisabled = context.disabled || context.readOnly || disabled || isAtMin

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      context.stepBy(-1)
    }
    onClick?.(event)
  }

  return (
    <button
      type="button"
      data-slot="number-field-decrement-trigger"
      className={cn(
        'absolute top-1/2 left-0 -translate-y-1/2 p-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      onClick={handleClick}
      disabled={isDisabled}
      ref={ref}
      {...props}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M5 12h14"
        />
      </svg>
    </button>
  )
})
NumberFieldDecrementTrigger.displayName = 'NumberFieldDecrementTrigger'

export type NumberFieldIncrementTriggerProps =
  React.ButtonHTMLAttributes<HTMLButtonElement>

const NumberFieldIncrementTrigger = React.forwardRef<
  HTMLButtonElement,
  NumberFieldIncrementTriggerProps
>(({ className, onClick, disabled, ...props }, ref) => {
  const context = useNumberFieldContext('NumberFieldIncrementTrigger')
  const parsed = parseNumber(context.inputValue)
  const currentValue = parsed ?? context.value
  const isAtMax =
    currentValue !== undefined &&
    context.max !== undefined &&
    currentValue >= context.max
  const isDisabled = context.disabled || context.readOnly || disabled || isAtMax

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      context.stepBy(1)
    }
    onClick?.(event)
  }

  return (
    <button
      type="button"
      data-slot="number-field-increment-trigger"
      className={cn(
        'absolute top-1/2 right-0 -translate-y-1/2 p-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      onClick={handleClick}
      disabled={isDisabled}
      ref={ref}
      {...props}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 5v14m-7-7h14"
        />
      </svg>
    </button>
  )
})
NumberFieldIncrementTrigger.displayName = 'NumberFieldIncrementTrigger'

export type NumberFieldErrorMessageProps = React.HTMLAttributes<HTMLDivElement>

const NumberFieldErrorMessage = React.forwardRef<
  HTMLDivElement,
  NumberFieldErrorMessageProps
>(({ className, ...props }, ref) => (
  <div
    data-slot="number-field-error-message"
    className={cn('text-destructive text-sm', className)}
    ref={ref}
    {...props}
  />
))
NumberFieldErrorMessage.displayName = 'NumberFieldErrorMessage'

export type NumberFieldDescriptionProps = React.HTMLAttributes<HTMLDivElement>

const NumberFieldDescription = React.forwardRef<
  HTMLDivElement,
  NumberFieldDescriptionProps
>(({ className, ...props }, ref) => (
  <div
    data-slot="number-field-description"
    className={cn('text-muted-foreground text-sm', className)}
    ref={ref}
    {...props}
  />
))
NumberFieldDescription.displayName = 'NumberFieldDescription'

export {
  NumberField,
  NumberFieldGroup,
  NumberFieldLabel,
  NumberFieldInput,
  NumberFieldDecrementTrigger,
  NumberFieldIncrementTrigger,
  NumberFieldErrorMessage,
  NumberFieldDescription,
}
