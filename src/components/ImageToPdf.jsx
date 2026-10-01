import React, { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FaChevronDown, FaChevronUp, FaFileExport, FaGripVertical, FaImage, FaTrashAlt } from "react-icons/fa";
import FileDropzone from "./common/FileDropzone.jsx";
import LoadingOverlay from "./common/LoadingOverlay.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import { createId, downloadPdfBytes, formatFileSize, getFriendlyErrorMessage, moveItem } from "../utils/pdfUtils";

const IMAGE_ACCEPT = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] };
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const A4_MARGIN = 36;
const AUTO_MAX_DIMENSION = 842;

const ImageToPdf = () => {
  const notify = useNotification();
  const [images, setImages] = useState([]);
  const [pageSizeMode, setPageSizeMode] = useState("auto");
  const [dragIndex, setDragIndex] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Revoke any still-live object URLs if the user navigates away without converting.
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const handleImagesAccepted = useCallback(
    (acceptedFiles) => {
      const validFiles = acceptedFiles.filter((file) => /^image\/(png|jpe?g)$/i.test(file.type));
      const rejectedCount = acceptedFiles.length - validFiles.length;
      if (rejectedCount > 0) {
        notify.warning(`${rejectedCount} file diabaikan karena bukan gambar PNG/JPG.`);
      }
      if (!validFiles.length) return;

      const entries = validFiles.map((file) => ({ id: createId(), file, previewUrl: URL.createObjectURL(file) }));
      setImages((prev) => [...prev, ...entries]);
      notify.success(`${entries.length} gambar berhasil ditambahkan.`);
    },
    [notify]
  );

  const removeImage = (id) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setImages([]);
  };

  const handleDragStart = (index) => (event) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (index) => (event) => {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setImages((prev) => moveItem(prev, dragIndex, index));
    setDragIndex(null);
  };
  const handleDragEnd = () => setDragIndex(null);

  const convertToPdf = async () => {
    if (!images.length) return;
    setIsConverting(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const item of images) {
        const bytes = new Uint8Array(await item.file.arrayBuffer());
        const isPng = /png/i.test(item.file.type);
        const embedded = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const imgW = embedded.width;
        const imgH = embedded.height;

        if (pageSizeMode === "auto") {
          const scale = Math.min(AUTO_MAX_DIMENSION / Math.max(imgW, imgH), 1);
          const pageWidth = imgW * scale;
          const pageHeight = imgH * scale;
          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
        } else {
          const maxW = A4_WIDTH - A4_MARGIN * 2;
          const maxH = A4_HEIGHT - A4_MARGIN * 2;
          const ratio = Math.min(maxW / imgW, maxH / imgH, 1);
          const drawW = imgW * ratio;
          const drawH = imgH * ratio;
          const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
          page.drawImage(embedded, { x: (A4_WIDTH - drawW) / 2, y: (A4_HEIGHT - drawH) / 2, width: drawW, height: drawH });
        }
      }

      const bytes = await pdfDoc.save();
      downloadPdfBytes(bytes, "images-to-document.pdf");
      notify.success(`Berhasil membuat PDF dari ${images.length} gambar.`);
    } catch (err) {
      console.error(err);
      notify.error(getFriendlyErrorMessage(err));
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">Gambar ke PDF</h2>
        <p className="mt-1 text-sm text-slate-500">
          Gabungkan beberapa gambar JPG/PNG menjadi satu dokumen PDF. Atur urutan dengan menyeret kartu atau tombol panah.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <FileDropzone
          accept={IMAGE_ACCEPT}
          onFilesAccepted={handleImagesAccepted}
          title="Seret & lepas gambar JPG/PNG di sini"
          hint="bisa pilih beberapa gambar sekaligus"
        />
      </div>

      {images.length > 0 && (
        <>
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{images.length}</span> gambar siap dikonversi
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50"
              >
                <FaTrashAlt size={12} /> Hapus Semua
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {images.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-opacity hover:shadow-md ${
                    dragIndex === index ? "opacity-40" : "opacity-100"
                  }`}
                >
                  <FaGripVertical className="flex-shrink-0 cursor-grab text-slate-300" title="Seret untuk mengurutkan" />
                  <img src={item.previewUrl} alt={item.file.name} className="h-14 w-14 flex-shrink-0 rounded-lg border border-slate-100 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {index + 1}. {item.file.name}
                    </p>
                    <p className="text-xs text-slate-400">{formatFileSize(item.file.size)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setImages((prev) => moveItem(prev, index, index - 1))}
                      disabled={index === 0}
                      className="rounded-lg p-2 text-slate-400 enabled:hover:bg-slate-100 enabled:hover:text-slate-600 disabled:opacity-30"
                      title="Naikkan urutan"
                    >
                      <FaChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImages((prev) => moveItem(prev, index, index + 1))}
                      disabled={index === images.length - 1}
                      className="rounded-lg p-2 text-slate-400 enabled:hover:bg-slate-100 enabled:hover:text-slate-600 disabled:opacity-30"
                      title="Turunkan urutan"
                    >
                      <FaChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(item.id)}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      title="Hapus"
                    >
                      <FaTrashAlt size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">Ukuran Halaman</h3>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <label
                className={`flex-1 cursor-pointer rounded-xl border-2 p-3 transition-colors ${
                  pageSizeMode === "auto" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input type="radio" name="pageSizeMode" value="auto" checked={pageSizeMode === "auto"} onChange={() => setPageSizeMode("auto")} className="sr-only" />
                <span className="text-sm font-semibold text-slate-700">Otomatis</span>
                <p className="mt-1 text-xs text-slate-500">Ukuran halaman mengikuti rasio asli setiap gambar</p>
              </label>
              <label
                className={`flex-1 cursor-pointer rounded-xl border-2 p-3 transition-colors ${
                  pageSizeMode === "a4" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input type="radio" name="pageSizeMode" value="a4" checked={pageSizeMode === "a4"} onChange={() => setPageSizeMode("a4")} className="sr-only" />
                <span className="text-sm font-semibold text-slate-700">A4 (Potret)</span>
                <p className="mt-1 text-xs text-slate-500">Gambar ditempatkan di tengah halaman berukuran A4</p>
              </label>
            </div>
          </div>

          <div className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {isConverting && <LoadingOverlay message="Menyusun gambar menjadi PDF..." />}
            <button
              type="button"
              onClick={convertToPdf}
              disabled={isConverting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FaFileExport /> Buat PDF dari {images.length} Gambar
            </button>
          </div>
        </>
      )}

      {!images.length && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-400">
          <FaImage className="text-2xl text-slate-300" />
          Belum ada gambar yang ditambahkan.
        </div>
      )}
    </section>
  );
};

export default ImageToPdf;
