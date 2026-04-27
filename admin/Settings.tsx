import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { institutionService, Institution } from '../services/institutionService';
import { useAuth } from '../auth/AuthProvider';
import { adminService } from '../services/adminService';

const Settings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [newInstitutionName, setNewInstitutionName] = useState('');

    const { profile } = useAuth();
    const isSuperAdmin = adminService.getEffectivePermission(profile) === 'super_admin';

    useEffect(() => {
        setLoading(true);
        const unsubscribeInsts = institutionService.subscribeToInstitutions((data) => {
            setInstitutions(data);
            setLoading(false);
        });
        return () => unsubscribeInsts();
    }, []);

    const handleAddInstitution = async () => {
        if (!newInstitutionName.trim()) return;
        setSaving(true);
        try {
            await institutionService.addInstitution(newInstitutionName);
            setNewInstitutionName('');
        } catch (err) {
            console.error("Add institution error:", err);
            alert('Failed to add institution.');
        }
        setSaving(false);
    };

    const handleDeleteInstitution = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        setDeleting(id);
        try {
            await institutionService.deleteInstitution(id);
        } catch (err) {
            console.error("Delete institution error:", err);
            alert('Failed to delete.');
        }
        setDeleting(null);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Container>
                <div className="mb-10">
                    <button 
                        onClick={() => window.history.back()}
                        className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit"
                    >
                        Back to Previous Page
                    </button>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Settings</h1>
                    <p className="text-slate-500 font-medium">Configure core academic and administrative parameters.</p>
                </div>

                {/* Administration Suite - Moved from Navigation as requested */}
                {isSuperAdmin && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        {[
                            { title: 'Student Directory', desc: 'Manage student accounts and records.', link: '/admin/students', color: 'bg-blue-600' },
                            { title: 'Admin Roles', desc: 'Configure permissions and assignments.', link: '/admin/roles', color: 'bg-purple-600' },
                            { title: 'Membership & Pricing', desc: 'Manage subscriptions and paywalls.', link: '/admin/membership', color: 'bg-emerald-600' },
                        ].map((item, i) => (
                            <Link key={i} to={item.link}>
                                <Card className="p-6 border-none shadow-xl shadow-slate-200/50 hover:translate-y-[-4px] transition-all group bg-white">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Administration</p>
                                    <h3 className="text-lg font-black text-slate-900 mb-2">{item.title}</h3>
                                    <p className="text-sm text-slate-500 font-medium">{item.desc}</p>
                                    <div className="mt-4 text-[10px] font-black text-primary-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                        Access Module
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}

                <Card className="p-0 overflow-hidden border-none shadow-xl shadow-slate-200/50 mb-10">
                    <div className="px-8 py-5 bg-slate-900">
                        <h2 className="text-sm font-black text-white uppercase tracking-wide">
                            Institution Management
                        </h2>
                    </div>
                    <div className="p-8">
                        <div className="flex gap-4 mb-8">
                            <input
                                type="text"
                                value={newInstitutionName}
                                onChange={(e) => setNewInstitutionName(e.target.value)}
                                className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition text-sm text-slate-700"
                                placeholder="Enter Institution Name (e.g., Ho Poly)"
                            />
                            <button
                                onClick={handleAddInstitution}
                                disabled={saving || !newInstitutionName.trim()}
                                className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary-700 transition-all disabled:opacity-40"
                            >
                                {saving ? 'Adding...' : 'Add Institution'}
                            </button>
                        </div>

                        {loading ? (
                            <div className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Loading institutions...</div>
                        ) : institutions.length === 0 ? (
                            <div className="py-10 text-center text-slate-300 italic">No institutions configured.</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {institutions.map(inst => (
                                    <div key={inst.id} className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group">
                                        <div className="flex items-center space-x-3">
                                            <p className="font-bold text-slate-900">{inst.name}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteInstitution(inst.id, inst.name)}
                                            disabled={deleting === inst.id}
                                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all font-black text-[10px] uppercase tracking-widest"
                                        >
                                            {deleting === inst.id ? 'Deleting...' : 'Remove'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </Container>
        </div>
    );
};

export default Settings;
