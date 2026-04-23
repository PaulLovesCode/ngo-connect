import React, { useState } from 'react';
import { X, Send, MessageSquare, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Volunteer } from '../types';
import { cn } from '../lib/utils';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: Volunteer;
}

export function FeedbackModal({ isOpen, onClose, userProfile }: FeedbackModalProps) {
  const [type, setType] = useState<'issue' | 'improvement' | 'other'>('improvement');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: userProfile.uid,
        userName: userProfile.name,
        type,
        message,
        createdAt: Timestamp.now()
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setMessage('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Feedback submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border bg-white border-gray-100"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-100 p-2.5 rounded-2xl text-emerald-600">
                <MessageSquare size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Feedback</h2>
                <p className="text-sm text-gray-500">Help us improve NGO Connect</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
            >
              <X size={20} />
            </button>
          </div>

          {isSuccess ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 text-center"
            >
              <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                <Send size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
              <p className="text-gray-500">Your feedback has been submitted successfully.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-wider">
                  Feedback Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'improvement', label: 'Suggestion', icon: Sparkles },
                    { id: 'issue', label: 'Issue', icon: AlertCircle },
                    { id: 'other', label: 'Other', icon: MessageSquare },
                  ].map((item) => (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id as any)}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-2",
                        type === item.id
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm"
                          : "bg-white border-gray-100 text-gray-500 hover:border-emerald-100"
                      )}
                    >
                      <item.icon size={20} />
                      <span className="text-xs font-bold">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-wider">
                  Your Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  className="w-full h-40 p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: '#047857' }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    <span>Send Feedback</span>
                  </>
                )}
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
