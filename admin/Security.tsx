import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { userService } from '../services/userService';
import { authService } from '../auth/authService';
import { UserProfile } from '../core/types';

const Security: React.FC = () => {
    const [students, setStudents] = useState<UserProfile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionState, setActionState] = useState<{ uid: string; status: 'loading' | 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const data = await userService.getAllUsers();
            setStudents(data.filter(u => u.role === 'student'));
        } catch (err) {
            console.error("Failed to fetch students", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;

        const query = searchQuery.toLowerCase();
        return students.filter(student =>
            (student.displayName?.toLowerCase() || '').includes(query) ||
            (student.email?.toLowerCase() || '').includes(query)
        );
    }, [students, searchQuery]);

    const handlePasswordReset = async (email: string, uid: string) => {
        if (!email) {
            alert("This user does not have an email address.");
            return;
        }

        if (!confirm(`Are you sure you want to send a password reset email to ${email}?`)) {
            return;
        }

        setActionState({ uid, status: 'loading' });

        try {
            await authService.sendPasswordReset(email);
            setActionState({ uid, status: 'success' });

            // Clear success message after 3 seconds
            setTimeout(() => {
                setActionState(prev => prev?.uid === uid ? null : prev);
            }, 3000);
        } catch (err: any) {
            console.error("Reset password error:", err);
            alert(`Failed to send reset email: ${err.message}`);
            setActionState({ uid, status: 'error' });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Container>
                <div className="mb-8">
                    <Link to="/admin" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
                        <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Security & Access Control</h1>
                    <p className="text-slate-500 font-medium">Manage student authentication credentials and security tools.</p>
                </div>

                <Card className="p-6 mb-8 border-none shadow-xl shadow-slate-200/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-lg">
                            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input
                                type="text"
                                placeholder="Search students by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none font-medium text-slate-700"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    aria-label="Clear search"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <i className="fas fa-times border border-slate-300 rounded-full w-5 h-5 flex items-center justify-center text-[10px]"></i>
                                </button>
                            )}
                        </div>
                        <div className="text-sm font-bold text-slate-500">
                            Showing {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </Card>

                {loading ? (
                    <Card className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse border-none shadow-xl shadow-slate-200/50">
                        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        Loading Directory...
                    </Card>
                ) : filteredStudents.length === 0 ? (
                    <Card className="p-20 text-center border-none shadow-xl shadow-slate-200/50">
                        <i className="fas fa-user-slash text-4xl text-slate-300 mb-4"></i>
                        <p className="text-lg font-bold text-slate-900">No students found</p>
                        <p className="text-slate-500 font-medium mt-1">
                            {searchQuery ? 'Try adjusting your search terms.' : 'There are no students registered yet.'}
                        </p>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {filteredStudents
                            .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""))
                            .map(u => (
                                <Card key={u.uid} className="overflow-hidden border-none shadow-xl shadow-slate-200/50 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
                                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center">
                                            <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-black text-lg mr-4 shadow-sm border border-primary-100">
                                                {(u.displayName || "U").charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <p className="font-bold text-slate-900 leading-tight text-lg">{u.displayName || "Unnamed User"}</p>
                                                </div>
                                                <div className="flex items-center text-xs font-medium text-slate-500 mt-1">
                                                    <i className="fas fa-envelope mr-1.5 opacity-70"></i>
                                                    <span>{u.email}</span>
                                                    {u.institution && (
                                                        <>
                                                            <span className="mx-2 opacity-50">•</span>
                                                            <i className="fas fa-university mr-1.5 opacity-70"></i>
                                                            <span>{u.institution}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end border-t border-slate-50 md:border-none pt-4 md:pt-0 mt-2 md:mt-0">
                                            {actionState?.uid === u.uid && actionState.status === 'success' ? (
                                                <div className="flex items-center space-x-2 bg-green-50 text-green-700 px-4 py-2.5 rounded-xl border border-green-100 font-bold text-sm animate-in zoom-in w-full md:w-auto justify-center">
                                                    <i className="fas fa-check-circle"></i>
                                                    <span>Reset Email Sent</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handlePasswordReset(u.email, u.uid)}
                                                    disabled={actionState?.uid === u.uid && actionState.status === 'loading'}
                                                    className="flex items-center justify-center space-x-2 bg-white text-slate-700 hover:text-primary-600 hover:bg-primary-50 border border-slate-200 hover:border-primary-200 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:ring-4 focus:ring-primary-50 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed group"
                                                >
                                                    {actionState?.uid === u.uid && actionState.status === 'loading' ? (
                                                        <i className="fas fa-spinner fa-spin text-primary-500"></i>
                                                    ) : (
                                                        <>
                                                            <i className="fas fa-key text-slate-400 group-hover:text-primary-500 transition-colors"></i>
                                                            <span>Send Password Reset</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
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

export default Security;
