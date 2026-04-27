import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import UploadZone from './components/UploadZone';
import Vectorizer from './components/Vectorizer';
import { AnimatePresence, motion } from 'framer-motion';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = (uploadedFile: File) => {
    setFile(uploadedFile);
  };

  const handleReset = () => {
    setFile(null);
  };

  return (
    <div className="min-h-screen bg-background text-white selection:bg-accent/30">
      <Navbar onReset={handleReset} />
      
      <main className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <Hero />
              <div className="max-w-4xl mx-auto mt-12">
                <UploadZone onUpload={handleUpload} />
              </div>
              
              <section className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto pb-20">
                <Step 
                  number="01" 
                  title="Upload" 
                  description="Drag and drop your raster image (JPG, PNG, GIF, BMP) up to 10MB." 
                />
                <Step 
                  number="02" 
                  title="Vectorize" 
                  description="Our engine traces paths and layers colors using smart posterization." 
                />
                <Step 
                  number="03" 
                  title="Download" 
                  description="Preview, adjust settings, and download your clean, scaleable SVG." 
                />
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="vectorizer"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 120 }}
            >
              <Vectorizer file={file} onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-white/40 text-sm">
        <p>&copy; {new Date().getFullYear()} Vectorify. Premium Image Vectorization.</p>
      </footer>
    </div>
  );
};

const Step: React.FC<{ number: string; title: string; description: string }> = ({ number, title, description }) => (
  <div className="relative p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-accent/30 transition-colors group">
    <div className="text-4xl font-bold text-accent/20 mb-4 group-hover:text-accent/40 transition-colors">{number}</div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-white/60 leading-relaxed">{description}</p>
  </div>
);

export default App;
