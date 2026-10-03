import { useEffect, useRef } from 'react';
import {
    Chart,
    LineController,
    BarController,
    DoughnutController,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Filler,
    Tooltip,
    Legend
} from 'chart.js';


Chart.register(
    LineController,
    BarController,
    DoughnutController,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Filler,
    Tooltip,
    Legend
);

export const CHART_COLORS = {
    navy: 'rgb(2, 116, 176)',
    navyFill: 'rgba(2, 116, 176, 0.12)',
    gold: 'rgb(247, 198, 49)',
    success: 'rgb(22, 163, 74)',
    warning: 'rgb(234, 88, 12)',
    danger: 'rgb(220, 38, 38)',
    info: 'rgb(2, 132, 199)',
    slate: 'rgb(100, 116, 139)'
};


export default function ChartCanvas({ type = 'line', data, options, height }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !data) return undefined;

        const chart = new Chart(canvasRef.current, { type, data, options });
        return () => chart.destroy();
    }, [type, data, options]);

    return <canvas ref={canvasRef} height={height} />;
}
