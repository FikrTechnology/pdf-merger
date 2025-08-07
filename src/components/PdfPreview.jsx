import React, { useRef, useEffect } from 'react';
import * as pdfjslib from 'pdfjs-dist/legacy/build/pdf';


pdfjslib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjslib.version}/pdf.worker.min.js`;


const PdfPreview = ({ file }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const renderPage = async () => {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjslib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            const scale = 0.3;
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport }).promise;
        };
        renderPage();
    }, [file]);

    return <canvas ref={canvasRef} style={{ border: "1px solid black" }}></canvas>
};

export default PdfPreview;