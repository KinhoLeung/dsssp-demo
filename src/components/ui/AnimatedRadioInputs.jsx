import React, { useState } from 'react';

const styles = `
.animated-radio-inputs-container {
    display: flex;
    flex-direction: column;
    padding: 50px;
    background-color: hsl(0, 0%, 20%);
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
    box-shadow: hsla(0, 0%, 100%, 0.15) 0 1px 1px,
        inset hsla(0, 0%, 0%, 0.5) 0 0 0 1px;
    background-color: hsla(0, 0%, 0%, 0.2);
    background-image: radial-gradient(
        hsla(200, 100%, 90%, 1) 0%,
        hsla(200, 100%, 70%, 1) 15%,
        hsla(200, 100%, 60%, 0.3) 28%,
        hsla(200, 100%, 30%, 0) 70%
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
`;

const AnimatedRadioInputs = ({
    name = 'animated-radio',
    options = ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
    defaultValue = 0,
    onChange
}) => {
    const [selectedIndex, setSelectedIndex] = useState(defaultValue);

    const handleChange = (index) => {
        setSelectedIndex(index);
        if (onChange) {
            onChange(index, options[index]);
        }
    };

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
    );
};

export default AnimatedRadioInputs;
