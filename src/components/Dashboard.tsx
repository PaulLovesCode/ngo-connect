import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, Timestamp, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Emergency, Volunteer, Task, Urgency } from '../types';
import { analyzeEmergency, ocrImage } from '../lib/gemini';
import { Camera, FileText, MapPin, AlertCircle, CheckCircle, Clock, Send, Upload, Loader2, Calendar as CalendarIcon, X, Zap, TrendingUp, Users, Star } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { ASSETS } from '../constants/assets';
import { Sidebar } from './Sidebar';
import { FeedbackModal } from './FeedbackModal';
import { Profile } from './Profile';
import { Calendar } from './Calendar';
import { Settings } from './Settings';
import { findMatches, findBestMatch, checkBackendHealth, type VolunteerMatch, type MatchResponse } from '../lib/matchmaking';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 1, 0.5, 1]
    }
  }
};

export default function Dashboard({ userProfile }: { userProfile: Volunteer }) {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [isReporting, setIsReporting] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [reportText, setReportText] = useState('');
  const [manualData, setManualData] = useState({
    description: '',
    location: '',
    urgency: 'medium' as Urgency,
    skills: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [smartMatchResults, setSmartMatchResults] = useState<Record<string, VolunteerMatch[]>>({});
  const [loadingMatches, setLoadingMatches] = useState<Record<string, boolean>>({});
  const [showSmartMatch, setShowSmartMatch] = useState<string | null>(null);
  const [allVolunteers, setAllVolunteers] = useState<Volunteer[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'profile' | 'settings'>('dashboard');

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth().then(setBackendOnline);
    const interval = setInterval(() => checkBackendHealth().then(setBackendOnline), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'emergencies'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Emergency));
      setEmergencies(data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
    });

    const tq = query(collection(db, 'tasks'), where('assignedVolunteerUid', '==', userProfile.uid));
    const tUnsubscribe = onSnapshot(tq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setMyTasks(data);
    });

    // Fetch all volunteers for matchmaking
    const vq = query(collection(db, 'volunteers'));
    const vUnsubscribe = onSnapshot(vq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Volunteer));
      setAllVolunteers(data);
    });

    return () => {
      unsubscribe();
      tUnsubscribe();
      vUnsubscribe();
    };
  }, [userProfile.uid]);

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsAnalyzing(true);
    try {
      let emergencyData;

      if (isManualEntry) {
        emergencyData = {
          reporterUid: userProfile.uid,
          reporterName: userProfile.name,
          description: manualData.description,
          location: manualData.location,
          urgency: manualData.urgency,
          status: 'pending' as const,
          requiredSkills: manualData.skills.split(',').map(s => s.trim()).filter(s => s),
          createdAt: Timestamp.now(),
          processedByAi: false
        };
        await addDoc(collection(db, 'emergencies'), emergencyData);
      } else {
        if (!reportText.trim()) return;
        const analysis = await analyzeEmergency(reportText);
        emergencyData = {
          reporterUid: userProfile.uid,
          reporterName: userProfile.name,
          description: analysis.description,
          location: analysis.location,
          urgency: analysis.urgency,
          status: 'pending' as const,
          requiredSkills: analysis.requiredSkills,
          createdAt: Timestamp.now(),
          processedByAi: true
        };
        await addDoc(collection(db, 'emergencies'), emergencyData);
      }
      
      // We don't call autoAssignTask here anymore because it fails for non-admins.
      // Instead, we let volunteers pick up tasks from the feed.

      setReportText('');
      setManualData({ description: '', location: '', urgency: 'medium', skills: '' });
      setIsReporting(false);
      setIsManualEntry(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCompleteTask = async (taskId: string, emergencyId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'completed'
      });
      await updateDoc(doc(db, 'emergencies', emergencyId), {
        status: 'resolved'
      });
    } catch (err) {
      console.error("Complete task failed:", err);
    }
  };

  // Fetch smart match results from the backend
  const fetchSmartMatches = useCallback(async (emergencyId: string, emergency: Emergency) => {
    if (!backendOnline) return;
    
    setLoadingMatches(prev => ({ ...prev, [emergencyId]: true }));
    try {
      // Get active task counts
      const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('status', 'in', ['open', 'in-progress'])));
      const taskCounts: Record<string, number> = {};
      tasksSnap.docs.forEach(d => {
        const uid = d.data().assignedVolunteerUid;
        taskCounts[uid] = (taskCounts[uid] || 0) + 1;
      });

      const response = await findMatches(
        { id: emergencyId, requiredSkills: emergency.requiredSkills || [], urgency: emergency.urgency },
        allVolunteers.map(v => ({ uid: v.uid, name: v.name, email: v.email, skills: v.skills, yearsVolunteering: v.yearsVolunteering })),
        taskCounts,
        { limit: 5, qualifiedOnly: true }
      );

      setSmartMatchResults(prev => ({ ...prev, [emergencyId]: response.matches }));
    } catch (err) {
      console.error('Smart match failed:', err);
    } finally {
      setLoadingMatches(prev => ({ ...prev, [emergencyId]: false }));
    }
  }, [backendOnline, allVolunteers]);

  // Backend-driven auto-assign: finds the best volunteer via the backend scoring engine
  const autoAssignTask = async (emergencyId: string, requiredSkills: string[]) => {
    try {
      if (backendOnline && allVolunteers.length > 0) {
        // Get active task counts
        const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('status', 'in', ['open', 'in-progress'])));
        const taskCounts: Record<string, number> = {};
        tasksSnap.docs.forEach(d => {
          const uid = d.data().assignedVolunteerUid;
          taskCounts[uid] = (taskCounts[uid] || 0) + 1;
        });

        const emergency = emergencies.find(e => e.id === emergencyId);
        if (!emergency) return;

        const response = await findBestMatch(
          { requiredSkills, urgency: emergency.urgency },
          allVolunteers.map(v => ({ uid: v.uid, name: v.name, email: v.email, skills: v.skills, yearsVolunteering: v.yearsVolunteering })),
          taskCounts
        );

        if (response.match) {
          await addDoc(collection(db, 'tasks'), {
            emergencyId,
            assignedVolunteerUid: response.match.volunteerId,
            status: 'open',
            createdAt: Timestamp.now(),
            matchScore: response.match.totalScore,
          });

          await updateDoc(doc(db, 'emergencies', emergencyId), {
            status: 'assigned',
            assignedVolunteerUid: response.match.volunteerId,
          });
        }
      } else {
        // Fallback: basic client-side matching when backend is offline
        const volunteersSnap = await getDocs(collection(db, 'volunteers'));
        const volunteers = volunteersSnap.docs.map(doc => doc.data() as Volunteer);
        const matches = volunteers.filter(v => 
          v.skills.some(skill => 
            requiredSkills.some(reqSkill => skill.toLowerCase().includes(reqSkill.toLowerCase()))
          )
        );
        if (matches.length > 0) {
          const assigned = matches[0];
          await addDoc(collection(db, 'tasks'), {
            emergencyId,
            assignedVolunteerUid: assigned.uid,
            status: 'open',
            createdAt: Timestamp.now()
          });
          await updateDoc(doc(db, 'emergencies', emergencyId), {
            status: 'assigned',
            assignedVolunteerUid: assigned.uid
          });
        }
      }
    } catch (err) {
      console.error("Auto-assign failed:", err);
    }
  };

  const handlePickUpTask = async (emergencyId: string) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        emergencyId,
        assignedVolunteerUid: userProfile.uid,
        status: 'open',
        createdAt: Timestamp.now()
      });

      await updateDoc(doc(db, 'emergencies', emergencyId), {
        status: 'assigned',
        assignedVolunteerUid: userProfile.uid
      });
    } catch (err) {
      console.error("Pick up task failed:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const text = await ocrImage(base64, file.type);
        setReportText(text);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
    } finally {
      setOcrLoading(false);
    }
  };

  const getUrgencyColor = (urgency: Urgency) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const activeEmergencies = emergencies.filter(e => e.status === 'pending');
  const resolvedAssignedEmergencies = emergencies.filter(e => e.status !== 'pending');

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="relative z-10">
      <Sidebar 
        userProfile={userProfile}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        onFeedbackClick={() => setShowFeedback(true)}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <div className={cn(
        "transition-all duration-300 min-h-screen flex flex-col",
        isCollapsed ? "pl-20" : "pl-64"
      )}>
        {/* Header */}
        <header className="h-16 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-20 px-8 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 capitalize">
            {currentView}
          </h1>
          <div className="flex items-center space-x-2">
              <span className={cn(
                "flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                backendOnline 
                  ? "bg-emerald-50 text-emerald-600" 
                  : "bg-amber-50 text-amber-600"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", backendOnline ? "bg-emerald-500" : "bg-amber-500")} />
                {backendOnline ? 'Engine Online' : 'Engine Offline'}
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wider">
                {userProfile.role}
              </span>
          </div>
        </header>

        <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
          {currentView === 'profile' ? (
            <Profile 
              userProfile={userProfile} 
              emergencies={emergencies} 
              tasks={myTasks} 
            />
          ) : currentView === 'settings' ? (
            <Settings />
          ) : (
            <>
              {/* Hero Section */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="mb-10 bg-gradient-to-br from-emerald-600 to-green-700 rounded-[32px] p-8 md:p-12 text-white shadow-xl shadow-emerald-900/10 relative overflow-hidden"
              >
                {/* Floating Decorative Shapes */}
                <motion.div 
                  animate={{ 
                    y: [0, -20, 0],
                    rotate: [0, 10, 0]
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-10 left-10 w-32 h-32 bg-white/5 rounded-3xl blur-xl"
                />
                <motion.div 
                  animate={{ 
                    y: [0, 20, 0],
                    rotate: [0, -10, 0]
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute bottom-10 right-1/2 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl"
                />

                <div className="relative z-10 max-w-2xl">
                  <motion.h2 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    className="text-3xl md:text-4xl font-bold mb-4 tracking-tight"
                  >
                    Ready to help, {userProfile.name.split(' ')[0]}?
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="text-emerald-50 text-base md:text-lg mb-8 leading-relaxed opacity-90"
                  >
                    Your contribution makes a difference. Track past emergencies and plan your volunteer activities through our archive.
                  </motion.p>
                  <motion.button 
                    whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCalendar(true)}
                    className="inline-flex items-center px-6 py-3.5 bg-white text-emerald-700 rounded-full font-bold text-sm transition-all shadow-lg group"
                  >
                    <CalendarIcon className="mr-2 group-hover:rotate-12 transition-transform" size={20} />
                    Open Emergency Archive
                  </motion.button>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-400/20 rounded-full translate-y-1/4 translate-x-1/4 blur-2xl"></div>
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-72 h-72"
                >
                  <img 
                    src={ASSETS.communitySupport} 
                    alt="Volunteers"
                    className="w-full h-full object-contain mix-blend-screen brightness-110 contrast-125"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Reporting & My Tasks */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-8">
              {/* Report Section */}
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <AlertCircle className="mr-2 text-emerald-600" size={20} />
                Report Emergency
              </h2>
              
              {!isReporting ? (
                <div className="space-y-3">
                  <button 
                    onClick={() => { setIsReporting(true); setIsManualEntry(false); }}
                    className="w-full py-3 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center shadow-sm"
                  >
                    <Send className="mr-2" size={18} />
                    AI Report (Text/OCR)
                  </button>
                  <button 
                    onClick={() => { setIsReporting(true); setIsManualEntry(true); }}
                    className="w-full py-3 px-4 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-medium hover:bg-emerald-50 transition-colors flex items-center justify-center"
                  >
                    <FileText className="mr-2" size={18} />
                    Manual Entry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReport} className="space-y-4">
                  {isManualEntry ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Location"
                        value={manualData.location}
                        onChange={e => setManualData({...manualData, location: e.target.value})}
                        className="w-full p-2 border border-gray-300 bg-white rounded-lg text-sm"
                        required
                      />
                      <textarea
                        placeholder="Description of emergency..."
                        value={manualData.description}
                        onChange={e => setManualData({...manualData, description: e.target.value})}
                        className="w-full h-24 p-2 border border-gray-300 bg-white rounded-lg text-sm resize-none"
                        required
                      />
                      <select
                        value={manualData.urgency}
                        onChange={e => setManualData({...manualData, urgency: e.target.value as Urgency})}
                        className="w-full p-2 border border-gray-300 bg-white rounded-lg text-sm"
                      >
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                        <option value="critical">Critical Priority</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Required Skills (e.g. Medicine, Food)"
                        value={manualData.skills}
                        onChange={e => setManualData({...manualData, skills: e.target.value})}
                        className="w-full p-2 border border-gray-300 bg-white rounded-lg text-sm"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <textarea
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="Describe the emergency, location, and needs..."
                        className="w-full h-32 p-3 border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm"
                      />
                      <div className="absolute bottom-3 right-3 flex space-x-2">
                        <label className="cursor-pointer p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                          <Upload size={18} />
                          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {!isManualEntry && ocrLoading && (
                    <div className="flex items-center text-xs text-emerald-600 animate-pulse">
                      <Loader2 className="animate-spin mr-1" size={14} />
                      Extracting text from image...
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={isAnalyzing || (!isManualEntry && !reportText.trim())}
                      className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center shadow-sm"
                    >
                      {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : 'Submit Report'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setIsReporting(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center justify-center"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </form>
              )}
            </section>

            {/* My Tasks Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <CheckCircle className="mr-2 text-emerald-600" size={20} />
                My Assignments
              </h2>
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                {myTasks.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No tasks assigned to you yet.</p>
                ) : (
                  myTasks.map((task) => {
                    const emergency = emergencies.find(e => e.id === task.emergencyId);
                    return (
                      <motion.div 
                        key={task.id}
                        variants={itemVariants}
                        layout
                        className="p-4 border border-gray-100 rounded-xl bg-white shadow-sm hover:border-emerald-100 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            task.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                          )}>
                            {task.status}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {format(task.createdAt.toDate(), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {emergency?.description || 'Loading emergency details...'}
                        </p>
                        <div className="mt-2 flex items-center text-xs text-gray-500">
                          <MapPin size={12} className="mr-1" />
                          {emergency?.location}
                        </div>
                        {task.status !== 'completed' && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleCompleteTask(task.id, task.emergencyId)}
                            className="mt-3 w-full py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200"
                          >
                            Mark as Resolved
                          </motion.button>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            </section>
            </div>
          </div>

          {/* Right Column: Global Emergency Feed */}
          <div className="lg:col-span-2 space-y-8">
            {/* Available Emergencies */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/30">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="text-emerald-600" size={20} />
                  <h2 className="text-lg font-bold text-gray-900">Available Emergencies</h2>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                  {activeEmergencies.length} New
                </span>
              </div>
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-gray-100"
              >
                {activeEmergencies.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle className="mx-auto text-emerald-400 mb-3" size={40} />
                    <p className="text-gray-500 font-medium">All clear! No pending emergencies.</p>
                  </div>
                ) : (
                  activeEmergencies.map((emergency) => (
                    <motion.div 
                      key={emergency.id}
                      variants={itemVariants}
                      layout
                      className="p-6 hover:bg-emerald-50/10 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center space-x-3">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border shadow-sm",
                            getUrgencyColor(emergency.urgency)
                          )}>
                            {emergency.urgency.toUpperCase()}
                          </span>
                          {emergency.requiredSkills?.some(skill => 
                            userProfile.skills.some(uSkill => uSkill.toLowerCase().includes(skill.toLowerCase()))
                          ) && (
                            <motion.span 
                              animate={{ 
                                scale: [1, 1.05, 1],
                                opacity: [0.8, 1, 0.8]
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold border border-indigo-100"
                            >
                              MATCHES YOUR SKILLS
                            </motion.span>
                          )}
                          <span className="text-xs text-gray-500 font-medium">
                            Reported by {emergency.reporterName}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {format(emergency.createdAt.toDate(), 'MMM d, yyyy • h:mm a')}
                        </span>
                      </div>
                      
                      <h3 className="text-base font-bold text-gray-900 mb-2">
                        {emergency.description}
                      </h3>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center">
                          <MapPin size={16} className="mr-1.5 text-emerald-500" />
                          <span className="font-medium">{emergency.location}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock size={16} className="mr-1.5 text-gray-400" />
                          Status: <span className="ml-1 font-bold text-emerald-600 capitalize">{emergency.status}</span>
                        </div>
                      </div>

                      {emergency.requiredSkills && emergency.requiredSkills.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2 items-center justify-between">
                            <div className="flex flex-wrap gap-2">
                              {emergency.requiredSkills.map(skill => (
                                <span key={skill} className="px-2.5 py-1 bg-white border border-emerald-100 text-emerald-600 rounded-lg text-[10px] font-bold uppercase tracking-tight shadow-sm">
                                  {skill}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center space-x-2">
                              {backendOnline && userProfile.role === 'admin' && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    if (showSmartMatch === emergency.id) {
                                      setShowSmartMatch(null);
                                    } else {
                                      setShowSmartMatch(emergency.id);
                                      fetchSmartMatches(emergency.id, emergency);
                                    }
                                  }}
                                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md flex items-center"
                                >
                                  <Zap size={14} className="mr-1.5" />
                                  Smart Match
                                </motion.button>
                              )}
                              <motion.button
                                whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handlePickUpTask(emergency.id)}
                                className="px-6 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-md"
                              >
                                Pick Up Task
                              </motion.button>
                            </div>
                          </div>

                          {/* Smart Match Results Panel */}
                          <AnimatePresence>
                            {showSmartMatch === emergency.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-bold text-indigo-900 flex items-center">
                                      <TrendingUp size={16} className="mr-2 text-indigo-600" />
                                      Backend Match Rankings
                                    </h4>
                                    <button onClick={() => setShowSmartMatch(null)} className="text-indigo-400 hover:text-indigo-700">
                                      <X size={16} />
                                    </button>
                                  </div>
                                  
                                  {loadingMatches[emergency.id] ? (
                                    <div className="flex items-center justify-center py-6">
                                      <Loader2 className="animate-spin text-indigo-500 mr-2" size={20} />
                                      <span className="text-sm text-indigo-600 font-medium">Computing matches...</span>
                                    </div>
                                  ) : smartMatchResults[emergency.id]?.length === 0 ? (
                                    <p className="text-sm text-indigo-500 text-center py-4">No qualified volunteers found.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {smartMatchResults[emergency.id]?.map((match, idx) => (
                                        <motion.div
                                          key={match.volunteerId}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: idx * 0.1 }}
                                          className="flex items-center justify-between p-3 bg-white rounded-xl border border-indigo-50 shadow-sm"
                                        >
                                          <div className="flex items-center space-x-3">
                                            <div className={cn(
                                              "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black",
                                              idx === 0 ? "bg-amber-100 text-amber-700" :
                                              idx === 1 ? "bg-gray-100 text-gray-700" :
                                              idx === 2 ? "bg-orange-100 text-orange-700" :
                                              "bg-indigo-50 text-indigo-600"
                                            )}>
                                              #{match.rank}
                                            </div>
                                            <div>
                                              <p className="text-sm font-bold text-gray-900">{match.volunteerName}</p>
                                              <p className="text-[10px] text-gray-500">
                                                Skills: {match.breakdown.skill.matchedSkills.map(s => s.volunteerSkill).join(', ') || 'None'}
                                                {match.breakdown.skill.matchedSkills.length > 0 && (
                                                  <span className="ml-1 text-emerald-600">({match.breakdown.skill.coverage}% coverage)</span>
                                                )}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-3">
                                            <div className="text-right">
                                              <p className="text-lg font-black text-indigo-700">{match.totalScore}</p>
                                              <p className="text-[10px] text-gray-400">/ 100 pts</p>
                                            </div>
                                            {userProfile.role === 'admin' && (
                                              <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={async () => {
                                                  await addDoc(collection(db, 'tasks'), {
                                                    emergencyId: emergency.id,
                                                    assignedVolunteerUid: match.volunteerId,
                                                    status: 'open',
                                                    createdAt: Timestamp.now(),
                                                    matchScore: match.totalScore,
                                                  });
                                                  await updateDoc(doc(db, 'emergencies', emergency.id), {
                                                    status: 'assigned',
                                                    assignedVolunteerUid: match.volunteerId,
                                                  });
                                                  setShowSmartMatch(null);
                                                }}
                                                className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                              >
                                                Assign
                                              </motion.button>
                                            )}
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </motion.div>
            </section>

            {/* Assigned & Resolved Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Clock size={20} />
                  <h2 className="text-lg font-bold">Assigned & Resolved</h2>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-gray-600 rounded-full text-xs font-medium">
                  {resolvedAssignedEmergencies.length} Total
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {resolvedAssignedEmergencies.length === 0 ? (
                  <p className="p-8 text-center text-gray-500 text-sm italic">No history yet.</p>
                ) : (
                  resolvedAssignedEmergencies.map(emergency => (
                    <div key={emergency.id} className="p-6 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border uppercase",
                            emergency.status === 'resolved' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            {emergency.status}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {format(emergency.createdAt.toDate(), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {emergency.urgency.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-gray-700 line-clamp-1">{emergency.description}</h4>
                      <p className="text-[10px] text-gray-400 mt-1 flex items-center">
                        <MapPin size={10} className="mr-1" /> {emergency.location}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </>
    )}
  </main>

      {/* Calendar Modal */}
      <AnimatePresence>
        {showCalendar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCalendar(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="absolute top-6 right-6 z-20">
                <button 
                  onClick={() => setShowCalendar(false)}
                  className="p-2 bg-white/80 backdrop-blur rounded-full text-gray-500 hover:text-gray-900 shadow-sm transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="max-h-[90vh] overflow-y-auto">
                <Calendar emergencies={emergencies} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedback && (
          <FeedbackModal 
            isOpen={showFeedback}
            onClose={() => setShowFeedback(false)}
            userProfile={userProfile}
          />
        )}
      </AnimatePresence>
      </div>
      </div>
    </div>
  );
}
