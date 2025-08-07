import React from "react";
import { FaFilePdf } from "react-icons/fa";
import './PdfItem.css';

const PdfItem = ({ file, index }) => {
    return (
        <div className="pdf-item">
            <FaFilePdf className="pdf-icon" />
            <div>
                <strong>{index + 1}. {file.name}</strong><br />
                <small>{(file.size / 1024).toFixed(1)} KB</small>
            </div>
        </div>
    );
};

export default PdfItem;