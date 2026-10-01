import React from "react";

const LoadingOverlay = ({ message = "Memproses...", fullScreen = false }) => (
  <div
    className={`${fullScreen ? "fixed" : "absolute"} inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/85 backdrop-blur-sm`}
  >
    <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
    <p className="text-sm font-medium text-slate-600">{message}</p>
  </div>
);

export default LoadingOverlay;
