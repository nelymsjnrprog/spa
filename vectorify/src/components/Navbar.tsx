import React from 'react';
import { Layers } from 'lucide-react';

interface NavbarProps {
  onReset: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onReset }) => {
  return (
    <nav className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div 
        className="flex items-center gap-3 cursor-pointer group"
        onClick={onReset}
      >
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20 group-hover:scale-110 transition-transform duration-300">
          <Layers className="text-white w-6 h-6" />
        </div>
        <span className="text-xl font-bold tracking-tight">Vectorify</span>
      </div>

      <div className="flex items-center gap-6">
        <a 
          href="#" 
          className="text-sm font-medium text-white/60 hover:text-white transition-colors"
        >
          Documentation
        </a>
        <button className="px-5 py-2.5 rounded-xl bg-accent text-sm font-semibold hover:bg-accent/90 transition-all shadow-lg shadow-accent/10 active:scale-95">
          Get Started
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
