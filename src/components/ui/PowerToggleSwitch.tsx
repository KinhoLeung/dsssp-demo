import { useId } from 'react'

import { useTheme } from '@/hooks/useTheme'

type PowerToggleSwitchProps = {
  id?: string
  name?: string
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  theme?: 'dark' | 'light'
  className?: string
}

const PowerToggleSwitch = ({
  id,
  name,
  checked,
  defaultChecked,
  onChange,
  theme,
  className,
}: PowerToggleSwitchProps) => {
  const fallbackId = useId()
  const inputId = id ?? `power-toggle-${fallbackId}`
  const { theme: appTheme } = useTheme()
  const resolvedTheme = theme ?? appTheme

  return (
    <>
      <style>
        {`
          .power-toggle-switch {
            --pts-slider-bg: rgb(8, 8, 8);
            --pts-slider-border: black;
            --pts-slider-shadow-off: inset 0px 0px 1px 0px rgba(0, 0, 0, 1),
              inset 90px 0px 50px -50px rgba(126, 4, 4, 0.56);
            --pts-slider-shadow-on: inset 0px 0px 1px 0px rgba(0, 0, 0, 1),
              inset -85px 0px 50px -50px rgba(1, 78, 4, 0.6);

            --pts-btn-bg: linear-gradient(to bottom, #333333, #242323);
            --pts-btn-border: #2b2b2b;
            --pts-btn-shadow-off: 0px 10px 5px 1px rgba(0, 0, 0, 0.15),
              inset 10px 0px 10px -5px rgba(126, 4, 4, 0.1);
            --pts-btn-shadow-on: 0px 10px 5px 1px rgba(0, 0, 0, 0.15),
              inset -10px 0px 10px -5px rgba(1, 112, 4, 0.1);

            --pts-texture-bg: #202020ea;
            --pts-texture-shadow: -0.7px -1.5px 1px 0px rgba(192, 192, 192, 0.3),
              0px 2px 3px rgb(0, 0, 0, 0.3);

            --pts-light-border: #222121;
            --pts-light-off-bg: rgb(230, 14, 14);
            --pts-light-off-shadow: 0px 0px 10px 1px rgb(241, 28, 28);
            --pts-light-on-bg: rgb(35, 158, 4);
            --pts-light-on-shadow: 0px 0px 10px 0px rgb(57, 230, 14);

            width: 100px;
            height: 45px;
          }

          .power-toggle-switch--light {
            --pts-slider-bg: #f4f4f5;
            --pts-slider-border: #d4d4d8;
            --pts-slider-shadow-off: inset 0px 0px 1px 0px rgba(0, 0, 0, 0.08),
              inset 90px 0px 50px -50px rgba(220, 38, 38, 0.12);
            --pts-slider-shadow-on: inset 0px 0px 1px 0px rgba(0, 0, 0, 0.08),
              inset -85px 0px 50px -50px rgba(34, 197, 94, 0.16);

            --pts-btn-bg: linear-gradient(to bottom, #ffffff, #e4e4e7);
            --pts-btn-border: #d4d4d8;
            --pts-btn-shadow-off: 0px 10px 5px 1px rgba(0, 0, 0, 0.08),
              inset 10px 0px 10px -5px rgba(220, 38, 38, 0.08);
            --pts-btn-shadow-on: 0px 10px 5px 1px rgba(0, 0, 0, 0.08),
              inset -10px 0px 10px -5px rgba(34, 197, 94, 0.08);

            --pts-texture-bg: rgba(113, 113, 122, 0.65);
            --pts-texture-shadow: -0.7px -1.5px 1px 0px rgba(255, 255, 255, 0.6),
              0px 2px 3px rgba(0, 0, 0, 0.12);

            --pts-light-border: #d4d4d8;
          }

          .power-toggle-switch input {
            display: none;
          }

          .power-toggle-switch__slider {
            cursor: pointer;
            position: relative;
            width: 100%;
            height: 100%;
            background-color: var(--pts-slider-bg);
            transition: all 0.4s cubic-bezier(0.99, 0.1, 0.1, 0.99);
            border-radius: 5px;
            box-shadow: var(--pts-slider-shadow-off);
            border: 2px solid var(--pts-slider-border);
          }

          .power-toggle-switch__slider-btn {
            position: absolute;
            content: "";
            aspect-ratio: 6/4;
            border-radius: 3px;
            left: 2px;
            top: 2px;
            bottom: 2px;
            right: auto;
            background: var(--pts-btn-bg);
            border: 1px solid var(--pts-btn-border);
            box-shadow: var(--pts-btn-shadow-off);
            transition: all 0.4s cubic-bezier(0.99, 0.1, 0.1, 0.99);
            display: flex;
            align-items: center;
            justify-content: space-around;
          }

          .power-toggle-switch__texture {
            width: 2px;
            height: 70%;
            background-color: var(--pts-texture-bg);
            box-shadow: var(--pts-texture-shadow);
            transition: 0.25s;
          }

          .power-toggle-switch__light {
            width: 4px;
            height: 4px;
            border: 1px solid var(--pts-light-border);
            border-radius: 50%;
            transition: all 0.4s cubic-bezier(0.99, 0.1, 0.1, 0.99);
            background-color: var(--pts-light-off-bg);
            box-shadow: var(--pts-light-off-shadow);
          }

          .power-toggle-switch input:checked + .power-toggle-switch__slider {
            box-shadow: var(--pts-slider-shadow-on);
          }

          .power-toggle-switch input:checked + .power-toggle-switch__slider .power-toggle-switch__slider-btn {
            transform: translateX(66%);
            box-shadow: var(--pts-btn-shadow-on);
          }

          .power-toggle-switch input:checked + .power-toggle-switch__slider .power-toggle-switch__slider-btn .power-toggle-switch__light {
            background-color: var(--pts-light-on-bg);
            box-shadow: var(--pts-light-on-shadow);
          }
        `}
      </style>
      <label
        className={
          [
            'power-toggle-switch',
            resolvedTheme === 'light' ? 'power-toggle-switch--light' : null,
            className,
          ]
            .filter(Boolean)
            .join(' ')
        }
        htmlFor={inputId}
      >
        <input
          id={inputId}
          type="checkbox"
          name={name}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={(event) => onChange?.(event.currentTarget.checked)}
        />
        <div className="power-toggle-switch__slider">
          <div className="power-toggle-switch__slider-btn">
            <div className="power-toggle-switch__light"></div>
            <div className="power-toggle-switch__texture"></div>
            <div className="power-toggle-switch__texture"></div>
            <div className="power-toggle-switch__texture"></div>
            <div className="power-toggle-switch__light"></div>
          </div>
        </div>
      </label>
    </>
  )
}

export default PowerToggleSwitch
