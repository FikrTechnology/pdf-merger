import React from "react";
import { FaFilePdf } from "react-icons/fa";

const Header = () => (
  <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
    <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-6">
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200">
        <FaFilePdf className="text-xl" />
      </span>
      <div>
        <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">PDF Toolkit</h1>
        <p className="text-sm text-slate-500">Gabung, pisah, edit, dan tanda tangani PDF langsung dari browser Anda</p>
      </div>
    </div>
  </header>
);

export default Header;
