import React, { useState } from 'react';
import { config } from '../game_modules/config';
import { MapActions } from '../actions/MapActions';
import GameCanvas from './GameCanvas';
import ToggleButton from './ToggleButton';

const App: React.FC = () => {
    const [segmentCountLimit, setSegmentCountLimit] = useState(config.mapGeneration.SEGMENT_COUNT_LIMIT);

    const onSegmentCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value, 10);
        config.mapGeneration.SEGMENT_COUNT_LIMIT = value;
        setSegmentCountLimit(value);
    };

    const regenerateMap = () => {
        const seed = new Date().getTime();
        MapActions.generate(seed);
    };

    const factorTargetZoom = (factor: number) => {
        MapActions.factorTargetZoom(factor);
    };

    return (
        <div id="main-viewport-container">
            <GameCanvas />
            <div id="control-bar">
                <ToggleButton 
                    onText="Hide Debug Drawing" 
                    offText="Show Debug Drawing" 
                    action={() => { config.mapGeneration.DEBUG = !config.mapGeneration.DEBUG; }}
                />
                <ToggleButton 
                    onText="Hide Population Heatmap" 
                    offText="Show Population Heatmap" 
                    action={() => { config.mapGeneration.DRAW_HEATMAP = !config.mapGeneration.DRAW_HEATMAP; }}
                />
                <button onClick={() => factorTargetZoom(3 / 2)}>Zoom in</button>
                <button onClick={() => factorTargetZoom(2 / 3)}>Zoom out</button>
                <label htmlFor="segment-limit">Segment limit:</label>
                <input 
                    id="segment-limit" 
                    onChange={onSegmentCountChange} 
                    type="number" 
                    min="1" 
                    max="5000" 
                    value={segmentCountLimit} 
                />
                <button onClick={regenerateMap}>Regenerate</button>
            </div>
        </div>
    );
};

export default App;