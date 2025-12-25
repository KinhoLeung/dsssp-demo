import React, { useCallback, useMemo, useRef, useState } from "react";

import ABSliderHandleBg from "./ABSliderHandleBg";
import "./ABSlider.css";

const HANDLE_HEIGHT_PX = 53;
const TRACK_HEIGHT_PX = 210;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPrecision(step) {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

function snapToStep(value, { min, max, step }) {
  const safeStep = step > 0 ? step : 1;
  const precision = getPrecision(safeStep);

  const stepped = Math.round((value - min) / safeStep) * safeStep + min;
  const fixed = precision ? Number(stepped.toFixed(precision)) : stepped;
  return clamp(fixed, min, max);
}

export function ABSlider({
  value,
  defaultValue,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ledOpacity,
  disabled = false,
  className = "",
  style,
  "aria-label": ariaLabel = "Slider",
}) {
  const isControlled = value != null;

  const [internalValue, setInternalValue] = useState(() => {
    const start = defaultValue != null ? defaultValue : min;
    return snapToStep(start, { min, max, step });
  });
  const [dragRatio, setDragRatio] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const currentValue = isControlled ? value : internalValue;
  const visualValue = clamp(currentValue, min, max);

  const trackRef = useRef(null);
  const activePointerIdRef = useRef(null);
  const trackHeightRef = useRef(TRACK_HEIGHT_PX);
  const rafRef = useRef(null);
  const pendingRatioRef = useRef(null);
  const pendingValueRef = useRef(null);
  const lastEmittedValueRef = useRef(null);

  const range = max - min;

  const normalized = useMemo(() => {
    if (range <= 0) return 0;
    return clamp((visualValue - min) / range, 0, 1);
  }, [min, range, visualValue]);

  const resolvedLedOpacity = useMemo(() => {
    if (ledOpacity == null) return normalized;
    return clamp(ledOpacity, 0, 1);
  }, [ledOpacity, normalized]);

  const setValue = useCallback(
    (next) => {
      const stepped = snapToStep(next, { min, max, step });
      if (!isControlled) setInternalValue(stepped);
      onChange?.(stepped);
    },
    [isControlled, max, min, onChange, step]
  );

  const flushFrame = useCallback(() => {
    rafRef.current = null;
    if (pendingRatioRef.current == null) return;

    const ratio = pendingRatioRef.current;
    pendingRatioRef.current = null;
    setDragRatio(ratio);

    if (pendingValueRef.current != null) {
      const nextValue = pendingValueRef.current;
      pendingValueRef.current = null;
      setValue(nextValue);
    }
  }, [setValue]);

  const scheduleFrame = useCallback(
    (ratio) => {
      const rawValue = min + ratio * range;
      pendingRatioRef.current = ratio;
      pendingValueRef.current = rawValue;
      lastEmittedValueRef.current = snapToStep(rawValue, { min, max, step });

      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushFrame);
      }
    },
    [flushFrame, min, range, max, step]
  );

  const updateFromClientY = useCallback(
    (clientY) => {
      const el = trackRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      if (rect.height) trackHeightRef.current = rect.height;
      const y = clientY - rect.top;

      const minY = HANDLE_HEIGHT_PX / 2;
      const maxY = rect.height - HANDLE_HEIGHT_PX / 2;
      const clampedY = clamp(y, minY, maxY);

      const usable = rect.height - HANDLE_HEIGHT_PX;
      const ratio = usable <= 0 ? 0 : 1 - (clampedY - minY) / usable;

      scheduleFrame(ratio);
    },
    [scheduleFrame]
  );

  const onPointerDown = useCallback(
    (e) => {
      if (disabled) return;
      if (e.button != null && e.button !== 0) return;

      e.preventDefault();

      setIsDragging(true);
      activePointerIdRef.current = e.pointerId;
      trackRef.current?.setPointerCapture?.(e.pointerId);

      updateFromClientY(e.clientY);
    },
    [disabled, updateFromClientY]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (disabled) return;
      if (activePointerIdRef.current !== e.pointerId) return;
      e.preventDefault();
      updateFromClientY(e.clientY);
    },
    [disabled, updateFromClientY]
  );

  const endPointer = useCallback(
    (e) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      updateFromClientY(e.clientY);
      activePointerIdRef.current = null;
      setIsDragging(false);
      try {
        trackRef.current?.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    },
    [updateFromClientY]
  );

  const onKeyDown = useCallback(
    (e) => {
      if (disabled) return;

      const safeStep = step > 0 ? step : 1;
      let next = null;

      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          next = currentValue + safeStep;
          break;
        case "ArrowDown":
        case "ArrowLeft":
          next = currentValue - safeStep;
          break;
        case "PageUp":
          next = currentValue + safeStep * 10;
          break;
        case "PageDown":
          next = currentValue - safeStep * 10;
          break;
        case "Home":
          next = min;
          break;
        case "End":
          next = max;
          break;
        default:
          return;
      }

      e.preventDefault();
      setValue(next);
    },
    [currentValue, disabled, max, min, setValue, step]
  );

  React.useEffect(() => {
    if (isControlled) return;
    setInternalValue((prev) => snapToStep(prev, { min, max, step }));
  }, [isControlled, max, min, step]);

  React.useEffect(() => {
    if (disabled) {
      setDragRatio(null);
      setIsDragging(false);
      pendingRatioRef.current = null;
      pendingValueRef.current = null;
      lastEmittedValueRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [disabled]);

  React.useEffect(() => {
    if (isDragging || dragRatio == null) return;
    if (!isControlled) {
      setDragRatio(null);
      return;
    }
    if (lastEmittedValueRef.current == null) return;
    if (Math.abs(currentValue - lastEmittedValueRef.current) < 1e-6) {
      setDragRatio(null);
    }
  }, [currentValue, dragRatio, isControlled, isDragging]);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const updateMetrics = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height) trackHeightRef.current = rect.height;
    };

    updateMetrics();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateMetrics);
      observer.observe(el);
      return () => observer.disconnect();
    }

    const handleResize = () => updateMetrics();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const wrapperClassName = ["ab-slider", className].filter(Boolean).join(" ");
  const visualNormalized = dragRatio == null ? normalized : dragRatio;
  const travel = Math.max(trackHeightRef.current - HANDLE_HEIGHT_PX, 0);
  const translateY = (1 - visualNormalized) * travel;
  const handleTransform = `translate3d(0, ${translateY}px, 0)`;

  return (
    <div className={wrapperClassName} style={style}>
      <div className="ab-slider-led-wrapper" aria-hidden="true">
        <div className="ab-slider-led-off" />
        <div className="ab-slider-led-on" style={{ opacity: resolvedLedOpacity }} />
      </div>

      <div className="ab-slider-innerplate">
        <div
          ref={trackRef}
          className="ab-slider__track"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={visualValue}
          aria-disabled={disabled || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onKeyDown={onKeyDown}
        >
          <div className="ab-slider__handle" style={{ transform: handleTransform }}>
            <ABSliderHandleBg className="inner-handle ab-slider__handle-svg" />
          </div>
        </div>
      </div>
    </div>
  );
}
