
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
    if (!profile?.level) return;
    
    // Students only see published resources for their level
    const unsub = libraryService.subscribeToLibrary(
      (data) => {
        setResources(data);
        setLoading(false);
      },
      { level: profile.level, onlyPublished: true }
    );
    
    return () => unsub();
  }, [profile?.level]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="mb-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Digital Library</h1>
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
            <h3 className="text-xl font-bold text-slate-900 mb-2">Shelf is Empty</h3>
            <p className="text-slate-500 max-w-sm mx-auto">No study materials have been uploaded for Level {profile?.level} yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {resources.map((resource) => (
              <Card key={resource.id} className="group flex flex-col h-full bg-white border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-primary-600/10 transition-all duration-500">
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
                      <i className="fas fa-file-pdf text-6xl mb-4 group-hover:scale-110 transition-transform duration-500"></i>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white px-4 py-2 rounded-full shadow-sm">PDF HANDOUT</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>

                {/* Info */}
                <div className="p-8 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                      Level {resource.level}
                    </span>
                    {resource.fileSize && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {(resource.fileSize / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-black text-slate-900 mb-3 leading-tight group-hover:text-primary-600 transition-colors">{resource.title}</h3>
                  <p className="text-slate-500 text-sm font-medium line-clamp-3 mb-8 flex-1">
                    {resource.description || 'Explore this study material to enhance your preparation and master your subjects.'}
                  </p>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setSelectedResource(resource)}
                      className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary-600 transition-all shadow-lg shadow-slate-200 active:scale-95"
                    >
                      <i className="fas fa-book-reader mr-2"></i>
                      Open Book
                    </button>
                    <a 
                      href={resource.fileUrl} 
                      download={resource.fileName}
                      className="w-14 bg-slate-50 text-slate-400 border border-slate-100 rounded-2xl flex items-center justify-center hover:bg-primary-50 hover:text-primary-600 hover:border-primary-100 transition-all active:scale-95"
                      title="Download PDF"
                    >
                      <i className="fas fa-download"></i>
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* PDF Reader Modal */}
        {selectedResource && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900 animate-in fade-in duration-300">
            {/* Header */}
            <div className="h-20 bg-slate-900 border-b border-white/10 flex items-center justify-between px-6 md:px-10">
              <div className="flex items-center gap-4 min-w-0">
                <button 
                  onClick={() => setSelectedResource(null)}
                  className="w-10 h-10 rounded-full bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
                <div className="min-w-0">
                  <h2 className="text-white font-black text-sm uppercase tracking-widest truncate">{selectedResource.title}</h2>
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Digital Reader</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a 
                  href={selectedResource.fileUrl} 
                  download={selectedResource.fileName}
                  className="hidden md:flex items-center gap-2 bg-white/5 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  <i className="fas fa-download"></i>
                  Download
                </a>
                <button 
                  onClick={() => setSelectedResource(null)}
                  className="bg-red-500/10 text-red-500 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/10"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 bg-slate-800 relative">
              <iframe 
                src={`${selectedResource.fileUrl}#toolbar=0`} 
                className="w-full h-full border-none"
                title={selectedResource.title}
              ></iframe>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
};

export default StudentLibrary;
