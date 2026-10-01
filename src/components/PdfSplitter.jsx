import React, { useCallback, useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { FaCheck, FaCheckSquare, FaFileArchive, FaFileExport, FaFilePdf, FaRedo, FaSquare } from "react-icons/fa";
import FileDropzone from "./common/FileDropzone.jsx";
import LoadingOverlay from "./common/LoadingOverlay.jsx";
import PageThumbnail from "./common/PageThumbnail.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import {
  buildOutputFileName,
  formatFileSize,
  getFriendlyErrorMessage,
  isPdfFile,
  loadPdfJsDocument,
  readFileAsArrayBuffer,
} from "../utils/pdfUtils";

const PdfSplitter = () => {
  const notify = useNotification();
  const [sourceFile, setSourceFile] = useState(null);
  const [pdfJsDoc, setPdfJsDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState(() => new Set());
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const pageNumbers = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  const resetDocument = useCallback(() => {
    setSourceFile(null);
    setPdfJsDoc(null);
    setNumPages(0);
    setSelectedPages(new Set());
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
      setSelectedPages(new Set());
      try {
        // Read the file twice: pdf-lib and pdfjs each consume their own ArrayBuffer independently.
        const validationBuffer = await readFileAsArrayBuffer(file);
        const pdfLibDoc = await PDFDocument.load(validationBuffer, { ignoreEncryption: true });
        const renderBuffer = await readFileAsArrayBuffer(file);
        const doc = await loadPdfJsDocument(renderBuffer);

        setSourceFile(file);
        setPdfJsDoc(doc);
        setNumPages(pdfLibDoc.getPageCount());
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

  const togglePage = (pageNumber) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNumber)) next.delete(pageNumber);
      else next.add(pageNumber);
      return next;
    });
  };

  const selectAll = () => setSelectedPages(new Set(pageNumbers));
  const clearSelection = () => setSelectedPages(new Set());

  const extractSelectedPages = async () => {
    if (!sourceFile || !selectedPages.size) return;
    setIsProcessing(true);
    try {
      const buffer = await readFileAsArrayBuffer(sourceFile);
      const sourcePdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pageIndices = Array.from(selectedPages)
        .sort((a, b) => a - b)
        .map((pageNumber) => pageNumber - 1);

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
      copiedPages.forEach((page) => newPdf.addPage(page));

      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      saveAs(blob, buildOutputFileName(sourceFile.name, "extracted"));
      notify.success(`Berhasil mengekstrak ${pageIndices.length} halaman ke file baru.`);
    } catch (err) {
      console.error(err);
      notify.error(getFriendlyErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const splitPagesToZip = async () => {
    if (!sourceFile) return;
    setIsProcessing(true);
    try {
      const buffer = await readFileAsArrayBuffer(sourceFile);
      const sourcePdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const targetIndices = selectedPages.size
        ? Array.from(selectedPages)
            .sort((a, b) => a - b)
            .map((pageNumber) => pageNumber - 1)
        : sourcePdf.getPageIndices();

      const zip = new JSZip();
      for (const pageIndex of targetIndices) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
        newPdf.addPage(copiedPage);
        const bytes = await newPdf.save();
        zip.file(`halaman-${pageIndex + 1}.pdf`, bytes);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, buildOutputFileName(sourceFile.name, "split-pages", "zip"));
      notify.success(`Berhasil memisahkan ${targetIndices.length} halaman menjadi file terpisah (ZIP).`);
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
        <h2 className="text-lg font-semibold text-slate-800">Split & Extract PDF</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pisahkan setiap halaman menjadi file tersendiri, atau ekstrak hanya halaman tertentu menjadi satu PDF baru.
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
                  {formatFileSize(sourceFile.size)} &middot; {numPages} halaman
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  <FaCheckSquare size={13} /> Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
                >
                  <FaSquare size={13} /> Hapus Pilihan
                </button>
              </div>
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{selectedPages.size}</span> dari {numPages} halaman dipilih
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pageNumbers.map((pageNumber) => {
                const isSelected = selectedPages.has(pageNumber);
                return (
                  <button
                    type="button"
                    key={pageNumber}
                    onClick={() => togglePage(pageNumber)}
                    className={`group relative overflow-hidden rounded-xl border-2 p-1.5 transition-all ${
                      isSelected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : "border-transparent bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <PageThumbnail pdfDoc={pdfJsDoc} pageNumber={pageNumber} width={140} className="mx-auto" />
                    <span
                      className={`absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-700/70 text-white"
                      }`}
                    >
                      {pageNumber}
                    </span>
                    {isSelected && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                        <FaCheck size={11} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:flex-row">
            {isProcessing && <LoadingOverlay message="Memproses halaman PDF..." />}
            <button
              type="button"
              onClick={extractSelectedPages}
              disabled={!selectedPages.size || isProcessing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FaFileExport /> Ekstrak Halaman Terpilih ({selectedPages.size})
            </button>
            <button
              type="button"
              onClick={splitPagesToZip}
              disabled={isProcessing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors enabled:hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FaFileArchive /> Pisahkan {selectedPages.size ? `${selectedPages.size} Halaman` : "Semua Halaman"} (ZIP)
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default PdfSplitter;
