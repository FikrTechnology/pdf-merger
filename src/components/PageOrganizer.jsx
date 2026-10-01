import React, { useCallback, useMemo, useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import {
  FaChevronDown,
  FaChevronUp,
  FaDownload,
  FaFilePdf,
  FaGripVertical,
  FaRedo,
  FaTrash,
  FaTrashRestore,
} from "react-icons/fa";
import FileDropzone from "./common/FileDropzone.jsx";
import LoadingOverlay from "./common/LoadingOverlay.jsx";
import PageThumbnail from "./common/PageThumbnail.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import {
  buildOutputFileName,
  downloadPdfBytes,
  formatFileSize,
  getFriendlyErrorMessage,
  isPdfFile,
  loadPdfJsDocument,
  moveItem,
  readFileAsArrayBuffer,
} from "../utils/pdfUtils";

const getFinalRotation = (item) => (((item.baseRotation + item.addedRotation) % 360) + 360) % 360;

const PageOrganizer = () => {
  const notify = useNotification();
  const [sourceFile, setSourceFile] = useState(null);
  const [pdfJsDoc, setPdfJsDoc] = useState(null);
  const [pages, setPages] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const remainingCount = useMemo(() => pages.filter((item) => !item.removed).length, [pages]);

  const resetDocument = useCallback(() => {
    setSourceFile(null);
    setPdfJsDoc(null);
    setPages([]);
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

        const initialPages = pdfLibDoc.getPages().map((page, index) => ({
          id: `page-${index}`,
          originalIndex: index,
          baseRotation: page.getRotation().angle,
          addedRotation: 0,
          removed: false,
        }));

        setSourceFile(file);
        setPdfJsDoc(doc);
        setPages(initialPages);
        notify.success(`${file.name} berhasil dimuat (${initialPages.length} halaman).`);
      } catch (err) {
        console.error(err);
        notify.error(getFriendlyErrorMessage(err));
      } finally {
        setIsLoadingFile(false);
      }
    },
    [notify]
  );

  const rotatePage = (id) => {
    setPages((prev) => prev.map((item) => (item.id === id ? { ...item, addedRotation: (item.addedRotation + 90) % 360 } : item)));
  };

  const toggleRemoved = (id) => {
    setPages((prev) => prev.map((item) => (item.id === id ? { ...item, removed: !item.removed } : item)));
  };

  const movePageUp = (index) => setPages((prev) => moveItem(prev, index, index - 1));
  const movePageDown = (index) => setPages((prev) => moveItem(prev, index, index + 1));

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
    setPages((prev) => moveItem(prev, dragIndex, index));
    setDragIndex(null);
  };
  const handleDragEnd = () => setDragIndex(null);

  const applyChanges = async () => {
    const remainingPages = pages.filter((item) => !item.removed);
    if (!remainingPages.length) {
      notify.warning("Semua halaman dihapus. Sisakan minimal 1 halaman sebelum menyimpan.");
      return;
    }

    setIsProcessing(true);
    try {
      const buffer = await readFileAsArrayBuffer(sourceFile);
      const sourcePdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(
        sourcePdf,
        remainingPages.map((item) => item.originalIndex)
      );
      copiedPages.forEach((copiedPage, index) => {
        copiedPage.setRotation(degrees(getFinalRotation(remainingPages[index])));
        newPdf.addPage(copiedPage);
      });

      const bytes = await newPdf.save();
      downloadPdfBytes(bytes, buildOutputFileName(sourceFile.name, "organized"));
      notify.success("PDF berhasil disusun ulang dan diunduh.");
    } catch (err) {
      console.error(err);
      notify.error(getFriendlyErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">Page Organizer / Rotate</h2>
        <p className="mt-1 text-sm text-slate-500">
          Lihat thumbnail setiap halaman, putar orientasinya, hapus halaman yang tidak perlu, atau susun ulang urutannya.
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
                  {formatFileSize(sourceFile.size)} &middot; {remainingCount} dari {pages.length} halaman akan disimpan
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

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pages.map((item, index) => {
                const finalRotation = getFinalRotation(item);
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={`relative rounded-xl border-2 p-2 transition-all ${
                      item.removed
                        ? "border-red-200 bg-red-50"
                        : dragIndex === index
                        ? "border-blue-400 bg-blue-50 opacity-50"
                        : "border-transparent bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700/80 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <FaGripVertical className="cursor-grab text-slate-300" title="Seret untuk mengurutkan" />
                    </div>

                    <div className={item.removed ? "opacity-40" : ""}>
                      <PageThumbnail pdfDoc={pdfJsDoc} pageNumber={item.originalIndex + 1} rotation={finalRotation} width={150} className="mx-auto" />
                    </div>

                    {item.removed && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow">Dihapus</span>
                      </div>
                    )}

                    {finalRotation !== 0 && !item.removed && (
                      <span className="absolute right-3 top-9 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {finalRotation}&deg;
                      </span>
                    )}

                    <div className="mt-2 grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => rotatePage(item.id)}
                        disabled={item.removed}
                        className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-40"
                        title="Putar 90 derajat"
                      >
                        <FaRedo size={11} /> Putar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRemoved(item.id)}
                        className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium ${
                          item.removed ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-50 text-red-600 hover:bg-red-100"
                        }`}
                        title={item.removed ? "Pulihkan halaman" : "Hapus halaman"}
                      >
                        {item.removed ? <FaTrashRestore size={11} /> : <FaTrash size={11} />}
                        {item.removed ? "Pulihkan" : "Hapus"}
                      </button>
                      <button
                        type="button"
                        onClick={() => movePageUp(index)}
                        disabled={index === 0}
                        className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-30"
                        title="Pindah ke kiri/atas"
                      >
                        <FaChevronUp size={11} /> Naik
                      </button>
                      <button
                        type="button"
                        onClick={() => movePageDown(index)}
                        disabled={index === pages.length - 1}
                        className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-30"
                        title="Pindah ke kanan/bawah"
                      >
                        <FaChevronDown size={11} /> Turun
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {isProcessing && <LoadingOverlay message="Menyusun ulang & menyimpan PDF..." />}
            <button
              type="button"
              onClick={applyChanges}
              disabled={!remainingCount || isProcessing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FaDownload /> Terapkan & Unduh PDF
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default PageOrganizer;
