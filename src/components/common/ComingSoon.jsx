import React from "react";

const ComingSoon = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
    {Icon && (
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl text-blue-500">
        <Icon />
      </span>
    )}
    <h2 className="text-xl font-semibold text-slate-700">{title}</h2>
    <p className="max-w-md text-sm text-slate-500">{description}</p>
    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
      Segera hadir
    </span>
  </div>
);

export default ComingSoon;
