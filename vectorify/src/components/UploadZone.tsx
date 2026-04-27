import React, { useCallback, useState } from 'react';
import { Upload, FileImage, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadZoneProps {
  onUpload: (file: File) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];

const UploadZone: React.FC<UploadZoneProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validateFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a valid image file (JPG, PNG, GIF, BMP, or WebP).');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds 10MB limit.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
      setFileState(file);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setFileState(file);
    }
  };

  const setFileState = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative group rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden ${
          isDragging 
            ? 'border-accent bg-accent/5 scale-[1.01]' 
            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
        }`}
      >
        <input
          type="file"
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileInput}
          aria-label="Upload image"
          title="Upload image"
        />

        <div className="py-24 flex flex-col items-center justify-center text-center px-6">
          <AnimatePresence mode="wait">
            {!previewUrl ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <Upload className="w-10 h-10 text-white/40 group-hover:text-accent transition-colors" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Drop your image here</h3>
                <p className="text-white/40">or click to browse from your computer</p>
                <div className="mt-8 flex gap-4 text-xs font-medium text-white/20 uppercase tracking-widest">
                  <span>PNG</span>
                  <span>JPG</span>
                  <span>GIF</span>
                  <span>BMP</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center w-full max-w-sm"
              >
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 mb-6 bg-checkerboard">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                  <button 
                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                    title="Remove image"
                    aria-label="Remove image"
                    className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-md rounded-lg text-white/60 hover:text-white transition-colors z-20 pointer-events-auto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-left w-full p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                  <FileImage className="w-6 h-6 text-accent" />
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate">{selectedFile?.name}</p>
                    <p className="text-xs text-white/40">{(selectedFile!.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onUpload(selectedFile!); }}
                  className="mt-8 w-full py-4 bg-accent text-white font-bold rounded-xl hover:bg-accent/90 transition-all shadow-xl shadow-accent/20 active:scale-95 pointer-events-auto"
                >
                  Vectorize Now
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UploadZone;
