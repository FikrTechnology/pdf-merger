import React, { useRef, useState } from "react";
import { FaEraser } from "react-icons/fa";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 220;

/** Minimal HTML5-canvas signature pad; exports a transparent-background PNG data URL. */
const SignaturePad = ({ onSave, onCancel }) => {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    canvasRef.current.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(event);
  };

  const handlePointerMove = (event) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const point = getPoint(event);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (isEmpty) setIsEmpty(false);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (isEmpty) return;
    onSave(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">Gambar tanda tangan menggunakan mouse, trackpad, atau layar sentuh di area berikut.</p>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        className="h-56 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white"
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          <FaEraser size={13} /> Hapus Coretan
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isEmpty}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Gunakan Tanda Tangan
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
