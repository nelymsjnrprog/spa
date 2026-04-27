
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Card } from '../ui/Layout';
import { userService } from '../services/userService';
import { adminService } from '../services/adminService';
import { UserProfile } from '../core/types';
import { useAuth } from '../auth/AuthProvider';

const Users: React.FC = () => {
   const { profile } = useAuth();
   const [users, setUsers] = useState<UserProfile[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [loading, setLoading] = useState(true);

   const effectivePerm = adminService.getEffectivePermission(profile);
   const isSuperAdmin = effectivePerm === 'super_admin';

   useEffect(() => {
      const unsubscribe = userService.subscribeToUsers((data) => {
         // Only show students in this management view
         setUsers(data.filter(u => u.role === 'student'));
         setLoading(false);
      });

      return () => unsubscribe();
   }, []);

   const handleBlockToggle = async (user: UserProfile) => {
      const newStatus = !user.isBlocked;
      const action = newStatus ? 'BLOCK' : 'UNBLOCK';
      if (!confirm(`Are you sure you want to ${action} ${user.displayName || "this student"}?`)) return;

      try {
         await userService.updateUserProfile(user.uid, { isBlocked: newStatus });
      } catch (err) {
         alert("Failed to update student status.");
      }
   };

   const handlePromote = async (user: UserProfile) => {
      const currentLevel = parseInt(user.level || '100');
      if (currentLevel >= 300) {
         alert("Student is already at the maximum level.");
         return;
      }
      const nextLevel = (currentLevel + 100).toString();
      if (!confirm(`Promote ${user.displayName || "this student"} to Level ${nextLevel}?`)) return;

      try {
         await userService.updateUserProfile(user.uid, { level: nextLevel });
      } catch (err) {
         alert("Failed to promote student.");
      }
   };

   const handleDeleteUser = async (user: UserProfile) => {
      if (!confirm(`WARNING: Are you sure you want to PERMANENTLY delete ${user.displayName || "this student"}?\n\nThis will remove their profile and all their exam submissions. They will no longer be able to log in.`)) return;
      if (!confirm("This action CANNOT be undone. Click OK to confirm deletion.")) return;

      try {
         await userService.deleteUserData(user.uid);
      } catch (err) {
         alert("Failed to delete student.");
      }
   };

   const filteredUsers = users.filter(u => {
      // 1. Role-based Institution Filtering
      if (!isSuperAdmin) {
         const assignedInstitutions = profile?.assignedInstitutions || [];
         const userInst = (u.institution || '').trim().toLowerCase();
         if (!assignedInstitutions.some(inst => inst.trim().toLowerCase() === userInst)) return false;
      }

      const search = searchQuery.toLowerCase();
      return (
         (u.displayName || "").toLowerCase().includes(search) ||
         (u.email || "").toLowerCase().includes(search)
      );
   });

   const groupedUsers = filteredUsers.reduce((acc, user) => {
      const inst = user.institution || 'Unassigned Institution';
      if (!acc[inst]) acc[inst] = [];
      acc[inst].push(user);
      return acc;
   }, {} as Record<string, UserProfile[]>);

   const sortedInstitutions = Object.keys(groupedUsers).sort((a, b) => a.localeCompare(b));

   return (
      <div className="min-h-screen bg-slate-50">
         <Navbar />
         <Container>
            <div className="mb-12">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div>
                     <Link to="/admin" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
                        <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
                     </Link>
                     <h1 className="text-3xl font-bold text-slate-900 tracking-tight">User Management</h1>
                     <p className="text-slate-500 font-medium">
                         {isSuperAdmin 
                            ? "Manage student registries and institutional access." 
                            : `Managing ${profile?.assignedInstitutions?.join(', ') || 'Assigned'} Institutions`}
                     </p>
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative w-full sm:w-80">
                     <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                     <input 
                        type="text"
                        placeholder="Search name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm transition-all"
                     />
                  </div>
               </div>
            </div>

            <div className="space-y-12">
               {loading ? (
                  <Card className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Loading Registry...</Card>
               ) : (
                  sortedInstitutions.map(inst => (
                     <div key={inst} className="space-y-4">
                        <div className="flex items-center space-x-4">
                           <div className="h-px flex-1 bg-slate-200"></div>
                           <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{inst}</h2>
                           <div className="h-px flex-1 bg-slate-200"></div>
                        </div>

                        <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
                           <table className="w-full text-left">
                              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                 <tr>
                                    <th className="px-8 py-4">Identity</th>
                                    <th className="px-8 py-4">Level</th>
                                    <th className="px-8 py-4">Role</th>
                                    <th className="px-8 py-4">Joined</th>
                                    {isSuperAdmin && <th className="px-8 py-4 text-right">Actions</th>}
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                 {groupedUsers[inst]
                                    .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""))
                                    .map(u => (
                                       <tr key={u.uid} className={`transition-colors group ${u.isBlocked ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}`}>
                                          <td className="px-8 py-5">
                                             <div className="flex items-center">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black mr-4 shadow-sm transition-all ${u.isBlocked ? 'bg-red-100 text-red-600' : 'bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white'}`}>
                                                   {(u.displayName || "U").charAt(0)}
                                                </div>
                                                <div>
                                                   <div className="flex items-center space-x-2">
                                                      <p className={`font-bold leading-tight ${u.isBlocked ? 'text-red-900' : 'text-slate-900'}`}>{u.displayName || "Unnamed User"}</p>
                                                      {u.isBlocked && <span className="text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Blocked</span>}
                                                   </div>
                                                   <p className="text-[11px] text-slate-400 font-medium">{u.email}</p>
                                                   {u.phoneNumber && <p className="text-[10px] text-primary-600 font-bold mt-0.5"><i className="fas fa-phone-alt mr-1 text-[8px]"></i> {u.phoneNumber}</p>}
                                                </div>
                                             </div>
                                          </td>
                                          <td className="px-8 py-5">
                                             <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
                                                {u.level || "100"}
                                             </span>
                                          </td>
                                          <td className="px-8 py-5">
                                             <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-tighter ${u.isBlocked ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                {u.role}
                                             </span>
                                          </td>
                                          <td className="px-8 py-5 text-xs font-bold text-slate-400">
                                             {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Legacy'}
                                          </td>
                                          {isSuperAdmin && (
                                             <td className="px-8 py-5 text-right space-x-3">
                                                <button
                                                   onClick={() => handlePromote(u)}
                                                   disabled={parseInt(u.level || '100') >= 300}
                                                   className={`text-[10px] font-black uppercase tracking-widest ${parseInt(u.level || '100') < 300 ? 'text-primary-600 hover:text-primary-800' : 'text-slate-300 cursor-not-allowed'}`}
                                                >
                                                   Promote
                                                </button>
                                                <button
                                                   onClick={() => handleBlockToggle(u)}
                                                   className={`text-[10px] font-black uppercase tracking-widest ${u.isBlocked ? 'text-green-600 hover:text-green-800' : 'text-red-500 hover:text-red-700'}`}
                                                >
                                                   {u.isBlocked ? 'Unblock' : 'Block'}
                                                </button>
                                                <button
                                                   onClick={() => handleDeleteUser(u)}
                                                   className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-800"
                                                >
                                                   Remove
                                                </button>
                                             </td>
                                          )}
                                       </tr>
                                    ))}
                              </tbody>
                           </table>
                        </Card>
                     </div>
                  ))
               )}
            </div>
         </Container>
      </div>
   );
};

export default Users;
