import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import * as _ from 'lodash';
import * as math from '../generic_modules/math';
import * as util from '../generic_modules/utility';
import * as astar from '../generic_modules/astar';
import { buildingFactory, Building } from '../game_modules/build';
import { config } from '../game_modules/config';
import { Segment, MapGenerationResult } from '../game_modules/mapgen';
import { MapActions } from '../actions/MapActions';
import MapStore from '../stores/MapStore';
import type { Point } from '../generic_modules/math';
import type { Quadtree } from 'quadtree-js';

const GameCanvas: React.FC = () => {
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const pixiRenderer = useRef<PIXI.Renderer | null>(null);
    const stage = useRef<PIXI.Stage | null>(null);
    const zoomContainer = useRef<PIXI.DisplayObjectContainer | null>(null);
    const drawables = useRef<PIXI.DisplayObjectContainer | null>(null);
    const dynamicDrawables = useRef<PIXI.DisplayObjectContainer | null>(null);
    const heatmaps = useRef<PIXI.DisplayObjectContainer | null>(null);
    const debugDrawables = useRef<PIXI.DisplayObjectContainer | null>(null);
    const debugSegments = useRef<PIXI.DisplayObjectContainer | null>(null);
    const debugMapData = useRef<PIXI.DisplayObjectContainer | null>(null);
    
    // Mutable state that doesn't trigger re-renders
    const state = useRef({
        segments: [] as Segment[],
        qTree: null as Quadtree | null,
        heatmap: null as MapGenerationResult['heatmap'] | null,
        initialised: false,
        dt: 0,
        time: null as number | null,
        touchDown: false,
        prevX: null as number | null,
        prevY: null as number | null,
        cumulDiff: { x: 0, y: 0 },
        zoom: 0.01 * window.devicePixelRatio,
        debugDrawablesAdded: false,
        populationHeatMap: null as PIXI.Graphics | null,
        pathGraphics: null as PIXI.Graphics | null,
        camera: { x: 0, y: -500, vx: 0, vy: 0 },
        routePartialSelectionMode: true,
        firstSelection: true,
        pathSelectionStart: null as astar.PathLocation | null,
        debugSegmentI: 0,
    }).current;

    const drawSegment = (segment: Segment, color?: number, width?: number) => {
        color = util.defaultFor(color, segment.q.color);
        width = util.defaultFor(width, segment.width);

        const graphics = new PIXI.Graphics();
        graphics.beginFill(0x000000, 0);
        graphics.lineStyle(width, color);
        graphics.moveTo(segment.r.start.x, segment.r.start.y);
        graphics.lineTo(segment.r.end.x, segment.r.end.y);
        graphics.endFill();
        return graphics;
    };

    const onMapChange = () => {
        if (!dynamicDrawables.current || !debugMapData.current || !debugSegments.current) return;

        if (state.pathGraphics) state.pathGraphics.clear();
        dynamicDrawables.current.removeChildren();
        debugMapData.current.removeChildren();
        debugSegments.current.removeChildren();
        state.debugSegmentI = 0;

        const segments = MapStore.getSegments();
        const qTree = MapStore.getQTree();
        const heatmap = MapStore.getHeatmap();
        const debugData = MapStore.getDebugData();

        state.segments = segments;
        state.qTree = qTree;
        state.heatmap = heatmap;
        
        debugData.snaps?.forEach((point: Point) => {
            const g = new PIXI.Graphics().beginFill(0x00FF00).drawCircle(point.x, point.y, 20).endFill();
            debugMapData.current?.addChild(g);
        });
        debugData.intersectionsRadius?.forEach((point: Point) => {
            const g = new PIXI.Graphics().beginFill(0x0000FF).drawCircle(point.x, point.y, 20).endFill();
            debugMapData.current?.addChild(g);
        });
        debugData.intersections?.forEach((point: Point) => {
            const g = new PIXI.Graphics().beginFill(0xFF0000).drawCircle(point.x, point.y, 20).endFill();
            debugMapData.current?.addChild(g);
        });

        let buildings: Building[] = [];
        for (let i = 0; i < segments.length; i += 10) {
            const segment = segments[i];
            const newBuildings = buildingFactory.aroundSegment(
                () => buildingFactory.fromProbability(new Date().getTime()),
                segment, 10, 400, qTree!
            );
            newBuildings.forEach(b => qTree!.insert(b.collider.limits()));
            buildings = buildings.concat(newBuildings);
        }

        buildings.forEach(building => {
            const g = new PIXI.Graphics().beginFill(0x0C161F).lineStyle(5, 0x555555);
            g.moveTo(building.corners[0].x, building.corners[0].y);
            building.corners.slice(1).forEach(c => g.lineTo(c.x, c.y));
            g.lineTo(building.corners[0].x, building.corners[0].y);
            dynamicDrawables.current?.addChild(g);
        });

        segments.forEach(segment => {
            const lineColor = segment.q.color ?? 0xA1AFA9;
            dynamicDrawables.current?.addChild(drawSegment(segment, lineColor));
        });

        state.initialised = true;
    };

    useEffect(() => {
        MapStore.addChangeListener(onMapChange);
        const seed = new Date().getTime();
        console.log(`seed: ${seed.toString()}`);
        MapActions.generate(seed);

        const canvasEl = document.createElement('canvas');
        canvasContainerRef.current?.appendChild(canvasEl);

        const handleResize = () => {
            if (!canvasContainerRef.current) return;
            const { offsetWidth, offsetHeight } = canvasContainerRef.current;
            canvasEl.style.width = `${offsetWidth}px`;
            canvasEl.style.height = `${offsetHeight}px`;
            const rendererWidth = offsetWidth * window.devicePixelRatio;
            const rendererHeight = offsetHeight * window.devicePixelRatio;
            if (pixiRenderer.current) {
                pixiRenderer.current.resize(rendererWidth, rendererHeight);
            }
            if (zoomContainer.current) {
                zoomContainer.current.x = rendererWidth / 2;
                zoomContainer.current.y = rendererHeight / 2;
            }
        };

        const { offsetWidth, offsetHeight } = canvasContainerRef.current!;
        pixiRenderer.current = PIXI.autoDetectRenderer({
            width: offsetWidth * window.devicePixelRatio,
            height: offsetHeight * window.devicePixelRatio,
            view: canvasEl,
            antialias: true,
            transparent: false
        });

        stage.current = new PIXI.Stage(0x3D7228);
        heatmaps.current = new PIXI.DisplayObjectContainer();
        debugDrawables.current = new PIXI.DisplayObjectContainer();
        debugSegments.current = new PIXI.DisplayObjectContainer();
        debugMapData.current = new PIXI.DisplayObjectContainer();
        zoomContainer.current = new PIXI.DisplayObjectContainer();
        drawables.current = new PIXI.DisplayObjectContainer();
        dynamicDrawables.current = new PIXI.DisplayObjectContainer();

        stage.current.addChild(heatmaps.current);
        debugDrawables.current.addChild(debugSegments.current);
        debugDrawables.current.addChild(debugMapData.current);
        drawables.current.addChild(dynamicDrawables.current);
        zoomContainer.current.addChild(drawables.current);
        stage.current.addChild(zoomContainer.current);

        handleResize();
        window.addEventListener('resize', handleResize);

        // Animation loop
        const animate = () => {
            if (state.initialised && stage.current && pixiRenderer.current) {
                // ... animation logic from original file ...
                // This would be a direct translation of the original 'animate' function
                // using the 'state' ref object for mutable state.
                const now = new Date().getTime();
                state.dt = now - (state.time || now);
                state.time = now;
                
                state.zoom = (state.zoom + MapStore.getTargetZoom()) / 2.0;

                zoomContainer.current!.scale.x = state.zoom;
                zoomContainer.current!.scale.y = state.zoom;
                
                drawables.current!.x = -state.camera.x;
                drawables.current!.y = -state.camera.y;

                pixiRenderer.current.render(stage.current);
            }
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            MapStore.removeChangeListener(onMapChange);
            pixiRenderer.current?.destroy();
            canvasContainerRef.current?.removeChild(canvasEl);
        };
    }, []);

    return <div id="canvas-container" ref={canvasContainerRef}></div>;
};

export default GameCanvas;