import React from 'react';
import { 
  LayoutDashboard, 
  User, 
  Settings, 
  BookOpen, 
  LogOut, 
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageSquare,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { Volunteer, Task, Emergency } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  userProfile: Volunteer;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onFeedbackClick: () => void;
  currentView: 'dashboard' | 'profile' | 'settings';
  onViewChange: (view: 'dashboard' | 'profile' | 'settings') => void;
  onArchiveClick: () => void;
  onAssignmentsClick: () => void;
}

export function Sidebar({ 
  userProfile, 
  isCollapsed, 
  setIsCollapsed,
  onFeedbackClick,
  currentView,
  onViewChange,
  onArchiveClick,
  onAssignmentsClick
}: SidebarProps) {
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', active: currentView === 'dashboard', onClick: () => onViewChange('dashboard') },
    { icon: Calendar, label: 'Emergency Archive', onClick: onArchiveClick },
    { icon: CheckCircle, label: 'My Assignments', onClick: onAssignmentsClick },
    { icon: User, label: 'Profile', active: currentView === 'profile', onClick: () => onViewChange('profile') },
    { icon: BookOpen, label: 'Resources' },
    { icon: MessageSquare, label: 'Feedback', onClick: onFeedbackClick },
  ];

  const systemItems = [
    { icon: Settings, label: 'Settings', active: currentView === 'settings', onClick: () => onViewChange('settings') },
  ];

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 72 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 h-screen z-30 flex flex-col border-r bg-white border-gray-100 overflow-hidden shadow-sm"
    >
      {/* Logo Section */}
      <div className="p-5 relative flex items-center min-h-[72px]">
        <div className={cn(
          "flex items-center space-x-3 transition-opacity duration-300",
          isCollapsed ? "mx-auto" : "opacity-100"
        )}>
          <motion.div 
            layout
            className="bg-emerald-600 p-2 rounded-xl text-white shadow-lg shadow-emerald-200"
          >
            <Heart size={18} fill="currentColor" />
          </motion.div>
          {!isCollapsed && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-bold text-lg text-emerald-900 whitespace-nowrap"
            >
              NGO Connect
            </motion.span>
          )}
        </div>
        
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:border-emerald-200 hover:text-emerald-600 transition-colors z-40"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-5 overflow-y-auto overflow-x-hidden no-scrollbar">
        <div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3"
              >
                Main Menu
              </motion.p>
            )}
          </AnimatePresence>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <motion.button
                key={item.label}
                whileHover={{ x: isCollapsed ? 0 : 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={item.onClick}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors group relative",
                  item.active 
                    ? "bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-100/50" 
                    : "text-gray-500 hover:bg-emerald-50/40 hover:text-gray-900"
                )}
              >
                <div className={cn("flex-shrink-0 flex items-center justify-center w-5 h-5", isCollapsed && "mx-auto")}>
                  <item.icon size={18} />
                </div>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-medium text-[13px] whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
                {item.active && !isCollapsed && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute left-0 w-1 h-6 bg-emerald-600 rounded-r-full"
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="pt-5 border-t border-gray-100">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3"
              >
                System
              </motion.p>
            )}
          </AnimatePresence>
          <div className="space-y-1">
            {systemItems.map((item) => (
              <motion.button
                key={item.label}
                whileHover={{ x: isCollapsed ? 0 : 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={item.onClick}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors group relative",
                  item.active 
                    ? "bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-100/50" 
                    : "text-gray-500 hover:bg-emerald-50/40 hover:text-gray-900"
                )}
              >
                <div className={cn("flex-shrink-0 flex items-center justify-center w-5 h-5", isCollapsed && "mx-auto")}>
                  <item.icon size={18} />
                </div>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-medium text-[13px] whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
                {item.active && !isCollapsed && (
                  <motion.div 
                    layoutId="active-pill-system"
                    className="absolute left-0 w-1 h-6 bg-emerald-600 rounded-r-full"
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-gray-100 bg-gray-50/30">
        <motion.div 
          layout
          className={cn(
            "flex items-center space-x-2 p-2 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden",
            isCollapsed && "justify-center"
          )}
        >
          <motion.img 
            layout
            src={userProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name}`} 
            alt={userProfile.name}
            className="w-8 h-8 rounded-xl bg-emerald-100 object-cover flex-shrink-0"
          />
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 min-w-0"
            >
              <p className="text-[13px] font-bold text-gray-900 truncate">{userProfile.name}</p>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{userProfile.role}</p>
            </motion.div>
          )}
        </motion.div>
        
        <motion.button
          whileHover={{ x: isCollapsed ? 0 : 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => auth.signOut()}
          className={cn(
            "w-full mt-3 flex items-center space-x-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors group",
            isCollapsed && "justify-center"
          )}
        >
          <div className="flex-shrink-0">
            <LogOut size={18} />
          </div>
          {!isCollapsed && <span className="font-medium text-[13px]">Log out</span>}
        </motion.button>
      </div>
    </motion.aside>
  );
}
