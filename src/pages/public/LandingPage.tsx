import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, ChevronRight, ArrowRight, ArrowUp } from 'lucide-react';
import HeroSection from '@/components/HeroSection';

const FEATURES = [
  {
    icon: '📅',
    title: 'Gestão completa',
    description: 'Planeje, organize e acompanhe cada etapa do seu evento com facilidade.',
    color: 'from-amber-500/20 to-amber-600/5',
    borderColor: 'border-amber-500/20',
    items: [
      'Páginas personalizadas',
      'Equipes e voluntários',
      'Painel administrativo',
      'Relatórios em tempo real',
    ],
  },
  {
    icon: '📋',
    title: 'Inscrições e pagamentos',
    description: 'Crie formulários personalizados, receba inscrições e pagamentos com segurança.',
    color: 'from-indigo-500/20 to-indigo-600/5',
    borderColor: 'border-indigo-500/20',
    items: [
      'Múltiplas formas de pagamento',
      'Lotes e cupons de desconto',
      'Confirmação automática',
      'Lista de participantes',
    ],
  },
  {
    icon: '💰',
    title: 'Financeiro e relatórios',
    description: 'Tenha clareza total das finanças e tome decisões com base em dados.',
    color: 'from-emerald-500/20 to-emerald-600/5',
    borderColor: 'border-emerald-500/20',
    items: [
      'Entradas e saídas',
      'Gráficos e indicadores',
      'Exportação para Excel',
      'Prestação de contas',
    ],
  },
  {
    icon: '🎫',
    title: 'Check-in e portaria',
    description: 'Agilize a entrada dos participantes com check-in digital e acompanhe a presença em tempo real.',
    color: 'from-sky-500/20 to-sky-600/5',
    borderColor: 'border-sky-500/20',
    items: [
      'Check-in digital',
      'Controle de presença',
      'Lista de participantes',
      'Portaria organizada',
    ],
  },
];

const WHY_KAIROS = [
  {
    icon: '💸',
    title: 'Sem taxa por inscrição',
    description: 'Receba pagamentos via PIX diretamente na conta da sua organização, sem comissões sobre cada inscrição.',
    color: 'from-amber-500/20 to-amber-600/5',
    borderColor: 'border-amber-500/20',
  },
  {
    icon: '🧩',
    title: 'Tudo em um só lugar',
    description: 'Gerencie inscrições, participantes, pagamentos, check-in e financeiro em uma única plataforma.',
    color: 'from-indigo-500/20 to-indigo-600/5',
    borderColor: 'border-indigo-500/20',
  },
  {
    icon: '⛪',
    title: 'Feito para igrejas',
    description: 'Desenvolvido para igrejas, ministérios e organizações cristãs que promovem eventos regularmente.',
    color: 'from-sky-500/20 to-sky-600/5',
    borderColor: 'border-sky-500/20',
  },
  {
    icon: '🚀',
    title: 'Evolução contínua',
    description: 'A plataforma evolui continuamente para oferecer uma experiência cada vez melhor.',
    color: 'from-emerald-500/20 to-emerald-600/5',
    borderColor: 'border-emerald-500/20',
  },
];

const STEPS = [
  {
    step: '1',
    title: 'Crie o evento e envie o link para os participantes',
    description: 'Preencha título, datas, local e valor. Um link público é gerado automaticamente — compartilhe no WhatsApp ou redes sociais.',
  },
  {
    step: '2',
    title: 'O participante se inscreve e faz o PIX direto para você',
    description: 'Os participantes acessam o link, preenchem o formulário e fazem o PIX diretamente para a sua conta. Sem taxas, sem intermediários.',
  },
  {
    step: '3',
    title: 'Confirme o pagamento e receba os participantes',
    description: 'Com 1 clique você confirma o pagamento, dispara o recibo via WhatsApp e faz o check-in digital na hora do evento.',
  },
];

const COMPARISON_CARDS = [
  {
    title: '📑 Planilha / Manual',
    color: 'border-red-500/30',
    titleColor: 'text-red-400',
    items: [
      '❌ Sujeito a erros',
      '❌ Perda de dados',
      '❌ Retrabalho',
      '❌ Sem integração',
    ],
  },
  {
    title: (
      <div className="flex items-center gap-2">
        <img src="/screenshots/Icone.png" alt="" className="h-5 w-auto" />
        <span className="font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Kairós</span>
        <span className="text-[9px] font-semibold uppercase text-[#F4B23A]" style={{ letterSpacing: '0.35em' }}>Events</span>
      </div>
    ),
    color: 'border-emerald-500/30',
    titleColor: 'text-emerald-400',
    items: [
      '✅ Automatizado',
      '✅ Seguro e confiável',
      '✅ Relatórios inteligentes',
      '✅ Tudo integrado',
    ],
  },
];

const AUDIENCE = [
  {
    emoji: '⛪',
    title: 'Igrejas e organizações',
    desc: 'Retiros de jovens, conferências de casais, congressos e cultos especiais com inscrição prévia.',
  },
  {
    emoji: '🙌',
    title: 'Ministérios e células',
    desc: 'Encontros de liderança, workshops de formação e treinamentos com controle de participantes.',
  },
  {
    emoji: '📣',
    title: 'Secretarias e coordenações',
    desc: 'Substitua planilhas e formulários manuais por um sistema organizado e profissional.',
  },
  {
    emoji: '🏢',
    title: 'Eventos corporativos',
    desc: 'Workshops empresariais, cursos, palestras e confraternizações com gestão profissional de participantes.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const [showBackToTop, setShowBackToTop] = useState(false);
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="font-sans text-slate-800 antialiased">
      <style>{`
        @keyframes cta-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,6,0.5); }
          50% { box-shadow: 0 0 0 12px rgba(217,119,6,0); }
        }
        .animate-cta-pulse {
          animation: cta-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-cta-pulse { animation: none; }
        }
      `}</style>

      {/* Navbar */}
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <img src="/screenshots/Icone.png" alt="" className="h-[36px] w-auto" />
          <div className="flex flex-col leading-none">
            <span className="text-xl font-bold text-white" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
              Kairós
            </span>
            <span className="text-[10px] font-semibold uppercase text-[#F4B23A]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.35em' }}>
              EVENTS
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('/login')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
            size="sm"
          >
            Entrar
          </Button>
          <Button
            onClick={() => navigate('/register')}
            className="bg-amber-600 text-white hover:bg-amber-700"
            size="sm"
          >
            Testar Grátis <ChevronRight className="size-3.5" />
          </Button>
        </div>
        </div>
      </header>

      <main className="pt-14">
        <HeroSection />

        {/* ======== FEATURES ======== */}
        <section className="bg-white px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-4xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                Tudo em um só lugar
              </span>
              <h2 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 lg:text-6xl">
        <span className="sm:hidden">Tudo o que você precisa em um só lugar</span>
        <span className="hidden sm:inline">Tudo que você precisa<br />para organizar eventos incríveis</span>
              </h2>
              <p className="mt-3 text-base text-slate-500">
                Mais organização, menos preocupação. Tenha tudo sob controle em uma plataforma feita<br className="hidden sm:inline" />
                para igrejas, ministérios e organizações cristãs.
              </p>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {FEATURES.map((f) => (
                <motion.div key={f.title} variants={staggerItem} className="h-full">
                  <div
                    className={`group h-full relative overflow-hidden rounded-xl border ${f.borderColor} bg-gradient-to-b ${f.color} p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 lg:p-8`}
                  >
                    <div className="mb-4 text-3xl lg:text-4xl">{f.icon}</div>
                    <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      {f.description}
                    </p>
                    <ul className="mt-4 space-y-2">
                      {f.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ======== HOW IT WORKS ======== */}
        <section className="bg-slate-50 px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mx-auto max-w-5xl text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              Como funciona
            </span>
            <h2 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 lg:text-6xl">
              Organize seu evento em 3 passos
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-slate-500">
              Sem treinamento. Sem complicação. Qualquer pessoa consegue usar no primeiro dia.
            </p>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-8 sm:grid-cols-3"
            >
              {STEPS.map((s) => (
                <motion.div key={s.step} variants={staggerItem} className="text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-900 font-serif text-xl font-bold text-amber-400 shadow-lg shadow-slate-900/10 lg:size-16 lg:text-2xl">
                    {s.step}
                  </div>
                  <h3 className="mt-6 text-base font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ======== POR QUE ESCOLHER O KAIRÓS ======== */}
        <section className="bg-white px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-4xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                Por que escolher o Kairós Events
              </span>
              <h2 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 lg:text-6xl">
        Desenvolvido para simplificar a organização de eventos cristãos
              </h2>
              <p className="mt-3 text-base text-slate-500">
                Do planejamento ao check-in, o Kairós Events reúne todas as ferramentas necessárias para organizar eventos com mais segurança, praticidade e controle.
              </p>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {WHY_KAIROS.map((f) => (
                <motion.div key={f.title} variants={staggerItem}>
                  <div
                    className={`group relative overflow-hidden rounded-xl border ${f.borderColor} bg-gradient-to-b ${f.color} p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 lg:p-8`}
                  >
                    <div className="mb-4 text-3xl lg:text-4xl">{f.icon}</div>
                    <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      {f.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ======== FINANCIAL HIGHLIGHT ======== */}
        <section className="bg-slate-900 px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mx-auto flex max-w-6xl flex-col gap-12 sm:flex-row sm:items-center lg:gap-16"
          >
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="flex-1"
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Chega de planilhas
              </span>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl text-balance">
                Chega de Excel que quebra no meio do evento.
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-slate-400">
                Trabalhe com segurança, elimine retrabalho e tenha todas as informações em um único lugar.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Dados protegidos e sempre disponíveis',
                  'Acesso de qualquer lugar',
                  'Adeus a erros e retrabalho',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="flex size-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-400">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {COMPARISON_CARDS.map((card) => (
                <motion.div
                  key={card.title}
                  variants={staggerItem}
                  className={`rounded-xl border ${card.color} bg-white/[4%] p-8 backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg hover:shadow-amber-500/5`}
                >
                  <h3 className={`text-base font-semibold ${card.titleColor}`}>{card.title}</h3>
                  <ul className="mt-4 space-y-4">
                    {card.items.map((item) => (
                      <li key={item} className="text-sm text-slate-300">{item}</li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ======== AUDIENCE ======== */}
        <section className="bg-white px-4 py-16 text-center sm:px-8 sm:py-24 lg:py-32">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mx-auto max-w-6xl"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              Para quem é
            </span>
            <h2 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 lg:text-6xl">
              Feito para a realidade de quem organiza eventos
            </h2>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-12 grid gap-6 text-left md:grid-cols-4"
            >
              {AUDIENCE.map((item) => (
                <motion.div
                  key={item.title}
                  variants={staggerItem}
                  className="rounded-xl border border-slate-200 p-6 transition-all duration-300 hover:border-amber-200 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <span className="block text-3xl" role="img" aria-hidden>{item.emoji}</span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ======== COMPARISON TABLE ======== */}
        <section className="bg-white px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mx-auto max-w-5xl text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              Comparativo
            </span>
            <h2 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 lg:text-6xl">
              Compare e veja por que o Kairós Events é diferente
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-500">
              Veja por que organizações estão trocando plataformas tradicionais e planilhas pelo Kairós Events.
            </p>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 overflow-x-auto"
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="p-4 font-semibold text-slate-900 w-1/3">Funcionalidade</th>
                    <th className="p-4 font-semibold text-amber-600 bg-amber-50/50 w-1/3">
                      <span className="inline-flex items-center gap-1.5">
                        Kairós Events
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-amber-500 rounded-full px-2 py-0.5">Melhor</span>
                      </span>
                    </th>
                    <th className="p-4 font-semibold text-slate-500 w-1/6">Outras Plataformas</th>
                    <th className="p-4 font-semibold text-slate-500 w-1/6">Planilha</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Taxa por inscrição', kairós: '0%', sympla: '~10%', planilha: '0% (mas...)', best: 'kairós' },
                    { feature: 'PIX direto na sua conta', kairós: '✓ Sim', sympla: '✗ Não', planilha: '✗ Manual', best: 'kairós' },
                    { feature: 'Recibo automático via WhatsApp', kairós: '✓ 1 clique', sympla: '✗', planilha: '✗ Manual', best: 'kairós' },
                    { feature: 'Check-in digital', kairós: '✓ Online', sympla: '✓ Pago', planilha: '✗', best: 'kairós' },
                    { feature: 'Formulário customizável', kairós: '✓ Sim', sympla: '✓ Limitado', planilha: '✗', best: 'kairós' },
                    { feature: 'Controle financeiro', kairós: '✓ Completo', sympla: '✓ Básico', planilha: '✓ Manual', best: 'kairós' },
                  ].map((row, i) => (
                    <tr key={row.feature} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="p-4 font-medium text-slate-900">{row.feature}</td>
                      {(['kairós', 'sympla', 'planilha'] as const).map((col) => (
                        <td key={col} className={`p-4 ${row.best === col ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </motion.div>
        </section>

        {/* ======== FAQ ======== */}
        <section className="bg-slate-50 px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mx-auto max-w-3xl"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-600 text-center block">
              FAQ
            </span>
            <h2 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 lg:text-6xl text-center">
              Dúvidas frequentes
            </h2>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-12 space-y-3"
            >
              {[
                {
                  q: 'Precisa de cartão de crédito para testar?',
                  a: 'Não. O teste gratuito de 15 dias não exige cartão de crédito nem qualquer forma de pagamento. Crie sua conta e comece a organizar seu evento imediatamente.',
                },
                {
                  q: 'Como funciona o pagamento por PIX?',
                  a: 'O participante faz o PIX diretamente para a sua conta — nenhum centavo passa pelo Kairós. Com 1 clique você confirma o pagamento no painel e o recibo é disparado automaticamente via WhatsApp.',
                },
                {
                  q: 'Posso cancelar quando quiser?',
                  a: 'Sim. Você pode cancelar a qualquer momento sem multa ou burocracia. Seus dados ficam disponíveis para exportação durante 30 dias após o cancelamento.',
                },
                {
                  q: 'O que acontece depois dos 15 dias de teste?',
                  a: 'Ao final do teste, você escolhe entre o Plano Mensal (R$ 97/mês) ou o Plano Anual (R$ 797/ano). Se não quiser continuar, sua conta é desativada sem custo.',
                },
                {
                  q: 'Meus dados ficam seguros?',
                  a: 'Sim. Utilizamos criptografia ponta a ponta, backup diário automatizado e seguimos as diretrizes da LGPD. Seus dados e dos participantes estão protegidos.',
                },
              ].map((item, i) => (
                <motion.div key={i} variants={staggerItem}>
                  <button
                    onClick={() => setFaqOpenIndex(faqOpenIndex === i ? null : i)}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-amber-200 hover:shadow-sm"
                  >
                    <span className="text-sm font-semibold text-slate-900 pr-4">{item.q}</span>
                    <span className={`shrink-0 text-slate-400 transition-transform duration-200 ${faqOpenIndex === i ? 'rotate-180' : ''}`}>
                      <ChevronRight className="size-4" />
                    </span>
                  </button>
                  {faqOpenIndex === i && (
                    <div className="px-5 pb-5 pt-3 text-sm leading-relaxed text-slate-500 border-x border-b border-slate-200 rounded-b-xl bg-white -mt-1">
                      {item.a}
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ======== PRICING ======== */}
        <section className="bg-slate-50 px-4 py-16 sm:px-8 sm:py-24 lg:py-32" id="planos">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="mx-auto max-w-6xl text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              Investimento
            </span>
            <h2 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 lg:text-6xl">
              Pare de perder dinheiro com taxas
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-500">
              Plataformas tradicionais cobram 10% por inscrição. Em um evento de R$ 30.000, você perde R$ 3.000 só de comissão. No Kairós Events o valor é fixo. O PIX cai 100% na sua conta.
            </p>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-8 sm:grid-cols-2 max-w-4xl mx-auto text-left"
            >
              
              {/* Card Plano Mensal */}
              <motion.div variants={staggerItem} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
                <h3 className="text-xl font-bold text-slate-900">Plano Mensal</h3>
                <p className="mt-2 text-sm text-slate-500">Ideal para quem quer organizar um evento específico sem compromisso anual.</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight text-slate-900">R$ 97</span>
                  <span className="text-sm font-medium text-slate-500">/mês</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {[
                    'Eventos e inscrições ilimitados',
                    'Check-in digital',
                    'Dashboard financeiro em tempo real',
                    'Formulários de inscrição personalizados',
                    'Suporte por e-mail (até 48h)',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-slate-600">
                      <Check className="size-4 text-amber-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="mt-8 w-full border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => navigate('/register')}>
                  Começar Teste Grátis
                </Button>
                <p className="mt-3 text-xs text-center text-slate-400">
                  Cancele quando quiser · Sem multa
                </p>
              </motion.div>

              {/* Card Plano Anual (Destaque) */}
              <motion.div variants={staggerItem} className="relative rounded-2xl border-2 border-amber-500 bg-slate-900 p-8 shadow-xl">
                <div className="absolute -top-4 right-8 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-900">
                  Mais vantajoso
                </div>
                <h3 className="text-xl font-bold text-white">Acesso Anual</h3>
                <p className="mt-2 text-sm text-slate-400">Tenha o Kairós rodando em todos os retiros, encontros e conferências do ano.</p>
                <div className="mt-3 inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                  Economize R$ 367 por ano
                </div>
                <div className="mt-6 flex flex-col">
                  <span className="text-sm text-slate-400 line-through">De R$ 1.164,00</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold tracking-tight text-amber-400">R$ 797</span>
                    <span className="text-sm font-medium text-slate-400">/ano</span>
                  </div>
                  <span className="mt-1 text-xs font-medium text-amber-400/80">equivale a R$ 66,42/mês</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {[
                    'Tudo do plano mensal',
                    'Exportação de relatórios (Excel e PDF)',
                    'Configuração inicial assistida',
                    'Prioridade em novas funcionalidades',
                    'Suporte por e-mail prioritário (até 24h)',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-slate-300">
                      <Check className="size-4 text-amber-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full bg-amber-500 text-slate-900 hover:bg-amber-400" onClick={() => navigate('/register')}>
                  Começar Teste Grátis
                </Button>
                <p className="mt-3 text-xs text-center text-slate-400">
                  Cancele quando quiser · Sem multa
                </p>
              </motion.div>

            </motion.div>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-10 text-xs leading-relaxed text-slate-400"
            >
              <strong className="text-slate-500">15 dias de teste gratuito.</strong> Sem cartão de crédito. Cancele quando quiser.
            </motion.p>
          </motion.div>
        </section>

        {/* ======== CTA FINAL ======== */}
        <section className="bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-20 text-center sm:px-8 sm:py-28 lg:py-36">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            <h2 className="text-5xl font-extrabold leading-tight tracking-tight text-white lg:text-6xl">
              Pronto para organizar<br />seu próximo evento?
            </h2>
            <p className="mt-3 text-base text-slate-400">
              Sem mensalidade. Sem comissão. Seus dados, seu controle.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/register')}
              className="mt-8 animate-cta-pulse bg-amber-600 text-white hover:bg-amber-700"
            >
              Começar agora <ArrowRight className="size-4" />
            </Button>
            <p className="mt-4 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-amber-500" /> 15 dias grátis
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                Sem cartão
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                Cancele quando quiser
              </span>
            </p>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950 px-4 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <img src="/screenshots/Icone.png" alt="" className="h-[28px] w-auto" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-slate-300" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
              Kairós
            </span>
            <span className="text-[8px] font-semibold uppercase text-[#F4B23A]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.35em' }}>
              EVENTS
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-400 transition-colors">
            Início
          </a>
          <a href="#planos" className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-400 transition-colors">
            Planos
          </a>
          <a href="/termos" className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-400 transition-colors">
            Termos de Uso
          </a>
          <a href="https://mail.google.com/mail/?view=cm&fs=1&to=kairosevents.suporte@gmail.com" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-400 transition-colors">
            Suporte
          </a>
          <span className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} Kairós Events &middot; Todos os direitos reservados
          </span>
        </div>
      </footer>

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 shadow-lg hover:bg-slate-700 hover:text-white transition-all duration-200"
          aria-label="Voltar ao topo"
        >
          <ArrowUp className="size-5" />
        </button>
      )}
    </div>
  );
}
