
import React, { useEffect, useState } from 'react';
import { Navbar, Container, Card } from '../ui/Layout';
import { supportService, SupportInquiry } from '../services/supportService';

const SupportCenter: React.FC = () => {
  const [inquiries, setInquiries] = useState<SupportInquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = supportService.subscribeToInquiries((data) => {
      setInquiries(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleResolve = async (id: string) => {
    if (!confirm("Are you sure you want to mark this as resolved? It will be permanently removed.")) return;
    try {
      await supportService.deleteInquiry(id);
    } catch (error) {
      alert("Failed to delete inquiry.");
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Just now';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="mb-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Support</h1>
          <p className="text-slate-500 font-medium mt-1">Manage and respond to student inquiries.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Inquiries...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-check-circle text-3xl"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">All Clear!</h3>
            <p className="text-slate-500">There are no pending inquiries at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {inquiries.map((inquiry) => (
              <Card key={inquiry.id} className="p-0 border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem] overflow-hidden">
                <div className="p-8 sm:p-10">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 mb-1">{inquiry.subject}</h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 bg-primary-50 px-2.5 py-1 rounded-lg">
                          {inquiry.name}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
                          {inquiry.email}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Received</p>
                      <p className="text-xs font-bold text-slate-900">{formatTimestamp(inquiry.createdAt)}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 mb-8">
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{inquiry.message}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <a 
                      href={`mailto:${inquiry.email}?subject=RE: ${inquiry.subject}&body=Hi ${inquiry.name},%0D%0A%0D%0A`}
                      className="flex-1 sm:flex-none bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary-600 transition-all text-center shadow-lg shadow-slate-200"
                    >
                      <i className="fas fa-reply mr-2"></i>
                      Respond
                    </a>
                    <button 
                      onClick={() => handleResolve(inquiry.id)}
                      className="flex-1 sm:flex-none bg-white text-emerald-600 border border-emerald-100 px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all text-center"
                    >
                      <i className="fas fa-check mr-2"></i>
                      Resolved
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
};

export default SupportCenter;
