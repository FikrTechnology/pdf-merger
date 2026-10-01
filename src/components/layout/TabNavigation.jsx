import React from "react";

const TabNavigation = ({ tabs, activeTab, onChange }) => (
  <nav className="mx-auto w-full max-w-6xl px-4 sm:px-6">
    <div className="scrollbar-thin flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex min-w-[140px] flex-1 flex-col items-center gap-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors sm:flex-row sm:justify-center sm:gap-2 ${
              isActive ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            <Icon className="text-base" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

export default TabNavigation;
