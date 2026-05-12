
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


        <div className="max-w-2xl mx-auto pt-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Loading Inquiries...</p>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-[2rem] p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-check-circle text-3xl"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">All Clear!</h3>
              <p className="text-slate-600">There are no pending inquiries at the moment.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-10 pb-20">
              {inquiries.map((inquiry) => (
                <div key={inquiry.id} className="group">
                  {/* Timestamp divider */}
                  <div className="flex justify-center mb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100/80 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-200/50">
                      {formatTimestamp(inquiry.createdAt)}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div className="flex flex-col items-start max-w-[90%] sm:max-w-[80%]">
                    <div className="flex items-center gap-2 mb-1.5 ml-4">
                      <span className="text-[11px] font-black text-emerald-600 uppercase tracking-tight">{inquiry.name}</span>
                      <span className="text-[10px] font-medium text-slate-400">({inquiry.email})</span>
                    </div>
                    
                    <div className="bg-white border border-slate-100 shadow-sm rounded-[1.5rem] rounded-bl-none p-6 relative">
                      {/* Bubble Tail */}
                      <div className="absolute bottom-0 -left-2 w-4 h-4 bg-white border-l border-b border-slate-100 transform -skew-x-[45deg] origin-bottom-right"></div>
                      
                      <div className="relative z-10">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 opacity-60">Subject: {inquiry.subject}</span>
                        <p className="text-slate-900 text-sm leading-relaxed font-medium">
                          {inquiry.message}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href={`mailto:${inquiry.email}?subject=RE: ${inquiry.subject}&body=Hi ${inquiry.name},%0D%0A%0D%0A`}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center shadow-md shadow-emerald-100"
                      >
                        <i className="fas fa-reply mr-1.5"></i>
                        Respond
                      </a>
                      <button 
                        onClick={() => handleResolve(inquiry.id)}
                        className="bg-white text-slate-400 border border-slate-200 px-4 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all flex items-center"
                      >
                        <i className="fas fa-check mr-1.5"></i>
                        Resolved
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
};

export default SupportCenter;
