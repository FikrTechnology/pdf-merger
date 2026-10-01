import React, { useCallback, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FaLayerGroup, FaTrashAlt } from "react-icons/fa";
import FileDropzone from "./common/FileDropzone.jsx";
import LoadingOverlay from "./common/LoadingOverlay.jsx";
import PdfPreviewModal from "./common/PdfPreviewModal.jsx";
import PdfItem from "./PdfItem.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import {
    createId,
    downloadPdfBytes,
    getFriendlyErrorMessage,
    isPdfFile,
    moveItem,
    readFileAsArrayBuffer,
} from "../utils/pdfUtils";

const PdfMerger = () => {
    const notify = useNotification();
    const [files, setFiles] = useState([]);
    const [isValidating, setIsValidating] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);

    const handleFilesAccepted = useCallback(
        async (acceptedFiles) => {
            const pdfFiles = acceptedFiles.filter(isPdfFile);
            const rejectedCount = acceptedFiles.length - pdfFiles.length;
            if (rejectedCount > 0) {
                notify.warning(`${rejectedCount} file diabaikan karena bukan format PDF.`);
            }
            if (!pdfFiles.length) return;

            setIsValidating(true);
            const validEntries = [];
            const invalidNames = [];

            for (const file of pdfFiles) {
                try {
                    const buffer = await readFileAsArrayBuffer(file);
                    await PDFDocument.load(buffer, { ignoreEncryption: true });
                    validEntries.push({ id: createId(), file });
                } catch (err) {
                    console.error("File PDF tidak valid:", file.name, err);
                    invalidNames.push(file.name);
                }
            }

            setIsValidating(false);

            if (validEntries.length) {
                setFiles((prev) => [...prev, ...validEntries]);
                notify.success(`${validEntries.length} file berhasil ditambahkan.`);
            }
            if (invalidNames.length) {
                notify.error(`Gagal memuat ${invalidNames.length} file (rusak/terenkripsi): ${invalidNames.join(", ")}`);
            }
        },
        [notify]
    );

    const removeFile = (id) => setFiles((prev) => prev.filter((entry) => entry.id !== id));
    const clearAll = () => setFiles([]);

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
        setFiles((prev) => moveItem(prev, dragIndex, index));
        setDragIndex(null);
    };
    const handleDragEnd = () => setDragIndex(null);

    const mergePdfs = async () => {
        if (files.length < 2) return;
        setIsMerging(true);
        try {
            const mergedPdf = await PDFDocument.create();
            for (const { file } of files) {
                const buffer = await readFileAsArrayBuffer(file);
                const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
            const mergedBytes = await mergedPdf.save();
            downloadPdfBytes(mergedBytes, "merged-document.pdf");
            notify.success("PDF berhasil digabungkan dan diunduh.");
        } catch (err) {
            console.error(err);
            notify.error(getFriendlyErrorMessage(err));
        } finally {
            setIsMerging(false);
        }
    };

    return (
        <section className="flex flex-col gap-5">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-lg font-semibold text-slate-800">Merge PDF</h2>
                <p className="mt-1 text-sm text-slate-500">
                    Gabungkan beberapa file PDF menjadi satu dokumen. Atur urutan dengan menyeret kartu atau tombol panah.
                </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <FileDropzone onFilesAccepted={handleFilesAccepted} />
            </div>

            {files.length > 0 && (
                <div className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    {isValidating && <LoadingOverlay message="Memvalidasi file PDF..." />}

                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            <span className="font-semibold text-slate-700">{files.length}</span> file siap digabungkan
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
                        {files.map((entry, index) => (
                            <div
                                key={entry.id}
                                draggable
                                onDragStart={handleDragStart(index)}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop(index)}
                                onDragEnd={handleDragEnd}
                                className={`transition-opacity ${dragIndex === index ? "opacity-40" : "opacity-100"}`}
                            >
                                <PdfItem
                                    file={entry.file}
                                    index={index}
                                    total={files.length}
                                    onPreview={() => setPreviewFile(entry.file)}
                                    onRemove={() => removeFile(entry.id)}
                                    onMoveUp={() => setFiles((prev) => moveItem(prev, index, index - 1))}
                                    onMoveDown={() => setFiles((prev) => moveItem(prev, index, index + 1))}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                {isMerging && <LoadingOverlay message="Menggabungkan PDF..." />}
                <button
                    type="button"
                    onClick={mergePdfs}
                    disabled={files.length < 2 || isMerging}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <FaLayerGroup /> Gabungkan PDF ({files.length})
                </button>
                {files.length === 1 && (
                    <p className="mt-2 text-center text-xs text-slate-400">Tambahkan minimal 2 file untuk menggabungkan.</p>
                )}
            </div>

            <PdfPreviewModal file={previewFile} isOpen={Boolean(previewFile)} onClose={() => setPreviewFile(null)} />
        </section>
    );
};

export default PdfMerger;