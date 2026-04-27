import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, Download, Copy, Settings, ZoomIn, ZoomOut, 
  RefreshCw, Check, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { vectorizeImage, downloadSVG, copyToClipboard, defaultOptions } from '../lib/vectorizer';
import type { VectorizeOptions } from '../lib/vectorizer';

interface VectorizerProps {
  file: File;
  onReset: () => void;
}

const Vectorizer: React.FC<VectorizerProps> = ({ file, onReset }) => {
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [svgContent, setSvgContent] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(true);
  const [options, setOptions] = useState<VectorizeOptions>(defaultOptions);
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [showBg, setShowBg] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'original'>('preview');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    processVector(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const processVector = async (url: string, currentOptions: VectorizeOptions = options) => {
    setIsProcessing(true);
    try {
      const result = await vectorizeImage(url, currentOptions);
      setSvgContent(result);
    } catch (error) {
      console.error('Vectorization failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOptionChange = (key: keyof VectorizeOptions, value: number) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    processVector(originalUrl, newOptions);
  };

  const handleDownload = () => {
    if (svgContent) {
      downloadSVG(svgContent, file.name);
    }
  };

  const handleCopy = () => {
    if (svgContent) {
      copyToClipboard(svgContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[900px]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onReset}
          className="group flex items-center gap-2 text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to upload</span>
        </button>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy SVG'}
          </button>
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-all text-sm font-bold shadow-lg shadow-accent/20"
          >
            <Download className="w-4 h-4" />
            Download SVG
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 h-full overflow-hidden">
        {/* Left: Preview Panel */}
        <div className="flex-1 flex flex-col bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden min-h-[400px]">
          <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <div className="flex p-1 bg-black/40 rounded-lg gap-1">
              <button 
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === 'preview' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
              >
                Vector Preview
              </button>
              <button 
                onClick={() => setActiveTab('original')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === 'original' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
              >
                Original
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} 
              title="Zoom out"
              className="p-1.5 hover:bg-white/5 rounded-md text-white/40 hover:text-white transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-white/40 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(z => Math.min(3, z + 0.25))} 
              title="Zoom in"
              className="p-1.5 hover:bg-white/5 rounded-md text-white/40 hover:text-white transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button 
                onClick={() => setShowBg(!showBg)} 
                title="Toggle checkerboard"
                className={`p-1.5 rounded-md transition-colors ${showBg ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white'}`}
              >
                <Zap className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className={`relative flex-1 overflow-hidden flex items-center justify-center p-8 ${showBg ? 'bg-checkerboard' : 'bg-[#0a0a0a]'}`}>
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  <RefreshCw className="w-10 h-10 text-accent animate-spin" />
                  <p className="text-sm font-medium text-white/40">Vectorizing image...</p>
                </motion.div>
              ) : activeTab === 'preview' ? (
                <motion.div 
                  key="svg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ transform: `scale(${zoom})` }}
                  className="max-w-full max-h-full drop-shadow-2xl transition-transform duration-300"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <motion.img 
                  key="original"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={originalUrl} 
                  alt="Original" 
                  style={{ transform: `scale(${zoom})` }}
                  className="max-w-full max-h-full object-contain transition-transform duration-300"
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Sidebar Editor */}
        <div className="w-full lg:w-80 flex flex-col gap-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-2 mb-6 text-sm font-bold uppercase tracking-wider text-white/40">
              <Settings className="w-4 h-4" />
              Vector Settings
            </div>

            <div className="space-y-8">
              <Control 
                label="Number of Colors" 
                value={options.colors} 
                min={2} 
                max={16} 
                step={1}
                onChange={(v) => handleOptionChange('colors', v)} 
              />
              <Control 
                label="Line Threshold" 
                value={options.ltres} 
                min={0} 
                max={5} 
                step={0.1}
                onChange={(v) => handleOptionChange('ltres', v)} 
                desc="Higher is simpler lines"
              />
              <Control 
                label="Curve Tolerance" 
                value={options.qtres} 
                min={0} 
                max={5} 
                step={0.1}
                onChange={(v) => handleOptionChange('qtres', v)} 
              />
              <Control 
                label="Stroke Width" 
                value={options.strokewidth} 
                min={0} 
                max={2} 
                step={0.1}
                onChange={(v) => handleOptionChange('strokewidth', v)} 
              />
              <Control 
                label="Pre-Blur" 
                value={options.blurradius} 
                min={0} 
                max={5} 
                step={1}
                onChange={(v) => handleOptionChange('blurradius', v)} 
                desc="Smooth out noise first"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-accent/5 border border-accent/10 flex items-start gap-3">
            <Zap className="w-5 h-5 text-accent mt-0.5" />
            <div>
              <p className="text-xs font-bold text-accent mb-0.5 uppercase">Pro Tip</p>
              <p className="text-xs text-white/50 leading-relaxed">
                For logos, set Blur to 0 and Curve Tolerance to 1. For photos, 
                try 8–12 colors and 1.5 Blur.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  desc?: string;
}

const Control: React.FC<ControlProps> = ({ label, value, min, max, step, onChange, desc }) => (
  <div>
    <div className="flex justify-between items-center mb-2">
      <label className="text-sm font-medium text-white/80">{label}</label>
      <span className="text-xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">{value}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      title={label}
      aria-label={label}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-accent hover:bg-white/10 transition-colors"
    />
    {desc && <p className="mt-1.5 text-[10px] text-white/30 italic">{desc}</p>}
  </div>
);

export default Vectorizer;
