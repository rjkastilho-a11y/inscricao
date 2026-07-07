import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Database, ChevronDown } from 'lucide-react';

const TRUST_ITEMS = [
  { icon: Shield, label: 'LGPD' },
  { icon: Lock, label: 'Criptografia ponta a ponta' },
  { icon: Database, label: 'Backup diário' },
];

const heroTextVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

const mockupVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: 'easeOut' as const, delay: 0.3 },
  },
};

function BrowserMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-3xl">
      <img
        src="/screenshots/dashboard.png"
        alt="Dashboard do Kairós Events"
        className="w-full rounded-xl"
      />
      <div aria-hidden className="pointer-events-none absolute -inset-6 -z-10 rounded-[48px] bg-gradient-to-b from-amber-500/25 via-amber-500/10 to-transparent blur-3xl" />
    </div>
  );
}

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-slate-900 px-4 pb-8 pt-12 sm:px-8 sm:pb-12 sm:pt-16 lg:pb-16 lg:pt-28">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-0 size-[500px] bg-[radial-gradient(circle,rgba(217,119,6,0.1)_0%,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute -right-32 bottom-0 size-[400px] bg-[radial-gradient(circle,rgba(99,102,241,0.06)_0%,transparent_70%)]" />

      <div className="mx-auto max-w-7xl flex flex-col gap-0 lg:flex-row lg:gap-10">
        {/* Left column: all text content */}
        <motion.div
          variants={heroTextVariants}
          initial="hidden"
          animate="visible"
          className="max-w-[560px] flex flex-col gap-0"
        >
          {/* 1. BADGE */}
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            ⚡ Novo · Eventos sem taxa de plataforma
          </div>

          {/* 2. HEADLINE */}
          <h1 className="mb-2 text-5xl font-extrabold leading-tight tracking-tight text-white lg:text-6xl">
            Sua inscrição entregue.<br />
            <span className="text-[#fbbf24]">Zero taxa. 100% seu.</span>
          </h1>

          {/* 3. SUBTEXTO */}
          <p className="mb-7 max-w-lg text-base leading-relaxed text-slate-400">
            Receba o <strong className="font-semibold text-white">PIX direto na conta da sua igreja ou organização</strong>, gerencie lotes, emita recibos e diga adeus à prancheta de papel — tudo em um sistema feito para quem organiza eventos.
          </p>

          {/* 4. CTA */}
          <div className="mb-2">
            <Button
              onClick={() => navigate('/register')}
              className="rounded-xl bg-[#FACC15] px-8 py-[16px] text-base font-bold text-[#0d1117] shadow-lg shadow-amber-500/25 hover:brightness-110 hover:shadow-xl hover:shadow-amber-500/30"
            >
              Criar meu evento grátis →
            </Button>
          </div>

          {/* 5. MICRO-COPY */}
          <p className="mt-2 mb-6 text-sm text-slate-500">
            Grátis nas primeiras 15 inscrições · Sem cartão de crédito
          </p>

          {/* 6. TRUSTMARKS */}
          <div className="mb-7 flex flex-row items-center gap-4">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                <item.icon className="size-3" />
                {item.label}
              </div>
            ))}
          </div>

          {/* 7. STATS */}
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-5 py-4">
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-[#FACC15] sm:text-xl">+340</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">organizações usando</div>
            </div>
            <div className="h-10 w-px bg-white/[0.08]" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-[#FACC15] sm:text-xl">R$4,2M</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Processados via PIX</div>
            </div>
            <div className="h-10 w-px bg-white/[0.08]" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-[#FACC15] sm:text-xl">0%</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Taxa de plataforma</div>
            </div>
          </div>
        </motion.div>

        {/* Right: mockup */}
        <motion.div variants={mockupVariants} initial="hidden" animate="visible" className="flex-1 relative">
          {/* Intense glow behind mockup */}
          <div aria-hidden className="pointer-events-none absolute -inset-16 lg:-inset-24 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.25)_0%,rgba(217,119,6,0.1)_40%,transparent_70%)]" />
          <div aria-hidden className="pointer-events-none absolute -inset-8 rounded-[60px] bg-gradient-to-b from-amber-500/10 via-transparent to-transparent blur-2xl" />
          <BrowserMockup />
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto mt-4 flex max-w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5"
          >
            <span className="text-sm">📊</span>
            <span className="text-xs text-slate-400">
              Chega de Excel. Sua organização merece o máximo controle para seu evento.
            </span>
          </motion.div>
        </motion.div>
      </div>
      <motion.div
        animate={{ y: [0, 10, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className="mt-10 flex w-full justify-center lg:mt-6"
      >
        <div className="rounded-full bg-white/10 p-3 ring-1 ring-white/20">
          <ChevronDown className="size-6 text-amber-400" />
        </div>
      </motion.div>
    </section>
  );
}
