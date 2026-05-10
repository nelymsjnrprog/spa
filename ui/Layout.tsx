
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { adminService } from '../services/adminService';
import { institutionService, Institution } from '../services/institutionService';

import { APP_CONFIG } from '../core/config';
import { supportService, SupportInquiry } from '../services/supportService';

export const Navbar: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [institutions, setInstitutions] = React.useState<Institution[]>([]);
  const [inquiryCount, setInquiryCount] = React.useState(0);


  React.useEffect(() => {
    if (profile?.role === 'admin') {
      const unsubInst = institutionService.subscribeToInstitutions(setInstitutions);
      const unsubSupport = supportService.subscribeToInquiries((data) => setInquiryCount(data.length));
      return () => {
        unsubInst();
        unsubSupport();
      };
    }
  }, [profile]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const effectivePerm = adminService.getEffectivePermission(profile);
  const isSuperAdmin = effectivePerm === 'super_admin';

  const filteredInstitutions = React.useMemo(() => {
    if (isSuperAdmin) return institutions;
    const assigned = profile?.assignedInstitutions || [];
    return institutions.filter(inst => 
      assigned.some(a => a.trim().toLowerCase() === inst.name.trim().toLowerCase())
    );
  }, [institutions, isSuperAdmin, profile]);

  return (
    <>
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 safe-pt">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">
          <div className="flex items-center space-x-2 min-w-0">
            {(profile?.role === 'admin' || profile?.role === 'student') && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-600 hover:text-primary-600 transition-colors"
                title="Open Navigation"
              >
                <i className="fas fa-bars-staggered text-xl"></i>
              </button>
            )}
            <Link to="/dispatch" className="flex items-center min-w-0">

              <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">{APP_CONFIG.name}</span>
            </Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 shrink-0 min-w-0">

            <button
              onClick={handleLogout}
              className="p-2.5 text-slate-600 hover:text-red-600 transition-colors active:scale-95"
              title="Logout"
            >
              <i className="fas fa-sign-out-alt text-lg sm:text-xl"></i>
            </button>
          </div>
        </div>
      </div>
    </nav>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-white z-[70] shadow-2xl transition-transform duration-300 ease-out flex flex-col safe-pt ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">{APP_CONFIG.name}</span>
            <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
              isSuperAdmin ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-slate-500 border-slate-200'
            }`}>
              {effectivePerm === 'super_admin' ? 'Super' : effectivePerm === 'institution_admin' ? 'Institution' : 'View'}
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors" title="Close sidebar">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {profile?.role === 'admin' && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Primary Systems</div>
              <SidebarLink to="/admin" icon="fa-th-large" label="Dashboard" onClick={() => setSidebarOpen(false)} />
              {isSuperAdmin || (profile?.assignedInstitutions && profile.assignedInstitutions.length >= 2) ? (
                <SidebarLink to="/admin/quizzes" icon="fa-layer-group" label="Module Management" onClick={() => setSidebarOpen(false)} />
              ) : null}

              
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mt-8 mb-2">Institution Management</div>
              {filteredInstitutions.map(inst => (
                <SidebarLink
                  key={inst.id}
                  to={`/admin/institution/${encodeURIComponent(inst.name)}`}
                  icon="fa-university"
                  label={inst.name}
                  onClick={() => setSidebarOpen(false)}
                />
              ))}
              {filteredInstitutions.length === 0 && (
                <p className="px-4 text-[10px] text-slate-400 italic">No institutions configured.</p>
              )}

              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mt-8 mb-2">Resources</div>
              <SidebarLink to="/admin/library" icon="fa-book" label="Library Management" onClick={() => setSidebarOpen(false)} />

              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mt-8 mb-2">Directives</div>

              <SidebarLink to="/admin/security" icon="fa-shield-halved" label="Security Ops" onClick={() => setSidebarOpen(false)} />
              <SidebarLink to="/admin/settings" icon="fa-sliders" label="System Settings" onClick={() => setSidebarOpen(false)} />

              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mt-8 mb-2">Customer Service</div>
              <Link 
                to="/admin/support" 
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-between px-4 py-4 sm:py-3 rounded-2xl sm:rounded-xl text-slate-600 font-semibold hover:bg-slate-50 hover:text-primary-600 transition-all group active:bg-primary-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 sm:w-8 flex justify-center text-xl sm:text-lg text-slate-400 group-hover:text-primary-500 transition-colors">
                    <i className="fas fa-headset"></i>
                  </div>
                  <span className="text-base sm:text-sm">Support</span>
                </div>
                {inquiryCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-lg shadow-red-200">
                    {inquiryCount}
                  </span>
                )}
              </Link>
              {isSuperAdmin && (
                <>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mt-8 mb-2">Financials</div>
                  <SidebarLink to="/admin/payments" icon="fa-credit-card" label="Payment Registry" onClick={() => setSidebarOpen(false)} />
                </>
              )}
            </>
          )}

          {profile?.role === 'student' && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Student Services</div>
              <SidebarLink to="/student" icon="fa-th-large" label="Dashboard" onClick={() => setSidebarOpen(false)} />
              <SidebarLink to="/student/library" icon="fa-book-open" label="Library" onClick={() => setSidebarOpen(false)} />
              <SidebarLink to="#" icon="fa-comments" label="Chat" onClick={() => setSidebarOpen(false)} />
              <SidebarLink to="/student/profile" icon="fa-user-cog" label="Settings" onClick={() => setSidebarOpen(false)} />
            </>
          )}
          

        </nav>

        <div className="p-4 border-t border-slate-50 bg-slate-50/50">
        </div>
      </aside>

    </>
  );
};

const SidebarLink: React.FC<{ to: string, icon: string, label: string, onClick: () => void }> = ({ to, icon, label, onClick }) => (
  <Link 
    to={to} 
    onClick={onClick}
    className="flex items-center space-x-3 px-4 py-4 sm:py-3 rounded-2xl sm:rounded-xl text-slate-600 font-semibold hover:bg-slate-50 hover:text-primary-600 transition-all group active:bg-primary-50"
  >
    <div className="w-10 sm:w-8 flex justify-center text-xl sm:text-lg text-slate-400 group-hover:text-primary-500 transition-colors">
      <i className={`fas ${icon}`}></i>
    </div>
    <span className="text-base sm:text-sm">{label}</span>
  </Link>
);

export const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 safe-pb-container">
    {children}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string; id?: string; variant?: 'default' | 'glass' } & React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', variant = 'default', ...rest }) => (
  <div className={`${variant === 'glass' ? 'glass-card' : 'bg-white'} rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`} {...rest}>
    {children}
  </div>
);

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'danger' | 'info' | 'success';
}> = ({ isOpen, onClose, title, children, footer, variant = 'info' }) => {
  if (!isOpen) return null;

  const icons = {
    danger: 'fa-exclamation-triangle text-red-600 bg-red-50',
    info: 'fa-info-circle text-primary-600 bg-primary-50',
    success: 'fa-check-circle text-emerald-600 bg-emerald-50'
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <Card className="relative w-full max-w-md p-8 border-none shadow-2xl bg-white rounded-[2rem] animate-in zoom-in-95 duration-200">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-6 mx-auto shadow-inner ${icons[variant]}`}>
          <i className={`fas ${icons[variant].split(' ')[0]}`}></i>
        </div>
        <h3 className="text-xl font-black text-black text-center mb-2 uppercase tracking-tight">{title}</h3>
        <div className="text-black text-center text-sm mb-8 leading-relaxed">
          {children}
        </div>
        {footer && <div className="flex gap-3">{footer}</div>}
      </Card>
    </div>
  );
};
