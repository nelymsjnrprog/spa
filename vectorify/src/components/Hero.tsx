import React from 'react';
import { Sparkles } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <div className="text-center py-16 md:py-24 max-w-3xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-wider mb-8 animate-pulse">
        <Sparkles className="w-3 h-3" />
        AI-Powered Vectorization
      </div>
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
        Turn Pixels into Clean Vectors
      </h1>
      <p className="text-lg md:text-xl text-white/50 leading-relaxed max-w-2xl mx-auto">
        Vectorize your raster images instantly. We use intelligent color layering 
        and adaptive simplification for professional-grade SVGs.
      </p>
    </div>
  );
};

export default Hero;
