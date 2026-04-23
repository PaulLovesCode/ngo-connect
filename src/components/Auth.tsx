import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Volunteer } from '../types';
import { Eye, EyeOff, Github, Chrome, Facebook, Apple } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect } from 'react';

export default function Auth({ onAuthChange }: { onAuthChange: (user: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [skills, setSkills] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const carouselImages = [
    "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=2070&auto=format&fit=crop", // Feeding children
    "https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8?q=80&w=2070&auto=format&fit=crop", // Elderly care
    "https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=2070&auto=format&fit=crop"  // Community support
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Basic origin check - ensure it's from the same origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.idToken) {
        setLoading(true);
        try {
          const credential = GoogleAuthProvider.credential(event.data.idToken);
          const result = await signInWithCredential(auth, credential);
          const user = result.user;

          const docRef = doc(db, 'volunteers', user.uid);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            const volunteerData: Volunteer = {
              uid: user.uid,
              name: user.displayName || 'Anonymous',
              email: user.email || '',
              skills: [],
              role: 'volunteer',
              yearsVolunteering: 0,
              photoURL: user.photoURL || ''
            };
            await setDoc(docRef, volunteerData);
          }
        } catch (err: any) {
          console.error('Google Sign-In Error:', err);
          setError(`Google Sign-In failed: ${err.message || 'Unknown error'}`);
        } finally {
          setLoading(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const volunteerData: Volunteer = {
          uid: user.uid,
          name: name,
          email: email,
          skills: skills.split(',').map(s => s.trim()).filter(s => s),
          role: 'volunteer',
          yearsVolunteering: 0
        };

        await setDoc(doc(db, 'volunteers', user.uid), volunteerData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const response = await fetch('/api/auth/url');
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        'google_oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        setError('Please allow popups to sign in with Google.');
      }
    } catch (err: any) {
      setError('Failed to initialize Google sign-in.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f5f5f0] flex items-center justify-center p-0 sm:p-4 md:p-8">
      <div className="w-full max-w-[1200px] min-h-[700px] bg-[#f5f5f0] rounded-[40px] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-gray-200/50">

        {/* Left Side: Auth Form */}
        <div className="flex-1 p-8 md:p-16 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[400px] mx-auto w-full"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
              {isLogin ? 'Welcome back!' : 'Create account'}
            </h1>
            <p className="text-gray-500 mb-10 text-sm md:text-base leading-relaxed">
              {isLogin
                ? "Simplify your workflow and boost your productivity with NGO Connect. Get started for free."
                : "Join our community of volunteers and make a real difference in people's lives today."}
            </p>

            <form onSubmit={handleAuth} className="space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100"
                >
                  {error}
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-5 overflow-hidden"
                  >
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full px-6 py-4 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6321]/20 focus:border-[#FF6321] transition-all placeholder:text-gray-400"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        placeholder="Skills (e.g. Medicine, First Aid)"
                        className="w-full px-6 py-4 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6321]/20 focus:border-[#FF6321] transition-all placeholder:text-gray-400"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-6 py-4 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6321]/20 focus:border-[#FF6321] transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-6 py-4 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6321]/20 focus:border-[#FF6321] transition-all placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <button type="button" className="text-xs font-semibold text-gray-900 hover:underline">
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-black text-white rounded-full font-bold text-sm hover:bg-[#FF6321] transition-all shadow-lg shadow-black/10 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Processing...' : isLogin ? 'Login' : 'Create Account'}
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200/50"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#f5f5f0] px-4 text-gray-400 font-medium tracking-widest">or continue with</span>
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-12 h-12 flex items-center justify-center rounded-full border border-gray-100 hover:bg-gray-50 transition-all active:scale-95"
                >
                  <Chrome size={20} className="text-gray-900" />
                </button>
                <button
                  type="button"
                  className="w-12 h-12 flex items-center justify-center rounded-full border border-gray-100 hover:bg-gray-50 transition-all active:scale-95"
                >
                  <Apple size={20} className="text-gray-900" />
                </button>
                <button
                  type="button"
                  className="w-12 h-12 flex items-center justify-center rounded-full border border-gray-100 hover:bg-gray-50 transition-all active:scale-95"
                >
                  <Facebook size={20} className="text-gray-900" />
                </button>
              </div>

              <div className="pt-6 text-center">
                <p className="text-sm text-gray-500">
                  {isLogin ? "Not a member? " : "Already have an account? "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-[#FF6321] font-bold hover:underline"
                  >
                    {isLogin ? 'Register now' : 'Login now'}
                  </button>
                </p>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Right Side: Immersive Visuals */}
        <div className="hidden md:flex flex-1 bg-[#e0731f] p-12 flex-col items-center justify-center relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative w-full max-w-[500px]"
          >
            {/* Main Illustration Carousel */}
            <div className="relative z-10 aspect-square rounded-[40px] overflow-hidden shadow-2xl border-4 border-white/20">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImageIndex}
                  src={carouselImages[currentImageIndex]}
                  alt="NGO Impact"
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>
            </div>

            {/* Background Decorative Circles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border-2 border-dashed border-white/20 rounded-full opacity-20 animate-[spin_60s_linear_infinite]"></div>
          </motion.div>

          <div className="mt-12 text-center max-w-[400px] relative z-10">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-4 leading-snug">
              We are Volunteers helping people in need and in emergency. Liked our work? Or wanna become a Volunteer? Sign in now.
            </h2>
            <div className="flex justify-center space-x-2">
              {carouselImages.map((_, idx) => (
                <motion.div
                  key={idx}
                  animate={{
                    width: currentImageIndex === idx ? 24 : 6,
                    opacity: currentImageIndex === idx ? 1 : 0.3,
                  }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="h-1.5 bg-white rounded-full cursor-pointer"
                  onClick={() => setCurrentImageIndex(idx)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
