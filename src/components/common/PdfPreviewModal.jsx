import React, { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaFilePdf } from "react-icons/fa";
import Modal from "./Modal.jsx";
import { loadPdfJsDocument, readFileAsArrayBuffer, renderPdfPageToCanvas } from "../../utils/pdfUtils";

const PdfPreviewModal = ({ file, isOpen, onClose }) => {
  const canvasRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !file) {
      setPdfDoc(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setPdfDoc(null);
    setPageNumber(1);

    (async () => {
      try {
        const buffer = await readFileAsArrayBuffer(file);
        const doc = await loadPdfJsDocument(buffer);
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Gagal memuat pratinjau. File mungkin rusak atau bukan PDF yang valid.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, file]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(620 / baseViewport.width, 1.8);
        if (cancelled || !canvasRef.current) return;
        await renderPdfPageToCanvas(pdfDoc, pageNumber, canvasRef.current, { scale });
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Gagal menampilkan halaman ini.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber]);

  const goPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goNext = () => setPageNumber((p) => Math.min(numPages, p + 1));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <FaFilePdf className="text-red-500" /> {file?.name || "Pratinjau PDF"}
        </span>
      }
    >
      <div className="relative flex min-h-[320px] flex-col items-center justify-center gap-4">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-10 text-slate-500">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="text-sm">Memuat pratinjau...</p>
          </div>
        )}
        {!loading && error && <p className="py-10 text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <>
            <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
              <canvas ref={canvasRef} className="block max-w-full" />
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={goPrev}
                disabled={pageNumber <= 1}
                className="rounded-full bg-slate-100 p-2 text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-40"
              >
                <FaChevronLeft />
              </button>
              <span className="text-sm font-medium text-slate-600">
                Halaman {pageNumber} / {numPages}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={pageNumber >= numPages}
                className="rounded-full bg-slate-100 p-2 text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-40"
              >
                <FaChevronRight />
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default PdfPreviewModal;
