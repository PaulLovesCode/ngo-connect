import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, Timestamp, doc, getDocs, updateDoc, orderBy, limit } from 'firebase/firestore';
import { Emergency, Volunteer, Task, Urgency } from '../types';
import { analyzeEmergency, ocrImage, generateDetailedNarrative, type EmergencyAnalysis } from '../lib/gemini';
import { Camera, FileText, MapPin, AlertCircle, CheckCircle, Clock, Send, Upload, Loader2, Calendar as CalendarIcon, X, Zap, TrendingUp, Users, Star, ChevronLeft, ChevronRight, MessageSquare, Eye, ExternalLink, CreditCard, Building2, BookOpen, HandHeart } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { ASSETS } from '../constants/assets';
import { Sidebar } from './Sidebar';
import { FeedbackModal } from './FeedbackModal';
import { Profile } from './Profile';
import { Calendar } from './Calendar';
import { Settings } from './Settings';
import { CommunityChat } from './CommunityChat';
import { LocationMapModal, LocationInputMap } from './LocationMap';
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

const formatLocation = (location: string) => {
  if (!location) return '';
  const parts = location.split(',').map(p => p.trim());
  if (parts.length <= 3) return location;
  return parts.slice(-3).join(', ');
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
  const [reportText, setReportText] = useState('');
  const [manualData, setManualData] = useState({
    description: '',
    location: '',
    urgency: 'medium' as Urgency,
    skills: '',
    donationUpiLink: '',
    donationQrCodeUrl: '',
    bankName: '',
    ifscCode: '',
    accountNumber: '',
    accountHolderName: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<EmergencyAnalysis | null>(null);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [showAiVerificationModal, setShowAiVerificationModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAssignments, setShowAssignments] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [smartMatchResults, setSmartMatchResults] = useState<Record<string, VolunteerMatch[]>>({});
  const [loadingMatches, setLoadingMatches] = useState<Record<string, boolean>>({});
  const [showSmartMatch, setShowSmartMatch] = useState<string | null>(null);
  const [allVolunteers, setAllVolunteers] = useState<Volunteer[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'profile' | 'settings'>('dashboard');
  const [activeTab, setActiveTab] = useState<'available' | 'resolved'>('available');
  const [availablePage, setAvailablePage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mapModalLocation, setMapModalLocation] = useState<string | null>(null);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [narrativeCache, setNarrativeCache] = useState<Record<string, string>>({});
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const lastSeenRef = React.useRef<Date>(new Date());

  // Track unread community chat messages
  useEffect(() => {
    const q = query(
      collection(db, 'communityChat'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (showChat) {
        setUnreadCount(0);
        return;
      }
      const newMessages = snapshot.docs.filter(doc => {
        const data = doc.data();
        if (!data.createdAt) return false;
        const msgDate = data.createdAt.toDate();
        return msgDate > lastSeenRef.current && data.senderUid !== userProfile.uid;
      });
      setUnreadCount(newMessages.length);
    });

    return () => unsubscribe();
  }, [showChat, userProfile.uid]);

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

      if (!reportText.trim()) return;
      const analysis = aiAnalysisResult || await analyzeEmergency(reportText);
      emergencyData = {
        reporterUid: userProfile.uid,
        reporterName: userProfile.name,
        description: analysis.description || reportText,
        location: analysis.location,
        urgency: analysis.urgency,
        status: 'pending' as const,
        requiredSkills: analysis.requiredSkills,
        createdAt: Timestamp.now(),
        processedByAi: true
      };
      await addDoc(collection(db, 'emergencies'), emergencyData);

      // We don't call autoAssignTask here anymore because it fails for non-admins.
      // Instead, we let volunteers pick up tasks from the feed.

      setReportText('');
      setAiAnalysisResult(null);
      setAiAnalysisError(null);
      setManualData({ description: '', location: '', urgency: 'medium', skills: '', donationUpiLink: '', donationQrCodeUrl: '', bankName: '', ifscCode: '', accountNumber: '', accountHolderName: '' });
      setIsReporting(false);
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

  // Open emergency detail modal and generate narrative if needed
  const openEmergencyDetail = async (emergency: Emergency) => {
    setSelectedEmergency(emergency);

    // Check if we already have a narrative cached or stored
    if (narrativeCache[emergency.id] || emergency.detailedNarrative) {
      return;
    }

    // If description is short (< 100 chars), generate a detailed AI narrative
    if (emergency.description.length < 100) {
      setNarrativeLoading(true);
      try {
        const narrative = await generateDetailedNarrative(
          emergency.description,
          emergency.location,
          emergency.urgency,
          emergency.requiredSkills || []
        );
        setNarrativeCache(prev => ({ ...prev, [emergency.id]: narrative }));
        // Also save it to Firestore for caching
        try {
          await updateDoc(doc(db, 'emergencies', emergency.id), { detailedNarrative: narrative });
        } catch (_) { /* non-critical */ }
      } catch (err) {
        console.error('Narrative generation failed:', err);
        setNarrativeCache(prev => ({ ...prev, [emergency.id]: emergency.description }));
      } finally {
        setNarrativeLoading(false);
      }
    } else {
      // Description is already detailed enough, use it directly
      setNarrativeCache(prev => ({ ...prev, [emergency.id]: emergency.description }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setAiAnalysisResult(null);
    setAiAnalysisError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const text = await ocrImage(base64, file.type);
          setReportText(text);
          const analysis = await analyzeEmergency(text);
          setAiAnalysisResult(analysis);
          setShowAiVerificationModal(true);
        } catch (err) {
          console.error(err);
          setAiAnalysisError("AI analysis failed. Please verify details manually.");
        } finally {
          setOcrLoading(false);
        }
      };
      reader.onerror = () => {
        setAiAnalysisError("Failed to read image file.");
        setOcrLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setAiAnalysisError("An unexpected error occurred.");
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

  const AVAILABLE_ITEMS_PER_PAGE = 2;
  const RESOLVED_ITEMS_PER_PAGE = 6;
  const paginatedAvailable = activeEmergencies.slice((availablePage - 1) * AVAILABLE_ITEMS_PER_PAGE, availablePage * AVAILABLE_ITEMS_PER_PAGE);
  const totalAvailablePages = Math.ceil(activeEmergencies.length / AVAILABLE_ITEMS_PER_PAGE);

  const paginatedResolved = resolvedAssignedEmergencies.slice((resolvedPage - 1) * RESOLVED_ITEMS_PER_PAGE, resolvedPage * RESOLVED_ITEMS_PER_PAGE);
  const totalResolvedPages = Math.ceil(resolvedAssignedEmergencies.length / RESOLVED_ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="relative z-10">
        <Sidebar
          userProfile={userProfile}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          onFeedbackClick={() => setShowFeedback(true)}
          onArchiveClick={() => setShowCalendar(true)}
          currentView={currentView}
          onViewChange={setCurrentView}
          onAssignmentsClick={() => setShowAssignments(true)}
        />

        <div className={cn(
          "transition-all duration-300 min-h-screen flex flex-col",
          isCollapsed ? "pl-[72px]" : "pl-[240px]"
        )}>
          {/* Header */}
          <header className="h-14 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-20 px-6 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 capitalize">
              {currentView}
            </h1>
            <div className="flex items-center space-x-3">
              {/* Community Chat Button */}
              <button
                onClick={() => { setShowChat(true); setUnreadCount(0); lastSeenRef.current = new Date(); }}
                className="relative p-2 rounded-xl hover:bg-emerald-50 transition-colors text-gray-500 hover:text-emerald-600"
                title="Community Chat"
              >
                <MessageSquare size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 99 ? '+99' : unreadCount}
                  </span>
                )}
              </button>
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

          <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Left Column: Reporting & My Tasks */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-20 space-y-6">
                      {/* Report Section */}
                      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                          <AlertCircle className="mr-2 text-emerald-600" size={18} />
                          Report Emergency
                        </h2>

                        {!isReporting ? (
                          <div className="space-y-3">
                            <button
                              onClick={() => { setIsReporting(true); setAiAnalysisResult(null); setAiAnalysisError(null); setReportText(''); }}
                              className="w-full py-2.5 px-4 bg-emerald-600 text-white text-sm rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center shadow-sm"
                            >
                              <Send className="mr-2" size={16} />
                              AI Report (Text/OCR)
                            </button>
                            <button
                              onClick={() => {
                                setShowManualEntryModal(true);
                                setManualData({ description: '', location: '', urgency: 'medium', skills: '' });
                              }}
                              className="w-full py-2.5 px-4 bg-white text-emerald-600 text-sm border border-emerald-200 rounded-xl font-medium hover:bg-emerald-50 transition-colors flex items-center justify-center"
                            >
                              <FileText className="mr-2" size={16} />
                              Manual Entry
                            </button>
                          </div>
                        ) : (
                          <form onSubmit={handleReport} className="space-y-4">
                            <div className="space-y-3">
                              <div className="relative">
                                <textarea
                                  value={reportText}
                                  onChange={(e) => {
                                    setReportText(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                  }}
                                  placeholder="Describe the emergency, location, and needs..."
                                  className="w-full min-h-[128px] p-3 border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm overflow-hidden"
                                  style={{ resize: 'none' }}
                                />
                                <div className="absolute bottom-3 right-3 flex space-x-2">
                                  <label className="cursor-pointer p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors shadow-sm">
                                    <Upload size={18} />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                  </label>
                                </div>
                              </div>

                              {ocrLoading && (
                                <div className="flex items-center text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100 shadow-sm animate-pulse">
                                  <Loader2 className="animate-spin mr-2" size={16} />
                                  <span className="font-medium">AI is analyzing image and extracting details...</span>
                                </div>
                              )}

                              {aiAnalysisError && (
                                <div className="flex items-center text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-100 shadow-sm">
                                  <AlertCircle className="mr-2" size={16} />
                                  <span className="font-medium">{aiAnalysisError}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex space-x-2">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={isAnalyzing || !reportText.trim()}
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
                    </div>
                  </div>

                  {/* Right Column: Global Emergency Feed */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Available Emergencies */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
                        <div className="flex bg-gray-100/80 p-1 rounded-xl">
                          <button
                            onClick={() => setActiveTab('available')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                              activeTab === 'available' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                          >
                            Available
                          </button>
                          <button
                            onClick={() => setActiveTab('resolved')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                              activeTab === 'resolved' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                          >
                            Resolved
                          </button>
                        </div>
                        {activeTab === 'available' ? (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                            {activeEmergencies.length} New
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                            {resolvedAssignedEmergencies.length} Total
                          </span>
                        )}
                      </div>
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="divide-y divide-gray-100"
                      >
                        {activeTab === 'available' ? (
                          paginatedAvailable.length === 0 ? (
                            <div className="p-12 text-center">
                              <CheckCircle className="mx-auto text-emerald-400 mb-3" size={40} />
                              <p className="text-gray-500 font-medium">All clear! No pending emergencies.</p>
                            </div>
                          ) : (
                            paginatedAvailable.map((emergency) => (
                              <motion.div
                                key={emergency.id}
                                variants={itemVariants}
                                layout
                                className="p-5 hover:bg-emerald-50/30 transition-colors cursor-pointer group/card"
                                onClick={() => openEmergencyDetail(emergency)}
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

                                <h3 className="text-sm font-bold text-gray-900 mb-2">
                                  {emergency.description}
                                </h3>

                                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setMapModalLocation(emergency.location); }}
                                      className="flex items-center hover:bg-emerald-50 px-2 py-1 -ml-2 rounded-lg transition-colors group/map cursor-pointer max-w-[250px] sm:max-w-xs md:max-w-sm"
                                      title={emergency.location}
                                    >
                                      <MapPin size={16} className="mr-1.5 text-emerald-500 flex-shrink-0 group-hover/map:scale-110 transition-transform" />
                                      <span className="font-medium group-hover/map:text-emerald-700 transition-colors truncate">{formatLocation(emergency.location)}</span>
                                      <span className="ml-1.5 text-[10px] text-emerald-500 opacity-0 group-hover/map:opacity-100 transition-opacity font-bold flex-shrink-0">MAP ↗</span>
                                    </button>
                                  <div className="flex items-center">
                                    <Clock size={16} className="mr-1.5 text-gray-400" />
                                    Status: <span className="ml-1 font-bold text-emerald-600 capitalize">{emergency.status}</span>
                                  </div>
                                  {(emergency.donationUpiLink || emergency.bankName) && (
                                    <span className="flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold border border-amber-200">
                                      <HandHeart size={12} className="mr-1" />
                                      DONATIONS OPEN
                                    </span>
                                  )}
                                </div>
                                {/* View Details hint */}
                                <div className="flex items-center text-[10px] text-gray-400 group-hover/card:text-emerald-600 transition-colors mt-1 mb-3">
                                  <Eye size={12} className="mr-1" />
                                  Click to view full details
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
                                            onClick={(e) => {
                                              e.stopPropagation();
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
                                          onClick={(e) => { e.stopPropagation(); handlePickUpTask(emergency.id); }}
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
                          )
                        ) : (
                          paginatedResolved.length === 0 ? (
                            <div className="p-12 text-center">
                              <Clock className="mx-auto text-gray-400 mb-3" size={40} />
                              <p className="text-gray-500 font-medium">No history yet.</p>
                            </div>
                          ) : (
                            paginatedResolved.map(emergency => (
                              <motion.div
                                key={emergency.id}
                                variants={itemVariants}
                                layout
                                className="p-5 bg-white hover:bg-gray-50 transition-colors"
                              >
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
                                  <span className="text-[10px] text-gray-500 font-bold border px-2 py-0.5 rounded-full">
                                    {emergency.urgency.toUpperCase()}
                                  </span>
                                </div>
                                <h4 className="text-sm font-medium text-gray-700 line-clamp-1 mb-1">{emergency.description}</h4>
                                <button
                                  type="button"
                                  onClick={() => setMapModalLocation(emergency.location)}
                                  className="text-[10px] text-gray-400 flex items-center hover:text-emerald-600 hover:bg-emerald-50 px-1.5 py-0.5 -ml-1.5 rounded transition-colors cursor-pointer group max-w-[200px]"
                                  title={emergency.location}
                                >
                                  <MapPin size={10} className="mr-1 flex-shrink-0 group-hover:scale-110 transition-transform" />
                                  <span className="truncate">{formatLocation(emergency.location)}</span>
                                  <span className="ml-1 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold flex-shrink-0">↗</span>
                                </button>
                              </motion.div>
                            ))
                          )
                        )}
                      </motion.div>

                      {/* Pagination Controls */}
                      <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                        {activeTab === 'available' ? (
                          <>
                            <span className="text-xs font-medium text-gray-500">
                              Showing {activeEmergencies.length > 0 ? (availablePage - 1) * AVAILABLE_ITEMS_PER_PAGE + 1 : 0} to {Math.min(availablePage * AVAILABLE_ITEMS_PER_PAGE, activeEmergencies.length)} of {activeEmergencies.length}
                            </span>
                            <div className="flex space-x-2">
                              <button
                                disabled={availablePage === 1}
                                onClick={() => setAvailablePage(p => p - 1)}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <button
                                disabled={availablePage >= totalAvailablePages || totalAvailablePages === 0}
                                onClick={() => setAvailablePage(p => p + 1)}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-medium text-gray-500">
                              Showing {resolvedAssignedEmergencies.length > 0 ? (resolvedPage - 1) * RESOLVED_ITEMS_PER_PAGE + 1 : 0} to {Math.min(resolvedPage * RESOLVED_ITEMS_PER_PAGE, resolvedAssignedEmergencies.length)} of {resolvedAssignedEmergencies.length}
                            </span>
                            <div className="flex space-x-2">
                              <button
                                disabled={resolvedPage === 1}
                                onClick={() => setResolvedPage(p => p - 1)}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <button
                                disabled={resolvedPage >= totalResolvedPages || totalResolvedPages === 0}
                                onClick={() => setResolvedPage(p => p + 1)}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </section>

                  </div>
                </div>
              </>
            )}
          </main>

          {/* Assignments Modal */}
          <AnimatePresence>
            {showAssignments && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAssignments(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden p-8"
                >
                  <div className="absolute top-6 right-6 z-20">
                    <button
                      onClick={() => setShowAssignments(false)}
                      className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 shadow-sm transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                    <CheckCircle className="mr-3 text-emerald-600" size={28} />
                    My Assignments
                  </h2>

                  <div className="max-h-[70vh] overflow-y-auto space-y-4 pr-2">
                    {myTasks.length === 0 ? (
                      <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100">
                        <CheckCircle className="mx-auto text-gray-400 mb-3" size={40} />
                        <p className="text-gray-500 font-medium">No tasks assigned to you yet.</p>
                      </div>
                    ) : (
                      myTasks.map((task) => {
                        const emergency = emergencies.find(e => e.id === task.emergencyId);
                        return (
                          <div
                            key={task.id}
                            className="p-5 border border-gray-100 rounded-2xl bg-white shadow-sm hover:border-emerald-100 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                task.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                              )}>
                                {task.status}
                              </span>
                              <span className="text-[10px] text-gray-400 font-medium">
                                {format(task.createdAt.toDate(), 'MMM d, h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">
                              {emergency?.description || 'Loading emergency details...'}
                            </p>
                            <div className="mt-3 flex items-center text-xs text-gray-500">
                              <MapPin size={14} className="mr-1.5 text-emerald-500" />
                              {emergency?.location}
                            </div>
                            {task.status !== 'completed' && (
                              <button
                                onClick={() => handleCompleteTask(task.id, task.emergencyId)}
                                className="mt-4 w-full py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200"
                              >
                                Mark as Resolved
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

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
          {/* Community Chat Modal */}
          <AnimatePresence>
            {showChat && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowChat(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
                  style={{ height: 'min(80vh, 700px)' }}
                >
                  <div className="absolute top-4 right-4 z-20">
                    <button
                      onClick={() => setShowChat(false)}
                      className="p-2 bg-white/80 backdrop-blur rounded-full text-gray-500 hover:text-gray-900 shadow-sm transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="h-full flex flex-col">
                    <CommunityChat userProfile={userProfile} />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Location Map Modal */}
          <AnimatePresence>
            {mapModalLocation && (
              <LocationMapModal
                location={mapModalLocation}
                isOpen={!!mapModalLocation}
                onClose={() => setMapModalLocation(null)}
              />
            )}
          </AnimatePresence>

          {/* Manual Entry Modal */}
          <AnimatePresence>
            {showManualEntryModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowManualEntryModal(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-4xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                  <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <FileText size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Manual Emergency Report</h3>
                        <p className="text-sm text-gray-500">Please provide detailed information about the emergency.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowManualEntryModal(false)}
                      className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto overflow-x-hidden flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight mb-2">Description</label>
                          <textarea
                            value={manualData.description}
                            onChange={(e) => setManualData({ ...manualData, description: e.target.value })}
                            placeholder="Describe the emergency in detail..."
                            className="w-full h-40 p-3 border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm resize-none"
                          />
                        </div>

                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight mb-2">Priority</label>
                            <select
                              value={manualData.urgency}
                              onChange={(e) => setManualData({ ...manualData, urgency: e.target.value as Urgency })}
                              className="w-full p-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                              <option value="low">Low Priority</option>
                              <option value="medium">Medium Priority</option>
                              <option value="high">High Priority</option>
                              <option value="critical">Critical Priority</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight mb-2">Required Skills</label>
                          <input
                            type="text"
                            placeholder="e.g. Medicine, Food, First Aid"
                            value={manualData.skills}
                            onChange={(e) => setManualData({ ...manualData, skills: e.target.value })}
                            className="w-full p-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                          <p className="mt-1 text-[10px] text-gray-400 uppercase tracking-wide">Comma separated</p>
                        </div>

                        {/* Donation / Crowdfunding Section */}
                        <div className="pt-4 border-t border-gray-200">
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-tight mb-3 flex items-center">
                            <HandHeart size={14} className="mr-1.5 text-amber-600" />
                            Donation / Crowdfunding (Optional)
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1">UPI / Google Pay Link</label>
                              <input
                                type="url"
                                placeholder="e.g. upi://pay?pa=name@upi"
                                value={manualData.donationUpiLink}
                                onChange={(e) => setManualData({ ...manualData, donationUpiLink: e.target.value })}
                                className="w-full p-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1">QR Code Image URL</label>
                              <input
                                type="url"
                                placeholder="Link to QR code image"
                                value={manualData.donationQrCodeUrl}
                                onChange={(e) => setManualData({ ...manualData, donationQrCodeUrl: e.target.value })}
                                className="w-full p-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1">Bank Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g. State Bank of India"
                                  value={manualData.bankName}
                                  onChange={(e) => setManualData({ ...manualData, bankName: e.target.value })}
                                  className="w-full p-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1">IFSC Code</label>
                                <input
                                  type="text"
                                  placeholder="e.g. SBIN0001234"
                                  value={manualData.ifscCode}
                                  onChange={(e) => setManualData({ ...manualData, ifscCode: e.target.value })}
                                  className="w-full p-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1">Account Number</label>
                                <input
                                  type="text"
                                  placeholder="Account number"
                                  value={manualData.accountNumber}
                                  onChange={(e) => setManualData({ ...manualData, accountNumber: e.target.value })}
                                  className="w-full p-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1">Account Holder Name</label>
                                <input
                                  type="text"
                                  placeholder="Name on the account"
                                  value={manualData.accountHolderName}
                                  onChange={(e) => setManualData({ ...manualData, accountHolderName: e.target.value })}
                                  className="w-full p-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight mb-2 flex items-center">
                          <MapPin size={14} className="mr-1.5 text-emerald-600" />
                          Specify Location
                        </label>
                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 flex-1 flex flex-col min-h-[300px]">
                          <LocationInputMap
                            value={manualData.location}
                            onChange={(loc) => setManualData({ ...manualData, location: loc })}
                            fillHeight={true}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-end space-x-3 shrink-0">
                    <button
                      onClick={() => setShowManualEntryModal(false)}
                      className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!manualData.description.trim() || !manualData.location.trim()) {
                          alert("Please provide both a description and a location.");
                          return;
                        }
                        setIsAnalyzing(true);
                        try {
                          const emergencyData: Record<string, any> = {
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
                          // Add donation fields only if provided
                          if (manualData.donationUpiLink.trim()) emergencyData.donationUpiLink = manualData.donationUpiLink.trim();
                          if (manualData.donationQrCodeUrl.trim()) emergencyData.donationQrCodeUrl = manualData.donationQrCodeUrl.trim();
                          if (manualData.bankName.trim()) emergencyData.bankName = manualData.bankName.trim();
                          if (manualData.ifscCode.trim()) emergencyData.ifscCode = manualData.ifscCode.trim();
                          if (manualData.accountNumber.trim()) emergencyData.accountNumber = manualData.accountNumber.trim();
                          if (manualData.accountHolderName.trim()) emergencyData.accountHolderName = manualData.accountHolderName.trim();

                          await addDoc(collection(db, 'emergencies'), emergencyData);

                          setManualData({ description: '', location: '', urgency: 'medium', skills: '', donationUpiLink: '', donationQrCodeUrl: '', bankName: '', ifscCode: '', accountNumber: '', accountHolderName: '' });
                          setShowManualEntryModal(false);
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setIsAnalyzing(false);
                        }
                      }}
                      disabled={isAnalyzing}
                      className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-md flex items-center disabled:opacity-50"
                    >
                      {isAnalyzing ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle className="mr-2" size={16} />}
                      Submit Report
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* AI Verification Modal */}
          <AnimatePresence>
            {showAiVerificationModal && aiAnalysisResult && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAiVerificationModal(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-4xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                  <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Zap size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Verify AI Extraction</h3>
                        <p className="text-sm text-gray-500">Please verify the extracted location and details.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAiVerificationModal(false)}
                      className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto overflow-x-hidden flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight mb-2">Description</label>
                          <textarea
                            value={aiAnalysisResult.description}
                            onChange={(e) => setAiAnalysisResult({ ...aiAnalysisResult, description: e.target.value })}
                            className="w-full h-40 p-3 border border-gray-300 bg-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm resize-none"
                          />
                        </div>

                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight mb-2">Priority</label>
                            <select
                              value={aiAnalysisResult.urgency}
                              onChange={(e) => setAiAnalysisResult({ ...aiAnalysisResult, urgency: e.target.value as Urgency })}
                              className="w-full p-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                              <option value="low">Low Priority</option>
                              <option value="medium">Medium Priority</option>
                              <option value="high">High Priority</option>
                              <option value="critical">Critical Priority</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight mb-2">Required Skills</label>
                          <div className="flex flex-wrap gap-2">
                            {aiAnalysisResult.requiredSkills.map(s => (
                              <span key={s} className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg font-bold text-xs shadow-sm uppercase tracking-tight">
                                {s}
                              </span>
                            ))}
                            {aiAnalysisResult.requiredSkills.length === 0 && (
                              <span className="text-sm text-gray-400 italic">No specific skills extracted</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight mb-2 flex items-center">
                          <MapPin size={14} className="mr-1.5 text-emerald-600" />
                          Verify Location
                        </label>
                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 flex-1 flex flex-col min-h-[300px]">
                          <LocationInputMap
                            value={aiAnalysisResult.location}
                            onChange={(loc) => setAiAnalysisResult({ ...aiAnalysisResult, location: loc })}
                            fillHeight={true}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-end space-x-3 shrink-0">
                    <button
                      onClick={() => setShowAiVerificationModal(false)}
                      className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setIsAnalyzing(true);
                        try {
                          const emergencyData = {
                            reporterUid: userProfile.uid,
                            reporterName: userProfile.name,
                            description: aiAnalysisResult.description || reportText,
                            location: aiAnalysisResult.location,
                            urgency: aiAnalysisResult.urgency,
                            status: 'pending' as const,
                            requiredSkills: aiAnalysisResult.requiredSkills,
                            createdAt: Timestamp.now(),
                            processedByAi: true
                          };
                          await addDoc(collection(db, 'emergencies'), emergencyData);

                          setReportText('');
                          setAiAnalysisResult(null);
                          setAiAnalysisError(null);
                          setShowAiVerificationModal(false);
                          setIsReporting(false);
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setIsAnalyzing(false);
                        }
                      }}
                      disabled={isAnalyzing}
                      className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-md flex items-center disabled:opacity-50"
                    >
                      {isAnalyzing ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle className="mr-2" size={16} />}
                      Confirm & Submit Report
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Emergency Detail Modal */}
          <AnimatePresence>
            {selectedEmergency && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedEmergency(null)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-3xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
                  style={{ maxHeight: 'min(90vh, 850px)' }}
                >
                  {/* Header */}
                  <div className="p-6 border-b border-gray-100 bg-white shrink-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center",
                          selectedEmergency.urgency === 'critical' ? 'bg-red-100' :
                          selectedEmergency.urgency === 'high' ? 'bg-orange-100' :
                          selectedEmergency.urgency === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                        )}>
                          <AlertCircle size={24} className={cn(
                            selectedEmergency.urgency === 'critical' ? 'text-red-600' :
                            selectedEmergency.urgency === 'high' ? 'text-orange-600' :
                            selectedEmergency.urgency === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                          )} />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">Emergency Report</h2>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase",
                              getUrgencyColor(selectedEmergency.urgency)
                            )}>
                              {selectedEmergency.urgency}
                            </span>
                            <span className="text-xs text-gray-400">
                              {format(selectedEmergency.createdAt.toDate(), 'MMMM d, yyyy \u2022 h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedEmergency(null)}
                        className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 shadow-sm transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Reported By */}
                    <div className="flex items-center text-sm text-gray-500">
                      <Users size={16} className="mr-2 text-gray-400" />
                      Reported by <span className="font-bold text-gray-700 ml-1">{selectedEmergency.reporterName}</span>
                    </div>

                    {/* Detailed Narrative */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-tight mb-3 flex items-center">
                        <BookOpen size={14} className="mr-1.5 text-emerald-600" />
                        Incident Details
                      </h3>
                      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                        {narrativeLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-emerald-500 mr-2" size={20} />
                            <span className="text-sm text-emerald-600 font-medium">Generating detailed report...</span>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {selectedEmergency.detailedNarrative || narrativeCache[selectedEmergency.id] || selectedEmergency.description}
                            </p>
                            {(narrativeCache[selectedEmergency.id] && selectedEmergency.description.length < 100) && (
                              <p className="mt-3 text-[10px] text-gray-400 italic flex items-center">
                                <Zap size={10} className="mr-1" />
                                AI-expanded from brief report for clarity
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-tight mb-3 flex items-center">
                        <MapPin size={14} className="mr-1.5 text-emerald-600" />
                        Location / Address
                      </h3>
                      <button
                        type="button"
                        onClick={() => { setSelectedEmergency(null); setTimeout(() => setMapModalLocation(selectedEmergency.location), 200); }}
                        className="w-full text-left bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 hover:bg-emerald-50 transition-colors group/loc cursor-pointer"
                      >
                        <p className="text-sm font-medium text-gray-800">{selectedEmergency.location}</p>
                        <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-flex items-center group-hover/loc:underline">
                          Open in Map <ExternalLink size={10} className="ml-1" />
                        </span>
                      </button>
                    </div>

                    {/* Required Skills */}
                    {selectedEmergency.requiredSkills && selectedEmergency.requiredSkills.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-tight mb-3 flex items-center">
                          <Star size={14} className="mr-1.5 text-indigo-600" />
                          Skills Required
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedEmergency.requiredSkills.map(skill => (
                            <span key={skill} className={cn(
                              "px-3 py-1.5 rounded-xl text-xs font-bold border shadow-sm uppercase tracking-tight",
                              userProfile.skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-white text-gray-600 border-gray-200"
                            )}>
                              {skill}
                              {userProfile.skills.some(s => s.toLowerCase().includes(skill.toLowerCase())) && (
                                <CheckCircle size={10} className="inline ml-1.5 -mt-0.5" />
                              )}
                            </span>
                          ))}
                        </div>
                        {selectedEmergency.requiredSkills.some(skill =>
                          userProfile.skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
                        ) && (
                          <p className="mt-2 text-[10px] text-indigo-500 font-bold flex items-center">
                            <CheckCircle size={10} className="mr-1" />
                            Your skills match this emergency
                          </p>
                        )}
                      </div>
                    )}

                    {/* Donation / Crowdfunding Section */}
                    {(selectedEmergency.donationUpiLink || selectedEmergency.donationQrCodeUrl || selectedEmergency.bankName) && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-tight mb-3 flex items-center">
                          <HandHeart size={14} className="mr-1.5 text-amber-600" />
                          Donation / Crowdfunding
                        </h3>
                        <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-100 space-y-4">
                          {/* UPI / Google Pay Link */}
                          {selectedEmergency.donationUpiLink && (
                            <div>
                              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-tight mb-2">UPI / Google Pay</p>
                              <a
                                href={selectedEmergency.donationUpiLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm font-bold text-amber-700 hover:bg-amber-50 transition-colors shadow-sm"
                              >
                                <ExternalLink size={14} className="mr-2" />
                                Pay via Google Pay / UPI
                              </a>
                            </div>
                          )}

                          {/* QR Code */}
                          {selectedEmergency.donationQrCodeUrl && (
                            <div>
                              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-tight mb-2">Scan QR Code</p>
                              <div className="bg-white rounded-xl p-3 border border-amber-200 inline-block shadow-sm">
                                <img
                                  src={selectedEmergency.donationQrCodeUrl}
                                  alt="Donation QR Code"
                                  className="w-40 h-40 object-contain"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Bank Details */}
                          {selectedEmergency.bankName && (
                            <div>
                              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-tight mb-2">Bank Details</p>
                              <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-tight font-bold">Bank Name</p>
                                    <p className="font-bold text-gray-800 flex items-center mt-0.5">
                                      <Building2 size={14} className="mr-1.5 text-gray-400" />
                                      {selectedEmergency.bankName}
                                    </p>
                                  </div>
                                  {selectedEmergency.ifscCode && (
                                    <div>
                                      <p className="text-[10px] text-gray-400 uppercase tracking-tight font-bold">IFSC Code</p>
                                      <p className="font-bold text-gray-800 font-mono mt-0.5">{selectedEmergency.ifscCode}</p>
                                    </div>
                                  )}
                                  {selectedEmergency.accountNumber && (
                                    <div>
                                      <p className="text-[10px] text-gray-400 uppercase tracking-tight font-bold">Account Number</p>
                                      <p className="font-bold text-gray-800 font-mono mt-0.5 flex items-center">
                                        <CreditCard size={14} className="mr-1.5 text-gray-400" />
                                        {selectedEmergency.accountNumber}
                                      </p>
                                    </div>
                                  )}
                                  {selectedEmergency.accountHolderName && (
                                    <div>
                                      <p className="text-[10px] text-gray-400 uppercase tracking-tight font-bold">Account Holder</p>
                                      <p className="font-bold text-gray-800 mt-0.5">{selectedEmergency.accountHolderName}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  {selectedEmergency.status === 'pending' && (
                    <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
                      <p className="text-xs text-gray-400">Help is needed — pick up this task to get involved.</p>
                      <div className="flex items-center space-x-3">
                        {backendOnline && userProfile.role === 'admin' && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelectedEmergency(null);
                              setShowSmartMatch(selectedEmergency.id);
                              fetchSmartMatches(selectedEmergency.id, selectedEmergency);
                            }}
                            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md flex items-center"
                          >
                            <Zap size={14} className="mr-1.5" />
                            Smart Match
                          </motion.button>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.02, boxShadow: "0 10px 20px -5px rgb(16 185 129 / 0.3)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { handlePickUpTask(selectedEmergency.id); setSelectedEmergency(null); }}
                          className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-md flex items-center"
                        >
                          <CheckCircle size={14} className="mr-1.5" />
                          Pick Up Task
                        </motion.button>
                      </div>
                    </div>
                  )}
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
