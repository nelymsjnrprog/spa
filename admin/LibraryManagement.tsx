
import React, { useEffect, useState } from 'react';
import { Navbar, Container, Card, Modal } from '../ui/Layout';
import { libraryService } from '../services/libraryService';
import { LibraryResource } from '../core/types';
import { useAuth } from '../auth/AuthProvider';

const LibraryManagement: React.FC = () => {
  const { profile } = useAuth();
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | '100' | '200' | '300' | 'candidate'>('all');
  const [deleteModalData, setDeleteModalData] = useState<LibraryResource | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: '100',
    published: true
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  useEffect(() => {
    const filters = activeTab === 'all' ? {} : { level: activeTab };
    const unsub = libraryService.subscribeToLibrary(setResources, filters);
    setLoading(false);
    return () => unsub();
  }, [activeTab]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return alert("Please select a PDF file.");
    if (!profile) return;

    setUploading(true);
    setUploadProgress(10); // Mock progress for start

    try {
      await libraryService.uploadResource(
        {
          title: formData.title,
          description: formData.description,
          level: formData.level,
          published: formData.published,
          fileName: pdfFile.name,
          uploadedBy: profile.uid,
          uploadedByName: profile.displayName || 'Admin'
        },
        pdfFile,
        thumbnailFile || undefined
      );

      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setShowUploadModal(false);
        resetForm();
      }, 500);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload resource.");
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', level: '100', published: true });
    setPdfFile(null);
    setThumbnailFile(null);
    setUploadProgress(0);
  };

  const executeDelete = async () => {
    if (!deleteModalData) return;
    setDeleting(true);
    try {
      await libraryService.deleteResource(deleteModalData.id, deleteModalData.fileUrl, deleteModalData.thumbnailUrl);
      if (profile) {
        await adminService.logAction(
          profile.uid,
          profile.displayName || 'Admin',
          'DELETE_RESOURCE',
          `Permanently deleted library resource: "${deleteModalData.title}"`
        );
      }
      setDeleteModalData(null);
    } catch (error) {
      alert("Failed to delete resource.");
    } finally {
      setDeleting(false);
    }
  };

  const togglePublish = async (resource: LibraryResource) => {
    try {
      await libraryService.togglePublish(resource.id, !resource.published);
    } catch (error) {
      alert("Failed to update status.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Library Management</h1>
            <p className="text-slate-500 font-medium mt-1">Upload and manage study materials for students.</p>
          </div>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="bg-primary-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 active:scale-95 flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            Upload Resource
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {['all', '100', '200', '300', 'candidate'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-5 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                  : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab === 'all' ? 'All Resources' : `Level ${tab}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Library...</p>
          </div>
        ) : resources.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-book text-3xl"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No resources found</h3>
            <p className="text-slate-500">Start by uploading your first PDF handout or book.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map((resource) => (
              <Card key={resource.id} className="group relative overflow-hidden flex flex-col h-full bg-white border-none shadow-xl shadow-slate-200/50 rounded-[2rem]">
                {/* Thumbnail Area */}
                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                  {resource.thumbnailUrl ? (
                    <img src={resource.thumbnailUrl} alt={resource.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                      <i className="fas fa-file-pdf text-5xl mb-2"></i>
                      <span className="text-[10px] font-black uppercase tracking-widest">PDF Document</span>
                    </div>
                  )}
                  
                  {/* Status Badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm">
                      Level {resource.level}
                    </span>
                    {resource.published ? (
                      <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">Published</span>
                    ) : (
                      <span className="bg-slate-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">Draft</span>
                    )}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-lg font-black text-slate-900 mb-2 line-clamp-1">{resource.title}</h3>
                  <p className="text-slate-500 text-sm font-medium line-clamp-2 mb-6 flex-1">{resource.description || 'No description provided.'}</p>
                  
                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => togglePublish(resource)}
                        title={resource.published ? "Unpublish" : "Publish"}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          resource.published ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                        }`}
                      >
                        <i className={`fas ${resource.published ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                      <button 
                        onClick={() => setDeleteModalData(resource)}
                        title="Delete"
                        className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                    <a 
                      href={resource.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1.5"
                    >
                      View File
                      <i className="fas fa-external-link-alt"></i>
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Upload Modal Overlay */}
        {showUploadModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !uploading && setShowUploadModal(false)}></div>
            <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 md:p-10">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Upload Resource</h2>
                  <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                    <i className="fas fa-times text-xl"></i>
                  </button>
                </div>

                <form onSubmit={handleUpload} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 mb-2 block">Resource Title</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Anatomy & Physiology Handout"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-semibold"
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 mb-2 block">Description (Optional)</label>
                      <textarea 
                        rows={2}
                        placeholder="What's this handout about?"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-semibold resize-none"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 mb-2 block">Target Level</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-semibold"
                          value={formData.level}
                          onChange={e => setFormData({...formData, level: e.target.value})}
                        >
                          <option value="100">Level 100</option>
                          <option value="200">Level 200</option>
                          <option value="300">Level 300</option>
                          <option value="candidate">Candidate</option>
                        </select>
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 cursor-pointer hover:bg-slate-100 transition-all">
                          <input 
                            type="checkbox" 
                            checked={formData.published}
                            onChange={e => setFormData({...formData, published: e.target.checked})}
                            className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm font-bold text-slate-700">Published</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 mb-2 block">PDF File</label>
                        <input 
                          type="file" 
                          accept=".pdf"
                          required
                          onChange={e => setPdfFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="pdf-upload"
                        />
                        <label htmlFor="pdf-upload" className={`w-full bg-slate-50 border border-dashed rounded-2xl py-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all ${pdfFile ? 'border-primary-300 bg-primary-50' : 'border-slate-200'}`}>
                          <i className={`fas ${pdfFile ? 'fa-file-circle-check text-primary-500' : 'fa-file-pdf text-slate-300'} text-2xl mb-2`}></i>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center px-2 truncate w-full">
                            {pdfFile ? pdfFile.name : 'Select PDF'}
                          </span>
                        </label>
                      </div>
                      <div className="relative">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 mb-2 block">Cover (Optional)</label>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => setThumbnailFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="thumb-upload"
                        />
                        <label htmlFor="thumb-upload" className={`w-full bg-slate-50 border border-dashed rounded-2xl py-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all ${thumbnailFile ? 'border-primary-300 bg-primary-50' : 'border-slate-200'}`}>
                          <i className={`fas ${thumbnailFile ? 'fa-image text-primary-500' : 'fa-camera text-slate-300'} text-2xl mb-2`}></i>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center px-2 truncate w-full">
                            {thumbnailFile ? thumbnailFile.name : 'Select Image'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {uploading ? (
                    <div className="space-y-4 pt-4">
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-600 transition-all duration-500" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                      <p className="text-center text-[10px] font-black uppercase tracking-widest text-primary-600 animate-pulse">Uploading Material...</p>
                    </div>
                  ) : (
                    <button 
                      type="submit"
                      className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary-600 transition-all shadow-xl active:scale-95"
                    >
                      Complete Upload
                    </button>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}
      </Container>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteModalData}
        onClose={() => !deleting && setDeleteModalData(null)}
        title="Remove Resource"
        variant="danger"
        footer={
          <>
            <button
              onClick={() => setDeleteModalData(null)}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={executeDelete}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black hover:bg-red-700 transition active:scale-95 shadow-xl shadow-red-200 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </>
        }
      >
        <div className="text-center">
          <p className="mb-4 text-slate-600">
            Are you sure you want to permanently remove <span className="font-bold text-slate-900">"{deleteModalData?.title}"</span>?
          </p>
          <p className="text-xs text-red-600 font-bold bg-red-50 p-3 rounded-xl">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            This will delete the file from cloud storage and remove it from the student library. This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default LibraryManagement;
