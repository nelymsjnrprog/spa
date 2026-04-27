import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { userService } from '../services/userService';
import { adminService } from '../services/adminService';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../core/firebase';
import { UserProfile, PaymentRecord } from '../core/types';
import { useAuth } from '../auth/AuthProvider';

type FilterTab = 'all' | 'paid' | 'unpaid';

const StudentDirectory: React.FC = () => {
  const { profile, user } = useAuth();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: 'delete' | 'block' | 'unblock' | 'promote' | 'mark_paid' | 'mark_unpaid'; student: UserProfile } | null>(null);

  const isSuperAdmin = adminService.getEffectivePermission(profile) === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) return;

    // Subscribe to real-time student list
    const unsubscribe = userService.subscribeToUsers((data) => {
      setStudents(data.filter(u => u.role === 'student'));
      setLoading(false);
    });

    // Load payment records once
    const fetchPayments = async () => {
      try {
        const q = query(collection(db, 'payments'), where('status', '==', 'success'), limit(1000));
        const snap = await getDocs(q);
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRecord)));
      } catch { /* non-critical */ }
    };
    fetchPayments();

    return () => unsubscribe();
  }, [isSuperAdmin]);

  const paidUserIds = useMemo(() => {
    const ids = new Set<string>();
    payments.forEach(p => { if (p.userId) ids.add(p.userId); });
    return ids;
  }, [payments]);

  const paidUserEmails = useMemo(() => {
    const emails = new Set<string>();
    payments.forEach(p => { if (p.email) emails.add(p.email.toLowerCase()); });
    return emails;
  }, [payments]);

  const isPaid = (student: UserProfile): { paid: boolean; method: 'manual' | 'uid' | 'email' | 'none' } => {
    if (student.membershipStatus === 'active') return { paid: true, method: 'manual' };
    if (paidUserIds.has(student.uid)) return { paid: true, method: 'uid' };
    if (student.email && paidUserEmails.has(student.email.toLowerCase())) return { paid: true, method: 'email' };
    return { paid: false, method: 'none' };
  };

  const allInstitutions = useMemo((): string[] => {
    const set = new Set<string>();
    students.forEach(s => { if (s.institution) set.add(s.institution); });
    return Array.from(set).sort();
  }, [students]);

  const allLevels = useMemo((): string[] => {
    const set = new Set<string>();
    students.forEach(s => set.add(s.level || '100'));
    return Array.from(set).sort((a, b) => parseInt(a) - parseInt(b));
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Payment tab filter
      if (filterTab === 'paid' && !isPaid(s).paid) return false;
      if (filterTab === 'unpaid' && isPaid(s).paid) return false;
      // Level filter
      if (levelFilter && (s.level || '100') !== levelFilter) return false;
      // Institution filter
      if (institutionFilter && s.institution !== institutionFilter) return false;
      // Search filter
      const q = searchQuery.toLowerCase();
      if (q && !(
        (s.displayName || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [students, filterTab, searchQuery, levelFilter, institutionFilter, paidUserIds]);

  // Group filtered students by Level
  const grouped = useMemo(() => {
    return filteredStudents.reduce((acc, s) => {
      const lvl = s.level || '100';
      if (!acc[lvl]) acc[lvl] = [];
      acc[lvl].push(s);
      return acc;
    }, {} as Record<string, UserProfile[]>);
  }, [filteredStudents]);

  const sortedLevels = Object.keys(grouped).sort((a, b) => parseInt(a) - parseInt(b));

  // ─── Stat Cards ─────────────────────────────────────────────────────────────
  const totalStudents = students.length;
  const paidCount = students.filter(s => isPaid(s).paid).length;
  const unpaidCount = totalStudents - paidCount;
  const blockedCount = students.filter(s => s.isBlocked).length;

  // ─── Actions ────────────────────────────────────────────────────────────────
  const executeAction = async () => {
    if (!confirmModal) return;
    const { type, student } = confirmModal;
    setConfirmModal(null);
    setActionLoading(student.uid);
    try {
      if (type === 'delete') {
        await userService.deleteUserData(student.uid);
        await adminService.logAction(user!.uid, profile!.displayName, 'STUDENT_REMOVED',
          `Removed student ${student.displayName} (${student.email}) from ${student.institution}`);
      } else if (type === 'block') {
        await userService.updateUserProfile(student.uid, { isBlocked: true });
        await adminService.logAction(user!.uid, profile!.displayName, 'STUDENT_BLOCKED',
          `Blocked access for ${student.displayName}`);
      } else if (type === 'unblock') {
        await userService.updateUserProfile(student.uid, { isBlocked: false });
        await adminService.logAction(user!.uid, profile!.displayName, 'STUDENT_UNBLOCKED',
          `Restored access for ${student.displayName}`);
      } else if (type === 'promote') {
        const next = (parseInt(student.level || '100') + 100).toString();
        await userService.updateUserProfile(student.uid, { level: next });
        await adminService.logAction(user!.uid, profile!.displayName, 'STUDENT_PROMOTED',
          `Promoted ${student.displayName} to Level ${next}`);
      } else if (type === 'mark_paid') {
        await userService.updateUserProfile(student.uid, { membershipStatus: 'active' });
        await adminService.logAction(user!.uid, profile!.displayName, 'STUDENT_PAID_MANUAL',
          `Manually marked ${student.displayName} as PAID`);
      } else if (type === 'mark_unpaid') {
        await userService.updateUserProfile(student.uid, { membershipStatus: 'pending' });
        await adminService.logAction(user!.uid, profile!.displayName, 'STUDENT_UNPAID_MANUAL',
          `Manually marked ${student.displayName} as UNPAID`);
      }
    } catch {
      alert('Action failed. Check your permissions and try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Guard: Super Admin only ─────────────────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Navbar />
        <div className="text-center p-12">
          <i className="fas fa-shield-alt text-6xl text-slate-200 mb-4"></i>
          <h2 className="text-2xl font-black text-slate-900">Super Admin Access Required</h2>
          <p className="text-slate-500 mt-2">This panel is restricted to Super Administrators.</p>
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

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <Link to="/admin" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
              <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Student Directory</h1>
            <p className="text-slate-500 font-medium text-sm mt-0.5">
              Full registry — payment status, level, and administrative controls.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-80">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Search name or email…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm transition-all"
            />
          </div>
        </div>

        {/* ── Stat Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Students', value: totalStudents, icon: 'fa-users', color: 'text-slate-700', bg: 'bg-slate-50' },
            { label: 'Paid Members', value: paidCount, icon: 'fa-check-circle', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Unpaid / Pending', value: unpaidCount, icon: 'fa-clock', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Blocked', value: blockedCount, icon: 'fa-ban', color: 'text-red-600', bg: 'bg-red-50' },
          ].map((card, i) => (
            <Card key={i} className="p-5 border-none shadow-xl shadow-slate-200/40 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                <p className="text-3xl font-black text-slate-900">
                  {loading ? <span className="animate-pulse text-slate-300">…</span> : card.value}
                </p>
              </div>
              <div className={`p-4 rounded-2xl ${card.bg} ${card.color} shadow-inner`}>
                <i className={`fas ${card.icon} text-xl`}></i>
              </div>
            </Card>
          ))}
        </div>

        {/* ── Filter Bar ────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          {/* Payment tabs */}
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {(['all', 'paid', 'unpaid'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`flex-1 px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${
                  filterTab === tab
                    ? tab === 'paid' ? 'bg-emerald-600 text-white'
                      : tab === 'unpaid' ? 'bg-amber-500 text-white'
                      : 'bg-slate-900 text-white'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {tab === 'all' ? `All (${totalStudents})` : tab === 'paid' ? `Paid (${paidCount})` : `Unpaid (${unpaidCount})`}
              </button>
            ))}
          </div>

          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
            title="Filter by Level"
            className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
          >
            <option value="">All Levels</option>
            {allLevels.map(l => (
              <option key={l} value={l}>Level {l}</option>
            ))}
          </select>

          {/* Institution filter */}
          <select
            value={institutionFilter}
            onChange={e => setInstitutionFilter(e.target.value)}
            title="Filter by Institution"
            className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-primary-500 outline-none shadow-sm flex-1"
          >
            <option value="">All Institutions</option>
            {allInstitutions.map(inst => (
              <option key={inst} value={inst}>{inst}</option>
            ))}
          </select>
        </div>

        {/* ── Student Table ─────────────────────────────────────────────────── */}
        <div className="space-y-10">
          {loading ? (
            <Card className="p-20 text-center border-none shadow-xl">
              <div className="flex flex-col items-center text-slate-300">
                <div className="w-12 h-12 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs font-black uppercase tracking-widest animate-pulse">Loading Registry…</p>
              </div>
            </Card>
          ) : filteredStudents.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[3rem] text-slate-300">
              <i className="fas fa-user-slash text-6xl mb-4 opacity-20"></i>
              <p className="font-black uppercase tracking-widest text-sm">No students match your filters</p>
            </div>
          ) : (
            sortedLevels.map(level => (
              <div key={level}>
                {/* Level separator */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <div className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-1.5 rounded-full">
                    <i className="fas fa-layer-group text-[10px]"></i>
                    <span className="text-[11px] font-black uppercase tracking-widest">Level {level}</span>
                    <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {grouped[level].length}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>

                <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
                  {/* Desktop Table View */}
                  <div className="hidden md:block">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4 text-slate-200">Student</th>
                          <th className="px-6 py-4 hidden lg:table-cell">Institution</th>
                          <th className="px-6 py-4">Payment</th>
                          <th className="px-6 py-4 hidden sm:table-cell">Joined</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {grouped[level]
                          .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
                          .map(student => {
                            const paid = isPaid(student);
                            const isLoading = actionLoading === student.uid;
                            const canPromote = parseInt(student.level || '100') < 300;

                            return (
                              <tr
                                key={student.uid}
                                className={`group transition-colors ${
                                  student.isBlocked ? 'bg-red-50/40' : 'hover:bg-slate-50/60'
                                } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                              >
                                {/* Identity */}
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shadow-sm flex-shrink-0 transition-transform group-hover:scale-105 ${
                                      student.isBlocked ? 'bg-red-100 text-red-600' : paid.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                      {(student.displayName || 'S').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className={`font-black text-sm leading-tight ${student.isBlocked ? 'text-red-900' : 'text-slate-900'}`}>
                                          {student.displayName || 'Unnamed'}
                                        </p>
                                        {student.isBlocked && (
                                          <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full uppercase">Blocked</span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-400 font-medium truncate">{student.email}</p>
                                      {student.phoneNumber && (
                                        <p className="text-[10px] text-primary-600 font-bold mt-0.5">
                                          <i className="fas fa-phone-alt mr-1 text-[8px]"></i>{student.phoneNumber}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>


                                {/* Institution */}
                                <td className="px-6 py-5 hidden lg:table-cell">
                                  <span className="text-xs font-bold text-slate-600">
                                    {student.institution || '—'}
                                  </span>
                                </td>

                                {/* Payment Badge */}
                                <td className="px-6 py-5">
                                  {paid.paid ? (
                                    <div className="flex flex-col">
                                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter">
                                        <i className="fas fa-check-circle text-[8px]"></i>Paid
                                      </span>
                                      {paid.method === 'email' && (
                                        <span className="text-[8px] font-bold text-emerald-400 mt-1 flex items-center">
                                          <i className="fas fa-at mr-1"></i> Match by Email
                                        </span>
                                      )}
                                      {paid.method === 'manual' && (
                                        <span className="text-[8px] font-bold text-primary-400 mt-1 flex items-center">
                                          <i className="fas fa-user-edit mr-1"></i> Manual Entry
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter">
                                      <i className="fas fa-clock text-[8px]"></i>Unpaid
                                    </span>
                                  )}
                                </td>

                                {/* Joined */}
                                <td className="px-6 py-5 hidden sm:table-cell text-xs font-bold text-slate-400">
                                  {student.createdAt ? new Date(student.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Legacy'}
                                </td>

                                {/* Actions */}
                                <td className="px-6 py-5 text-right">
                                  {isLoading ? (
                                    <span className="text-[10px] font-black text-primary-500 uppercase animate-pulse">Working…</span>
                                  ) : (
                                    <div className="flex items-center justify-end gap-3">
                                      {/* Promote */}
                                      <button
                                        onClick={() => canPromote && setConfirmModal({ type: 'promote', student })}
                                        disabled={!canPromote}
                                        title={canPromote ? `Promote to Level ${parseInt(student.level || '100') + 100}` : 'Already at max level'}
                                        className={`text-[10px] font-black uppercase tracking-widest transition ${
                                          canPromote ? 'text-primary-600 hover:text-primary-800' : 'text-slate-200 cursor-not-allowed'
                                        }`}
                                      >
                                        <i className="fas fa-level-up-alt mr-1"></i>Promote
                                      </button>

                                      {/* Block / Unblock */}
                                      <button
                                        onClick={() => setConfirmModal({ type: student.isBlocked ? 'unblock' : 'block', student })}
                                        className={`text-[10px] font-black uppercase tracking-widest transition ${
                                          student.isBlocked ? 'text-emerald-600 hover:text-emerald-800' : 'text-amber-600 hover:text-amber-800'
                                        }`}
                                      >
                                        <i className={`fas ${student.isBlocked ? 'fa-unlock' : 'fa-lock'} mr-1`}></i>
                                        {student.isBlocked ? 'Unblock' : 'Block'}
                                      </button>

                                      {/* Payment Toggle */}
                                      <button
                                        onClick={() => setConfirmModal({ type: paid.paid ? 'mark_unpaid' : 'mark_paid', student })}
                                        className={`text-[10px] font-black uppercase tracking-widest transition ${
                                          paid.paid ? 'text-slate-400 hover:text-amber-600' : 'text-emerald-600 hover:text-emerald-800'
                                        }`}
                                      >
                                        <i className={`fas ${paid.paid ? 'fa-times-circle' : 'fa-money-bill-wave'} mr-1`}></i>
                                        {paid.paid ? 'Revoke Paid' : 'Mark Paid'}
                                      </button>

                                      {/* Remove */}
                                      <button
                                        onClick={() => setConfirmModal({ type: 'delete', student })}
                                        className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition"
                                      >
                                        <i className="fas fa-trash-alt mr-1"></i>Remove
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {grouped[level]
                      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
                      .map(student => {
                        const paid = isPaid(student);
                        const isLoading = actionLoading === student.uid;
                        const canPromote = parseInt(student.level || '100') < 300;

                        return (
                          <div key={student.uid} className={`p-4 space-y-4 ${student.isBlocked ? 'bg-red-50/30' : ''} ${isLoading ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm flex-shrink-0 ${
                                student.isBlocked ? 'bg-red-100 text-red-600' : paid.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {(student.displayName || 'S').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-black text-slate-900 truncate max-w-[150px]">{student.displayName || 'Unnamed'}</p>
                                  {student.isBlocked && <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full uppercase">Blocked</span>}
                                </div>
                                <p className="text-xs text-slate-400 font-medium truncate">{student.email}</p>
                                {student.phoneNumber && (
                                  <p className="text-[10px] text-primary-600 font-bold mt-1">
                                    <i className="fas fa-phone-alt mr-1 text-[8px]"></i>{student.phoneNumber}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-widest">
                                <div className="bg-slate-50 p-2 rounded-xl">
                                   <p className="text-slate-400 mb-0.5">Academic Level</p>
                                   <p className="text-slate-700">Level {student.level || '100'}</p>
                                </div>
                               <div className="bg-slate-50 p-2 rounded-xl">
                                  <p className="text-slate-400 mb-0.5">Institution</p>
                                  <p className="text-slate-700 truncate">{student.institution || '—'}</p>
                               </div>
                            </div>

                            <div className="flex items-center justify-between">
                               {paid.paid ? (
                                  <div className="flex flex-col">
                                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter">
                                      <i className="fas fa-check-circle text-[8px]"></i>Paid Member
                                    </span>
                                    {paid.method === 'email' && <span className="text-[8px] font-bold text-emerald-500 mt-1 uppercase tracking-tighter"><i className="fas fa-at mr-1"></i>Email Match</span>}
                                    {paid.method === 'manual' && <span className="text-[8px] font-bold text-primary-500 mt-1 uppercase tracking-tighter"><i className="fas fa-edit mr-1"></i>Manual Override</span>}
                                  </div>
                               ) : (
                                 <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter">
                                   <i className="fas fa-clock text-[8px]"></i>Unpaid / Pending
                                 </span>
                               )}
                               <p className="text-[10px] text-slate-300 font-bold">Joined {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Legacy'}</p>
                             </div>

                             <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                               <button 
                                 onClick={() => canPromote && setConfirmModal({ type: 'promote', student })}
                                 disabled={!canPromote}
                                 className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition ${canPromote ? 'border-primary-100 text-primary-600 bg-primary-50 active:bg-primary-100' : 'border-slate-50 text-slate-200 bg-slate-50'}`}
                               >
                                 <i className="fas fa-level-up-alt"></i> Promote
                               </button>
                               <button 
                                 onClick={() => setConfirmModal({ type: student.isBlocked ? 'unblock' : 'block', student })}
                                 className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition ${student.isBlocked ? 'border-emerald-100 text-emerald-600 bg-emerald-50 active:bg-emerald-100' : 'border-amber-100 text-amber-600 bg-amber-50 active:bg-amber-100'}`}
                               >
                                 <i className={`fas ${student.isBlocked ? 'fa-unlock' : 'fa-lock'}`}></i> {student.isBlocked ? 'Un' : ''}Block
                               </button>
                                <button 
                                 onClick={() => setConfirmModal({ type: paid.paid ? 'mark_unpaid' : 'mark_paid', student })}
                                 className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition ${paid.paid ? 'border-amber-100 text-amber-600 bg-amber-50' : 'border-emerald-100 text-emerald-600 bg-emerald-50'}`}
                               >
                                 <i className={`fas ${paid.paid ? 'fa-times-circle' : 'fa-money-bill-wave'}`}></i> {paid.paid ? 'Revoke' : 'Pay'}
                               </button>
                               <button 
                                 onClick={() => setConfirmModal({ type: 'delete', student })}
                                 className="flex items-center justify-center px-4 py-3 rounded-xl border-2 border-red-100 text-red-500 bg-red-50 active:bg-red-100 transition"
                                 title="Delete Student"
                               >
                                 <i className="fas fa-trash-alt"></i>
                               </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </Card>
              </div>
            ))
          )}
        </div>

      </Container>

      {/* ── Confirm Modal ─────────────────────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto ${
              confirmModal.type === 'delete' ? 'bg-red-50' :
              confirmModal.type === 'block' ? 'bg-amber-50' :
              confirmModal.type === 'unblock' ? 'bg-emerald-50' : 
              confirmModal.type === 'mark_paid' ? 'bg-emerald-50' :
              confirmModal.type === 'mark_unpaid' ? 'bg-amber-50' :
              'bg-primary-50'
            }`}>
              <i className={`fas text-3xl ${
                confirmModal.type === 'delete' ? 'fa-trash-alt text-red-500' :
                confirmModal.type === 'block' ? 'fa-lock text-amber-500' :
                confirmModal.type === 'unblock' ? 'fa-unlock text-emerald-500' :
                confirmModal.type === 'mark_paid' ? 'fa-money-bill-wave text-emerald-600' :
                confirmModal.type === 'mark_unpaid' ? 'fa-times-circle text-amber-500' :
                'fa-level-up-alt text-primary-600'
              }`}></i>
            </div>

            <h3 className="text-xl font-black text-slate-900 text-center mb-2">
              {confirmModal.type === 'delete' ? 'Permanently Remove Student' :
               confirmModal.type === 'block' ? 'Block Student Access' :
               confirmModal.type === 'unblock' ? 'Restore Student Access' :
               confirmModal.type === 'mark_paid' ? 'Manual Payment Authorization' :
               confirmModal.type === 'mark_unpaid' ? 'Revoke Payment Status' :
               `Promote to Level ${parseInt(confirmModal.student.level || '100') + 100}`}
            </h3>
            <p className="text-sm text-slate-500 text-center mb-2">
              <span className="font-bold text-slate-900">{confirmModal.student.displayName}</span>
              {' '}· {confirmModal.student.institution}
            </p>
            {confirmModal.type === 'delete' && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-xl p-3 mb-6 text-center">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                This will permanently delete their profile and ALL exam submission records. This cannot be undone.
              </div>
            )}
            {confirmModal.type !== 'delete' && <div className="mb-6"></div>}

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                className={`flex-1 py-3 rounded-xl font-black text-white transition active:scale-95 ${
                  confirmModal.type === 'delete' ? 'bg-red-600 hover:bg-red-700' :
                  confirmModal.type === 'block' ? 'bg-amber-500 hover:bg-amber-600' :
                  confirmModal.type === 'unblock' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  confirmModal.type === 'mark_paid' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  confirmModal.type === 'mark_unpaid' ? 'bg-amber-600 hover:bg-amber-700' :
                  'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {confirmModal.type === 'delete' ? 'Yes, Remove' :
                 confirmModal.type === 'block' ? 'Block Access' :
                 confirmModal.type === 'unblock' ? 'Restore Access' :
                 confirmModal.type === 'mark_paid' ? 'Authorize Access' :
                 confirmModal.type === 'mark_unpaid' ? 'Revoke Access' :
                 'Confirm Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDirectory;
