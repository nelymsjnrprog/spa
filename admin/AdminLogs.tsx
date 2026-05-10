import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { adminService } from '../services/adminService';
import { AdminLog } from '../core/types';
import { useAuth } from '../auth/AuthProvider';

const AdminLogs: React.FC = () => {
    const { profile, user } = useAuth();
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [loading, setLoading] = useState(true);
    const isSuperAdmin = adminService.getEffectivePermission(profile) === 'super_admin';

    useEffect(() => {
        const unsubscribe = adminService.subscribeToAdminLogs((data) => {
            setLogs(data);
            setLoading(false);
        }, 100);

        return () => unsubscribe();
    }, []);

    const getTimeSince = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Container>
                <div className="mb-8">
                    <Link to="/admin" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
                        <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-black text-black tracking-tight uppercase">System Action Log</h1>
                    <p className="text-black font-medium">Real-time audit trail of administrative operations.</p>
                </div>

                <Card className="border-none shadow-22xl shadow-slate-200/50 overflow-hidden bg-white">
                    <div className="p-4 bg-slate-900 flex items-center justify-between">
                        <h2 className="text-[10px] sm:text-xs font-black text-white uppercase tracking-widest flex items-center">
                            <i className="fas fa-history mr-2 text-primary-400"></i> Audit Feed
                        </h2>
                        <span className="text-[10px] font-black text-black uppercase">
                            Last 100 Operations
                        </span>
                    </div>

                    <div className="divide-y divide-slate-50 min-h-[400px]">
                        {loading ? (
                            <div className="p-20 text-center">
                                <i className="fas fa-spinner fa-spin text-4xl text-slate-200 mb-4"></i>
                                <p className="text-xs font-black text-black uppercase tracking-widest animate-pulse">Synchronizing Logs...</p>
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="p-20 text-center text-slate-300">
                                <i className="fas fa-clipboard-check text-5xl mb-4 opacity-10"></i>
                                <p className="font-bold uppercase tracking-widest text-xs">No actions recorded yet</p>
                            </div>
                        ) : (
                            logs.filter(log => {
                                // Stealth: Non-super admins can only see Level Admin logs (not Super Admin logs)
                                if (isSuperAdmin) return true;
                                // This is a bit complex as we don't have the actor's role in the log doc,
                                // but we can hide logs where the adminName contains "Super" or match against known super admin IDs.
                                // For now, let's keep it simple: if the user wants transparency for "all admins", 
                                // we'll show everything unless security dictates otherwise.
                                // The user's request "for all the admins including the super admining" suggests transparency.
                                return true;
                            }).map((log) => (
                                <div key={log.id} className="p-5 hover:bg-slate-50 transition-colors group">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shadow-lg">
                                                {log.action.split('_')[0].charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-black uppercase tracking-tight">{log.action.replace(/_/g, ' ')}</p>
                                                <p className="text-[10px] font-bold text-primary-600">{log.adminName}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-300 group-hover:text-black transition-colors uppercase">
                                            {getTimeSince(log.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-black font-medium pl-11">
                                        {log.details}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </Container>
        </div>
    );
};

export default AdminLogs;
