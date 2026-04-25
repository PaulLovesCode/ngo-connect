import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, X, Image, FileText, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Volunteer } from '../types';

interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  imageUrl?: string;
  fileName?: string;
  createdAt: Timestamp;
}

interface CommunityChatProps {
  userProfile: Volunteer;
}

export function CommunityChat({ userProfile }: CommunityChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to messages
  useEffect(() => {
    const q = query(
      collection(db, 'communityChat'),
      orderBy('createdAt', 'asc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatMessage));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'communityChat'), {
        senderUid: userProfile.uid,
        senderName: userProfile.name,
        senderPhoto: userProfile.photoURL || '',
        text: newMessage.trim(),
        createdAt: Timestamp.now(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    setSending(true);
    try {
      // Convert to base64 data URL for inline display
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        await addDoc(collection(db, 'communityChat'), {
          senderUid: userProfile.uid,
          senderName: userProfile.name,
          senderPhoto: userProfile.photoURL || '',
          text: '',
          imageUrl: dataUrl,
          createdAt: Timestamp.now(),
        });
        setSending(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to send image:', error);
      setSending(false);
    }
    e.target.value = '';
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    setSending(true);
    try {
      await addDoc(collection(db, 'communityChat'), {
        senderUid: userProfile.uid,
        senderName: userProfile.name,
        senderPhoto: userProfile.photoURL || '',
        text: `📎 ${file.name}`,
        fileName: file.name,
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Failed to send document:', error);
    }
    setSending(false);
    e.target.value = '';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Group consecutive messages from same sender
  const isConsecutive = (idx: number) => {
    if (idx === 0) return false;
    const prev = messages[idx - 1];
    const curr = messages[idx];
    return prev.senderUid === curr.senderUid;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-100 bg-emerald-50/40">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
            🌍
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Community Chat</h3>
            <p className="text-[10px] text-gray-500">{messages.length} messages • All volunteers</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#f0f2f5]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d1d5db\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs">Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderUid === userProfile.uid;
            const consecutive = isConsecutive(idx);

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex items-end gap-2",
                  isMe ? "justify-end" : "justify-start",
                  !consecutive && idx > 0 && "mt-3"
                )}
              >
                {/* Avatar - only for others, not consecutive */}
                {!isMe && (
                  <div className={cn("w-7 h-7 flex-shrink-0", consecutive && "invisible")}>
                    {msg.senderPhoto ? (
                      <img
                        src={msg.senderPhoto}
                        alt={msg.senderName}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-[10px] font-bold">
                        {getInitials(msg.senderName)}
                      </div>
                    )}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 shadow-sm relative",
                    isMe
                      ? "bg-[#d9fdd3] rounded-br-md"
                      : "bg-white rounded-bl-md"
                  )}
                >
                  {/* Sender name - only for others, not consecutive */}
                  {!isMe && !consecutive && (
                    <p className="text-[11px] font-bold text-emerald-600 mb-0.5">
                      {msg.senderName}
                    </p>
                  )}

                  {/* Image attachment */}
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Shared image"
                      className="rounded-lg max-w-full max-h-48 object-cover mb-1"
                    />
                  )}

                  {/* Document attachment */}
                  {msg.fileName && !msg.imageUrl && (
                    <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-2 mb-1 border border-gray-100">
                      <FileText size={16} className="text-emerald-600 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-700 truncate">{msg.fileName}</span>
                    </div>
                  )}

                  {/* Text */}
                  {msg.text && !msg.fileName && (
                    <p className="text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>
                  )}

                  {/* Timestamp */}
                  <p className={cn(
                    "text-[10px] mt-0.5 text-right",
                    isMe ? "text-gray-500" : "text-gray-400"
                  )}>
                    {msg.createdAt && format(msg.createdAt.toDate(), 'h:mm a')}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-gray-100 bg-white">
        <div className="flex items-end space-x-2">
          {/* Attach Button */}
          <div className="relative">
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-emerald-600 transition-colors"
            >
              <Plus size={20} />
            </button>

            {/* Attach Menu Popup */}
            <AnimatePresence>
              {showAttachMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 min-w-[160px] z-10"
                >
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                      <Image size={16} className="text-violet-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Image</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <FileText size={16} className="text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Document</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hidden file inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
              className="hidden"
              onChange={handleDocUpload}
            />
          </div>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              rows={1}
              className="w-full px-4 py-2.5 bg-gray-100 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:bg-white transition-all border border-transparent focus:border-emerald-100 max-h-24"
              style={{ minHeight: '40px' }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className={cn(
              "p-2.5 rounded-full transition-all flex-shrink-0",
              newMessage.trim()
                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
                : "bg-gray-100 text-gray-400"
            )}
          >
            <Send size={18} className={newMessage.trim() ? "translate-x-[1px]" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
