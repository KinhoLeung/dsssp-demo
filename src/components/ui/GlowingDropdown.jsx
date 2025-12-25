import React, { useState, useRef, useEffect } from 'react';

const styles = `
@font-face {
    font-family: "Mona Sans";
    src: url("https://assets.codepen.io/64/Mona-Sans.woff2") format("woff2 supports variations"),
        url("https://assets.codepen.io/64/Mona-Sans.woff2") format("woff2-variations");
    font-weight: 100 1000;
}

@layer properties {
    @property --max-height {
        syntax: '<number>';
        inherits: true;
        initial-value: 0;
    }

    @property --bg-x {
        syntax: '<number>';
        inherits: true;
        initial-value: 50;
    }

    @property --bg-y {
        syntax: '<number>';
        inherits: true;
        initial-value: -200;
    }

    @property --scale {
        syntax: '<number>';
        inherits: true;
        initial-value: 1;
    }

    @property --accent-color-hue {
        syntax: '<number>';
        inherits: true;
        initial-value: 0;
    }

    @property --accent-color-hue {
        syntax: '<number>';
        inherits: true;
        initial-value: 0;
    }

    @property --item-y {
        syntax: '<number>';
        inherits: true;
        initial-value: 0;
    }

    @property --item-opacity {
        syntax: '<number>';
        inherits: true;
        initial-value: 0;
    }

    @property --accent-color {
        syntax: '<color>';
        inherits: true;
        initial-value: hsl(calc(var(--accent-color-hue)*1deg) 100% 58%);
    }

    @property --radial-bg-color {
        syntax: '<color>';
        inherits: true;
        initial-value: black;
    }
}

.glowing-dropdown-select {
    --background-color: hsl(222deg 17% 14%);
    --dark-color: hsl(227deg 37% 3%);
    --light-color: hsl(211deg 23% 51%);
    --accent-color-hue: 219;
    --accent-color: hsl(calc(var(--accent-color-hue)*1deg) 100% 58%);
    --radial-bg-color: var(--dark-color);
    --max-height: 0;
    --bg-y: -50;
    --bg-x: 200;
    --item-y: 20;
    --item-opacity: 0;

    /* Misc */
    --_inner-radius: 10;
    --_inner-padding: 6;
    --inner-radius: calc(var(--_inner-radius) * 1px);
    --inner-padding: calc(var(--_inner-padding) * 1px);
    --outer-radius: calc(calc(var(--_inner-radius) + var(--_inner-padding)) * 1px);
    --debug: 0;
    --a11y: 0;
    --outline-color: hsla(calc(var(--accent-color-hue)*1deg) 100% 58% / calc(var(--a11y)*100%));

    color: white;
    background: var(--dark-color) radial-gradient(ellipse 70% 70% at calc(var(--bg-x)*1%) calc(var(--bg-y)*1%), var(--radial-bg-color) 0%, var(--dark-color) 100%);
    padding: var(--inner-padding);
    border-radius: var(--outer-radius);
    position: relative;
    width: 200px;
    z-index: 1;
    transition: background .3s ease, --bg-y .4s ease, --bg-x .4s ease;
    font-family: "Mona sans", sans-serif;
}

.glowing-dropdown-select:hover {
    animation: glow 1.2s ease-in-out;
}

.glowing-dropdown-select:hover>button:after {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='58' height='98' fill='none'%3E%3Cpath fill='hsl(219deg 100% 58%)' d='M25.536 6c1.54-2.667 5.388-2.667 6.928 0l18.187 31.5c1.54 2.667-.385 6-3.465 6H10.814c-3.079 0-5.003-3.333-3.464-6L25.536 6ZM25.536 92c1.54 2.667 5.388 2.667 6.928 0l18.187-31.5c1.54-2.667-.385-6-3.465-6H10.814c-3.079 0-5.003 3.333-3.464 6L25.536 92Z'/%3E%3C/svg%3E")no-repeat center center / 0.6em;
}

.glowing-dropdown-select:before {
    content: '';
    display: block;
    position: absolute;
    width: calc(100% - 2px);
    height: calc(100% - 2px);
    top: 1px;
    left: 1px;
    background: var(--dark-color);
    border-radius: var(--outer-radius);
    z-index: -1;
}

.glowing-dropdown-select>button {
    padding: calc(var(--inner-padding)*2) calc(var(--inner-padding)*2);
    background: var(--background-color);
    border-radius: var(--inner-radius);
    border: 0;
    color: white;
    text-align: left;
    font-size: 1em;
    width: 100%;
    cursor: pointer;
    position: relative;
    box-shadow: inset 0 2px 1px -1px rgb(255 255 255 / 10%);
    transform: scale(var(--scale));
    animation-duration: .2s;
    animation-timing-function: cubic-bezier(.66, -0.82, .33, 1.73);
    font-family: inherit;
}

.glowing-dropdown-select>button:focus {
    outline: 1px solid var(--accent-color);
    outline-offset: -1px;
}

.glowing-dropdown-select>button:after {
    content: '';
    position: absolute;
    right: 8px;
    height: 100%;
    width: 1em;
    top: 0;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='58' height='98' fill='none'%3E%3Cpath fill='hsl(211deg 23% 51%)' d='M25.536 6c1.54-2.667 5.388-2.667 6.928 0l18.187 31.5c1.54 2.667-.385 6-3.465 6H10.814c-3.079 0-5.003-3.333-3.464-6L25.536 6ZM25.536 92c1.54 2.667 5.388 2.667 6.928 0l18.187-31.5c1.54-2.667-.385-6-3.465-6H10.814c-3.079 0-5.003 3.333-3.464 6L25.536 92Z'/%3E%3C/svg%3E")no-repeat center center / 0.6em;
}

.glowing-dropdown-select>div {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 0;
    transition: height .3s ease-in-out;
}

.glowing-dropdown-select>div>a {
    display: block;
    padding: calc(var(--inner-padding)*1.6) calc(var(--inner-padding)*1.2);
    color: var(--light-color);
    cursor: pointer;
    margin-top: 8px;
    text-decoration: none;
    border-radius: var(--inner-radius);
    position: relative;
}

.glowing-dropdown-select>div>a>span {
    position: relative;
    display: block;
    transform: translateY(calc(var(--item-y)*1px));
    opacity: var(--item-opacity);
    transition: --item-y .2s ease .1s, --item-opacity .2s .1s;
}

.glowing-dropdown-select>div>a:nth-child(1) span {
    transition-delay: .1s;
}

.glowing-dropdown-select>div>a:nth-child(2) span {
    transition-delay: .15s;
}

.glowing-dropdown-select>div>a:nth-child(3) span {
    transition-delay: .2s;
}

.glowing-dropdown-select>div>a:focus {
    outline: 1px solid var(--outline-color);
    outline-offset: -1px;
}

.glowing-dropdown-select>div>a:hover,
.glowing-dropdown-select>div>a:focus {
    color: var(--accent-color);
}

.glowing-dropdown-select:focus-within {
    outline: 1px dashed var(--outline-color);
}

.glowing-dropdown-select:hover>div,
.glowing-dropdown-select:has(button:focus)>div,
.glowing-dropdown-select:focus-within>div {
    height: calc(var(--max-height)*1px);
    --item-y: 0;
    --item-opacity: 1;
}

.glowing-dropdown-select.nomotion {
    transition: none !important;
    animation: none !important;
}

.glowing-dropdown-select.nomotion:before,
.glowing-dropdown-select.nomotion:after,
.glowing-dropdown-select.nomotion *,
.glowing-dropdown-select.nomotion *:before,
.glowing-dropdown-select.nomotion *:after {
    transition: none !important;
    animation: none !important;
}

@media (prefers-reduced-motion: reduce) {
    .glowing-dropdown-select {
        transition: none !important;
        animation: none !important;
    }

    .glowing-dropdown-select:before,
    .glowing-dropdown-select:after,
    .glowing-dropdown-select *,
    .glowing-dropdown-select *:before,
    .glowing-dropdown-select *:after {
        transition: none !important;
        animation: none !important;
    }
}

@keyframes glow {
    from {
        --radial-bg-color: var(--accent-color);
        --bg-x: 100;
        --bg-y: 0;
    }

    50% {
        --radial-bg-color: hsl(290deg 100% 58%);
        --bg-x: 60;
        --bg-y: 120;
    }

    to {
        --radial-bg-color: var(--dark-color);
        --bg-x: 60;
        --bg-y: 120;
    }
}

@keyframes popOut {
    from {
        --scale: 1;
    }

    50% {
        --scale: 1.02;
    }

    to {
        --scale: 1;
    }
}
`;

const GlowingDropdown = ({
    options = ['Artboards', 'Pages', 'Templates'],
    defaultValue = 'Components',
    onChange,
    accessible = false,
    reduceMotion = false,
    width = '200px'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState(defaultValue);
    const [totalHeight, setTotalHeight] = useState(0);
    const selectRef = useRef(null);
    const buttonRef = useRef(null);
    const linksRef = useRef([]);

    useEffect(() => {
        // Calculate total height of dropdown items
        if (linksRef.current.length > 0) {
            const heights = linksRef.current.map(link => {
                if (!link) return 0;
                const styles = window.getComputedStyle(link);
                const box = link.getBoundingClientRect();
                const margin = parseFloat(styles.marginTop) + parseFloat(styles.marginBottom) || 0;
                return box.height + margin;
            });

            const total = heights.reduce((acc, curr) => acc + curr, 0);
            setTotalHeight(total);

            if (selectRef.current) {
                selectRef.current.style.setProperty('--max-height', total);
            }
        }
    }, [options]);

    const handleOptionClick = (option, index) => {
        const previousValue = selectedValue;
        setSelectedValue(option);

        // Trigger pop animation
        if (buttonRef.current) {
            buttonRef.current.style.animationName = 'popOut';
            buttonRef.current.addEventListener('animationend', () => {
                buttonRef.current.style.animationName = 'none';
            }, { once: true });
        }

        // Update the clicked option to show previous value
        // This creates the swap effect
        if (onChange) {
            onChange(option);
        }

        setIsOpen(false);
    };

    const handleButtonClick = () => {
        setIsOpen(!isOpen);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleOptionKeyDown = (e, option, index) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOptionClick(option, index);
        }
    };

    const selectClassName = `glowing-dropdown-select ${reduceMotion ? 'nomotion' : ''}`;
    const selectStyle = {
        '--a11y': accessible ? 1 : 0,
        '--outline-color': accessible
            ? 'hsla(calc(var(--accent-color-hue)*1deg) 100% 58% / 100%)'
            : 'hsla(calc(var(--accent-color-hue)*1deg) 100% 58% / 0%)',
        width: width,
    };

    return (
        <div
            className={selectClassName}
            ref={selectRef}
            tabIndex="0"
            role="button"
            style={selectStyle}
            onKeyDown={handleKeyDown}
        >
            <style>{styles}</style>
            <button
                ref={buttonRef}
                tabIndex="0"
                onClick={handleButtonClick}
            >
                {selectedValue}
            </button>

            <div className={`glowing-dropdown-options ${isOpen ? 'open' : ''}`}>
                {options.map((option, index) => (
                    <a
                        key={index}
                        ref={el => linksRef.current[index] = el}
                        role="button"
                        tabIndex="0"
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            handleOptionClick(option, index);
                        }}
                        onKeyDown={(e) => handleOptionKeyDown(e, option, index)}
                    >
                        <span>{option}</span>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default GlowingDropdown;
