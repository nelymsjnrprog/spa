import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { useAuth } from '../auth/AuthProvider';
import { adminService } from '../services/adminService';
import { membershipService } from '../services/membershipService';
import { PaymentRecord } from '../core/types';

const RenewalRegistry: React.FC = () => {
   const { profile } = useAuth();
   const effectivePerm = adminService.getEffectivePermission(profile);
   const isSuperAdmin = effectivePerm === 'super_admin';

   const [payments, setPayments] = useState<PaymentRecord[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      fetchRenewals();
   }, []);

   const fetchRenewals = async () => {
      setLoading(true);
      try {
         const data = await membershipService.getRecentPayments(200);
         // Filter for renewals only
         const renewals = data.filter(p => p.isRenewal === true);
         setPayments(renewals);
      } catch (err) {
         console.error("Failed to fetch renewals:", err);
      }
      setLoading(false);
   };

   if (!isSuperAdmin) {
      return (
         <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Container>
               <div className="flex flex-col items-center justify-center py-32">
                  <i className="fas fa-shield-halved text-6xl text-slate-200 mb-6"></i>
                  <h1 className="text-2xl font-bold text-black mb-2">Access Restricted</h1>
                  <p className="text-black">Only Super Admins can access the renewal registry.</p>
                  <Link to="/admin" className="mt-6 text-primary-600 font-bold hover:underline">
                     <i className="fas fa-arrow-left mr-2"></i>Back to Dashboard
                  </Link>
               </div>
            </Container>
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-slate-50">
         <Navbar />
         <Container>
            <div className="mb-10">
               <Link to="/admin" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
                  <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
               </Link>
               <h1 className="text-3xl font-bold text-black tracking-tight">Renewal Registry</h1>
               <p className="text-black font-medium">Log of level promotion renewals and term payments.</p>
            </div>

            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center space-x-4">
                  <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100">
                     <p className="text-[10px] font-black text-black uppercase tracking-widest">Renewal Revenue</p>
                     <p className="text-lg font-black text-black">
                        {payments.reduce((acc, p) => acc + (p.status === 'success' ? p.amount : 0), 0).toLocaleString()} <span className="text-xs text-black">GHS</span>
                     </p>
                  </div>
                  <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100">
                     <p className="text-[10px] font-black text-black uppercase tracking-widest">Successful Renewals</p>
                     <p className="text-lg font-black text-black">
                        {payments.filter(p => p.status === 'success').length}
                     </p>
                  </div>
               </div>
               <button
                  onClick={fetchRenewals}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary-100 transition-colors"
               >
                  <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
                  <span>Refresh</span>
               </button>
            </div>

            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-slate-900 text-white">
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Date & Time</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Student / Email</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">New Level</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Amount</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Reference</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {loading && payments.length === 0 ? (
                           <tr>
                              <td colSpan={6} className="px-6 py-20 text-center text-black font-medium animate-pulse">
                                 <i className="fas fa-circle-notch animate-spin text-2xl mb-4 block"></i>
                                 Synchronizing renewal records...
                              </td>
                           </tr>
                        ) : payments.length === 0 ? (
                           <tr>
                              <td colSpan={6} className="px-6 py-20 text-center text-slate-300 italic text-sm">
                                 No renewal records found.
                              </td>
                           </tr>
                        ) : (
                           payments.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                 <td className="px-6 py-5 whitespace-nowrap">
                                    <p className="text-xs font-bold text-black">
                                       {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    <p className="text-[10px] text-black font-medium">
                                       {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                 </td>
                                 <td className="px-6 py-5 whitespace-nowrap">
                                    <p className="text-xs font-bold text-black group-hover:text-primary-600 transition-colors">{p.email}</p>
                                    <p className="text-[9px] text-black font-mono tracking-tighter uppercase">{p.id?.substring(0, 12)}...</p>
                                 </td>
                                 <td className="px-6 py-5 whitespace-nowrap text-center">
                                     <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg uppercase tracking-tighter ring-1 ring-emerald-100">
                                        {p.formLevel === 'Candidate' ? p.formLevel : `Level ${p.formLevel}`}
                                     </span>
                                 </td>
                                 <td className="px-6 py-5 whitespace-nowrap text-right">
                                    <div className="inline-block text-right">
                                       <p className="text-sm font-black text-black leading-none">
                                          {p.amount} <span className="text-[10px] text-black ml-0.5">GHS</span>
                                       </p>
                                    </div>
                                 </td>
                                 <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="flex items-center space-x-2">
                                       <span className="font-mono text-[10px] text-black uppercase bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                          {p.reference}
                                       </span>
                                    </div>
                                 </td>
                                 <td className="px-6 py-5 whitespace-nowrap text-center">
                                    <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-full uppercase tracking-widest ${
                                       p.status === 'success' 
                                          ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100' 
                                          : 'bg-slate-100 text-black ring-1 ring-slate-200'
                                    }`}>
                                       {p.status}
                                    </span>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </Card>
         </Container>
      </div>
   );
};

export default RenewalRegistry;
