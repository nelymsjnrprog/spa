import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { useAuth } from '../auth/AuthProvider';
import { adminService } from '../services/adminService';
import { membershipService } from '../services/membershipService';
import { MembershipSettings } from '../core/types';

const LEVELS = [
   { key: '100', label: 'Level 100', formKey: 'form1' as keyof MembershipSettings },
   { key: '200', label: 'Level 200', formKey: 'form2' as keyof MembershipSettings },
   { key: '300', label: 'Level 300', formKey: 'form3' as keyof MembershipSettings },
   { key: 'Candidate', label: 'Candidate', formKey: 'candidate' as keyof MembershipSettings },
];

const MembershipPricing: React.FC = () => {
   const { profile } = useAuth();
   const effectivePerm = adminService.getEffectivePermission(profile);
   const isSuperAdmin = effectivePerm === 'super_admin';

   const [settings, setSettings] = useState<MembershipSettings>({
      form1: { paymentRequired: false, price: 0 },
      form2: { paymentRequired: false, price: 0 },
      form3: { paymentRequired: false, price: 0 },
      candidate: { paymentRequired: false, price: 0 },
   });
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [saved, setSaved] = useState(false);

   useEffect(() => {
      const unsub = membershipService.subscribeMembershipSettings((data) => {
         setSettings(data);
         setLoading(false);
      });
      return () => unsub();
   }, []);

   const handleToggle = (formKey: keyof MembershipSettings) => {
      setSettings(prev => ({
         ...prev,
         [formKey]: {
            ...prev[formKey],
            paymentRequired: !prev[formKey].paymentRequired,
            price: !prev[formKey].paymentRequired ? prev[formKey].price || 0 : 0,
         }
      }));
      setSaved(false);
   };

   const handlePriceChange = (formKey: keyof MembershipSettings, value: string) => {
      const price = parseFloat(value) || 0;
      setSettings(prev => ({
         ...prev,
         [formKey]: { ...prev[formKey], price }
      }));
      setSaved(false);
   };

   const handleSaveAll = async () => {
      setSaving(true);
      try {
         await membershipService.updateAllSettings(settings);
         await adminService.logAction(
            profile!.uid,
            profile!.displayName,
            'Updated Membership Pricing',
            `Form1: ${settings.form1.paymentRequired ? settings.form1.price + ' GHS' : 'Free'}, Form2: ${settings.form2.paymentRequired ? settings.form2.price + ' GHS' : 'Free'}, Form3: ${settings.form3.paymentRequired ? settings.form3.price + ' GHS' : 'Free'}, Candidate: ${settings.candidate.paymentRequired ? settings.candidate.price + ' GHS' : 'Free'}`
         );
         setSaved(true);
         setTimeout(() => setSaved(false), 3000);
      } catch (err) {
         console.error("Save error:", err);
         alert("Failed to save membership settings. Check Firestore permissions.");
      }
      setSaving(false);
   };

   if (!isSuperAdmin) {
      return (
         <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Container>
               <div className="flex flex-col items-center justify-center py-32">
                  <i className="fas fa-shield-halved text-6xl text-slate-200 mb-6"></i>
                  <h1 className="text-2xl font-bold text-black mb-2">Access Restricted</h1>
                  <p className="text-black">Only Super Admins can manage membership pricing.</p>
                  <Link to="/admin/settings" className="mt-6 text-primary-600 font-bold hover:underline">
                     <i className="fas fa-arrow-left mr-2"></i>Back to Settings
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
               <Link to="/admin/settings" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
                  <i className="fas fa-arrow-left mr-2"></i> Back to Settings
               </Link>
               <h1 className="text-3xl font-bold text-black tracking-tight">Membership & Pricing Control</h1>
               <p className="text-black font-medium">Configure which levels require payment before signup and set membership prices.</p>
            </div>

            <Card className="p-0 overflow-hidden border-none shadow-xl shadow-slate-200/50 mb-8">
               <div className="px-8 py-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100/50">
                  <div className="flex items-start space-x-3">
                     <i className="fas fa-info-circle text-amber-500 mt-0.5"></i>
                     <div>
                        <p className="text-sm font-bold text-amber-800">How It Works</p>
                        <p className="text-xs text-amber-600 mt-1">
                           When payment is <strong>required</strong> for a level, students must complete a Paystack payment before their account is created.
                           When payment is <strong>not required</strong>, accounts are created immediately upon signup.
                        </p>
                     </div>
                  </div>
               </div>
            </Card>

            {loading ? (
               <Card className="p-20 text-center text-black font-bold uppercase tracking-widest animate-pulse">Loading Settings...</Card>
            ) : (
               <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                     {LEVELS.map(({ key, label, formKey }) => {
                        const levelSettings = settings[formKey] || { paymentRequired: false, price: 0 };
                        return (
                           <Card key={key} className={`p-0 overflow-hidden border-none shadow-xl transition-all duration-300 ${levelSettings.paymentRequired
                              ? 'shadow-primary-200/50 ring-2 ring-primary-200'
                              : 'shadow-slate-200/50'
                              }`}>
                              <div className={`px-6 py-5 border-b transition-colors ${levelSettings.paymentRequired
                                 ? 'bg-primary-50 border-primary-100'
                                 : 'bg-slate-50 border-slate-100'
                                 }`}>
                                 <div className="flex items-center justify-between">
                                    <div>
                                       <h3 className="text-lg font-black text-black">{label}</h3>
                                       <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${levelSettings.paymentRequired
                                          ? 'bg-primary-100 text-primary-700'
                                          : 'bg-slate-100 text-black'
                                          }`}>
                                          {levelSettings.paymentRequired ? 'Paid Signup' : 'Free Signup'}
                                       </span>
                                    </div>
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${levelSettings.paymentRequired
                                       ? 'bg-primary-100 text-primary-600'
                                       : 'bg-slate-100 text-black'
                                       }`}>
                                       <i className={`fas ${levelSettings.paymentRequired ? 'fa-credit-card' : 'fa-door-open'} text-xl`}></i>
                                    </div>
                                 </div>
                              </div>

                              <div className="p-6 space-y-5">
                                 <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-black uppercase tracking-widest">Require Payment</label>
                                    <button
                                       onClick={() => handleToggle(formKey)}
                                       className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${levelSettings.paymentRequired ? 'bg-primary-600' : 'bg-slate-200'
                                          }`}
                                    >
                                       <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${levelSettings.paymentRequired ? 'left-[26px]' : 'left-0.5'
                                          }`}></span>
                                    </button>
                                 </div>

                                 <div className={`transition-all duration-300 ${levelSettings.paymentRequired ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                                    <label className="block text-[10px] font-black text-black uppercase tracking-[0.15em] mb-2">Price (GHS)</label>
                                    <div className="relative">
                                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-bold text-sm">GHS</span>
                                       <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={levelSettings.price || ''}
                                          onChange={(e) => handlePriceChange(formKey, e.target.value)}
                                          disabled={!levelSettings.paymentRequired}
                                          className="w-full pl-14 pr-4 py-3.5 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition text-lg font-bold text-black"
                                          placeholder="0.00"
                                       />
                                    </div>
                                 </div>

                                 {levelSettings.paymentRequired && levelSettings.price > 0 && (
                                    <div className="bg-primary-50 rounded-xl p-4 text-center animate-in fade-in zoom-in-95 duration-300">
                                       <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">Student Sees</p>
                                       <p className="text-xl font-black text-primary-800">
                                          {levelSettings.price} GHS
                                       </p>
                                       <p className="text-[10px] text-primary-500 font-bold mt-1">Membership Fee</p>
                                    </div>
                                 )}
                              </div>
                           </Card>
                        );
                     })}
                  </div>

                  <div className="flex justify-end">
                     <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className={`px-10 py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-lg ${saved
                           ? 'bg-green-600 text-white shadow-green-200'
                           : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-200'
                           } disabled:opacity-50`}
                     >
                        {saving ? (
                           <><i className="fas fa-circle-notch animate-spin mr-2"></i>Saving...</>
                        ) : saved ? (
                           <><i className="fas fa-check mr-2"></i>Saved!</>
                        ) : (
                           <><i className="fas fa-save mr-2"></i>Save All Settings</>
                        )}
                     </button>
                  </div>
               </>
            )}
         </Container>
      </div>
   );
};

export default MembershipPricing;
