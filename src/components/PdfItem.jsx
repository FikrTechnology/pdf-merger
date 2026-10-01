import React from "react";
import { FaChevronDown, FaChevronUp, FaEye, FaFilePdf, FaGripVertical, FaTrash } from "react-icons/fa";
import { formatFileSize } from "../utils/pdfUtils";

const PdfItem = ({ file, index, total, onPreview, onRemove, onMoveUp, onMoveDown }) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
        <FaGripVertical className="flex-shrink-0 cursor-grab text-slate-300" title="Seret untuk mengurutkan" />
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
            <FaFilePdf />
        </span>
        <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-700">
                {index + 1}. {file.name}
            </p>
            <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
            <button
                type="button"
                onClick={onMoveUp}
                disabled={index === 0}
                className="rounded-lg p-2 text-slate-400 enabled:hover:bg-slate-100 enabled:hover:text-slate-600 disabled:opacity-30"
                title="Naikkan urutan"
            >
                <FaChevronUp size={13} />
            </button>
            <button
                type="button"
                onClick={onMoveDown}
                disabled={index === total - 1}
                className="rounded-lg p-2 text-slate-400 enabled:hover:bg-slate-100 enabled:hover:text-slate-600 disabled:opacity-30"
                title="Turunkan urutan"
            >
                <FaChevronDown size={13} />
            </button>
            <button type="button" onClick={onPreview} className="rounded-lg p-2 text-blue-500 hover:bg-blue-50" title="Pratinjau">
                <FaEye size={14} />
            </button>
            <button type="button" onClick={onRemove} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Hapus">
                <FaTrash size={14} />
            </button>
        </div>
    </div>
);

export default PdfItem;