import React, { useState, useEffect, useRef, useCallback } from 'react';

const styles = `
@font-face {
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 300;
    src: local('Open Sans Light'), local('OpenSans-Light'), url(https://fonts.gstatic.com/s/opensans/v18/mem5YaGs126MiZpBA-UN_r8OUuhs.ttf) format('truetype');
}

@font-face {
    font-family: 'Varela Round';
    font-style: normal;
    font-weight: 400;
    src: local('Varela Round Regular'), local('VarelaRound-Regular'), url(https://fonts.gstatic.com/s/varelaround/v13/w8gdH283Tvk__Lua32TysjIfp8uK.ttf) format('truetype');
}

.dvk-container {
    font-family: "Open Sans", sans-serif;
    --dvk-text: #4b4b4b;
    --dvk-knob-bg: linear-gradient(180deg, #f2f2f2 0%, #d8d8d8 100%);
    --dvk-knob-border: #c4c4c4;
    --dvk-knob-shadow: 0 0.2em 0.1em 0.05em rgba(255, 255, 255, 0.85) inset,
        0 -0.2em 0.1em 0.05em rgba(0, 0, 0, 0.12) inset,
        0 0.5em 0.65em 0 rgba(0, 0, 0, 0.2);
    --dvk-accent: #5ea9e6;
    --dvk-accent-glow: 0 0 0.35em 0 rgba(94, 169, 230, 0.75);
    --dvk-minmax: rgba(0, 0, 0, 0.45);
    --dvk-tick: rgba(0, 0, 0, 0.2);
    --dvk-tick-active: #5ea9e6;
    --dvk-tick-active-glow: 0 0 0.3em 0.08em rgba(94, 169, 230, 0.7);
    --dvk-value: #4b97d2;
    --dvk-label-radius: 13.5em;
    color: var(--dvk-text);
    text-align: center;
    user-select: none;
    display: inline-block;
}

.dark .dvk-container {
    --dvk-text: #aaa;
    --dvk-knob-bg: linear-gradient(180deg, #1d1d1d 0%, #131313 100%);
    --dvk-knob-border: #0e0e0e;
    --dvk-knob-shadow: 0 0.2em 0.1em 0.05em rgba(255, 255, 255, 0.1) inset,
        0 -0.2em 0.1em 0.05em rgba(0, 0, 0, 0.5) inset,
        0 0.5em 0.65em 0 rgba(0, 0, 0, 0.3);
    --dvk-accent: #a8d8f8;
    --dvk-accent-glow: 0 0 0.4em 0 #79c3f4;
    --dvk-minmax: rgba(255, 255, 255, 0.4);
    --dvk-tick: rgba(255, 255, 255, 0.2);
    --dvk-tick-active: #a8d8f8;
    --dvk-tick-active-glow: 0 0 0.3em 0.08em #79c3f4;
    --dvk-value: #a8d8f8;
}

.dvk-knob-surround {
    position: relative;
    width: 14em;
    height: 14em;
    border-radius: 50%;
    border: solid 0.25em var(--dvk-knob-border);
    margin: 2em auto;
    background: var(--dvk-knob-bg);
    box-shadow: var(--dvk-knob-shadow);
}

.dvk-knob {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    z-index: 10;
    cursor: pointer;
}

.dvk-knob:before {
    content: "";
    position: absolute;
    bottom: 19%;
    left: 19%;
    width: 3%;
    height: 3%;
    background-color: var(--dvk-accent);
    border-radius: 50%;
    box-shadow: var(--dvk-accent-glow);
}

.dvk-min,
.dvk-max {
    display: block;
    font-family: "Varela Round", sans-serif;
    color: var(--dvk-minmax);
    text-transform: uppercase;
    -webkit-font-smoothing: antialiased;
    font-size: 70%;
    position: absolute;
    left: 50%;
    top: 50%;
    opacity: 0.5;
    pointer-events: none;
}

.dvk-min {
    transform: translate(-50%, -50%) rotate(-135deg) translateY(calc(-1 * var(--dvk-label-radius))) rotate(135deg);
}

.dvk-max {
    transform: translate(-50%, -50%) rotate(135deg) translateY(calc(-1 * var(--dvk-label-radius))) rotate(-135deg);
}

.dvk-tick {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 5;
    overflow: visible;
    pointer-events: none;
}

.dvk-tick:after {
    content: "";
    width: 0.08em;
    height: 0.6em;
    background-color: var(--dvk-tick);
    position: absolute;
    top: -1.5em;
    left: 50%;
    -webkit-transition: all 180ms ease-out;
    -moz-transition: all 180ms ease-out;
    -o-transition: all 180ms ease-out;
    transition: all 180ms ease-out;
}

.dvk-activetick:after {
    background-color: var(--dvk-tick-active);
    box-shadow: var(--dvk-tick-active-glow);
    -webkit-transition: all 50ms ease-in;
    -moz-transition: all 50ms ease-in;
    -o-transition: all 50ms ease-in;
    transition: all 50ms ease-in;
}

.dvk-value-display {
    margin-top: 1em;
    font-size: 1.2rem;
    color: var(--dvk-value);
}
`;

const DraggableVolumeKnob = ({ initialVolume = 0, onVolumeChange }) => {
    const [volume, setVolume] = useState(initialVolume);
    const [angle, setAngle] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const knobRef = useRef(null);
    const boundingRectangle = useRef({});

    // Constants based on original script
    const STARTING_TICK_ANGLE = -135;
    const NUM_TICKS = 28;
    const MAX_ROTATION = 270; // degrees
    const TICK_STEP = MAX_ROTATION / (NUM_TICKS - 1);

    useEffect(() => {
        // Initialize angle based on initial volume
        // volume = floor(angle / (270/100)) => angle approx volume * 2.7
        const initialAngle = (initialVolume * 2.7);
        setAngle(initialAngle);
    }, []); // Only on mount, or we might overwrite user interaction if initialVolume changes

    // Helper to detect mobile (touch) vs desktop
    // In React we just check the event type usually, but we'll support both

    const getClientXY = (event) => {
        if (event.touches && event.touches[0]) {
            return { x: event.touches[0].pageX, y: event.touches[0].pageY };
        }
        return { x: event.pageX, y: event.pageY };
    };

    const handleDrag = useCallback((event) => {
        const { x: mouseX, y: mouseY } = getClientXY(event);
        const rect = boundingRectangle.current;

        // knobPositionX = rect.left
        // knobPositionY = rect.top
        const knobPositionX = rect.left + window.scrollX;
        const knobPositionY = rect.top + window.scrollY;

        const knobCenterX = rect.width / 2 + knobPositionX;
        const knobCenterY = rect.height / 2 + knobPositionY;

        // adjacentSide = knobCenterX - mouseX
        const adjacentSide = knobCenterX - mouseX;
        // oppositeSide = knobCenterY - mouseY
        const oppositeSide = knobCenterY - mouseY;

        // currentRadiansAngle
        const currentRadiansAngle = Math.atan2(adjacentSide, oppositeSide);

        // getRadiansInDegrees
        const getRadiansInDegrees = currentRadiansAngle * 180 / Math.PI;

        // finalAngleInDegrees
        const rawAngle = -(getRadiansInDegrees - 135);

        // We need to handle the wrap-around case appropriately or limit strictly as original code.
        // Original code: if(finalAngleInDegrees >= 0 && finalAngleInDegrees <= 270)
        // But rawAngle might be outside 0-270 if we go too far.
        // However, the original logic assumes valid input or ignores it. 
        // Let's implement the exact check from original code.

        let finalAngleInDegrees = rawAngle;

        // Fix for 360 wrap around issues if necessary, but original code didn't handle it explicitly other than the if check
        // If the user drags from bottom-left to bottom-right, angle might jump.
        // Let's stick to the original filter:
        if (finalAngleInDegrees >= 0 && finalAngleInDegrees <= MAX_ROTATION) {
            setAngle(finalAngleInDegrees);

            const newVolume = Math.floor(finalAngleInDegrees / (MAX_ROTATION / 100));
            setVolume(newVolume);
            if (onVolumeChange) {
                onVolumeChange(newVolume);
            }
        }
    }, [onVolumeChange]);

    const startDrag = (event) => {
        // Preventing default interaction (scrolling on touch) might be needed
        // event.preventDefault(); 

        if (knobRef.current) {
            // Update rect on start
            boundingRectangle.current = knobRef.current.getBoundingClientRect();
        }
        setIsDragging(true);
        handleDrag(event); // update immediately on click/touch
    };

    const stopDrag = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDrag);
            window.addEventListener('mouseup', stopDrag);
            window.addEventListener('touchmove', handleDrag, { passive: false });
            window.addEventListener('touchend', stopDrag);
        } else {
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', handleDrag);
            window.removeEventListener('touchend', stopDrag);
        }

        return () => {
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', handleDrag);
            window.removeEventListener('touchend', stopDrag);
        };
    }, [isDragging, handleDrag]);


    // Render Ticks
    const ticks = [];
    // tickHighlightPosition = Math.round((volume / 100) * NUM_TICKS)
    const tickHighlightPosition = Math.round((volume / 100) * NUM_TICKS);

    for (let i = 0; i < NUM_TICKS; i++) {
        const isHighlighted = i < tickHighlightPosition;
        const rotation = STARTING_TICK_ANGLE + (i * TICK_STEP);
        ticks.push(
            <div
                key={i}
                className={`dvk-tick ${isHighlighted ? 'dvk-activetick' : ''}`}
                style={{ transform: `rotate(${rotation}deg)` }}
            />
        );
    }

    return (
        <div className="dvk-container">
            <style>{styles}</style>
            <div className="dvk-knob-surround">
                <div
                    className="dvk-knob"
                    id="knob"
                    ref={knobRef}
                    style={{ transform: `rotate(${angle}deg)` }}
                    onMouseDown={startDrag}
                    onTouchStart={startDrag}
                ></div>

                <span className="dvk-min">Min</span>
                <span className="dvk-max">Max</span>

                <div className="dvk-ticks">
                    {ticks}
                </div>
            </div>
            <div className="dvk-value-display">{volume}%</div>
        </div>
    );
};

export default DraggableVolumeKnob;
