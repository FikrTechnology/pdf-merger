import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  FaChevronLeft,
  FaChevronRight,
  FaDownload,
  FaFilePdf,
  FaFont,
  FaRedo,
  FaSignature,
  FaTimes,
  FaTint,
  FaTrash,
} from "react-icons/fa";
import FileDropzone from "./common/FileDropzone.jsx";
import LoadingOverlay from "./common/LoadingOverlay.jsx";
import Modal from "./common/Modal.jsx";
import SignaturePad from "./SignaturePad.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import {
  buildOutputFileName,
  clamp,
  computeCenteredTextOrigin,
  createId,
  dataUrlToUint8Array,
  downloadPdfBytes,
  formatFileSize,
  getFriendlyErrorMessage,
  getImageDimensions,
  hexToRgb01,
  isPdfFile,
  loadPdfJsDocument,
  readFileAsArrayBuffer,
  readFileAsDataUrl,
  renderPdfPageToCanvas,
} from "../utils/pdfUtils";

const DEFAULT_WATERMARK = {
  enabled: false,
  text: "CONFIDENTIAL",
  fontSize: 60,
  color: "#ef4444",
  opacity: 0.25,
  rotation: 45,
  applyToAllPages: true,
  targetPage: 1,
};

const IMAGE_ACCEPT = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] };

/** A single draggable/resizable annotation rendered on top of the page preview canvas. */
const AnnotationOverlayItem = ({ annotation, isSelected, containerRef, renderScale, onSelect, onUpdate, onDelete }) => {
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  const handleDragPointerDown = (event) => {
    onSelect(annotation.id);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXPct: annotation.xPct,
      startYPct: annotation.yPct,
      containerWidth: rect.width,
      containerHeight: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dxPct = ((event.clientX - drag.startClientX) / drag.containerWidth) * 100;
    const dyPct = ((event.clientY - drag.startClientY) / drag.containerHeight) * 100;
    const maxX = Math.max(100 - (annotation.wPct || 4), 0);
    const maxY = Math.max(100 - (annotation.hPct || 4), 0);
    onUpdate(annotation.id, {
      xPct: clamp(drag.startXPct + dxPct, 0, maxX),
      yPct: clamp(drag.startYPct + dyPct, 0, maxY),
    });
  };

  const handleDragPointerUp = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const handleResizePointerDown = (event) => {
    event.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    resizeRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWPct: annotation.wPct,
      aspectRatio: annotation.hPct / annotation.wPct,
      containerWidth: rect.width,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizePointerMove = (event) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const dxPct = ((event.clientX - resize.startClientX) / resize.containerWidth) * 100;
    const nextWPct = clamp(resize.startWPct + dxPct, 5, Math.max(100 - annotation.xPct, 5));
    onUpdate(annotation.id, { wPct: nextWPct, hPct: nextWPct * resize.aspectRatio });
  };

  const handleResizePointerUp = (event) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  };

  const style =
    annotation.type === "image"
      ? { left: `${annotation.xPct}%`, top: `${annotation.yPct}%`, width: `${annotation.wPct}%`, height: `${annotation.hPct}%` }
      : {
          left: `${annotation.xPct}%`,
          top: `${annotation.yPct}%`,
          fontSize: `${Math.max(annotation.fontSizePt * renderScale, 6)}px`,
          color: annotation.color,
          fontFamily: "Helvetica, Arial, sans-serif",
        };

  return (
    <div
      onPointerDown={handleDragPointerDown}
      onPointerMove={handleDragPointerMove}
      onPointerUp={handleDragPointerUp}
      style={style}
      className={`absolute cursor-move touch-none select-none ${
        isSelected ? "z-10 outline outline-2 outline-offset-2 outline-blue-500" : "hover:outline hover:outline-2 hover:outline-blue-300"
      }`}
    >
      {annotation.type === "image" ? (
        <img src={annotation.dataUrl} alt="Tanda tangan/stempel" className="h-full w-full object-contain" draggable={false} />
      ) : (
        <p className="whitespace-nowrap font-semibold leading-none">{annotation.text}</p>
      )}

      {isSelected && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onDelete(annotation.id)}
          className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600"
          title="Hapus anotasi"
        >
          <FaTimes size={11} />
        </button>
      )}

      {isSelected && annotation.type === "image" && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize touch-none rounded-full border-2 border-white bg-blue-500 shadow"
          title="Seret untuk mengubah ukuran"
        />
      )}
    </div>
  );
};

const PdfEditor = () => {
  const notify = useNotification();

  const [sourceFile, setSourceFile] = useState(null);
  const [pdfJsDoc, setPdfJsDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pagePointSize, setPagePointSize] = useState({ width: 0, height: 0 });
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [annotations, setAnnotations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [stagedStamp, setStagedStamp] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const [textDraft, setTextDraft] = useState("");
  const [textFontSize, setTextFontSize] = useState(18);
  const [textColor, setTextColor] = useState("#111827");

  const [watermark, setWatermark] = useState(DEFAULT_WATERMARK);

  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const resetDocument = useCallback(() => {
    setSourceFile(null);
    setPdfJsDoc(null);
    setNumPages(0);
    setCurrentPage(1);
    setAnnotations([]);
    setSelectedId(null);
    setStagedStamp(null);
    setWatermark(DEFAULT_WATERMARK);
  }, []);

  const handleFilesAccepted = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles?.[0];
      if (!file) return;
      if (!isPdfFile(file)) {
        notify.warning("Berkas yang dipilih bukan file PDF.");
        return;
      }

      setIsLoadingFile(true);
      try {
        // Read the file twice: pdf-lib and pdfjs each consume their own ArrayBuffer independently.
        const validationBuffer = await readFileAsArrayBuffer(file);
        const pdfLibDoc = await PDFDocument.load(validationBuffer, { ignoreEncryption: true });
        const renderBuffer = await readFileAsArrayBuffer(file);
        const doc = await loadPdfJsDocument(renderBuffer);

        setSourceFile(file);
        setPdfJsDoc(doc);
        setNumPages(pdfLibDoc.getPageCount());
        setCurrentPage(1);
        setAnnotations([]);
        setSelectedId(null);
        setWatermark(DEFAULT_WATERMARK);
        notify.success(`${file.name} berhasil dimuat (${pdfLibDoc.getPageCount()} halaman).`);
      } catch (err) {
        console.error(err);
        notify.error(getFriendlyErrorMessage(err));
      } finally {
        setIsLoadingFile(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    if (!pdfJsDoc || !canvasRef.current) return undefined;
    let cancelled = false;
    setIsRenderingPage(true);

    (async () => {
      try {
        const page = await pdfJsDoc.getPage(currentPage);
        const basePageViewport = page.getViewport({ scale: 1 });
        const maxWidth = 680;
        const scale = Math.min(maxWidth / basePageViewport.width, 1.6);
        if (cancelled || !canvasRef.current) return;
        const viewport = await renderPdfPageToCanvas(pdfJsDoc, currentPage, canvasRef.current, { scale });
        if (cancelled) return;
        setViewportSize({ width: viewport.width, height: viewport.height });
        setPagePointSize({ width: basePageViewport.width, height: basePageViewport.height });
      } catch (err) {
        console.error(err);
        if (!cancelled) notify.error("Gagal menampilkan halaman ini.");
      } finally {
        if (!cancelled) setIsRenderingPage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfJsDoc, currentPage, notify]);

  const renderScale = pagePointSize.width ? viewportSize.width / pagePointSize.width : 1;

  const goPrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goNextPage = () => setCurrentPage((p) => Math.min(numPages, p + 1));

  const updateAnnotation = useCallback((id, patch) => {
    setAnnotations((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeAnnotation = useCallback((id) => {
    setAnnotations((prev) => prev.filter((item) => item.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const currentPageAnnotations = useMemo(
    () => annotations.filter((item) => item.page === currentPage),
    [annotations, currentPage]
  );

  const selectedAnnotation = useMemo(
    () => currentPageAnnotations.find((item) => item.id === selectedId) || null,
    [currentPageAnnotations, selectedId]
  );

  const handleStampUpload = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles?.[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const { width, height } = await getImageDimensions(dataUrl);
        setStagedStamp({ dataUrl, mimeType: file.type || "image/png", width, height });
      } catch (err) {
        console.error(err);
        notify.error("Gagal membaca gambar. Pastikan file berupa PNG atau JPG yang valid.");
      }
    },
    [notify]
  );

  const handleSignatureSaved = useCallback(async (dataUrl) => {
    const { width, height } = await getImageDimensions(dataUrl);
    setStagedStamp({ dataUrl, mimeType: "image/png", width, height });
    setShowSignaturePad(false);
  }, []);

  const addStampToPage = () => {
    if (!stagedStamp || !pdfJsDoc) return;
    const wPct = 28;
    const imgRatio = stagedStamp.height / stagedStamp.width;
    const drawWidthPx = (wPct / 100) * (viewportSize.width || 1);
    const drawHeightPx = drawWidthPx * imgRatio;
    const hPct = clamp((drawHeightPx / (viewportSize.height || 1)) * 100, 2, 90);

    const annotation = {
      id: createId(),
      type: "image",
      page: currentPage,
      xPct: clamp(50 - wPct / 2, 0, 100 - wPct),
      yPct: clamp(50 - hPct / 2, 0, 100 - hPct),
      wPct,
      hPct,
      dataUrl: stagedStamp.dataUrl,
      mimeType: stagedStamp.mimeType,
    };
    setAnnotations((prev) => [...prev, annotation]);
    setSelectedId(annotation.id);
    notify.success("Tanda tangan/stempel ditambahkan. Seret untuk mengatur posisi.");
  };

  const addTextAnnotation = () => {
    if (!textDraft.trim()) {
      notify.warning("Isi teks terlebih dahulu sebelum menambahkannya.");
      return;
    }
    const annotation = {
      id: createId(),
      type: "text",
      page: currentPage,
      xPct: 35,
      yPct: 45,
      text: textDraft.trim(),
      fontSizePt: textFontSize,
      color: textColor,
    };
    setAnnotations((prev) => [...prev, annotation]);
    setSelectedId(annotation.id);
    setTextDraft("");
  };

  const handleExport = async () => {
    if (!sourceFile) return;
    setIsExporting(true);
    try {
      const buffer = await readFileAsArrayBuffer(sourceFile);
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const embeddedImages = new Map();
      const getEmbeddedImage = async (annotation) => {
        if (embeddedImages.has(annotation.dataUrl)) return embeddedImages.get(annotation.dataUrl);
        const bytes = dataUrlToUint8Array(annotation.dataUrl);
        const isJpeg = /jpe?g/i.test(annotation.mimeType || "");
        const embedded = isJpeg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
        embeddedImages.set(annotation.dataUrl, embedded);
        return embedded;
      };

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        const pageNumber = index + 1;
        const { width: pageWidth, height: pageHeight } = page.getSize();

        const shouldWatermark = watermark.enabled && (watermark.applyToAllPages || watermark.targetPage === pageNumber);
        if (shouldWatermark && watermark.text.trim()) {
          const { r, g, b } = hexToRgb01(watermark.color);
          const textWidth = boldFont.widthOfTextAtSize(watermark.text, watermark.fontSize);
          const origin = computeCenteredTextOrigin(pageWidth / 2, pageHeight / 2, textWidth, watermark.fontSize, watermark.rotation);
          page.drawText(watermark.text, {
            x: origin.x,
            y: origin.y,
            size: watermark.fontSize,
            font: boldFont,
            color: rgb(r, g, b),
            opacity: watermark.opacity,
            rotate: degrees(watermark.rotation),
          });
        }

        const pageAnnotations = annotations.filter((item) => item.page === pageNumber);
        for (const annotation of pageAnnotations) {
          if (annotation.type === "image") {
            const embedded = await getEmbeddedImage(annotation);
            const drawWidth = (annotation.wPct / 100) * pageWidth;
            const drawHeight = (annotation.hPct / 100) * pageHeight;
            const x = (annotation.xPct / 100) * pageWidth;
            const y = pageHeight - (annotation.yPct / 100) * pageHeight - drawHeight;
            page.drawImage(embedded, { x, y, width: drawWidth, height: drawHeight });
          } else if (annotation.type === "text" && annotation.text.trim()) {
            const { r, g, b } = hexToRgb01(annotation.color);
            const x = (annotation.xPct / 100) * pageWidth;
            const y = pageHeight - (annotation.yPct / 100) * pageHeight - annotation.fontSizePt;
            page.drawText(annotation.text, {
              x,
              y,
              size: annotation.fontSizePt,
              font: regularFont,
              color: rgb(r, g, b),
            });
          }
        }
      }

      const bytes = await pdfDoc.save();
      downloadPdfBytes(bytes, buildOutputFileName(sourceFile.name, "edited"));
      notify.success("PDF berhasil diperbarui dan diunduh.");
    } catch (err) {
      console.error(err);
      notify.error(getFriendlyErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">Edit, Sign & Watermark PDF</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tambahkan tanda tangan, stempel gambar, teks kustom, dan watermark ke halaman PDF sebelum diunduh.
        </p>
      </div>

      {!sourceFile && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <FileDropzone
            multiple={false}
            onFilesAccepted={handleFilesAccepted}
            title="Seret & lepas satu file PDF di sini"
            hint="atau klik untuk memilih file dari perangkat Anda"
          />
        </div>
      )}

      {isLoadingFile && (
        <div className="relative rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
          <LoadingOverlay message="Memuat & memvalidasi PDF..." />
        </div>
      )}

      {sourceFile && !isLoadingFile && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-500">
                <FaFilePdf />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-700">{sourceFile.name}</p>
                <p className="text-xs text-slate-400">
                  {formatFileSize(sourceFile.size)} &middot; {numPages} halaman &middot; {annotations.length} anotasi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetDocument}
              className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
            >
              <FaRedo size={12} /> Ganti File
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <button
                  type="button"
                  onClick={goPrevPage}
                  disabled={currentPage <= 1}
                  className="rounded-full bg-slate-100 p-2 text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-40"
                >
                  <FaChevronLeft />
                </button>
                <span className="text-sm font-medium text-slate-600">
                  Halaman {currentPage} / {numPages}
                </span>
                <button
                  type="button"
                  onClick={goNextPage}
                  disabled={currentPage >= numPages}
                  className="rounded-full bg-slate-100 p-2 text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-40"
                >
                  <FaChevronRight />
                </button>
              </div>

              <div className="relative overflow-auto rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div
                  ref={overlayRef}
                  className="relative mx-auto"
                  style={{ width: viewportSize.width || "auto" }}
                >
                  <canvas ref={canvasRef} className="block rounded-lg border border-slate-200" />
                  <div
                    className="absolute inset-0"
                    onPointerDown={(event) => {
                      if (event.target === event.currentTarget) setSelectedId(null);
                    }}
                  >
                    {currentPageAnnotations.map((annotation) => (
                      <AnnotationOverlayItem
                        key={annotation.id}
                        annotation={annotation}
                        isSelected={annotation.id === selectedId}
                        containerRef={overlayRef}
                        renderScale={renderScale}
                        onSelect={setSelectedId}
                        onUpdate={updateAnnotation}
                        onDelete={removeAnnotation}
                      />
                    ))}
                  </div>
                  {isRenderingPage && <LoadingOverlay message="Merender halaman..." />}
                </div>
              </div>

              {selectedAnnotation && (
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">Pengaturan Item Terpilih</h3>
                    <button
                      type="button"
                      onClick={() => removeAnnotation(selectedAnnotation.id)}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      title="Hapus"
                    >
                      <FaTrash size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      Posisi X (%)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round(selectedAnnotation.xPct)}
                        onChange={(e) => updateAnnotation(selectedAnnotation.id, { xPct: clamp(Number(e.target.value) || 0, 0, 100) })}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      Posisi Y (%)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round(selectedAnnotation.yPct)}
                        onChange={(e) => updateAnnotation(selectedAnnotation.id, { yPct: clamp(Number(e.target.value) || 0, 0, 100) })}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                      />
                    </label>

                    {selectedAnnotation.type === "image" ? (
                      <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-slate-500">
                        Skala ({Math.round(selectedAnnotation.wPct)}%)
                        <input
                          type="range"
                          min={5}
                          max={90}
                          value={selectedAnnotation.wPct}
                          onChange={(e) => {
                            const nextWPct = Number(e.target.value);
                            const ratio = selectedAnnotation.hPct / selectedAnnotation.wPct;
                            updateAnnotation(selectedAnnotation.id, { wPct: nextWPct, hPct: nextWPct * ratio });
                          }}
                          className="w-full accent-blue-600"
                        />
                      </label>
                    ) : (
                      <>
                        <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-slate-500">
                          Isi Teks
                          <input
                            type="text"
                            value={selectedAnnotation.text}
                            onChange={(e) => updateAnnotation(selectedAnnotation.id, { text: e.target.value })}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                          Ukuran Font (pt)
                          <input
                            type="number"
                            min={6}
                            max={96}
                            value={selectedAnnotation.fontSizePt}
                            onChange={(e) => updateAnnotation(selectedAnnotation.id, { fontSizePt: Number(e.target.value) || 1 })}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                          Warna
                          <input
                            type="color"
                            value={selectedAnnotation.color}
                            onChange={(e) => updateAnnotation(selectedAnnotation.id, { color: e.target.value })}
                            className="h-9 w-full rounded-lg border border-slate-200"
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Anda juga bisa menyeret item langsung di atas pratinjau halaman.</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <FaSignature className="text-blue-500" /> Tanda Tangan & Stempel
                </h3>
                <p className="mt-1 text-xs text-slate-400">Unggah gambar PNG/JPG atau gambar tanda tangan langsung.</p>

                {stagedStamp ? (
                  <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <img src={stagedStamp.dataUrl} alt="Pratinjau stempel" className="h-20 object-contain" />
                    <div className="flex w-full gap-2">
                      <button
                        type="button"
                        onClick={() => setStagedStamp(null)}
                        className="flex-1 rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-300"
                      >
                        Ganti
                      </button>
                      <button
                        type="button"
                        onClick={addStampToPage}
                        className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Tambahkan ke Halaman
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    <FileDropzone
                      multiple={false}
                      accept={IMAGE_ACCEPT}
                      onFilesAccepted={handleStampUpload}
                      title="Unggah gambar tanda tangan/logo"
                      hint="PNG transparan atau JPG"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignaturePad(true)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <FaSignature /> Gambar Tanda Tangan
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <FaFont className="text-blue-500" /> Tambah Teks
                </h3>
                <div className="mt-3 flex flex-col gap-3">
                  <input
                    type="text"
                    value={textDraft}
                    onChange={(e) => setTextDraft(e.target.value)}
                    placeholder="Contoh: Nama, Jabatan, Tanggal..."
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                      Ukuran Font
                      <input
                        type="number"
                        min={6}
                        max={96}
                        value={textFontSize}
                        onChange={(e) => setTextFontSize(Number(e.target.value) || 1)}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                      Warna
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={addTextAnnotation}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Tambahkan Teks ke Halaman
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <FaTint className="text-blue-500" /> Watermark
                  </h3>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={watermark.enabled}
                      onChange={(e) => setWatermark((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600" />
                    <div className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                  </label>
                </div>

                {watermark.enabled && (
                  <div className="mt-3 flex flex-col gap-3">
                    <input
                      type="text"
                      value={watermark.text}
                      onChange={(e) => setWatermark((prev) => ({ ...prev, text: e.target.value }))}
                      placeholder="CONFIDENTIAL / DRAFT"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    />

                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      Transparansi ({Math.round(watermark.opacity * 100)}%)
                      <input
                        type="range"
                        min={5}
                        max={80}
                        value={Math.round(watermark.opacity * 100)}
                        onChange={(e) => setWatermark((prev) => ({ ...prev, opacity: Number(e.target.value) / 100 }))}
                        className="w-full accent-blue-600"
                      />
                    </label>

                    <div className="flex gap-3">
                      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                        Ukuran Font
                        <input
                          type="number"
                          min={12}
                          max={200}
                          value={watermark.fontSize}
                          onChange={(e) => setWatermark((prev) => ({ ...prev, fontSize: Number(e.target.value) || 12 }))}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                        />
                      </label>
                      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                        Rotasi (&deg;)
                        <input
                          type="number"
                          min={-90}
                          max={90}
                          value={watermark.rotation}
                          onChange={(e) => setWatermark((prev) => ({ ...prev, rotation: Number(e.target.value) || 0 }))}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                        />
                      </label>
                      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                        Warna
                        <input
                          type="color"
                          value={watermark.color}
                          onChange={(e) => setWatermark((prev) => ({ ...prev, color: e.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-200"
                        />
                      </label>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={watermark.applyToAllPages}
                        onChange={(e) => setWatermark((prev) => ({ ...prev, applyToAllPages: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                      />
                      Terapkan ke semua halaman
                    </label>

                    {!watermark.applyToAllPages && (
                      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                        Halaman ke-
                        <input
                          type="number"
                          min={1}
                          max={numPages || 1}
                          value={watermark.targetPage}
                          onChange={(e) =>
                            setWatermark((prev) => ({ ...prev, targetPage: clamp(Number(e.target.value) || 1, 1, numPages || 1) }))
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div className="relative rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                {isExporting && <LoadingOverlay message="Menerapkan perubahan & menyiapkan unduhan..." />}
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FaDownload /> Terapkan & Unduh PDF
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={showSignaturePad} onClose={() => setShowSignaturePad(false)} title="Gambar Tanda Tangan" size="md">
        <SignaturePad onSave={handleSignatureSaved} onCancel={() => setShowSignaturePad(false)} />
      </Modal>
    </section>
  );
};

export default PdfEditor;
