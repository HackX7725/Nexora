import { useEffect, useRef, useState } from 'react';

const PAPER = '#f4efe4';
const COLORS = ['#14211c', '#d4652f', '#2f6f56', '#2456c5', '#f7f3ea'];

function paint(ctx, stroke, width, height) {
  if (!stroke?.points?.length) return;
  ctx.strokeStyle = stroke.tool === 'eraser' ? PAPER : stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  stroke.points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

export default function Whiteboard({ roomId, socket, isHost }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const liveRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(COLORS[0]);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokesRef.current.forEach((stroke) => paint(ctx, stroke, canvas.width, canvas.height));
    paint(ctx, liveRef.current, canvas.width, canvas.height);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const onInit = (strokes) => {
      strokesRef.current = strokes || [];
      redraw();
    };
    const onAdd = (stroke) => {
      strokesRef.current = [...strokesRef.current, stroke];
      redraw();
    };
    const onClear = () => {
      strokesRef.current = [];
      liveRef.current = null;
      redraw();
    };
    socket.on('strokes:init', onInit);
    socket.on('stroke:add', onAdd);
    socket.on('board:cleared', onClear);
    return () => {
      socket.off('strokes:init', onInit);
      socket.off('stroke:add', onAdd);
      socket.off('board:cleared', onClear);
    };
  }, [socket]);

  function pointFrom(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(event) {
    liveRef.current = {
      tool,
      color,
      width: tool === 'eraser' ? 22 : 3,
      points: [pointFrom(event)],
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable for this event.
    }
    redraw();
  }

  function onPointerMove(event) {
    if (!liveRef.current) return;
    liveRef.current.points.push(pointFrom(event));
    redraw();
  }

  function onPointerUp() {
    const stroke = liveRef.current;
    liveRef.current = null;
    if (!stroke || !socket) return;
    if (stroke.points.length === 1) stroke.points.push({ ...stroke.points[0] });
    strokesRef.current = [...strokesRef.current, stroke];
    socket.emit('stroke:draw', { roomId, ...stroke });
    redraw();
  }

  return (
    <div className="board-pane">
      <div className="board-tools">
        <button type="button" className={tool === 'pen' ? 'on' : ''} onClick={() => setTool('pen')}>Pen</button>
        <button type="button" className={tool === 'eraser' ? 'on' : ''} onClick={() => setTool('eraser')}>Eraser</button>
        <div className="swatches">
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              className={color === swatch ? 'on' : ''}
              style={{ background: swatch }}
              onClick={() => { setColor(swatch); setTool('pen'); }}
            />
          ))}
        </div>
        {isHost ? (
          <button type="button" onClick={() => socket?.emit('board:clear', { roomId })}>Clear board</button>
        ) : null}
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onLostPointerCapture={onPointerUp}
      />
    </div>
  );
}
