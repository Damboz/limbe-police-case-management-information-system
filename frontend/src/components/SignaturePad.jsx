import { useEffect, useRef, useState } from 'react';


const WIDTH = 600;
const HEIGHT = 180;


export default function SignaturePad({ onChange, disabled = false }) {
    const canvasRef = useRef(null);
    const drawingRef = useRef(false);
    const hasInkRef = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    const getPoint = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (canvas.width / rect.width),
            y: (event.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const start = (event) => {
        if (disabled) return;
        event.preventDefault();
        const canvas = canvasRef.current;
        canvas.setPointerCapture?.(event.pointerId);
        const { x, y } = getPoint(event);
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        drawingRef.current = true;
    };

    const move = (event) => {
        if (!drawingRef.current) return;
        event.preventDefault();
        const { x, y } = getPoint(event);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
        hasInkRef.current = true;
    };

    const end = () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        if (!hasInkRef.current) return;
        setHasInk(true);
        onChange(canvasRef.current.toDataURL('image/png'));
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hasInkRef.current = false;
        setHasInk(false);
        onChange('');
    };

    return (
        <div>
            <div className="border rounded bg-white position-relative">
                <canvas
                    ref={canvasRef}
                    width={WIDTH}
                    height={HEIGHT}
                    className="w-100 d-block"
                    style={{
                        touchAction: 'none',
                        maxWidth: '100%',
                        height: 'auto',
                        cursor: disabled ? 'not-allowed' : 'crosshair'
                    }}
                    onPointerDown={start}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerLeave={end}
                    onPointerCancel={end}
                />
                {!hasInk && (
                    <span className="text-muted small position-absolute top-50 start-50 translate-middle pe-none">
                        Sign here
                    </span>
                )}
            </div>
            <div className="d-flex justify-content-end mt-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clear} disabled={!hasInk || disabled}>
                    <i className="bi bi-eraser me-1" />Clear signature
                </button>
            </div>
        </div>
    );
}
