import React from "react";
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from "react-icons/fa";
import { useNotification } from "../../context/NotificationContext.jsx";

const STYLES = {
  success: { icon: FaCheckCircle, wrap: "bg-emerald-50 text-emerald-700 ring-emerald-200", iconColor: "text-emerald-500" },
  error: { icon: FaExclamationCircle, wrap: "bg-red-50 text-red-700 ring-red-200", iconColor: "text-red-500" },
  warning: { icon: FaExclamationTriangle, wrap: "bg-amber-50 text-amber-700 ring-amber-200", iconColor: "text-amber-500" },
  info: { icon: FaInfoCircle, wrap: "bg-blue-50 text-blue-700 ring-blue-200", iconColor: "text-blue-500" },
};

const ToastContainer = () => {
  const { toasts, dismiss } = useNotification();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-100 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => {
        const style = STYLES[toast.type] || STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            className={`animate-toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 ${style.wrap}`}
            role="alert"
          >
            <Icon className={`mt-0.5 flex-shrink-0 text-lg ${style.iconColor}`} />
            <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="flex-shrink-0 rounded-full p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600"
              aria-label="Tutup notifikasi"
            >
              <FaTimes size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
