import React, { useEffect, useState, useMemo } from 'react';
import { Navbar, Container, Card } from '../ui/Layout';
import { adminService } from '../services/adminService';
import { userService } from '../services/userService';
import { institutionService, Institution } from '../services/institutionService';
import { useAuth } from '../auth/AuthProvider';
import { UserProfile } from '../core/types';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

const AdminDashboard: React.FC = () => {
  const { role, user, profile, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  const isSystemOwner = user?.email?.toLowerCase() === 'nelymsjnr@gmail.com' || user?.uid === 'lcfFiLMTu3WULPpiXb4joCX1W3s1';
  const isSuperAdmin = profile?.adminPermission === 'super_admin' || isSystemOwner;
  
  const assignedInstitutions = useMemo(() => {
    if (isSuperAdmin) return [];
    return profile?.assignedInstitutions || [];
  }, [profile, isSuperAdmin]);

  // Admin heartbeat
  useEffect(() => {
    if (!user || role !== 'admin') return;
    adminService.updateHeartbeat(user.uid);
    const interval = setInterval(() => {
      adminService.updateHeartbeat(user.uid);
    }, 30000);
    return () => clearInterval(interval);
  }, [user, role]);

  // Fetch and filter students
  useEffect(() => {
    if (authLoading) return;
    
    const unsub = userService.subscribeToUsers((allUsers) => {
      const studentList = allUsers.filter(u => {
        if (u.role !== 'student') return false;
        if (isSuperAdmin) return true;
        
        const userInst = (u.institution || '').trim().toLowerCase();
        return assignedInstitutions.some(inst => inst.trim().toLowerCase() === userInst);
      });
      setStudents(studentList);
      setLoading(false);
    });

    return () => unsub();
  }, [authLoading, assignedInstitutions, isSuperAdmin]);

  // Fetch institutions
  useEffect(() => {
    const unsub = institutionService.subscribeToInstitutions(setInstitutions);
    return () => unsub();
  }, []);

  // Institution breakdown stats
  const institutionStats = useMemo(() => {
    // 1. Get the base list of institutions for this admin
    const baseList = isSuperAdmin 
      ? institutions 
      : institutions.filter(inst => 
          assignedInstitutions.some(ai => ai.trim().toLowerCase() === inst.name.trim().toLowerCase())
        );

    // 2. Map them to stats
    const stats = baseList.map(inst => {
      const count = students.filter(s => (s.institution || '').trim().toLowerCase() === inst.name.trim().toLowerCase()).length;
      return { name: inst.name, count };
    });

    // 3. Add Unassigned if there are students without an institution (only for super admins usually, or if assigned?)
    // Actually, level admins probably don't care about unassigned students unless they are in their "assigned" list?
    // But students without institution are not in assigned list. So only Super Admin sees Unassigned.
    if (isSuperAdmin) {
      const unassignedCount = students.filter(s => !s.institution || s.institution === 'Unassigned').length;
      if (unassignedCount > 0) {
        stats.push({ name: 'Unassigned', count: unassignedCount });
      }
    }

    return stats.sort((a, b) => b.count - a.count);
  }, [institutions, students, isSuperAdmin, assignedInstitutions]);

  const chartData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }).reverse();

    last7Days.forEach(day => dailyMap[day] = 0);

    students.forEach(s => {
      const day = new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (dailyMap[day] !== undefined) {
        dailyMap[day]++;
      }
    });

    return Object.entries(dailyMap).map(([date, count]) => ({ date, count }));
  }, [students]);


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-primary-200 rounded-full mb-4"></div>
          <p className="text-slate-900 font-bold uppercase tracking-widest text-xs">Initializing Mission Control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />
      <Container>
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-800 text-sm font-medium">
            <div className="flex-1">
              <p className="font-bold">Security Alert</p>
              <p className="opacity-80">{error}</p>
            </div>
          </div>
        )}


        {/* Institution Breakdown */}
        {(isSuperAdmin || assignedInstitutions.length > 0) && institutionStats.length > 0 && (
          <div className="mb-12">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {institutionStats.map(inst => (
                <Link key={inst.name} to={inst.name !== 'Unassigned' ? `/admin/institution/${encodeURIComponent(inst.name)}` : '#'}>
                  <Card className="p-6 border-none shadow-lg shadow-slate-200/40 bg-white hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300 group cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center group-hover:bg-primary-600 transition-colors">
                          <i className="fas fa-university text-primary-600 group-hover:text-white transition-colors"></i>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{inst.name}</p>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{inst.count} student{inst.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <i className="fas fa-chevron-right text-slate-300 group-hover:text-primary-500 transition-colors"></i>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Enrollment Trends Bar Graph */}
        <Card className="p-10 border-none shadow-2xl shadow-slate-200/60 bg-white rounded-[3rem] overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>

              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Candidate registration metrics (Last 7 Days)</p>
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '1.5rem', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '1.25rem'
                  }}
                  itemStyle={{ color: '#0f172a', fontWeight: 900, fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="url(#barGradient)" 
                  radius={[10, 10, 0, 0]} 
                  barSize={40}
                  animationBegin={200}
                  animationDuration={1500}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} className="hover:opacity-80 transition-opacity cursor-pointer" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Container>
    </div>
  );
};

export default AdminDashboard;
