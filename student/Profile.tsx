
import React, { useState, useEffect } from 'react';
import { Navbar, Container, Card } from '../ui/Layout';
import { useAuth } from '../auth/AuthProvider';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../auth/authService';
import { institutionService, Institution } from '../services/institutionService';

const Profile: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editInstitution, setEditInstitution] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editProgram, setEditProgram] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  useEffect(() => {
    if (profile) {
      setEditInstitution(profile.institution || '');
      setEditPhoneNumber(profile.phoneNumber || '');
      setEditLevel(profile.level || '');
      setEditProgram(profile.program || '');
    }

    const unsubscribe = institutionService.subscribeToInstitutions(setInstitutions);
    return () => unsubscribe();
  }, [profile]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await authService.updateProfileDetails(user.uid, editInstitution, editPhoneNumber, editLevel, editProgram);
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      setIsEditing(false);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Container>
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link to="/student" className="text-primary-600 text-sm font-bold flex items-center mb-2 hover:translate-x-[-4px] transition-transform w-fit">
              <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Account Settings</h1>
            <p className="text-slate-500">Manage your identity and security preferences.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <Card className="p-8 text-center border-none shadow-xl shadow-slate-200">
                <div className="w-24 h-24 bg-primary-600 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl text-white font-black shadow-lg">
                  {profile?.displayName?.charAt(0)}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{profile?.displayName}</h2>
                <p className="text-sm text-slate-500 mb-6">{profile?.email}</p>
                <span className="bg-primary-50 text-primary-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-primary-100">
                  {profile?.role} Account
                </span>
              </Card>
            </div>

            <div className="md:col-span-2 space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6 flex items-center">
                  <i className="fas fa-user-circle mr-3 text-primary-600"></i>
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-700 font-medium border border-slate-100">{profile?.displayName}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address</label>
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-700 font-medium border border-slate-100">{profile?.email}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</label>
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-700 font-medium border border-slate-100">{profile?.phoneNumber || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Account Created</label>
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-700 font-medium border border-slate-100">
                      {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Messages */}
              {message.text && (
                <div className={`p-4 rounded-xl text-sm font-bold border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                  <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2`}></i>
                  {message.text}
                </div>
              )}

              <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold flex items-center">
                    <i className="fas fa-graduation-cap mr-3 text-primary-600"></i>
                    Academic Details
                  </h3>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-primary-600 hover:text-primary-700 font-bold text-sm bg-primary-50 px-4 py-2 rounded-lg transition"
                    >
                      <i className="fas fa-edit mr-2"></i> Edit
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditInstitution(profile?.institution || '');
                          setEditLevel(profile?.level || '');
                        }}
                        className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold text-sm transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving || !editInstitution || !editLevel || !editProgram}
                        className="bg-primary-600 text-white hover:bg-primary-700 px-4 py-2 rounded-lg font-bold text-sm transition disabled:opacity-50 flex items-center"
                      >
                        {saving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Institution</label>
                    {isEditing ? (
                      <div className="relative">
                        <select
                          title="Select Institution"
                          disabled={profile?.institution !== 'Pending' && !!profile?.institution}
                          value={editInstitution}
                          onChange={(e) => setEditInstitution(e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition bg-white ${profile?.institution !== 'Pending' && !!profile?.institution ? 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-500 appearance-none' : 'border-primary-200 focus:ring-primary-500'}`}
                        >
                          <option value="" disabled>Select Institution</option>
                          {institutions.map(inst => (
                            <option key={inst.id} value={inst.name}>{inst.name}</option>
                          ))}
                        </select>
                        {profile?.institution !== 'Pending' && !!profile?.institution && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <i className="fas fa-lock text-xs"></i>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-lg text-slate-800 font-bold border border-slate-100 flex items-center">
                        {profile?.institution === 'Pending' ? (
                          <span className="text-orange-500"><i className="fas fa-exclamation-triangle mr-2"></i> Needs Update</span>
                        ) : (
                          profile?.institution || 'N/A'
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Academic Level</label>
                    {isEditing ? (
                      <div className="relative">
                        <select
                          title={profile?.level ? "Level is locked. Contact admin to promote." : "Select Academic Level"}
                          disabled={!!profile?.level}
                          value={editLevel}
                          onChange={(e) => setEditLevel(e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition bg-white ${profile?.level ? 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-500 appearance-none' : 'border-primary-200 focus:ring-primary-500'}`}
                        >
                          <option value="" disabled>Select Level</option>
                          <option value="100">Level 100</option>
                          <option value="200">Level 200</option>
                          <option value="300">Level 300</option>
                          <option value="Candidate">Candidate</option>
                        </select>
                        {profile?.level && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" title="Contact admin to promote or change level">
                            <i className="fas fa-lock text-xs"></i>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-lg text-slate-800 font-bold border border-slate-100 flex items-center">
                        {profile?.level ? (
                          `Level ${profile.level}`
                        ) : (
                          <span className="text-orange-500"><i className="fas fa-exclamation-triangle mr-2"></i> Needs Update</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Academic Program</label>
                    {isEditing ? (
                      <div className="relative">
                        <select
                          title="Select Academic Program"
                          value={editProgram}
                          onChange={(e) => setEditProgram(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-primary-200 focus:ring-2 focus:ring-primary-500 outline-none transition bg-white"
                        >
                          <option value="" disabled>Select Program</option>
                          <option value="RCN">RCN</option>
                          <option value="RGN">RGN</option>
                          <option value="RMN">RMN</option>
                          <option value="RPHN">RPHN</option>
                        </select>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-lg text-slate-800 font-bold border border-slate-100 flex items-center">
                        {profile?.program || (
                          <span className="text-orange-500"><i className="fas fa-exclamation-triangle mr-2"></i> Needs Update</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-red-100 bg-red-50/20">
                <h3 className="text-lg font-bold mb-4 text-red-600 flex items-center">
                  <i className="fas fa-shield-alt mr-3"></i>
                  Security
                </h3>
                <p className="text-sm text-slate-500 mb-6">Changing your password or email requires re-authentication for security purposes.</p>
                <button
                  onClick={handleLogout}
                  className="bg-white border border-red-200 text-red-600 px-6 py-2 rounded-lg font-bold text-sm hover:bg-red-600 hover:text-white transition"
                >
                  Sign Out of All Devices
                </button>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default Profile;
