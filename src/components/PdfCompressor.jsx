import React, { useCallback, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FaCompressAlt, FaDownload, FaFilePdf, FaRedo } from "react-icons/fa";
import FileDropzone from "./common/FileDropzone.jsx";
import LoadingOverlay from "./common/LoadingOverlay.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import {
  buildOutputFileName,
  dataUrlToUint8Array,
  downloadPdfBytes,
  formatFileSize,
  getFriendlyErrorMessage,
  isPdfFile,
  loadPdfJsDocument,
  readFileAsArrayBuffer,
} from "../utils/pdfUtils";

const LEVELS = {
  low: { label: "Rendah", hint: "Kualitas terbaik, ukuran berkurang sedikit", quality: 0.85, scale: 1.5 },
  medium: { label: "Sedang", hint: "Keseimbangan antara ukuran file & kualitas gambar", quality: 0.6, scale: 1.15 },
  high: { label: "Tinggi", hint: "Ukuran file paling kecil, kualitas gambar menurun", quality: 0.35, scale: 0.85 },
};

/** Rasterizes each page to a JPEG at the chosen quality/DPI and rebuilds the PDF from those images. */
const PdfCompressor = () => {
  const notify = useNotification();
  const [sourceFile, setSourceFile] = useState(null);
  const [pdfJsDoc, setPdfJsDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [level, setLevel] = useState("medium");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);

  const resetDocument = useCallback(() => {
    setSourceFile(null);
    setPdfJsDoc(null);
    setNumPages(0);
    setResult(null);
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
      setResult(null);
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

  const handleCompress = async () => {
    if (!pdfJsDoc || !numPages) return;
    setIsCompressing(true);
    setResult(null);
    setProgress({ current: 0, total: numPages });

    try {
      const preset = LEVELS[level];
      const newPdf = await PDFDocument.create();

      for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
        const page = await pdfJsDoc.getPage(pageNumber);
        const renderViewport = page.getViewport({ scale: preset.scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(renderViewport.width));
        canvas.height = Math.max(1, Math.round(renderViewport.height));
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport: renderViewport }).promise;

        const dataUrl = canvas.toDataURL("image/jpeg", preset.quality);
        const jpgImage = await newPdf.embedJpg(dataUrlToUint8Array(dataUrl));

        const basePageViewport = page.getViewport({ scale: 1 });
        const newPage = newPdf.addPage([basePageViewport.width, basePageViewport.height]);
        newPage.drawImage(jpgImage, { x: 0, y: 0, width: basePageViewport.width, height: basePageViewport.height });

        setProgress({ current: pageNumber, total: numPages });
      }

      const bytes = await newPdf.save();
      setResult({ bytes, size: bytes.byteLength });

      if (bytes.byteLength < sourceFile.size) {
        const reduction = Math.round((1 - bytes.byteLength / sourceFile.size) * 100);
        notify.success(`Kompresi selesai. Ukuran berkurang ${reduction}%.`);
      } else {
        notify.warning("Hasil kompresi tidak lebih kecil dari file asli. Dokumen ini mungkin sudah efisien.");
      }
    } catch (err) {
      console.error(err);
      notify.error(getFriendlyErrorMessage(err));
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !sourceFile) return;
    downloadPdfBytes(result.bytes, buildOutputFileName(sourceFile.name, `compressed-${level}`));
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">Kompres PDF</h2>
        <p className="mt-1 text-sm text-slate-500">
          Perkecil ukuran file PDF langsung di browser Anda dengan memilih tingkat kompresi yang sesuai.
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
            <h3 className="text-sm font-semibold text-slate-700">Pilih Tingkat Kompresi</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Object.entries(LEVELS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLevel(key)}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    level === key ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-700">{preset.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{preset.hint}</p>
                </button>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Catatan: proses ini mengubah setiap halaman menjadi gambar terkompresi, sehingga teks pada hasil akhir tidak lagi dapat
              diseleksi/disalin.
            </p>
          </div>

          <div className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {isCompressing && (
              <LoadingOverlay message={`Mengompres halaman ${progress.current} dari ${progress.total}...`} />
            )}
            <button
              type="button"
              onClick={handleCompress}
              disabled={isCompressing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FaCompressAlt /> Kompres PDF
            </button>
          </div>

          {result && (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">Hasil Kompresi</h3>
              <div className="mt-3 grid grid-cols-2 gap-4 text-center">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">Ukuran Asli</p>
                  <p className="text-lg font-semibold text-slate-700">{formatFileSize(sourceFile.size)}</p>
                </div>
                <div className={`rounded-xl p-4 ${result.size < sourceFile.size ? "bg-emerald-50" : "bg-amber-50"}`}>
                  <p className="text-xs text-slate-400">Setelah Kompresi</p>
                  <p className={`text-lg font-semibold ${result.size < sourceFile.size ? "text-emerald-600" : "text-amber-600"}`}>
                    {formatFileSize(result.size)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-center text-sm font-medium text-slate-500">
                {result.size < sourceFile.size
                  ? `Berkurang ${Math.round((1 - result.size / sourceFile.size) * 100)}% dari ukuran asli`
                  : "Ukuran tidak berkurang secara signifikan"}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <FaDownload /> Unduh PDF Terkompresi
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default PdfCompressor;
