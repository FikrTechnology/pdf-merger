import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { PDFDocument } from "pdf-lib";
import { saveAs } from "file-saver";
import PdfItem from "./PdfItem.jsx";
import './PdfMerger.css';



const PdfMerger = () => {
    const [files, setFiles] = useState([]);

    const onDrop = useCallback((acceptedFiles) => {
        const pdfs = acceptedFiles.filter(file => file.type === 'application/pdf');
        console.log("PDF Files dropped:", pdfs);
        setFiles(prev => [...prev, ...pdfs]);
    }, []);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: {'application/pdf': []},
        multiple: true
    });

    const mergePDFs = async () => {
        const mergedPdf = await PDFDocument.create();
        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }
        const mergedPdfFile = await mergedPdf.save();
        const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
        saveAs(blob, 'merged.pdf');
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;
        const newFiles = Array.from(files);
        const [moved] = newFiles.splice(result.source.index, 1);
        newFiles.splice(result.destination.index, 0, moved);
        setFiles(newFiles);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    }

    return (
        <div className="pdf-merger-container">
            <h1 className="pdf-title">PDF Merger</h1>

            <div {...getRootProps()} className="pdf-dropzone">
                <input {...getInputProps()} />
                <p>Drag & drop PDF files here, or click to select files</p>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="pdfList">
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="pdf-list">
                            {files.map((file, index) => (
                                <Draggable key={file.name + index} draggableId={file.name + index} index={index}>
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className="pdf-card"
                                        >
                                            <PdfItem file={file} index={index}/>
                                            <button
                                                className="pdf-remove-btn"
                                                onClick={() => removeFile(index)}
                                                type="button"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <button
                onClick={mergePDFs}
                disabled={files.length < 2}
                className="pdf-merge-btn"
            >
                Gabungkan PDF ({files.length})
            </button>
        </div>
    );
};

export default PdfMerger;