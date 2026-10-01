import React, { useEffect, useRef, useState } from "react";
import { renderPdfPageToCanvas } from "../../utils/pdfUtils";

const PageThumbnail = ({ pdfDoc, pageNumber, width = 140, rotation, className = "" }) => {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return undefined;
    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1, rotation });
        const scale = width / baseViewport.width;
        if (cancelled || !canvasRef.current) return;
        await renderPdfPageToCanvas(pdfDoc, pageNumber, canvasRef.current, { scale, rotation });
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("Gagal merender thumbnail halaman", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber, width, rotation]);

  return (
    <div
      className={`relative flex min-h-[80px] items-center justify-center overflow-hidden rounded-lg bg-slate-100 ${className}`}
      style={{ width }}
    >
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
        </div>
      )}
      {status === "error" ? (
        <div className="flex h-36 w-full items-center justify-center px-2 text-center text-xs text-red-400">Gagal memuat halaman</div>
      ) : (
        <canvas ref={canvasRef} className="w-full" />
      )}
    </div>
  );
};

export default PageThumbnail;
