import { useId, useMemo, useState } from 'react'

type MediaControlOption = {
  label: string
  value: string
}

type MediaControlRadioGroupProps = {
  name?: string
  options?: MediaControlOption[]
  defaultValue?: string
  onChange?: (value: string) => void
  theme?: 'dark' | 'light' | 'auto'
  className?: string
}

const defaultOptions: MediaControlOption[] = [
  { label: 'play', value: 'play' },
  { label: 'stop', value: 'stop' },
  { label: 'again', value: 'again' },
]

const MediaControlRadioGroup = ({
  name,
  options = defaultOptions,
  defaultValue = '',
  onChange,
  theme = 'auto',
  className,
}: MediaControlRadioGroupProps) => {
  const fallbackName = useId()
  const [selectedValue, setSelectedValue] = useState(defaultValue)
  const groupName = name ?? `media-control-${fallbackName}`

  const normalizedOptions = useMemo(
    () =>
      options.map((option, index) => ({
        ...option,
        id: `${groupName}-${index}`,
      })),
    [groupName, options]
  )

  return (
    <>
      <style>
        {`
          .media-control-radio-group {
            --mc-group-bg: black;
            --mc-key-bg: #2a2a2a;
            --mc-key-border: #383838;
            --mc-back-shadow-top: rgba(0, 0, 0, 0.5);
            --mc-back-shadow-bottom: rgba(56, 163, 224, 0.1);
            --mc-selected-shadow: rgba(0, 0, 0, 0.5);
            --mc-selected-border: #2589c362;
            --mc-text: black;
            --mc-text-shadow: -1px -1px 1px rgb(224, 224, 224, 0.1);
            --mc-checked-text: #258ac3;
            --mc-checked-shadow-glow: rgb(37, 138, 195);
            --mc-checked-shadow-hard: rgb(0, 0, 0, 1);
            --mc-bottom-bg: #2a2a2a;
            --mc-bottom-shadow: rgb(19, 19, 19);
            --mc-bottom-border: #383838;
            --mc-checked-bottom-bg: #1a1a1a;
            --mc-checked-bottom-border: #258ac340;

            display: flex;
            align-items: center;
            gap: 6px;
            background-color: var(--mc-group-bg);
            padding: 6px;
            border-radius: 8px;
            overflow: hidden;
            height: 94px;
          }

          html:not(.dark) .media-control-radio-group:not(.media-control-radio-group--dark):not(.media-control-radio-group--light) {
            --mc-group-bg: #f4f4f5;
            --mc-key-bg: #ffffff;
            --mc-key-border: #e4e4e7;
            --mc-back-shadow-top: rgba(0, 0, 0, 0.08);
            --mc-back-shadow-bottom: rgba(37, 138, 195, 0.12);
            --mc-selected-shadow: rgba(0, 0, 0, 0.12);
            --mc-selected-border: rgba(37, 137, 195, 0.28);
            --mc-text: #111827;
            --mc-text-shadow: 0px 1px 0px rgba(255, 255, 255, 0.6);
            --mc-checked-shadow-glow: rgba(37, 138, 195, 0.55);
            --mc-checked-shadow-hard: rgba(0, 0, 0, 0.15);
            --mc-bottom-bg: #ffffff;
            --mc-bottom-shadow: rgba(0, 0, 0, 0.12);
            --mc-bottom-border: #e4e4e7;
            --mc-checked-bottom-bg: #e4e4e7;
            --mc-checked-bottom-border: rgba(37, 138, 195, 0.22);
          }

          .media-control-radio-group--light {
            --mc-group-bg: #f4f4f5;
            --mc-key-bg: #ffffff;
            --mc-key-border: #e4e4e7;
            --mc-back-shadow-top: rgba(0, 0, 0, 0.08);
            --mc-back-shadow-bottom: rgba(37, 138, 195, 0.12);
            --mc-selected-shadow: rgba(0, 0, 0, 0.12);
            --mc-selected-border: rgba(37, 137, 195, 0.28);
            --mc-text: #111827;
            --mc-text-shadow: 0px 1px 0px rgba(255, 255, 255, 0.6);
            --mc-checked-shadow-glow: rgba(37, 138, 195, 0.55);
            --mc-checked-shadow-hard: rgba(0, 0, 0, 0.15);
            --mc-bottom-bg: #ffffff;
            --mc-bottom-shadow: rgba(0, 0, 0, 0.12);
            --mc-bottom-border: #e4e4e7;
            --mc-checked-bottom-bg: #e4e4e7;
            --mc-checked-bottom-border: rgba(37, 138, 195, 0.22);
          }

          .media-control-radio-group--dark {
          }

          .media-control-radio-group input {
            display: none;
          }

          .media-control-radio-group__label {
            width: 70px;
            height: 80px;
            background-color: var(--mc-key-bg);
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 8px 6px;
            border-top: 1px solid var(--mc-key-border);
            transition: all 0.1s linear;
            position: relative;
            z-index: 2;
          }

          .media-control-radio-group__back-side {
            position: absolute;
            top: -10px;
            left: 0px;
            background-color: var(--mc-key-bg);
            border-radius: 4px 4px 2px 2px;
            width: 100%;
            height: 14px;
            box-shadow:
              inset 0 5px 3px 1px var(--mc-back-shadow-top),
              inset 0px -5px 2px 0px var(--mc-back-shadow-bottom);
            transform: perspective(300px) rotateX(50deg);
            z-index: 1;
            opacity: 0;
            transition: all 0.1s linear;
          }

          .media-control-radio-group__label:has(input[type="radio"]:checked) .media-control-radio-group__back-side {
            opacity: 1;
          }

          .media-control-radio-group__label:has(input[type="radio"]:checked) {
            transform: perspective(200px) rotateX(-18deg);
            transform-origin: 50% 40%;
            box-shadow: inset 0px -20px 15px 0px var(--mc-selected-shadow);
            border-top: 1px solid var(--mc-selected-border);
            margin-top: 6px;
            border-radius: 0 0 4px 4px;
          }

          .media-control-radio-group__text {
            color: var(--mc-text);
            font-size: 15px;
            line-height: 12px;
            padding: 0px;
            font-weight: 800;
            text-transform: uppercase;
            transition: all 0.1s linear;
            text-shadow: var(--mc-text-shadow);
          }

          .media-control-radio-group__label input[type="radio"]:checked + .media-control-radio-group__text {
            color: var(--mc-checked-text);
            text-shadow:
              0px 0px 8px var(--mc-checked-shadow-glow),
              1px 1px 2px var(--mc-checked-shadow-hard);
          }

          .media-control-radio-group__bottom-line {
            width: 100%;
            height: 4px;
            border-radius: 999px;
            background-color: var(--mc-bottom-bg);
            box-shadow: 0 0 3px 0px var(--mc-bottom-shadow);
            border-top: 1px solid var(--mc-bottom-border);
            transition: all 0.1s linear;
          }

          .media-control-radio-group__label:has(input[type="radio"]:checked) .media-control-radio-group__bottom-line {
            background-color: var(--mc-checked-bottom-bg);
            border-top: 1px solid var(--mc-checked-bottom-border);
          }
        `}
      </style>
      <div
        className={[
          'media-control-radio-group',
          theme === 'light' ? 'media-control-radio-group--light' : null,
          theme === 'dark' ? 'media-control-radio-group--dark' : null,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {normalizedOptions.map((option) => (
          <label
            className="media-control-radio-group__label"
            key={option.value}
          >
            <div className="media-control-radio-group__back-side"></div>
            <input
              type="radio"
              id={option.id}
              name={groupName}
              value={option.value}
              checked={selectedValue === option.value}
              onChange={() => {
                setSelectedValue(option.value)
                onChange?.(option.value)
              }}
            />
            <span className="media-control-radio-group__text">
              {option.label}
            </span>
            <span className="media-control-radio-group__bottom-line"></span>
          </label>
        ))}
      </div>
    </>
  )
}

export default MediaControlRadioGroup
