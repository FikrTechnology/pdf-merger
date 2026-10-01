import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FaCloudUploadAlt } from "react-icons/fa";

const FileDropzone = ({
  onFilesAccepted,
  multiple = true,
  disabled = false,
  title = "Seret & lepas file PDF di sini",
  hint = "atau klik untuk memilih file dari perangkat Anda",
}) => {
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (!acceptedFiles?.length) return;
      onFilesAccepted(acceptedFiles);
    },
    [onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    disabled,
    accept: { "application/pdf": [".pdf"] },
  });

  return (
    <div
      {...getRootProps()}
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/60"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input {...getInputProps()} />
      <FaCloudUploadAlt className="mb-3 text-4xl text-blue-500 transition-transform group-hover:scale-110" />
      <p className="font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{hint}</p>
    </div>
  );
};

export default FileDropzone;
