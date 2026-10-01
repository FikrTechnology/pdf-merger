import React, { useState } from 'react';
import { FaCompressAlt, FaCut, FaImages, FaLayerGroup, FaObjectGroup, FaSignature } from 'react-icons/fa';
import Header from './components/layout/Header.jsx';
import TabNavigation from './components/layout/TabNavigation.jsx';
import ToastContainer from './components/common/ToastContainer.jsx';
import PdfMerger from './components/PdfMerger.jsx';
import PdfSplitter from './components/PdfSplitter.jsx';
import PdfEditor from './components/PdfEditor.jsx';
import PageOrganizer from './components/PageOrganizer.jsx';
import PdfCompressor from './components/PdfCompressor.jsx';
import ImageToPdf from './components/ImageToPdf.jsx';

const TABS = [
  { id: 'merge', label: 'Merge PDF', icon: FaObjectGroup, Component: PdfMerger },
  { id: 'split', label: 'Split & Extract', icon: FaCut, Component: PdfSplitter },
  { id: 'editor', label: 'Edit, Sign & Watermark', icon: FaSignature, Component: PdfEditor },
  { id: 'organizer', label: 'Page Organizer', icon: FaLayerGroup, Component: PageOrganizer },
  { id: 'compress', label: 'Kompres PDF', icon: FaCompressAlt, Component: PdfCompressor },
  { id: 'image-to-pdf', label: 'Gambar ke PDF', icon: FaImages, Component: ImageToPdf },
];

function App() {
  const [activeTab, setActiveTab] = useState('merge');
  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.Component ?? PdfMerger;

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <TabNavigation tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <ActiveComponent />
      </main>
      <ToastContainer />
    </div>
  )
}

export default App
