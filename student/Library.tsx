
import React, { useEffect, useState } from 'react';
import { Navbar, Container, Card } from '../ui/Layout';
import { libraryService } from '../services/libraryService';
import { LibraryResource } from '../core/types';
import { useAuth } from '../auth/AuthProvider';

const StudentLibrary: React.FC = () => {
  const { profile } = useAuth();
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState<LibraryResource | null>(null);

  useEffect(() => {
    // Wait for profile to load
    if (!profile) return;

    if (!profile.level) {
      setLoading(false);
      return;
    }
    
    let unsubscribed = false;
    setLoading(true);

    try {
      const unsub = libraryService.subscribeToLibrary(
        (data) => {
          if (!unsubscribed) {
            setResources(data);
            setLoading(false);
          }
        },
        { level: profile.level, onlyPublished: true }
      );
      
      return () => {
        unsubscribed = true;
        unsub();
      };
    } catch (err) {
      console.error('Library subscription error:', err);
      setLoading(false);
    }
  }, [profile]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="mb-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Library</h1>
          <p className="text-slate-500 font-medium mt-1">Access your handouts, books, and study materials.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Opening Library...</p>
          </div>
        ) : resources.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-20 text-center shadow-xl shadow-slate-200/30">
            <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-book-open text-3xl"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Empty</h3>
            <p className="text-slate-500 max-w-sm mx-auto">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-8">
            {resources.map((resource) => (
              <Card key={resource.id} className="group flex flex-col h-full bg-white border-none shadow-lg shadow-slate-200/50 rounded-[1.2rem] sm:rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-primary-600/10 transition-all duration-500">
                {/* Visual Cover */}
                <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                  {resource.thumbnailUrl ? (
                    <img 
                      src={resource.thumbnailUrl} 
                      alt={resource.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                      <i className="fas fa-file-pdf text-3xl sm:text-6xl mb-2 sm:mb-4 group-hover:scale-110 transition-transform duration-500"></i>
                      <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-widest bg-white px-2 sm:px-4 py-1 sm:py-2 rounded-full shadow-sm">PDF</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>

                {/* Info */}
                <div className="p-3 sm:p-8 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    {resource.fileSize && (
                      <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {(resource.fileSize / 1024 / 1024).toFixed(1)}MB
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-xs sm:text-xl font-black text-slate-900 mb-1 sm:mb-3 leading-tight group-hover:text-primary-600 transition-colors line-clamp-1">{resource.title}</h3>
                  <p className="text-slate-500 text-[10px] sm:text-sm font-medium line-clamp-2 sm:line-clamp-3 mb-4 sm:mb-8 flex-1">
                    {resource.description || 'Access this study material.'}
                  </p>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setSelectedResource(resource)}
                      className="flex-1 bg-slate-900 text-white py-2 sm:py-5 rounded-xl sm:rounded-[1.5rem] font-black text-[8px] sm:text-[11px] uppercase tracking-[0.15em] hover:bg-primary-600 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-book-reader"></i>
                      <span>Read Handout</span>
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Enhanced PDF Reader Modal */}
        {selectedResource && (
          <PDFViewer 
            resource={selectedResource} 
            onClose={() => setSelectedResource(null)} 
          />
        )}
      </Container>
    </div>
  );
};

const PDFViewer: React.FC<{ resource: LibraryResource; onClose: () => void }> = ({ resource, onClose }) => {

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };

    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#525659] animate-in fade-in duration-300">
      {/* Floating Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 z-[110] w-12 h-12 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-all shadow-2xl active:scale-90 border border-white/10 backdrop-blur-md"
        title="Close Reader (Esc)"
      >
        <i className="fas fa-times text-xl"></i>
      </button>

      {/* Full Screen PDF Content */}
      <div className="flex-1 relative">
        <iframe 
          src={`${resource.fileUrl}#toolbar=0&navpanes=0`} 
          className="w-full h-full border-none"
          title={resource.title}
        ></iframe>
      </div>
    </div>
  );
};

export default StudentLibrary;
