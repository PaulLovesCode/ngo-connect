import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValueEvent, Variants, AnimatePresence, useInView } from 'motion/react';
import { ArrowRight, Heart, Users, Shield, Globe, ChevronDown, CheckCircle2, Sparkles, Zap, ArrowUpRight } from 'lucide-react';
import { ASSETS } from '../constants/assets';
import ShapeGrid from './ShapeGrid';

interface LandingPageProps {
  onEnter: () => void;
}

/* ─── Animated Counter Component ─── */
function AnimatedCounter({ value, suffix: externalSuffix = '' }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayVal, setDisplayVal] = useState('0');

  useEffect(() => {
    if (!isInView) return;

    // Match prefix, number (with decimals/commas), and suffix
    const match = value.match(/^([^0-9.]*)([0-9.,]+)(.*)$/);
    if (!match) {
      setDisplayVal(value + externalSuffix);
      return;
    }

    const prefix = match[1];
    const rawNumber = match[2];
    const internalSuffix = match[3];
    const combinedSuffix = internalSuffix + externalSuffix;

    const target = parseFloat(rawNumber.replace(/,/g, ''));
    if (isNaN(target)) {
      setDisplayVal(value + externalSuffix);
      return;
    }

    const duration = 2000;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = target * eased;

      let formattedNumber;
      if (rawNumber.includes('.')) {
        // Retain decimal precision if the input had it
        formattedNumber = current.toFixed(1);
      } else {
        // Otherwise treat as integer with commas
        formattedNumber = Math.floor(current).toLocaleString();
      }

      setDisplayVal(`${prefix}${formattedNumber}${combinedSuffix}`);

      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isInView, value, externalSuffix]);

  return <span ref={ref}>{displayVal}</span>;
}

/* ─── Magnetic Hover Button ─── */
function MagneticButton({ children, onClick, className = '' }: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.button>
  );
}

/* ─── Section Reveal Wrapper ─── */
function SectionReveal({ children, className = '', delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [navScrolled, setNavScrolled] = useState(false);

  // ─── Scroll-linked values (all hooks at the top level, NEVER inside JSX) ───
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const { scrollYProgress: completionProgress } = useScroll();
  const scaleX = useSpring(completionProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Hero parallax
  const textY = useTransform(heroScroll, [0, 1], [0, -150]);
  const heroOpacity = useTransform(heroScroll, [0, 0.7], [1, 0]);
  const heroScale = useTransform(heroScroll, [0, 0.7], [1, 0.92]);

  // Floating shapes parallax — extracted from JSX to top-level
  const floatShape1Y = useTransform(heroScroll, [0, 1], [0, -80]);
  const floatShape2Y = useTransform(heroScroll, [0, 1], [0, 60]);
  const floatShape3Y = useTransform(heroScroll, [0, 1], [0, -40]);

  // Nav scroll detection
  useMotionValueEvent(heroScroll, "change", (latest) => {
    setNavScrolled(latest > 0.05);
  });

  // Metrics data
  const metricsData = [
    { label: 'SURVEYS', displayVal: '50,000+', desc: 'Community surveys conducted globally.', color: 'text-white' },
    { label: 'VOLUNTEERS', displayVal: '12,000+', desc: 'Active responders in 45 countries.', color: 'text-[#FF6321]' },
    { label: 'RESOLVED', displayVal: '98%', desc: 'Success rate in resolving verified needs.', color: 'text-white' },
    { label: 'IMPACT', displayVal: '$2.4M', desc: 'Resources distributed to families.', color: 'text-[#FF6321]' }
  ];

  // Staggered entrance variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { y: 60, opacity: 0, filter: 'blur(10px)' },
    visible: {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.9,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  const stepVariants: Variants = {
    hidden: { opacity: 0, x: -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen overflow-x-hidden bg-[#fdfdfc]"
    >
      {/* ═══ Scroll Progress Bar ═══ */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#FF6321] to-[#ff8f5a] origin-left z-[60]"
        style={{ scaleX }}
      />

      {/* ═══ Navigation ═══ */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
      >
        <div className="max-w-7xl mx-auto px-8 md:px-16 h-24 flex items-center justify-between">
          <motion.div
            className="flex items-center space-x-2 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-full px-5 py-2 shadow-sm shadow-black/5 pointer-events-auto"
            whileHover={{ scale: 1.02 }}
          >
            <span className="text-2xl font-black tracking-tighter text-gray-900">NGO</span>
            <span className="text-2xl font-black tracking-tighter text-[#FF6321]">CONNECT</span>
          </motion.div>

          <motion.div
            className="flex items-center bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-full p-1.5 shadow-sm shadow-black/5 pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <MagneticButton
              onClick={() => document.getElementById('impact')?.scrollIntoView({ behavior: 'smooth' })}
              className="group flex items-center text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors px-6 py-2.5 rounded-full"
            >
              Impact
              <ArrowUpRight className="ml-1.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={16} />
            </MagneticButton>
            <MagneticButton
              onClick={onEnter}
              className="text-sm font-bold text-white bg-gray-900 hover:bg-[#FF6321] px-7 py-2.5 rounded-full transition-all shadow-md shadow-gray-900/10"
            >
              Log In
            </MagneticButton>
          </motion.div>
        </div>
      </motion.nav>

      {/* ═══ Hero Section ═══ */}
      <section ref={heroRef} className="relative h-screen flex flex-col items-center justify-center px-8 md:px-16 text-center pt-20 overflow-hidden">
        {/* Dynamic Grid Pattern Background */}
        <div className="absolute inset-0 z-0 opacity-40 md:opacity-100">
          <ShapeGrid
            speed={0.5}
            squareSize={50}
            direction="diagonal"
            borderColor="#e2d3c8"
            hoverFillColor="#e9e5d9"
            shape="square"
            hoverTrailAmount={0}
          />
        </div>

        {/* Floating Background Shapes — parallax values from top-level hooks */}
        <motion.div
          style={{ y: floatShape1Y }}
          className="absolute top-1/4 left-[15%] w-72 h-72 bg-[#FF6321]/[0.04] rounded-full blur-3xl -z-10 animate-pulse-glow"
        />
        <motion.div
          style={{ y: floatShape2Y }}
          className="absolute bottom-1/4 right-[15%] w-96 h-96 bg-gray-300/[0.06] rounded-full blur-3xl -z-10 animate-pulse-glow"
        />
        <motion.div
          style={{ y: floatShape3Y }}
          className="absolute top-1/3 right-1/3 w-48 h-48 bg-amber-200/[0.04] rounded-full blur-3xl -z-10"
        />

        <motion.div
          style={{ y: textY, opacity: heroOpacity, scale: heroScale }}
          className="relative z-10 w-full max-w-[90vw] mx-auto gpu-accelerated"
        >
          {/* Eyebrow Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center space-x-2 px-5 py-2 bg-white/60 backdrop-blur-md border border-gray-200/50 rounded-full mb-8 shadow-sm"
          >
            <Sparkles size={14} className="text-[#FF6321]" />
            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Community-Driven Platform</span>
          </motion.div>

          {/* Hero Title — Image-masked text */}
          <motion.h1
            initial={{ opacity: 0, y: 60, filter: 'blur(20px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-[14vw] md:text-[16vw] font-black tracking-tighter leading-[0.85] select-none bg-cover bg-center bg-clip-text text-transparent"
            style={{
              backgroundImage: `url(${ASSETS.connectBg})`,
              WebkitBackgroundClip: 'text'
            }}
          >
            CONNECT
          </motion.h1>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl mx-auto mt-8"
          >
            <p className="text-lg md:text-2xl text-gray-500 font-medium leading-relaxed">
              Turning local survey data into{' '}
              <span className="text-gray-900 font-bold">real-world action</span>.
              <br className="hidden md:block" />
              See a need, fill a need.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
          >
            <MagneticButton
              onClick={onEnter}
              className="inline-flex items-center px-8 py-4 bg-gray-900 text-white rounded-full font-bold text-base transition-all group shadow-xl shadow-gray-900/10 hover:bg-[#FF6321] hover:shadow-[#FF6321]/20"
            >
              Get Started Free
              <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
            </MagneticButton>
            <MagneticButton
              onClick={() => document.getElementById('impact')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-full font-bold text-base transition-all hover:border-[#FF6321]/30 hover:text-[#FF6321]"
            >
              See Our Impact
              <ArrowUpRight className="ml-2" size={18} />
            </MagneticButton>
          </motion.div>
        </motion.div>

      </section>

      {/* ═══ Impact Section ═══ */}
      <section id="impact" className="py-32 md:py-40 px-8 md:px-16 bg-[#f9f9f7]">
        <div className="max-w-7xl mx-auto">
          <SectionReveal className="mb-20 text-center">
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-block text-xs font-black text-[#FF6321] uppercase tracking-[0.25em] mb-4 px-4 py-1.5 bg-[#FF6321]/5 rounded-full"
            >
              Our Impact
            </motion.span>
            <h2 className="text-4xl md:text-7xl font-black text-gray-900 tracking-tighter mb-6 leading-[0.95]">
              REAL DATA. <span className="text-[#FF6321]">REAL IMPACT.</span>
            </h2>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-20 h-1.5 bg-[#FF6321] mx-auto rounded-full origin-left"
            />
          </SectionReveal>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12"
          >
            {[
              {
                icon: Shield,
                title: 'Verified Needs',
                desc: 'Our survey system ensures that every request for help is verified by local community members before being broadcast.',
                gradient: 'from-orange-50 to-amber-50'
              },
              {
                icon: Users,
                title: 'Direct Action',
                desc: 'Connect directly with those in need. No middlemen, no delays. Just pure, community-driven support.',
                gradient: 'from-emerald-50 to-teal-50'
              },
              {
                icon: Globe,
                title: 'Global Network',
                desc: 'Join a worldwide movement of volunteers using data to create measurable impact in their local neighborhoods.',
                gradient: 'from-blue-50 to-indigo-50'
              }
            ].map((card, i) => (
              <motion.div
                key={card.title}
                variants={itemVariants}
                whileHover={{ y: -8, transition: { duration: 0.4 } }}
                className={`group p-10 bg-gradient-to-br ${card.gradient} backdrop-blur-xl rounded-[32px] border border-white/80 shadow-lg shadow-gray-200/30 hover:shadow-2xl hover:shadow-[#FF6321]/10 transition-shadow duration-500 relative overflow-hidden`}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#FF6321]/0 to-[#FF6321]/0 group-hover:from-[#FF6321]/[0.02] group-hover:to-[#FF6321]/[0.06] transition-all duration-700 rounded-[32px]" />

                <div className="relative z-10">
                  <motion.div
                    whileHover={{ rotate: -5, scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#FF6321] mb-8"
                  >
                    <card.icon size={32} strokeWidth={1.8} />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{card.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-base font-medium">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ Metrics — Stacked Full-Screen Panels ═══ */}
      {metricsData.map((item, i) => (
        <section
          key={i}
          className="relative h-screen bg-gray-950 flex flex-col items-center justify-center px-8 md:px-24 text-center overflow-hidden"
        >
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px'
            }}
          />

          {/* Accent glow */}
          <div className={`absolute w-[500px] h-[500px] rounded-full blur-[160px] ${i % 2 === 0 ? 'bg-[#FF6321]/[0.06] top-1/4 left-1/4' : 'bg-[#FF6321]/[0.04] bottom-1/4 right-1/4'
            }`} />

          {/* Divider line between panels */}
          {i > 0 && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-gray-700/30 to-transparent" />
          )}

          <motion.div
            initial={{ opacity: 0, y: 60, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col items-center"
          >
            <span className="text-[11px] font-black tracking-[0.4em] text-gray-600 mb-2 uppercase">
              0{i + 1} / 04
            </span>

            <motion.span
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-sm md:text-lg font-black tracking-[0.3em] text-gray-500 mb-4 uppercase"
            >
              {item.label}
            </motion.span>

            <h2 className={`text-[16vw] md:text-[12vw] font-black ${item.color} leading-none tracking-tighter mb-6`}>
              <AnimatedCounter value={item.displayVal} />
            </h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.7 }}
              className="text-lg md:text-2xl text-gray-500 max-w-2xl font-medium leading-relaxed"
            >
              {item.desc}
            </motion.p>
          </motion.div>

          {/* Scroll hint on first panel */}
          {i === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center text-gray-600"
            >
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
              >
                <ChevronDown size={20} strokeWidth={2} />
              </motion.div>
            </motion.div>
          )}
        </section>
      ))}

      {/* ═══ How it Works — Sticky Reveal ═══ */}
      <section id="how-it-works" className="py-32 md:py-40 px-8 md:px-16 bg-[#fdfdfc]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
            {/* Left — Sticky */}
            <div className="sticky top-32 h-fit space-y-8">
              <SectionReveal>
                <span className="inline-block text-xs font-black text-[#FF6321] uppercase tracking-[0.25em] mb-4 px-4 py-1.5 bg-[#FF6321]/5 rounded-full">How It Works</span>
                <h2 className="text-5xl md:text-8xl font-black text-gray-900 tracking-tighter leading-[0.9]">
                  HOW IT <br />
                  <span className="text-[#FF6321]">WORKS.</span>
                </h2>
                <p className="text-lg text-gray-500 leading-relaxed max-w-md mt-6">
                  We've streamlined the process of giving and receiving help through a data-driven approach.
                </p>
              </SectionReveal>
              <SectionReveal delay={0.2}>
                <MagneticButton
                  onClick={onEnter}
                  className="inline-flex items-center px-8 py-4 bg-gray-900 text-white rounded-full font-bold transition-all group shadow-xl shadow-gray-900/10 hover:bg-[#FF6321] hover:shadow-[#FF6321]/20"
                >
                  Start Volunteering
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
                </MagneticButton>
              </SectionReveal>
            </div>

            {/* Right — Scrolling Steps */}
            <div className="space-y-24 md:space-y-32">
              {[
                {
                  num: '01',
                  title: 'Survey the Area',
                  desc: 'Volunteers conduct local surveys to identify specific needs, from food insecurity to infrastructure repairs.',
                  icon: Zap
                },
                {
                  num: '02',
                  title: 'Verify & Broadcast',
                  desc: 'Data is verified by community leaders and then broadcast as actionable tasks to our global network.',
                  icon: Shield
                },
                {
                  num: '03',
                  title: 'Take Action',
                  desc: 'Volunteers claim tasks and provide direct support, closing the loop on community needs.',
                  icon: CheckCircle2
                }
              ].map((step, i) => (
                <motion.div
                  key={step.num}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-80px" }}
                  variants={stepVariants}
                  transition={{ delay: i * 0.1 }}
                  className="group relative pl-8 border-l-2 border-gray-100 hover:border-[#FF6321]/30 transition-colors duration-500"
                >
                  {/* Step indicator dot */}
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1, type: 'spring', stiffness: 300 }}
                    className="absolute -left-[9px] top-0 w-4 h-4 bg-[#FF6321] rounded-full ring-4 ring-white"
                  />
                  <div className="text-6xl md:text-8xl font-black text-gray-100 group-hover:text-[#FF6321]/10 transition-colors duration-500 leading-none mb-2">{step.num}</div>
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-base md:text-lg text-gray-500 leading-relaxed max-w-md">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Stories Section — Immersive ═══ */}
      <section id="stories" className="py-32 md:py-40 px-8 md:px-16 bg-[#f3f3f0] overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Image Side */}
            <div className="relative">
              <SectionReveal>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.6 }}
                  className="aspect-[4/5] rounded-[32px] overflow-hidden shadow-2xl shadow-gray-400/20"
                >
                  <img
                    src={ASSETS.volunteerGroup}
                    alt="Volunteers collaborating in the community"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              </SectionReveal>

              {/* Floating Stats Card */}
              <motion.div
                initial={{ opacity: 0, x: -40, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="absolute -bottom-8 -right-4 md:-right-8 bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-gray-300/20 max-w-[260px] border border-gray-100 hidden md:block"
              >
                <div className="flex items-center space-x-4 mb-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                    <Heart size={22} fill="currentColor" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900">12.4k</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lives Impacted</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Real-time data tracking allows us to see the immediate impact of every volunteer action.
                </p>
              </motion.div>
            </div>

            {/* Text Side */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              <div>
                <span className="inline-block text-xs font-black text-[#FF6321] uppercase tracking-[0.25em] mb-4 px-4 py-1.5 bg-[#FF6321]/5 rounded-full">Our Story</span>
                <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tighter leading-[0.9]">
                  DATA DRIVEN <br />
                  <span className="text-[#FF6321]">COMPASSION.</span>
                </h2>
              </div>
              <p className="text-lg text-gray-500 leading-relaxed">
                We believe that the best way to help is to listen first. Our platform turns community feedback into actionable tasks for volunteers.
              </p>
              <div className="space-y-3">
                {['Verified Impact', 'Direct Connection', 'Global Reach'].map((item, i) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center space-x-3 text-gray-700 font-bold"
                  >
                    <div className="w-6 h-6 bg-[#FF6321]/10 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="text-[#FF6321]" size={14} />
                    </div>
                    <span>{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ CTA Section ═══ */}
      <section className="py-24 md:py-32 px-8 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl mx-auto bg-gradient-to-br from-[#FF6321] to-[#e85a1b] rounded-[48px] p-12 md:p-20 text-center text-white relative overflow-hidden noise-overlay"
        >
          <div className="relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-4xl md:text-7xl font-black mb-6 tracking-tighter leading-[0.9]"
            >
              BE THE <br /> CONNECTION.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-orange-100 text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed"
            >
              Your skills and time are the missing piece in someone else's puzzle. Join NGO Connect today.
            </motion.p>
            <MagneticButton
              onClick={onEnter}
              className="px-10 py-4 bg-white text-[#FF6321] rounded-full font-bold text-base transition-all shadow-xl shadow-black/10 hover:shadow-2xl"
            >
              Get Started Now
            </MagneticButton>
          </div>

          {/* Decorative floating orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl animate-pulse-glow" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-black/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl animate-pulse-glow" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] border border-white/5 rounded-full" />
        </motion.div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="py-16 md:py-20 px-8 md:px-16 bg-[#fdfdfc] border-t border-gray-100">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black tracking-tighter text-gray-900">NGO</span>
              <span className="text-2xl font-black tracking-tighter text-[#FF6321]">CONNECT</span>
            </div>
            <p className="text-gray-400 max-w-sm leading-relaxed text-sm">
              Empowering communities through data-driven volunteerism. We bridge the gap between local needs and global compassion.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Platform</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              {['Surveys', 'Open Tasks', 'Volunteer Map'].map(item => (
                <li key={item}>
                  <a href="#" className="hover:text-[#FF6321] transition-colors duration-300">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-gray-900 uppercase text-xs tracking-widest">Company</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              {['About Us', 'Our Impact', 'Contact'].map(item => (
                <li key={item}>
                  <a href="#" className="hover:text-[#FF6321] transition-colors duration-300">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-400">© 2026 NGO Connect. All rights reserved.</p>
          <div className="flex space-x-6 text-xs text-gray-400">
            <a href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
