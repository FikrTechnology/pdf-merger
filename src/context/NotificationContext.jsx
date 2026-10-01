import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const NotificationContext = createContext(null);

let idCounter = 0;

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (message, { type = "info", duration = 5000 } = {}) => {
      idCounter += 1;
      const id = idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      notify,
      success: (message, options) => notify(message, { ...options, type: "success" }),
      error: (message, options) => notify(message, { duration: 7000, ...options, type: "error" }),
      warning: (message, options) => notify(message, { ...options, type: "warning" }),
      info: (message, options) => notify(message, { ...options, type: "info" }),
    }),
    [toasts, dismiss, notify]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook must live alongside its provider/context
export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification harus digunakan di dalam NotificationProvider");
  }
  return ctx;
}
