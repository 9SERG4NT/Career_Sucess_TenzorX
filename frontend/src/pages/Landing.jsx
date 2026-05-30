import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  motion, AnimatePresence, useScroll, useTransform, useReducedMotion,
  useInView, animate,
} from 'motion/react';
import {
  ArrowRight, Eye, Globe, Target, ChevronDown,
  GraduationCap, Banknote,
} from 'lucide-react';
import { BrandMark } from '../components/AppShell';

const QUOTES = [
  {
    text: "Education isn't a degree — it's a trajectory.",
    tail: "Let's measure that, transparently.",
    attrib: "Two-sided promise",
  },
  {
    text: "Every loan we issue is a bet on a career.",
    tail: "We make sure the borrower wins it.",
    attrib: "On lender alignment",
  },
  {
    text: "Data informs.",
    tail: "The intervention does the work.",
    attrib: "On Next-Best-Action",
  },
];

const USPS = [
  {
    serial: 'I',
    title: 'Transparent by design',
    body: "Borrower and lender see the same SHAP-explained placement score. F1 = 0.86, salary MAPE = 12.6%, fully audit-trailed. No black box on either side.",
    icon: Eye,
  },
  {
    serial: 'II',
    title: 'Real market data, not synthetic confidence',
    body: "World Bank macroeconomic indicators + Foundit / Naukri job-posting volumes + 2025 campus placement reports feed every prediction. Live placement-shock detection.",
    icon: Globe,
  },
  {
    serial: 'III',
    title: 'Intervention ROI, not just predictions',
    body: "Every high-risk borrower gets a ranked Next-Best-Action list with cost + ROI. The lender funds it, the borrower acts on it, the portfolio outcome improves.",
    icon: Target,
  },
];

// ─── KPI count-up ──────────────────────────────────────────────────
function Counter({ to, suffix = '', prefix = '', decimals = 0, duration = 1.6, delay = 0 }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, to, {
      duration,
      delay,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [to, duration, delay, reduce]);

  const display = decimals === 0
    ? Math.round(value).toLocaleString('en-IN')
    : value.toFixed(decimals);

  return <span ref={ref} className="mono">{prefix}{display}{suffix}</span>;
}

// ─── Hero ──────────────────────────────────────────────────────────
function Hero({ scrollY, onScrollHint }) {
  const reduce = useReducedMotion();
  const heroWashY = useTransform(scrollY, [0, 600], [0, 140]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.4]);

  const headlineWords = ['Education', 'loans,', 'but', 'with'];

  return (
    <section className="landing-hero">
      {/* Parallax ink wash */}
      <motion.div
        aria-hidden
        className="landing-hero-wash"
        style={{ y: reduce ? 0 : heroWashY, opacity: reduce ? 1 : heroOpacity }}
      />

      <div className="landing-hero-inner">
        {/* Top bar */}
        <header className="landing-topbar">
          <BrandMark size={40} />
          <Link to="/signin" className="landing-topbar-cta">
            Sign in <ArrowRight size={14} />
          </Link>
        </header>

        {/* Eyebrow */}
        <motion.div
          className="landing-eyebrow"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <span style={{ color: 'var(--signal)' }}>POONAWALLA FINCORP</span>
          <span style={{ width: '24px', height: '1px', background: 'var(--rule-strong)', display: 'inline-block' }} />
          <span>Career Risk Intelligence</span>
        </motion.div>

        {/* Headline — word-by-word reveal + serif italic flourish */}
        <h1 className="landing-headline">
          {headlineWords.map((w, i) => (
            <motion.span
              key={i}
              className="landing-headline-word"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 + i * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {w}{' '}
            </motion.span>
          ))}
          <motion.span
            className="landing-headline-italic"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.65, ease: [0.2, 0.7, 0.2, 1] }}
          >
            foresight.
          </motion.span>
        </h1>

        {/* Sub */}
        <motion.p
          className="landing-sub"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0, ease: [0.2, 0.7, 0.2, 1] }}
        >
          The first education-loan platform that scores placement risk{' '}
          <em style={{ color: 'var(--ink)', fontStyle: 'italic' }}>transparently to both sides</em>. Lenders see portfolio risk. Borrowers see their own predicted career trajectory — and a free path to improve it.
        </motion.p>

        {/* Dual CTA */}
        <motion.div
          className="landing-cta-row"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <Link to="/signin?role=student" className="landing-cta landing-cta-primary">
            <GraduationCap size={17} />
            <span>I'm a borrower</span>
            <ArrowRight size={15} />
          </Link>
          <Link to="/signin?role=admin" className="landing-cta landing-cta-ghost">
            <Banknote size={17} />
            <span>I'm a lender</span>
            <ArrowRight size={15} />
          </Link>
        </motion.div>

        {/* KPI strip */}
        <motion.div
          className="landing-kpi-strip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.5 }}
        >
          {[
            { num: 10000, prefix: '', suffix: '', label: 'Student records' },
            { num: 0.86, decimals: 2, prefix: '', suffix: '', label: 'F1 · 6-month' },
            { num: 32, suffix: '', label: 'API endpoints' },
            { num: 5, suffix: '', label: 'AI agents' },
          ].map((k, i) => (
            <div key={k.label} className="landing-kpi">
              <span className="landing-kpi-num">
                <Counter to={k.num} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals || 0} duration={1.4} delay={1.6 + i * 0.12} />
              </span>
              <span className="landing-kpi-label">{k.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Scroll hint */}
        <motion.button
          className="landing-scroll-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.4 }}
          onClick={onScrollHint}
          aria-label="Scroll down"
        >
          <motion.span
            animate={reduce ? {} : { y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown size={18} />
          </motion.span>
        </motion.button>
      </div>
    </section>
  );
}

// ─── Quote rotator ────────────────────────────────────────────────
function QuoteRotator() {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((p) => (p + 1) % QUOTES.length), 7000);
    return () => clearInterval(t);
  }, [reduce]);

  const q = QUOTES[i];

  return (
    <section className="landing-section landing-quote-section">
      <div className="landing-section-inner">
        <div className="landing-section-eyebrow">
          <span style={{ color: 'var(--signal)' }}>02</span>
          <span>The Promise</span>
        </div>

        <div className="landing-quote-stage">
          <AnimatePresence mode="wait">
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.65, ease: [0.2, 0.7, 0.2, 1] }}
              className="landing-quote-figure"
            >
              <span className="landing-quote-mark" aria-hidden>"</span>
              <blockquote className="landing-quote">
                <span className="landing-quote-text">{q.text}</span>{' '}
                <span className="landing-quote-tail">{q.tail}</span>
              </blockquote>
              <figcaption className="landing-quote-attrib">— {q.attrib}</figcaption>
            </motion.figure>
          </AnimatePresence>

          {/* Pager */}
          <div className="landing-quote-pager">
            {QUOTES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Quote ${idx + 1}`}
                className={`landing-quote-pager-dot ${idx === i ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── USP grid ──────────────────────────────────────────────────────
function UspGrid() {
  return (
    <section className="landing-section landing-usp-section">
      <div className="landing-section-inner">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <div className="landing-section-eyebrow">
          <span style={{ color: 'var(--signal)' }}>03</span>
            <span>The Unique Selling Proposition</span>
          </div>
          <h2 className="landing-section-title">
            The only education-loan platform that scores risk{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--signal)' }}>transparently to both sides.</em>
          </h2>
        </motion.div>

        <div className="landing-usp-grid">
          {USPS.map((usp, i) => (
            <motion.article
              key={usp.serial}
              className="landing-usp-card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.65, delay: i * 0.12, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <div className="landing-usp-card-head">
                <span className="landing-usp-card-serial">№ {usp.serial}</span>
                <usp.icon size={18} color="var(--signal)" />
              </div>
              <h3 className="landing-usp-card-title">{usp.title}</h3>
              <p className="landing-usp-card-body">{usp.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works — Borrower vs Lender side-by-side ────────────────
function HowItWorks() {
  const cols = [
    {
      heading: 'For the borrower',
      side: 'Borrower',
      sideColor: 'var(--signal)',
      steps: [
        ['Apply', 'Three-step loan application — academic, financial, review.'],
        ['Pre-screen', 'Instant placement-risk score with SHAP-explained drivers. See your salary band, EMI comfort, and recruiter matches.'],
        ['Improve', 'Free Next-Best-Action plan: certifications, mock interviews, recruiter intros. The intervention that lifts your score the most, first.'],
      ],
    },
    {
      heading: 'For the lender',
      side: 'Lender',
      sideColor: 'var(--navy)',
      steps: [
        ['Monitor', 'Portfolio dashboard of every borrower with risk band, EMI comfort, drift signals, fairness audit.'],
        ['Intervene', 'Fund the highest-ROI NBA per borrower. Track cost vs lift in placement probability.'],
        ['Realise', 'Lower delinquency, higher placement velocity, audit-ready FLDG compliance reports.'],
      ],
    },
  ];

  return (
    <section className="landing-section landing-how-section">
      <div className="landing-section-inner">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.7 }}
        >
          <div className="landing-section-eyebrow">
          <span style={{ color: 'var(--signal)' }}>04</span>
            <span>How It Works</span>
          </div>
          <h2 className="landing-section-title">
            One predictive engine. <em style={{ fontStyle: 'italic' }}>Two journeys.</em>
          </h2>
        </motion.div>

        <div className="landing-how-grid">
          {cols.map((col, ci) => (
            <motion.div
              key={col.side}
              className="landing-how-col"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.7, delay: ci * 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <div className="landing-how-side-badge" style={{ borderLeftColor: col.sideColor, color: col.sideColor }}>
                {col.side}
              </div>
              <h3 className="landing-how-heading">{col.heading}</h3>
              <ol className="landing-how-steps">
                {col.steps.map(([t, body], si) => (
                  <li key={t}>
                    <span className="landing-how-step-num">{String(si + 1).padStart(2, '0')}</span>
                    <div>
                      <div className="landing-how-step-title">{t}</div>
                      <div className="landing-how-step-body">{body}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Closing CTA ───────────────────────────────────────────────────
function ClosingCta() {
  return (
    <section className="landing-section landing-closing-section">
      <div className="landing-section-inner landing-closing-inner">
        <motion.h2
          className="landing-closing-title"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20%' }}
          transition={{ duration: 0.75 }}
        >
          Pick the side you're on.
        </motion.h2>

        <motion.div
          className="landing-cta-row"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20%' }}
          transition={{ duration: 0.65, delay: 0.15 }}
        >
          <Link to="/signin?role=student" className="landing-cta landing-cta-primary">
            <GraduationCap size={17} />
            <span>Apply as a borrower</span>
            <ArrowRight size={15} />
          </Link>
          <Link to="/signin?role=admin" className="landing-cta landing-cta-ghost">
            <Banknote size={17} />
            <span>Sign in as a lender</span>
            <ArrowRight size={15} />
          </Link>
        </motion.div>

        <div className="landing-footer">
          © 2026 Poonawalla Fincorp · PlacementIQ v2.0 · prototype
        </div>
      </div>
    </section>
  );
}

// ─── Landing ───────────────────────────────────────────────────────
export default function Landing() {
  const { scrollY } = useScroll();
  const navigate = useNavigate();
  const quoteRef = useRef(null);

  // Redirect if already signed in
  // (Soft redirect — preserves localStorage so refresh into / doesn't loop)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('placementiq_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.role === 'admin') navigate('/dashboard', { replace: true });
        if (u?.role === 'student') navigate('/me/dashboard', { replace: true });
      }
    } catch {}
  }, [navigate]);

  return (
    <div className="landing">
      <Hero scrollY={scrollY} onScrollHint={() => quoteRef.current?.scrollIntoView({ behavior: 'smooth' })} />
      <div ref={quoteRef}>
        <QuoteRotator />
      </div>
      <UspGrid />
      <HowItWorks />
      <ClosingCta />
    </div>
  );
}
