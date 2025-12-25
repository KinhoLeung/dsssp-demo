import React, { useState, useEffect, useRef, useCallback } from 'react';
import './DraggableVolumeKnob.css';

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
