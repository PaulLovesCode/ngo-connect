import React, { useState, useMemo, useRef } from 'react';
import { User, MapPin, Phone, Calendar, Award, Save, Edit2, UserCircle, Camera, Loader2, ChevronDown } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Volunteer, Emergency, Task } from '../types';
import { cn } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface ProfileProps {
  userProfile: Volunteer;
  emergencies: Emergency[];
  tasks: Task[];
}

export function Profile({ userProfile, emergencies, tasks }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: userProfile.name,
    gender: userProfile.gender || 'prefer_not_to_say',
    age: userProfile.age || 0,
    address: userProfile.address || '',
    yearsVolunteering: userProfile.yearsVolunteering || 0,
    photoURL: userProfile.photoURL || '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const [countryCode, setCountryCode] = useState(() => {
    if (userProfile.mobile?.startsWith('+')) {
      const match = userProfile.mobile.match(/^\+\d+/);
      return match ? match[0] : '+91';
    }
    return '+91';
  });

  const [mobileNumber, setMobileNumber] = useState(() => {
    if (userProfile.mobile?.startsWith('+')) {
      return userProfile.mobile.replace(/^\+\d+/, '');
    }
    return userProfile.mobile || '';
  });

  const [mobileError, setMobileError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 200KB to stay well within Firestore 1MB limit
    if (file.size > 200 * 1024) {
      setPhotoError('Image must be smaller than 200KB');
      return;
    }

    setPhotoError('');
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, photoURL: base64 }));
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Photo upload failed:", err);
      setPhotoError('Failed to process image');
      setUploading(false);
    }
  };

  const countryCodes = [
    { code: '+91', country: 'India' },
    { code: '+1', country: 'USA' },
    { code: '+44', country: 'UK' },
    { code: '+61', country: 'Australia' },
    { code: '+81', country: 'Japan' },
    { code: '+49', country: 'Germany' },
    { code: '+33', country: 'France' },
    { code: '+86', country: 'China' },
    { code: '+7', country: 'Russia' },
    { code: '+55', country: 'Brazil' },
  ];

  const handleSave = async () => {
    if (mobileNumber.length > 0 && mobileNumber.length !== 10) {
      setMobileError('Mobile number must be exactly 10 digits');
      return;
    }
    setMobileError('');
    setIsSaving(true);
    try {
      const updatedData = {
        ...formData,
        mobile: mobileNumber ? `${countryCode}${mobileNumber}` : '',
      };
      await updateDoc(doc(db, 'volunteers', userProfile.uid), updatedData);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const solvedStats = useMemo(() => {
    const solvedTasks = tasks.filter(t => t.status === 'completed');
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    solvedTasks.forEach(task => {
      const emergency = emergencies.find(e => e.id === task.emergencyId);
      if (emergency) {
        stats[emergency.urgency]++;
      }
    });

    return [
      { name: 'Critical', value: stats.critical, color: '#ef4444' },
      { name: 'High', value: stats.high, color: '#f97316' },
      { name: 'Medium', value: stats.medium, color: '#eab308' },
      { name: 'Low', value: stats.low, color: '#3b82f6' },
    ];
  }, [tasks, emergencies]);

  const totalSolved = solvedStats.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Volunteer Profile</h1>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={isSaving}
          className={cn(
            "flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg",
            isEditing 
              ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20" 
              : "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50"
          )}
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isEditing ? (
            <><Save size={18} /><span>Save Changes</span></>
          ) : (
            <><Edit2 size={18} /><span>Edit Profile</span></>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="relative inline-block mb-6 group">
              <img 
                src={formData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name}`} 
                alt={formData.name}
                className="w-32 h-32 rounded-3xl bg-emerald-100 border-4 border-white shadow-xl object-cover"
              />
              {isEditing && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 rounded-3xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {uploading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <>
                      <Camera size={24} className="mb-1" />
                      <span className="text-[10px] font-bold uppercase">Change</span>
                    </>
                  )}
                </button>
              )}
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-2 rounded-xl shadow-lg">
                <Award size={20} />
              </div>
            </div>
            {photoError && <p className="text-[10px] text-red-500 font-bold mb-4">{photoError}</p>}
            {isEditing ? (
              <input 
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-center text-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
              />
            ) : (
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{formData.name}</h2>
            )}
            <p className="text-sm text-emerald-600 font-bold uppercase tracking-widest mb-6">{userProfile.role}</p>
            
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{formData.yearsVolunteering}</p>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Years Active</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{totalSolved}</p>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Solved Cases</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <UserCircle className="mr-2 text-emerald-600" size={20} />
                Personal Details
              </h3>
              {!isEditing && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-emerald-600 transition-colors"
                  title="Edit Details"
                >
                  <Edit2 size={16} />
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center text-gray-600">
                <User size={18} className="mr-3 text-emerald-600/50" />
                <div className="flex-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Gender</p>
                  {isEditing ? (
                    <select 
                      value={formData.gender}
                      onChange={e => setFormData({...formData, gender: e.target.value as any})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  ) : (
                    <p className="text-sm font-medium text-gray-900 capitalize">{formData.gender.replace('_', ' ')}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center text-gray-600">
                <Calendar size={18} className="mr-3 text-emerald-600/50" />
                <div className="flex-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Age</p>
                  {isEditing ? (
                    <input 
                      type="number"
                      value={formData.age}
                      onChange={e => setFormData({...formData, age: parseInt(e.target.value) || 0})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formData.age} Years</p>
                  )}
                </div>
              </div>

              <div className="flex items-start text-gray-600">
                <Phone size={18} className="mr-3 mt-1 text-emerald-600/50" />
                <div className="flex-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Mobile</p>
                  {isEditing ? (
                    <div className="space-y-1">
                      <div className="flex space-x-2">
                        <div className="relative group/select">
                          <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1 text-sm text-gray-900 flex items-center justify-between min-w-[70px] h-full group-focus-within/select:ring-2 group-focus-within/select:ring-emerald-500 transition-all">
                            <span className="font-medium">{countryCode}</span>
                            <ChevronDown size={14} className="ml-1 text-gray-400" />
                          </div>
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          >
                            {countryCodes.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} ({c.country})
                              </option>
                            ))}
                          </select>
                        </div>
                        <input 
                          type="text"
                          value={mobileNumber}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (val.length <= 10) {
                              setMobileNumber(val);
                              setMobileError('');
                            } else {
                              setMobileError('Mobile number cannot exceed 10 digits');
                            }
                          }}
                          placeholder="10-digit number"
                          className={cn(
                            "flex-1 bg-gray-50 border rounded-lg px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500",
                            mobileError ? "border-red-500" : "border-gray-100"
                          )}
                        />
                      </div>
                      {mobileError && (
                        <p className="text-[10px] text-red-500 font-bold">{mobileError}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-gray-900">
                      {userProfile.mobile || 'Not provided'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center text-gray-600">
                <MapPin size={18} className="mr-3 text-emerald-600/50" />
                <div className="flex-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Address</p>
                  {isEditing ? (
                    <textarea 
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{formData.address || 'Not provided'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center text-gray-600">
                <Award size={18} className="mr-3 text-emerald-600/50" />
                <div className="flex-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Years Volunteering</p>
                  <p className="text-sm font-medium text-gray-900">{formData.yearsVolunteering} Years</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Column */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center">
              <Award className="mr-3 text-emerald-600" size={24} />
              Performance Analysis
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-[300px]">
                <p className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-widest text-center">Emergencies by Urgency</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={solvedStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#666', fontSize: 12 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#666', fontSize: 12 }} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#00000005' }}
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: 'none', 
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {solvedStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-[300px] flex flex-col items-center justify-center">
                <p className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-widest text-center">Distribution</p>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={solvedStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {solvedStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: 'none', 
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4">
                  {solvedStats.map((stat) => (
                    <div key={stat.name} className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                      <span className="text-xs font-medium text-gray-600">{stat.name}: {stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-emerald-600/20">
            <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2">Volunteer Impact</h3>
              <p className="text-emerald-50 opacity-90 max-w-md">
                Your dedication has directly helped {totalSolved} families in need. Every emergency you solve makes our community safer and stronger.
              </p>
            </div>
            <Award className="absolute -right-8 -bottom-8 text-white/10 w-48 h-48 rotate-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
