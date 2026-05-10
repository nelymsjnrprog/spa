import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card, Modal } from '../ui/Layout';
import { adminService } from '../services/adminService';
import { institutionService, Institution } from '../services/institutionService';
import { useAuth } from '../auth/AuthProvider';

const StudentEnrollment: React.FC = () => {
    const { profile } = useAuth();
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [institution, setInstitution] = useState('');
    const [level, setLevel] = useState('100');
    const [program, setProgram] = useState('');
    const [membershipStatus, setMembershipStatus] = useState<'active' | 'pending'>('active');

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const isSuperAdmin = adminService.getEffectivePermission(profile) === 'super_admin';

    useEffect(() => {
        const unsubInst = institutionService.subscribeToInstitutions((data) => {
            setInstitutions(data);
            setLoading(false);
        });
        return () => unsubInst();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        
        if (!name || !email || !password || !institution || !level || !program) {
            setError('Please fill in all required fields.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        await processEnrollment();
    };

    const processEnrollment = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await adminService.createStudentAccount(
                email.trim(),
                password,
                name.trim(),
                phoneNumber.trim(),
                institution,
                level,
                program.trim(),
                membershipStatus
            );

            await adminService.logAction(
                profile!.uid,
                profile!.displayName,
                'MANUAL_STUDENT_ENROLLMENT',
                `Manually created student account: ${name} (${email}) for ${institution} Level ${level}. Status: ${membershipStatus}`
            );

            setSuccess(`Student account created successfully for ${email}`);
            resetForm();
        } catch (err: any) {
            setError(err.message || 'Enrollment failed. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setName('');
        setEmail('');
        setPhoneNumber('');
        setPassword('');
        setInstitution('');
        setLevel('100');
        setProgram('');
        setMembershipStatus('active');
    };

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Navbar />
                <div className="text-center p-12">
                    <i className="fas fa-shield-alt text-6xl text-slate-200 mb-4"></i>
                    <h2 className="text-2xl font-black text-slate-900">Super Admin Access Required</h2>
                    <p className="text-slate-500 mt-2">Only Super Administrators can perform manual student enrollment.</p>
                    <Link to="/admin" className="mt-6 inline-block bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Container>
                <div className="mb-8">
                    <Link to="/admin/settings" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
                        <i className="fas fa-arrow-left mr-2"></i> Back to Settings
                    </Link>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Student Enrollment</h1>
                    <p className="text-slate-500 font-medium">Create and enroll students manually, bypassing public payment gates.</p>
                </div>

                <div className="max-w-3xl mx-auto">

                    <Card className="p-8 border-none shadow-2xl shadow-slate-200/60 relative overflow-hidden">
                        {/* Decorative background accent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-bl-[100px] -mr-16 -mt-16 opacity-50"></div>
                        
                        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl animate-in slide-in-from-top-2">
                                    <p className="text-red-700 text-xs font-black uppercase tracking-widest">{error}</p>
                                </div>
                            )}
                            {success && (
                                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-xl animate-in slide-in-from-top-2">
                                    <p className="text-emerald-700 text-xs font-black uppercase tracking-widest">{success}</p>
                                </div>
                            )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Full Name *</label>
                                            <input 
                                                type="text" 
                                                value={name} 
                                                onChange={e => setName(e.target.value)} 
                                                placeholder="e.g. John Doe" 
                                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
                                                required 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address *</label>
                                            <input 
                                                type="email" 
                                                value={email} 
                                                onChange={e => setEmail(e.target.value)} 
                                                placeholder="student@example.com" 
                                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
                                                required 
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                                            <input 
                                                type="tel" 
                                                value={phoneNumber} 
                                                onChange={e => setPhoneNumber(e.target.value)} 
                                                placeholder="e.g. 0244123456" 
                                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Account Password *</label>
                                            <div className="relative">
                                                <input 
                                                    type={showPassword ? "text" : "password"} 
                                                    value={password} 
                                                    onChange={e => setPassword(e.target.value)} 
                                                    placeholder="Min 6 characters" 
                                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all tracking-widest" 
                                                    required 
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                                                >
                                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                            <hr className="border-slate-50" />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Institution *</label>
                                    <select 
                                        value={institution} 
                                        onChange={e => setInstitution(e.target.value)} 
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        required
                                    >
                                        <option value="">Select Institution</option>
                                        {institutions.map(inst => (
                                            <option key={inst.id} value={inst.name}>{inst.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Academic Level *</label>
                                    <select 
                                        value={level} 
                                        onChange={e => setLevel(e.target.value)} 
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        required
                                    >
                                        <option value="100">Level 100</option>
                                        <option value="200">Level 200</option>
                                        <option value="300">Level 300</option>
                                        <option value="Candidate">Candidate</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Academic Program *</label>
                                <select 
                                    value={program} 
                                    onChange={e => setProgram(e.target.value)} 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                    required
                                >
                                    <option value="">Select Program</option>
                                    <option value="RCN">RCN</option>
                                    <option value="RGN">RGN</option>
                                    <option value="RMN">RMN</option>
                                    <option value="RPHN">RPHN</option>
                                </select>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Enrollment Status Override</label>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setMembershipStatus('active')}
                                        className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${membershipStatus === 'active' 
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' 
                                            : 'bg-white text-slate-400 border border-slate-200 hover:border-emerald-200 hover:text-emerald-600'
                                        }`}
                                    >
                                        <i className="fas fa-check-circle mr-2"></i> Mark as Paid
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMembershipStatus('pending')}
                                        className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${membershipStatus === 'pending' 
                                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' 
                                            : 'bg-white text-slate-400 border border-slate-200 hover:border-amber-200 hover:text-amber-500'
                                        }`}
                                    >
                                        <i className="fas fa-clock mr-2"></i> Mark as Unpaid
                                    </button>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={saving} 
                                className="w-full bg-primary-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-100 active:scale-95 disabled:opacity-50"
                            >
                                {saving ? <i className="fas fa-circle-notch animate-spin mr-2"></i> : <i className="fas fa-user-plus mr-2"></i>}
                                {saving ? 'Processing Enrollment...' : 'Create & Enroll Student'}
                            </button>
                        </form>
                    </Card>
                </div>
            </Container>
        </div>
    );
};

export default StudentEnrollment;
