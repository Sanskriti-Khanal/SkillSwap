import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Star } from 'lucide-react';

const ROTATING = ['Programming', 'Mathematics', 'Design', 'Music', 'Business', 'Science'];
const TRENDING = ['Programming', 'Design', 'Mathematics', 'English', 'Music', 'Business'];

const TUTORS = [
  { initials: 'AR', bg: '#2B2421' },
  { initials: 'PK', bg: '#B9D532', color: '#2B2421' },
  { initials: 'SM', bg: '#F47B20' },
  { initials: 'RB', bg: '#61B44E' },
  { initials: 'DT', bg: '#718096' },
];

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [displayed, setDisplayed] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [typing, setTyping] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const word = ROTATING[wordIdx];
    let timeout;
    if (typing) {
      if (displayed.length < word.length) {
        timeout = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 90);
      } else {
        timeout = setTimeout(() => setTyping(false), 1800);
      }
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(d => d.slice(0, -1)), 45);
      } else {
        setWordIdx(i => (i + 1) % ROTATING.length);
        setTyping(true);
      }
    }
    return () => clearTimeout(timeout);
  }, [displayed, typing, wordIdx]);

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/listings${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`);
  };

  const row1 = [
    { title: "The Best of the Best!", text: "Every lesson has been fresh and exciting, setting me up for significant progress every time. Finally, and most importantly, Rashida has helped me to love MY voice.", author: "Danielle", lessons: 19, tutor: "Rashida", subject: "Voice Tutor", color: "#F47B20", bg: "#FCE1E4", avatar: "https://i.pravatar.cc/150?img=43" },
    { title: "A+ Tutor - Knowledgable and patient", text: "Charles has been a terrific tutor for my 17-year-old daughter in AP Chemistry. He reviews the material in a manner that is easy to understand and fosters a positive learning environment.", author: "Annette", lessons: 104, tutor: "Charles", subject: "Chemistry Tutor", color: "#7CB342", bg: "#E8DFF5", avatar: "https://i.pravatar.cc/150?img=11" },
    { title: "Great tutor", text: "My son is a high school sophomore. He was struggling with Geometry. Danny has been a great geometry tutor for my son. He went from a D to B in one quarter. Very happy with Danny.", author: "Debra", lessons: 8, tutor: "Danny", subject: "Geometry Tutor", color: "#B9D532", bg: "#E2F0CB", avatar: "https://i.pravatar.cc/150?img=12" },
    { title: "Amazing progress!", text: "In just a few weeks, my daughter's confidence in Math skyrocketed. James breaks down complex problems into easy steps. Absolutely fantastic experience.", author: "Sarah", lessons: 12, tutor: "James", subject: "Math Tutor", color: "#1E88E5", bg: "#FFF6CC", avatar: "https://i.pravatar.cc/150?img=22" },
    { title: "Highly recommended", text: "I never thought I could learn to code, but Eric broke everything down perfectly. His patience and structured lessons made all the difference. I built my first app!", author: "Emily", lessons: 34, tutor: "Eric", subject: "Coding Tutor", color: "#F47B20", bg: "#D4E6F1", avatar: "https://i.pravatar.cc/150?img=5" },
  ];

  const row2 = [
    { title: "Wonderful tutor", text: "Mikayla is an amazing tutor! She is extremely knowledgeable and so patient to boot! Now I'm looking forward to her working with my daughter after she laid the groundwork.", author: "Sunny", lessons: 10, tutor: "Mikayla", subject: "Writing Tutor", color: "#1E88E5", bg: "#E8DFF5", avatar: "https://i.pravatar.cc/150?img=32" },
    { title: "Fun and engaging", text: "My kids actually look forward to their French lessons now. Marie uses games and interactive stories. The interactivity is amazing and their pronunciation is improving fast.", author: "Lisa", lessons: 22, tutor: "Marie", subject: "French Tutor", color: "#B9D532", bg: "#FCE1E4", avatar: "https://i.pravatar.cc/150?img=9" },
    { title: "Patient and clear", text: "Physics used to be a nightmare, but Michael explains it with such clarity. I actually look forward to our sessions. My grades have gone from a C to an A+!", author: "John", lessons: 15, tutor: "Michael", subject: "Physics Tutor", color: "#1E88E5", bg: "#D4E6F1", avatar: "https://i.pravatar.cc/150?img=60" },
    { title: "A true artist", text: "Chloe helped me master watercolors in just a month. She is incredibly talented, observant, and gives the most constructive feedback. Highly recommended!", author: "Mia", lessons: 6, tutor: "Chloe", subject: "Art Tutor", color: "#F47B20", bg: "#E2F0CB", avatar: "https://i.pravatar.cc/150?img=47" },
    { title: "Perfect for beginners", text: "I started guitar from scratch. Alex is so encouraging and makes sure my technique is right. Now I can play my favorite songs confidently! Best tutor ever.", author: "David", lessons: 45, tutor: "Alex", subject: "Guitar Tutor", color: "#7CB342", bg: "#FFF6CC", avatar: "https://i.pravatar.cc/150?img=68" },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F1', fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>

      {/* ── Keyframes injected once ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes floatA { 0%,100%{transform:translateY(0px) rotate(0deg)} 33%{transform:translateY(-12px) rotate(1deg)} 66%{transform:translateY(-6px) rotate(-1deg)} }
        @keyframes glowPulse { 0%,100%{opacity:.45} 50%{opacity:.75} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        
        .hero-img-container {
          position: absolute;
          top: 40px;
          z-index: 5;
          width: 25%;
          max-width: 350px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          animation: fadeSlideUp .7s ease both;
          animation-delay: 0.2s;
        }
        .hero-img-left { left: 0; }
        .hero-img-right { right: 0; }
        .hero-img {
          width: 100%;
          height: auto;
          max-height: 580px;
          object-fit: contain;
        }
        
        @media (max-width: 1024px) {
          .hero-img-container {
            width: 20%;
            opacity: 0.4;
            pointer-events: none;
          }
        }
        .marquee-wrapper {
          overflow: hidden;
          width: 100%;
          position: relative;
        }
        .marquee-content-left {
          display: flex;
          width: max-content;
          animation: scroll-left 50s linear infinite;
        }
        .marquee-content-right {
          display: flex;
          width: max-content;
          animation: scroll-right 50s linear infinite;
        }
        .marquee-content-left:hover, .marquee-content-right:hover {
          animation-play-state: paused;
        }
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .marquee-card {
          width: 380px;
          flex-shrink: 0;
          margin: 0 12px;
          white-space: normal;
        }
        @media (max-width: 768px) {
          .hero-img-container {
            display: none;
          }
          .zig-zag-row { flex-direction: column !important; text-align: center !important; gap: 32px !important; }
          .zig-zag-text { text-align: center !important; }
          .zig-zag-arrow { display: none !important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{ background: '#1E1A18', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 52px', height: 88, position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/images/image copy 2.png" alt="SkillSwap" style={{ height: 48, width: 'auto' }} />
          <span style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>SkillSwap</span>
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/login" style={{ color: 'rgba(255,255,255,.8)', fontWeight: 500, fontSize: '.9rem', padding: '9px 22px', borderRadius: 10, textDecoration: 'none', transition: 'color .15s' }}>Log in</Link>
          <Link to="/register" style={{ background: '#F47B20', color: '#fff', fontWeight: 600, fontSize: '.9rem', padding: '9px 22px', borderRadius: 10, textDecoration: 'none' }}>Sign up free</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', minHeight: 580, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 48px', overflow: 'hidden' }}>
        {/* Very subtle background accent */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(185,213,50,.09) 0%, transparent 100%)', pointerEvents: 'none' }} />

        {/* ── Left content (Image) ── */}
        <div className="hero-img-container hero-img-left">
          <img src="/images/image copy.png" alt="Hero Illustration Left" className="hero-img" />
        </div>

        {/* ── Center content ── */}
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: 680, animation: 'fadeSlideUp .7s ease both' }}>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(2.2rem, 5.5vw, 3.6rem)', fontWeight: 700, lineHeight: 1.1, color: '#1A1512', letterSpacing: '-0.04em', marginBottom: 36 }}>
            The network for<br />
            <span style={{ color: '#B9D532', position: 'relative', display: 'inline-block' }}>
              {displayed}
              <span style={{ display: 'inline-block', width: 2, height: '0.85em', background: '#B9D532', marginLeft: 3, verticalAlign: 'middle', animation: 'blink .7s step-end infinite' }} />
            </span>
            {' '}tutors
          </h1>

          {/* Search */}
          <form onSubmit={handleSearch} style={{ display: 'flex', maxWidth: 560, margin: '0 auto 24px', background: '#fff', borderRadius: 18, boxShadow: '0 2px 0 rgba(0,0,0,.04), 0 8px 40px rgba(0,0,0,.10)', overflow: 'hidden', border: '1.5px solid rgba(0,0,0,.07)' }}>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="What would you like to learn?"
              style={{ flex: 1, border: 'none', outline: 'none', padding: '18px 22px', fontSize: '1rem', fontFamily: 'inherit', color: '#1A1512', background: 'transparent' }}
            />
            <button type="submit" style={{ background: '#F47B20', border: 'none', cursor: 'pointer', margin: 6, borderRadius: 12, padding: '0 22px', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontWeight: 600, fontSize: '.9rem', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Search
            </button>
          </form>

          {/* Social proof row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', flexWrap: 'wrap', marginBottom: 32 }}>
            {[
              { val: '200+', label: 'Expert tutors', color: '#F47B20' },
              { val: '500+', label: 'Sessions completed', color: '#61B44E' },
              { val: '4.9', label: 'Average rating', color: '#B9D532', icon: true },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {s.val}
                  {s.icon && <Star width={20} height={20} strokeWidth={2} color={s.color} fill={s.color} aria-hidden="true" />}
                </div>
                <div style={{ fontSize: '.85rem', color: '#8A7E7A', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Trending pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '.8rem', fontWeight: 500, color: '#8A7E7A', letterSpacing: '.01em' }}>Trending:</span>
            {TRENDING.map(t => (
              <button key={t} onClick={() => navigate(`/listings?keyword=${encodeURIComponent(t)}`)} style={{ background: '#fff', border: '1.5px solid #E5E0DB', borderRadius: 999, padding: '5px 14px', fontSize: '.8rem', fontFamily: 'inherit', color: '#3C322F', cursor: 'pointer', fontWeight: 500, boxShadow: '0 1px 4px rgba(0,0,0,.05)', transition: 'all .15s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#F47B20'; e.currentTarget.style.color = '#F47B20'; e.currentTarget.style.background = '#FFF8F4'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#E5E0DB'; e.currentTarget.style.color = '#3C322F'; e.currentTarget.style.background = '#fff'; }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right content (Image) ── */}
        <div className="hero-img-container hero-img-right">
          <img src="/images/image.png" alt="Hero Illustration Right" className="hero-img" />
        </div>
      </section>



      {/* ── How it works ── */}
      <section style={{ padding: '48px 24px 88px', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: '.8rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#B9D532', marginBottom: 10 }}>How it works</p>
            <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 800, color: '#1A1512', letterSpacing: '-0.03em' }}>Simple. Fast. Effective.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 100, position: 'relative', alignItems: 'center' }}>
            {[
              { n: '01', title: 'Find a tutor', desc: 'Browse skill listings and filter by subject, price, or availability.', image: '/images/step1.png' },
              { n: '02', title: 'Book a session', desc: 'Pick a time that works for you and confirm your booking instantly.', image: '/images/step2.png' },
              { n: '03', title: 'Pay securely', desc: "Stripe-powered checkout. Your money is protected until you're satisfied.", image: '/images/step3.png' },
              { n: '04', title: 'Learn & review', desc: 'Attend your session and leave a rating to help the community grow.', image: '/images/step4.png' },
            ].map((s, index) => {
              const isEven = index % 2 !== 0;
              return (
                <div key={s.n} className="zig-zag-row" style={{ display: 'flex', flexDirection: isEven ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 48, width: '100%', position: 'relative' }}>
                  
                  <div className="zig-zag-text" style={{ flex: 1, textAlign: isEven ? 'right' : 'left' }}>
                    <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', border: '2.5px solid #F47B20', color: '#F47B20', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, marginBottom: 20, background: '#fff' }}>
                      {s.n}
                    </div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1A1512', marginBottom: 12 }}>{s.title}</h3>
                    <div style={{ position: 'relative', display: 'block' }}>
                      <p style={{ fontSize: '1.05rem', color: '#7A6E6A', lineHeight: 1.6 }}>{s.desc}</p>
                    </div>
                  </div>

                  <div style={{ flex: 1, height: 280, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <img src={s.image} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'contain', zIndex: 1, position: 'relative' }} />
                    {index < 3 && (
                      <img src="/images/arrow.png" alt="" className="zig-zag-arrow" style={{ 
                        position: 'absolute', 
                        top: '75%', 
                        ...(isEven ? { right: '-80%', transform: 'scaleX(-1)' } : { left: '-80%' }), 
                        width: 650, 
                        pointerEvents: 'none', 
                        zIndex: 10 
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: '#1E1A18', padding: '88px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '.8rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#B9D532', marginBottom: 16 }}>Get started</p>
        <h2 style={{ color: '#fff', fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 14 }}>Ready to start learning?</h2>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '1rem', marginBottom: 40, maxWidth: 400, margin: '0 auto 40px' }}>
          Join SkillSwap and connect with expert tutors across Nepal.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{ background: '#F47B20', color: '#fff', fontWeight: 700, fontSize: '.95rem', padding: '14px 36px', borderRadius: 14, textDecoration: 'none' }}>Become a tutor</Link>
          <Link to="/listings" style={{ background: 'rgba(255,255,255,.08)', color: '#fff', fontWeight: 600, fontSize: '.95rem', padding: '14px 36px', borderRadius: 14, textDecoration: 'none', border: '1px solid rgba(255,255,255,.12)' }}>Browse tutors</Link>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: '88px 0', background: '#F7F4F1', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px', textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', fontWeight: 800, color: '#1A1512', letterSpacing: '-0.03em', marginBottom: 16 }}>Your next great tutor</h2>
          <p style={{ fontSize: '1.05rem', color: '#7A6E6A' }}>Enjoy one-on-one instruction from the nation's biggest network of independent experts.</p>
        </div>

        <div className="marquee-wrapper" style={{ marginBottom: 24 }}>
          <div className="marquee-content-left">
            {[...row1, ...row1].map((t, i) => (
              <div key={i} className="marquee-card" style={{ background: t.bg, borderRadius: 16, padding: 32, border: '6px solid #FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,.04)' }}>
                <h4 style={{ color: t.color, fontSize: '1.05rem', fontWeight: 800, marginBottom: 16 }}>
                  <span style={{ fontSize: '1.2rem', marginRight: 4 }}>“</span>{t.title}
                </h4>
                <div style={{ overflow: 'hidden' }}>
                  <img src={t.avatar} alt={t.tutor} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', float: 'left', marginRight: 16, marginBottom: 8, marginTop: 4 }} />
                  <p style={{ fontSize: '.95rem', color: '#3C322F', lineHeight: 1.6, marginBottom: 16 }}>{t.text}</p>
                  <p style={{ fontSize: '.85rem', color: '#7A6E6A', marginBottom: 4 }}>{t.author}, {t.lessons} lessons with {t.tutor}</p>
                  <p style={{ fontSize: '.85rem', fontWeight: 700, color: t.color }}>{t.subject}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="marquee-wrapper">
          <div className="marquee-content-right">
            {[...row2, ...row2].map((t, i) => (
              <div key={i} className="marquee-card" style={{ background: t.bg, borderRadius: 16, padding: 32, border: '6px solid #FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,.04)' }}>
                <h4 style={{ color: t.color, fontSize: '1.05rem', fontWeight: 800, marginBottom: 16 }}>
                  <span style={{ fontSize: '1.2rem', marginRight: 4 }}>“</span>{t.title}
                </h4>
                <div style={{ overflow: 'hidden' }}>
                  <img src={t.avatar} alt={t.tutor} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', float: 'left', marginRight: 16, marginBottom: 8, marginTop: 4 }} />
                  <p style={{ fontSize: '.95rem', color: '#3C322F', lineHeight: 1.6, marginBottom: 16 }}>{t.text}</p>
                  <p style={{ fontSize: '.85rem', color: '#7A6E6A', marginBottom: 4 }}>{t.author}, {t.lessons} lessons with {t.tutor}</p>
                  <p style={{ fontSize: '.85rem', fontWeight: 700, color: t.color }}>{t.subject}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}

      <footer style={{ background: '#141210', padding: '28px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}>
          <img src="/images/image copy 2.png" alt="SkillSwap" style={{ height: 28, width: 'auto' }} />
          <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, letterSpacing: '-0.02em' }}>SkillSwap</span>
        </div>
        <p style={{ color: '#5A5350', fontSize: '.78rem' }}>© {new Date().getFullYear()} SkillSwap. All rights reserved.</p>
      </footer>
    </div>
  );
}
