
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { storageService } from '../services/storageService';
import { quizService } from '../services/quizService';
import { Quiz } from '../core/types';

const FileExplorer: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (quizId) loadData(quizId);
  }, [quizId]);

  const loadData = async (id: string) => {
    try {
      const [qz, fls] = await Promise.all([
        quizService.getQuiz(id),
        storageService.getFilesByQuiz(id)
      ]);
      setQuiz(qz);
      setFiles(fls);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quizId) return;
    
    setUploading(true);
    try {
      await storageService.uploadFile(quizId, file);
      await loadData(quizId);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm("Remove this resource permanently?")) return;
    await storageService.deleteFile(path);
    await loadData(quizId!);
  };

  if (loading) return <div className="p-12 text-center">Opening Vault...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="mb-8">
           <Link to="/admin/quizzes" className="text-primary-600 text-sm font-bold flex items-center mb-2">
            <i className="fas fa-arrow-left mr-2"></i> Back to Quizzes
          </Link>
          <h1 className="text-3xl font-bold text-black">Resource Vault: {quiz?.title}</h1>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
           <Card className="lg:col-span-1 p-6 h-fit bg-slate-900 text-white">
              <h3 className="font-bold mb-4">Add Resource</h3>
              <p className="text-xs text-black mb-6">Upload diagrams, reference PDFs, or case study images for this exam.</p>
              
              <label className="block w-full text-center py-4 bg-primary-600 rounded-xl font-bold cursor-pointer hover:bg-primary-700 transition">
                 {uploading ? <i className="fas fa-circle-notch animate-spin"></i> : 'Select File'}
                 <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
           </Card>

           <Card className="lg:col-span-3 p-8">
              <h3 className="text-xl font-bold text-black mb-8">Exam Assets ({files.length})</h3>
              {files.length === 0 ? (
                <div className="text-center py-20 text-black">
                  <i className="fas fa-cloud-upload-alt text-5xl mb-4 opacity-20"></i>
                  <p>No files uploaded for this examination module.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                   {files.map((f, i) => (
                     <div key={i} className="group relative bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition">
                        <div className="h-32 bg-slate-200 flex items-center justify-center overflow-hidden">
                           {f.name.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                             <img src={f.url} className="w-full h-full object-cover" alt="" />
                           ) : (
                             <i className="fas fa-file-pdf text-4xl text-red-400"></i>
                           )}
                        </div>
                        <div className="p-4">
                           <p className="text-xs font-bold text-black truncate mb-1" title={f.name}>{f.name}</p>
                           <div className="flex items-center justify-between">
                              <a href={f.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary-600 font-bold uppercase">View Link</a>
                              <button onClick={() => handleDelete(f.fullPath)} className="text-slate-300 hover:text-red-600 transition">
                                <i className="fas fa-trash-alt text-xs"></i>
                              </button>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              )}
           </Card>
        </div>
      </Container>
    </div>
  );
};

export default FileExplorer;
