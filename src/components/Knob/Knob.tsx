import * as React from 'react';

import styles from './Knob.module.css';

const KNOB_MIN_ANGLE_DEG = 0;
const KNOB_MAX_ANGLE_DEG = 270;
const TICKS_START_ANGLE_DEG = -135;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getKnobAngleFromPointer(clientX: number, clientY: number, rect: DOMRect) {
  const knobCenterX = rect.left + rect.width / 2;
  const knobCenterY = rect.top + rect.height / 2;

  const dx = clientX - knobCenterX;
  const dy = clientY - knobCenterY;

  const angleFromXAxisDeg = (Math.atan2(dy, dx) * 180) / Math.PI; // [-180, 180]
  const angleCwFromTopDeg = (angleFromXAxisDeg + 90 + 360) % 360; // [0, 360)

  const startCwFromTopDeg = (TICKS_START_ANGLE_DEG + 360) % 360;
  const distanceAlongArcDeg = (angleCwFromTopDeg - startCwFromTopDeg + 360) % 360;

  if (distanceAlongArcDeg < KNOB_MIN_ANGLE_DEG || distanceAlongArcDeg > KNOB_MAX_ANGLE_DEG) return null;
  return distanceAlongArcDeg;
}

function getStepPrecision(step: number) {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const stepString = step.toString().toLowerCase();
  const exponentIndex = stepString.indexOf('e-');
  if (exponentIndex !== -1) {
    const exponent = Number(stepString.slice(exponentIndex + 2));
    return Number.isFinite(exponent) ? exponent : 0;
  }

  const dotIndex = stepString.indexOf('.');
  return dotIndex === -1 ? 0 : stepString.length - dotIndex - 1;
}

function getValueFromAngle(angleDeg: number, min: number, max: number, step: number) {
  if (max <= min) return min;
  if (step <= 0) return clampNumber(min + (angleDeg / KNOB_MAX_ANGLE_DEG) * (max - min), min, max);

  const raw = min + (angleDeg / KNOB_MAX_ANGLE_DEG) * (max - min);
  const steps = Math.round((raw - min) / step);
  const stepped = min + steps * step;

  const precision = Math.min(20, getStepPrecision(step));
  const rounded = precision > 0 ? Number(stepped.toFixed(precision)) : stepped;

  return clampNumber(rounded, min, max);
}

function getAngleFromValue(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * KNOB_MAX_ANGLE_DEG;
}

export type KnobProps = {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  numTicks?: number;
  minLabel?: string;
  maxLabel?: string;
  theme?: 'auto' | 'light' | 'dark';
  disabled?: boolean;
  onChange?: (value: number) => void;
  'aria-label'?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function Knob({
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  numTicks = 27,
  minLabel = 'Min',
  maxLabel = 'Max',
  theme = 'auto',
  disabled = false,
  onChange,
  className,
  style,
  'aria-label': ariaLabel = 'Knob',
}: KnobProps) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() => {
    const initial = defaultValue ?? min;
    return clampNumber(initial, min, max);
  });

  const currentValue = clampNumber(isControlled ? value : uncontrolledValue, min, max);

  const knobSurroundRef = React.useRef<HTMLDivElement | null>(null);
  const knobRef = React.useRef<HTMLDivElement | null>(null);

  const dragPointerIdRef = React.useRef<number | null>(null);
  const dragRectRef = React.useRef<DOMRect | null>(null);

  const setValue = React.useCallback(
    (next: number) => {
      const clamped = clampNumber(next, min, max);
      if (!isControlled) setUncontrolledValue(clamped);
      onChange?.(clamped);
    },
    [isControlled, max, min, onChange],
  );

  const safeStep = step > 0 ? step : 1;
  const angleDeg = getAngleFromValue(currentValue, min, max);
  const tickAngleStep = numTicks > 1 ? KNOB_MAX_ANGLE_DEG / (numTicks - 1) : 0;
  const activeTicks = clampNumber(
    Math.round((angleDeg / KNOB_MAX_ANGLE_DEG) * numTicks),
    0,
    numTicks,
  );

  const updateFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = dragRectRef.current ?? knobSurroundRef.current?.getBoundingClientRect() ?? null;
      if (!rect) return;

      const nextAngle = getKnobAngleFromPointer(clientX, clientY, rect);
      if (nextAngle === null) return;

      setValue(getValueFromAngle(nextAngle, min, max, safeStep));
    },
    [max, min, safeStep, setValue],
  );

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.button !== 0 && event.pointerType !== 'touch') return;

      dragPointerIdRef.current = event.pointerId;
      dragRectRef.current = knobSurroundRef.current?.getBoundingClientRect() ?? null;

      event.currentTarget.setPointerCapture(event.pointerId);
      knobRef.current?.focus();

      updateFromPointer(event.clientX, event.clientY);
    },
    [disabled, updateFromPointer],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (dragPointerIdRef.current !== event.pointerId) return;

      event.preventDefault();
      updateFromPointer(event.clientX, event.clientY);
    },
    [disabled, updateFromPointer],
  );

  const stopDragging = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) return;
    dragPointerIdRef.current = null;
    dragRectRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const bigStep = safeStep * 10;
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          event.preventDefault();
          setValue(currentValue + safeStep);
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          event.preventDefault();
          setValue(currentValue - safeStep);
          break;
        case 'PageUp':
          event.preventDefault();
          setValue(currentValue + bigStep);
          break;
        case 'PageDown':
          event.preventDefault();
          setValue(currentValue - bigStep);
          break;
        case 'Home':
          event.preventDefault();
          setValue(min);
          break;
        case 'End':
          event.preventDefault();
          setValue(max);
          break;
      }
    },
    [currentValue, disabled, max, min, safeStep, setValue],
  );

  const themeClass =
    theme === 'dark'
      ? styles.themeDark
      : theme === 'light'
        ? styles.themeLight
        : styles.themeAuto;

  return (
    <div className={[styles.root, themeClass, className].filter(Boolean).join(' ')} style={style}>
      <div ref={knobSurroundRef} className={styles.knobSurround}>
        <div
          ref={knobRef}
          className={styles.knob}
          style={{ transform: `rotate(${angleDeg}deg)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          role="slider"
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
          aria-disabled={disabled ? 'true' : undefined}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
        />

        <span className={styles.min}>{minLabel}</span>
        <span className={styles.max}>{maxLabel}</span>

        <div className={styles.ticks}>
          {Array.from({ length: numTicks }, (_, index) => {
            const tickAngle = TICKS_START_ANGLE_DEG + index * tickAngleStep;
            const isActive = index < activeTicks;
            return (
              <div
                key={index}
                className={[styles.tick, isActive ? styles.activeTick : ''].filter(Boolean).join(' ')}
                style={{ transform: `rotate(${tickAngle}deg)` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
