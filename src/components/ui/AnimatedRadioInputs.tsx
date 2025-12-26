import { useState } from 'react'

export type AnimatedRadioInputsProps = {
  name?: string
  options?: string[]
  defaultValue?: number
  onChange?: (index: number, option: string) => void
}

const styles = `
.animated-radio-inputs-container {
    display: flex;
    flex-direction: column;
    padding: 50px;
    --ari-container-bg: hsl(0, 0%, 96%);
    --ari-input-shadow: hsla(0, 0%, 0%, 0.12) 0 1px 1px,
        inset hsla(0, 0%, 0%, 0.35) 0 0 0 1px;
    --ari-input-bg: hsla(0, 0%, 100%, 0.85);
    --ari-gradient-0: hsla(200, 100%, 45%, 1);
    --ari-gradient-1: hsla(200, 100%, 55%, 0.85);
    --ari-gradient-2: hsla(200, 100%, 45%, 0.35);
    --ari-gradient-3: hsla(200, 100%, 30%, 0);
    background-color: var(--ari-container-bg);
}

.dark .animated-radio-inputs-container {
    --ari-container-bg: hsl(0, 0%, 20%);
    --ari-input-shadow: hsla(0, 0%, 100%, 0.15) 0 1px 1px,
        inset hsla(0, 0%, 0%, 0.5) 0 0 0 1px;
    --ari-input-bg: hsla(0, 0%, 0%, 0.2);
    --ari-gradient-0: hsla(200, 100%, 90%, 1);
    --ari-gradient-1: hsla(200, 100%, 70%, 1);
    --ari-gradient-2: hsla(200, 100%, 60%, 0.3);
    --ari-gradient-3: hsla(200, 100%, 30%, 0);
}

.animated-radio-input {
    -webkit-appearance: none;
    appearance: none;
    display: block;
    margin: 10px;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    cursor: pointer;
    vertical-align: middle;
    box-shadow: var(--ari-input-shadow);
    background-color: var(--ari-input-bg);
    background-image: radial-gradient(
        var(--ari-gradient-0) 0%,
        var(--ari-gradient-1) 15%,
        var(--ari-gradient-2) 28%,
        var(--ari-gradient-3) 70%
    );
    background-repeat: no-repeat;
    transition: background-position 0.15s cubic-bezier(0.8, 0, 1, 1),
        transform 0.25s cubic-bezier(0.8, 0, 1, 1);
    outline: none;
}

.animated-radio-input:checked {
    transition: background-position 0.2s 0.15s cubic-bezier(0, 0, 0.2, 1),
        transform 0.25s cubic-bezier(0, 0, 0.2, 1);
}

.animated-radio-input:active {
    transform: scale(1.5);
    transition: transform 0.1s cubic-bezier(0, 0, 0.2, 1);
}

/* The up/down direction logic */
.animated-radio-input,
.animated-radio-input:active {
    background-position: 0 24px;
}

.animated-radio-input:checked {
    background-position: 0 0;
}

.animated-radio-input:checked ~ .animated-radio-input,
.animated-radio-input:checked ~ .animated-radio-input:active {
    background-position: 0 -24px;
}
`

const defaultOptions = ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5']

const AnimatedRadioInputs = ({
  name = 'animated-radio',
  options = defaultOptions,
  defaultValue = 0,
  onChange,
}: AnimatedRadioInputsProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(defaultValue)

  const handleChange = (index: number) => {
    setSelectedIndex(index)
    onChange?.(index, options[index])
  }

  return (
    <div className="animated-radio-inputs-container">
      <style>{styles}</style>
      {options.map((option, index) => (
        <input
          key={index}
          type="radio"
          name={name}
          className="animated-radio-input"
          checked={selectedIndex === index}
          onChange={() => handleChange(index)}
          aria-label={option}
        />
      ))}
    </div>
  )
}

export default AnimatedRadioInputs
