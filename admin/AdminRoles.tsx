import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { userService } from '../services/userService';
import { adminService } from '../services/adminService';
import { UserProfile, AdminPermission } from '../core/types';
import { useAuth } from '../auth/AuthProvider';
import { institutionService, Institution } from '../services/institutionService';

const AdminRoles: React.FC = () => {
   const { profile } = useAuth();
   const [users, setUsers] = useState<UserProfile[]>([]);
   const [institutions, setInstitutions] = useState<Institution[]>([]);
   const [loading, setLoading] = useState(true);
   const [editingUser, setEditingUser] = useState<string | null>(null);
   const [editPermission, setEditPermission] = useState<AdminPermission>('institution_admin');
   const [editInstitutions, setEditInstitutions] = useState<string[]>([]);
   const [saving, setSaving] = useState(false);

   // Promote student modal state
   const [showPromoteModal, setShowPromoteModal] = useState(false);
   const [modalTab, setModalTab] = useState<'create' | 'promote'>('create');
   const [students, setStudents] = useState<UserProfile[]>([]);
   const [promoteSearch, setPromoteSearch] = useState('');
   const [promotePermission, setPromotePermission] = useState<AdminPermission>('institution_admin');
   const [promoteInstitutions, setPromoteInstitutions] = useState<string[]>([]);

   // Create admin form state
   const [createName, setCreateName] = useState('');
   const [createEmail, setCreateEmail] = useState('');
   const [createPassword, setCreatePassword] = useState('');
   const [createPermission, setCreatePermission] = useState<AdminPermission>('institution_admin');
   const [createInstitutions, setCreateInstitutions] = useState<string[]>([]);
   const [createError, setCreateError] = useState('');
   const [createSuccess, setCreateSuccess] = useState('');

   const effectivePerm = adminService.getEffectivePermission(profile);
   const isSuperAdmin = effectivePerm === 'super_admin';

   useEffect(() => {
      const unsubUsers = userService.subscribeToUsers((data) => {
         setUsers(data);
         setStudents(data.filter(u => u.role === 'student'));
         setLoading(false);
      });
      const unsubInst = institutionService.subscribeToInstitutions(setInstitutions);
      return () => {
         unsubUsers();
         unsubInst();
      };
   }, []);

   const admins = users.filter(u => u.role === 'admin');

   const handleEditClick = (user: UserProfile) => {
      setEditingUser(user.uid);
      setEditPermission(user.adminPermission || 'super_admin');
      setEditInstitutions(user.assignedInstitutions || []);
   };

   const handleSave = async (uid: string) => {
      setSaving(true);
      try {
         await adminService.setAdminPermissions(uid, editPermission, editInstitutions);
         const targetUser = users.find(u => u.uid === uid);
         await adminService.logAction(
            profile!.uid,
            profile!.displayName,
            'Updated Admin Permissions',
            `Set ${targetUser?.displayName || uid} to ${editPermission}, institutions: ${editInstitutions.join(', ') || 'none'}`
         );
         setEditingUser(null);
      } catch (err) {
         alert("Failed to update permissions.");
      }
      setSaving(false);
   };

   const handleRemove = async (user: UserProfile) => {
      if (adminService.isSystemOwner(user.email)) {
         alert("Cannot remove the system owner.");
         return;
      }
      if (!confirm(`Remove ${user.displayName} from admin access? they will return to student role.`)) return;
      try {
         await adminService.demoteToStudent(user.uid);
         await adminService.logAction(
            profile!.uid,
            profile!.displayName,
            'Removed Admin',
            `Removed ${user.displayName} from admin role`
         );
      } catch (err) {
         alert("Failed to remove admin.");
      }
   };

   const toggleInstitution = (name: string, current: string[], setter: (v: string[]) => void) => {
      if (current.includes(name)) {
         setter(current.filter(l => l !== name));
      } else {
         setter([...current, name]);
      }
   };

   const handlePromoteStudent = async (student: UserProfile) => {
      setSaving(true);
      try {
         await adminService.promoteToAdmin(student.uid, promotePermission, promoteInstitutions);
         await adminService.logAction(
            profile!.uid,
            profile!.displayName,
            'Promoted to Admin',
            `Promoted ${student.displayName} to ${promotePermission}, institutions: ${promoteInstitutions.join(', ') || 'none'}`
         );
         setShowPromoteModal(false);
         setPromoteSearch('');
         setPromoteInstitutions([]);
      } catch (err) {
         alert("Failed to promote student.");
      }
      setSaving(false);
   };

   const handleCreateAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreateError('');
      setCreateSuccess('');
      if (!createName.trim() || !createEmail.trim() || !createPassword.trim()) {
         setCreateError('Please fill in all fields.');
         return;
      }
      if (createPassword.length < 8) {
         setCreateError('Password must be at least 8 characters.');
         return;
      }
      // Ask for superadmin's password to re-authenticate after creating the new account
      const callerPassword = prompt('Enter YOUR password to confirm (needed to stay signed in after creating the account):');
      if (!callerPassword) {
         setCreateError('Your password is required to create admin accounts.');
         return;
      }
      setSaving(true);
      try {
         await adminService.createAdminAccount(
            createEmail.trim(),
            createPassword,
            createName.trim(),
            createPermission,
            createInstitutions,
            profile!.email,
            callerPassword
         );
         await adminService.logAction(
            profile!.uid,
            profile!.displayName,
            'Created Admin Account',
            `Created admin account for ${createName.trim()} (${createEmail.trim()}) with ${createPermission}`
         );
         setCreateSuccess(`Admin account created successfully for ${createEmail.trim()}`);
         setCreateName('');
         setCreateEmail('');
         setCreatePassword('');
         setCreateInstitutions([]);
      } catch (err: any) {
         setCreateError(err.message || 'Failed to create admin account.');
      }
      setSaving(false);
   };

   const resetModalState = () => {
      setShowPromoteModal(false);
      setCreateError('');
      setCreateSuccess('');
      setCreateName('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateInstitutions([]);
      setPromoteSearch('');
      setPromoteInstitutions([]);
   };

   const filteredStudents = students.filter(s =>
      s.displayName?.toLowerCase().includes(promoteSearch.toLowerCase()) ||
      s.email?.toLowerCase().includes(promoteSearch.toLowerCase())
   );

   if (!isSuperAdmin) {
      return (
         <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Container>
               <div className="flex flex-col items-center justify-center py-32">
                  <i className="fas fa-shield-halved text-6xl text-slate-200 mb-6"></i>
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
                  <p className="text-slate-500">Only Super Admins can manage admin roles and permissions.</p>
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
               <div>
                  <Link to="/admin" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
                     <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
                  </Link>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Admin Roles & Permissions</h1>
                  <p className="text-slate-500 font-medium text-sm sm:text-base">Manage who has access to what.</p>
               </div>
               <button
                  onClick={() => setShowPromoteModal(true)}
                  className="w-full sm:w-auto bg-primary-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-700 transition-all text-sm"
               >
                  <i className="fas fa-user-plus mr-2"></i>Add Admin
               </button>
            </div>

            {/* Permission Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
               <Card className="p-4 border-l-4 border-l-amber-500">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Super Admin</p>
                  <p className="text-xs text-slate-500">Full access to all institutions, levels, and administrative settings.</p>
               </Card>
               <Card className="p-4 border-l-4 border-l-primary-500">
                  <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">Admin</p>
                  <p className="text-xs text-slate-500">Can manage quizzes and students for assigned institutions only.</p>
               </Card>
               <Card className="p-4 border-l-4 border-l-slate-400">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Viewer</p>
                  <p className="text-xs text-slate-500">Read-only access. Cannot modify institutions or examination data.</p>
               </Card>
            </div>

            {/* Admin List */}
            {loading ? (
               <Card className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Loading Admins...</Card>
            ) : (
               <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
                  <div className="px-6 sm:px-8 py-5 bg-slate-900 text-white flex items-center justify-between">
                     <h2 className="text-sm font-black uppercase tracking-widest flex items-center">
                        <i className="fas fa-users-cog mr-2 text-primary-400"></i> Admin Registry
                     </h2>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {admins.length} Admin{admins.length !== 1 ? 's' : ''}
                     </span>
                  </div>
                  <div className="divide-y divide-slate-50">
                     {admins.map(admin => {
                        const isOwner = adminService.isSystemOwner(admin.email);
                        const perm = adminService.getEffectivePermission(admin);
                        const isEditing = editingUser === admin.uid;
                        const isOnline = admin.lastActiveAt && (Date.now() - admin.lastActiveAt) < 120000;

                        return (
                           <div key={admin.uid} className="p-5 sm:p-6 hover:bg-slate-50/50 transition-colors">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                 {/* Identity */}
                                 <div className="flex items-center space-x-4">
                                    <div className="relative">
                                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner ${isOwner ? 'bg-amber-100 text-amber-700' : 'bg-primary-50 text-primary-600'}`}>
                                          {admin.displayName?.charAt(0) || 'A'}
                                       </div>
                                       {isOnline && (
                                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>
                                       )}
                                    </div>
                                    <div>
                                       <div className="flex items-center space-x-2">
                                          <p className="font-bold text-slate-900">{admin.displayName}</p>
                                          {isOwner && (
                                             <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full uppercase">OWNER</span>
                                          )}
                                          {isOnline ? (
                                             <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full uppercase">Online</span>
                                          ) : (
                                             <span className="text-[8px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full uppercase">Offline</span>
                                          )}
                                       </div>
                                       <p className="text-[11px] text-slate-400">{admin.email}</p>
                                    </div>
                                 </div>

                                 {/* Permission Badge & Actions */}
                                 <div className="flex items-center space-x-3">
                                    {!isEditing ? (
                                       <>
                                          <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider ${
                                             perm === 'super_admin' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                             perm === 'institution_admin' ? 'bg-primary-50 text-primary-700 border border-primary-200' :
                                             'bg-slate-50 text-slate-500 border border-slate-200'
                                          }`}>
                                             {perm === 'institution_admin' ? 'Admin' : perm.replace('_', ' ')}
                                          </span>
                                          {(admin.assignedInstitutions || []).length > 0 && perm === 'institution_admin' && (
                                             <div className="flex flex-wrap gap-1">
                                                {admin.assignedInstitutions!.map(inst => (
                                                   <span key={inst} className="text-[8px] font-bold bg-primary-100 text-primary-700 px-2 py-0.5 rounded uppercase tracking-tighter truncate max-w-[80px]">{inst}</span>
                                                ))}
                                             </div>
                                          )}
                                          {!isOwner && (
                                             <div className="flex space-x-2">
                                                <button
                                                   onClick={() => handleEditClick(admin)}
                                                   className="text-[10px] font-black text-primary-600 hover:text-primary-800 uppercase tracking-widest"
                                                >
                                                   Edit
                                                </button>
                                                <button
                                                   onClick={() => handleRemove(admin)}
                                                   className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest"
                                                >
                                                   Remove
                                                </button>
                                             </div>
                                          )}
                                       </>
                                    ) : (
                                       /* Edit Mode */
                                       <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                                          <select
                                             value={editPermission}
                                             onChange={(e) => setEditPermission(e.target.value as AdminPermission)}
                                             title="Permission Level"
                                             className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold"
                                          >
                                             <option value="super_admin">Super Admin</option>
                                             <option value="institution_admin">Admin</option>
                                             <option value="viewer">Viewer</option>
                                          </select>
                                          {editPermission === 'institution_admin' && (
                                             <div className="flex flex-wrap gap-2 max-w-xs">
                                                {institutions.map(inst => (
                                                   <button
                                                      key={inst.id}
                                                      type="button"
                                                      onClick={() => toggleInstitution(inst.name, editInstitutions, setEditInstitutions)}
                                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border-2 transition uppercase ${
                                                         editInstitutions.includes(inst.name)
                                                            ? 'bg-primary-600 border-primary-600 text-white'
                                                            : 'bg-white border-slate-200 text-slate-400 hover:border-primary-200'
                                                      }`}
                                                   >
                                                      {inst.name}
                                                   </button>
                                                ))}
                                             </div>
                                          )}
                                          <div className="flex space-x-2">
                                             <button
                                                onClick={() => handleSave(admin.uid)}
                                                disabled={saving}
                                                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition disabled:opacity-50"
                                             >
                                                {saving ? <i className="fas fa-circle-notch animate-spin"></i> : 'Save'}
                                             </button>
                                             <button
                                                onClick={() => setEditingUser(null)}
                                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition"
                                             >
                                                Cancel
                                             </button>
                                          </div>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                     {admins.length === 0 && (
                        <div className="p-20 text-center text-slate-400 text-sm">No admin accounts found.</div>
                     )}
                  </div>
               </Card>
            )}

            {/* Add Admin Modal */}
            {showPromoteModal && (
               <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                  <Card className="max-w-lg w-full p-6 sm:p-8 relative border-none shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                     <button
                        onClick={resetModalState}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition"
                        title="Close modal"
                     >
                        <i className="fas fa-times text-xl"></i>
                     </button>

                     <h2 className="text-xl font-black text-slate-900 mb-1">Add New Admin</h2>
                     <p className="text-sm text-slate-500 mb-4">Create a new admin account or promote an existing student.</p>

                     {/* Tab Switcher */}
                     <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                        <button
                           onClick={() => setModalTab('create')}
                           className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                              modalTab === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                           }`}
                        >
                           <i className="fas fa-user-plus mr-1.5"></i>Create New
                        </button>
                        <button
                           onClick={() => setModalTab('promote')}
                           className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                              modalTab === 'promote' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                           }`}
                        >
                           <i className="fas fa-arrow-up mr-1.5"></i>Promote Student
                        </button>
                     </div>

                     {/* ===== CREATE NEW TAB ===== */}
                     {modalTab === 'create' && (
                        <form onSubmit={handleCreateAdmin} className="space-y-4">
                           {createError && (
                              <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg">
                                 <p className="text-red-700 text-xs font-bold">{createError}</p>
                              </div>
                           )}
                           {createSuccess && (
                              <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r-lg">
                                 <p className="text-green-700 text-xs font-bold">{createSuccess}</p>
                              </div>
                           )}
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                              <input type="text" value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Admin Name" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none" />
                           </div>
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                              <input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="admin@example.com" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none" />
                           </div>
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
                              <input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="Min 8 characters" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none tracking-widest" />
                           </div>
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Permission Level</label>
                              <select value={createPermission} onChange={e => setCreatePermission(e.target.value as AdminPermission)} title="Permission" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none">
                                 <option value="super_admin">Super Admin — Full Access</option>
                                 <option value="institution_admin">Admin — Assigned Institutions Only</option>
                                 <option value="viewer">Viewer — Read Only</option>
                              </select>
                           </div>
                           {createPermission === 'institution_admin' && (
                              <div>
                                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Assign Institutions</label>
                                 <div className="flex flex-wrap gap-2">
                                    {institutions.map(inst => (
                                       <button key={inst.id} type="button" onClick={() => toggleInstitution(inst.name, createInstitutions, setCreateInstitutions)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border-2 transition uppercase ${createInstitutions.includes(inst.name) ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-primary-200'}`}>
                                          {inst.name}
                                       </button>
                                    ))}
                                 </div>
                                 {institutions.length === 0 && <p className="text-xs text-red-400 italic mt-1">No institutions configured yet.</p>}
                              </div>
                           )}
                           <button type="submit" disabled={saving} className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-700 transition disabled:opacity-50 shadow-lg mt-2">
                              {saving ? <i className="fas fa-circle-notch animate-spin"></i> : 'Create Admin Account'}
                           </button>
                        </form>
                     )}

                     {/* ===== PROMOTE STUDENT TAB ===== */}
                     {modalTab === 'promote' && (
                        <div className="space-y-4">
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Permission Level</label>
                              <select value={promotePermission} onChange={(e) => setPromotePermission(e.target.value as AdminPermission)} title="Select Permission" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none">
                                 <option value="super_admin">Super Admin — Full Access</option>
                                 <option value="institution_admin">Admin — Assigned Institutions Only</option>
                                 <option value="viewer">Viewer — Read Only</option>
                              </select>
                           </div>
                           {promotePermission === 'institution_admin' && (
                              <div>
                                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Assign Institutions</label>
                                 <div className="flex flex-wrap gap-2">
                                    {institutions.map(inst => (
                                       <button key={inst.id} type="button" onClick={() => toggleInstitution(inst.name, promoteInstitutions, setPromoteInstitutions)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border-2 transition uppercase ${promoteInstitutions.includes(inst.name) ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-primary-200'}`}>
                                          {inst.name}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           )}
                           <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Search Student</label>
                              <div className="relative">
                                 <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                 <input type="text" value={promoteSearch} onChange={(e) => setPromoteSearch(e.target.value)} placeholder="Search by name or email..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
                              </div>
                           </div>
                           <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
                              {filteredStudents.length === 0 ? (
                                 <div className="p-8 text-center text-slate-400 text-sm italic">No students found.</div>
                              ) : (
                                 filteredStudents.slice(0, 20).map(student => (
                                    <div key={student.uid} className="p-3 flex items-center justify-between hover:bg-slate-50 transition group">
                                       <div className="flex items-center space-x-3">
                                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{student.displayName?.charAt(0) || '?'}</div>
                                          <div>
                                             <p className="text-sm font-bold text-slate-900">{student.displayName}</p>
                                             <p className="text-[10px] text-slate-400">{student.email}</p>
                                          </div>
                                       </div>
                                       <button onClick={() => handlePromoteStudent(student)} disabled={saving} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition disabled:opacity-50 shadow-sm">Promote</button>
                                    </div>
                                 ))
                              )}
                           </div>
                        </div>
                     )}
                  </Card>
               </div>
            )}
         </Container>
      </div>
   );
};

export default AdminRoles;
