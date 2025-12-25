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
            display: flex;
            align-items: center;
            gap: 6px;
            background-color: black;
            padding: 6px;
            border-radius: 8px;
            overflow: hidden;
            height: 94px;
          }

          .media-control-radio-group input {
            display: none;
          }

          .media-control-radio-group__label {
            width: 70px;
            height: 80px;
            background-color: #2a2a2a;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 8px 6px;
            border-top: 1px solid #383838;
            transition: all 0.1s linear;
            position: relative;
            z-index: 2;
          }

          .media-control-radio-group__back-side {
            position: absolute;
            top: -10px;
            left: 0px;
            background-color: #2a2a2a;
            border-radius: 4px 4px 2px 2px;
            width: 100%;
            height: 14px;
            box-shadow:
              inset 0 5px 3px 1px rgba(0, 0, 0, 0.5),
              inset 0px -5px 2px 0px rgba(56, 163, 224, 0.1);
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
            box-shadow: inset 0px -20px 15px 0px rgba(0, 0, 0, 0.5);
            border-top: 1px solid #2589c362;
            margin-top: 6px;
            border-radius: 0 0 4px 4px;
          }

          .media-control-radio-group__text {
            color: black;
            font-size: 15px;
            line-height: 12px;
            padding: 0px;
            font-weight: 800;
            text-transform: uppercase;
            transition: all 0.1s linear;
            text-shadow: -1px -1px 1px rgb(224, 224, 224, 0.1);
          }

          .media-control-radio-group__label input[type="radio"]:checked + .media-control-radio-group__text {
            color: #258ac3;
            text-shadow:
              0px 0px 8px rgb(37, 138, 195),
              1px 1px 2px rgb(0, 0, 0, 1);
          }

          .media-control-radio-group__bottom-line {
            width: 100%;
            height: 4px;
            border-radius: 999px;
            background-color: #2a2a2a;
            box-shadow: 0 0 3px 0px rgb(19, 19, 19);
            border-top: 1px solid #383838;
            transition: all 0.1s linear;
          }

          .media-control-radio-group__label:has(input[type="radio"]:checked) .media-control-radio-group__bottom-line {
            background-color: #1a1a1a;
            border-top: 1px solid #258ac340;
          }
        `}
      </style>
      <div
        className={
          className
            ? `media-control-radio-group ${className}`
            : 'media-control-radio-group'
        }
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
