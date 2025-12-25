import React, { useId, useState } from 'react';

export interface TiltedRadioOption {
  label: string;
  value: string;
}

export interface TiltedRadioGroupProps {
  options?: TiltedRadioOption[];
  defaultValue?: string;
  name?: string;
  onChange?: (value: string) => void;
  className?: string;
}

const defaultOptions: TiltedRadioOption[] = [
  { label: 'Play', value: 'value-1' },
  { label: 'Stop', value: 'value-2' },
  { label: 'Reset', value: 'value-3' },
];

const TiltedRadioGroup: React.FC<TiltedRadioGroupProps> = ({
  options = defaultOptions,
  defaultValue = 'value-1',
  name,
  onChange,
  className = '',
}) => {
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const internalId = useId();
  const radioGroupName = name || `radio-group-${internalId}`;

  const handleValueChange = (value: string) => {
    setSelectedValue(value);
    onChange?.(value);
  };

  return (
    <div className={`tilted-radio-wrapper ${className}`}>
      <style>{`
        .radio-input {
          display: flex;
          align-items: center;
          gap: 2px;
          background-color: black;
          padding: 4px;
          border-radius: 10px;
          position: relative;
          z-index: 1;
        }

        .radio-input input {
          display: none;
        }

        .radio-input .label {
          box-sizing: border-box; /* 确保边框不影响高度 */
          width: 90px;
          height: 60px;
          background: linear-gradient(to bottom, #333333, rgb(36, 35, 35));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px;
          /* 针对性过渡，避免全部重绘 */
          transition: background 0.1s linear, box-shadow 0.1s linear, border-color 0.1s linear;
          border-top: 1px solid #4e4d4d;
          position: relative;
          cursor: pointer;
          box-shadow: 0px 17px 5px 1px rgba(0, 0, 0, 0.2);
        }

        /* 使用类名替代 :has() 提高 React 渲染效率 */
        .radio-input .label.is-active {
          box-shadow: 0px 17px 5px 1px rgba(0, 0, 0, 0);
          background: linear-gradient(to bottom, #1d1d1d, #1d1d1d);
          border-top-color: transparent; /* 使用透明色而非 none，保持布局垂直方向稳定 */
        }

        .radio-input .label:first-of-type {
          border-top-left-radius: 6px;
          border-bottom-left-radius: 6px;
        }

        .radio-input .label:last-of-type {
          border-top-right-radius: 6px;
          border-bottom-right-radius: 6px;
        }

        .radio-input .label::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 103%;
          height: 100%;
          border-radius: 10px;
          background: linear-gradient(
            to bottom,
            rgba(202, 226, 253, 0) 10%,
            rgba(202, 226, 253, 0),
            rgba(202, 226, 253, 0) 90%
          );
          transition: background 0.1s linear;
          z-index: -1;
          pointer-events: none;
        }

        .radio-input .label.is-active::before {
          background: linear-gradient(
            to bottom,
            transparent 10%,
            #cae2fd63,
            transparent 90%
          );
        }

        .radio-input .label .text {
          color: black;
          font-size: 15px;
          line-height: 12px;
          font-weight: 800;
          text-transform: uppercase;
          transition: color 0.1s linear, text-shadow 0.1s linear;
          text-shadow:
            -1px -1px 1px rgb(224, 224, 224, 0.1),
            0px 2px 3px rgb(0, 0, 0, 0.3);
          pointer-events: none;
        }

        .radio-input .label.is-active .text {
          color: rgb(202, 226, 253);
          text-shadow: 0px 0px 12px #cae2fd;
        }
      `}</style>

      <div className="radio-input">
        {options.map((option) => {
          const isActive = selectedValue === option.value;
          return (
            <label 
              key={`${radioGroupName}-${option.value}`} 
              className={`label ${isActive ? 'is-active' : ''}`}
            >
              <input
                type="radio"
                name={radioGroupName}
                value={option.value}
                checked={isActive}
                onChange={() => handleValueChange(option.value)}
              />
              <span className="text">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default TiltedRadioGroup;