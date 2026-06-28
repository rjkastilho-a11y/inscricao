import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, ChevronRight, ArrowRight, ArrowUp } from 'lucide-react';
import HeroSection from '@/components/HeroSection';

const FEATURES = [
  {
    icon: '📅',
    title: 'Gestão sem Taxas',
    description: 'Receba o PIX direto na conta da igreja. Controle pagamentos manuais sem intermediários mordendo o caixa do evento.',
    color: 'from-amber-500/20 to-amber-600/5',
    borderColor: 'border-amber-500/20',
    items: [
      'PIX direto na conta da igreja — taxa zero',
      'Baixa manual de pagamentos confirmados',
      'Sem comissão por inscrição (adeus Sympla)',
      'Controle total de quem pagou e quem não pagou',
    ],
  },
  {
    icon: '📋',
    title: 'Secretaria Descomplicada',
    description: 'Inscrição em etapas com autorização pastoral e envio automático de recibo via WhatsApp.',
    color: 'from-indigo-500/20 to-indigo-600/5',
    borderColor: 'border-indigo-500/20',
    items: [
      'Inscrição em etapas com dados pessoais e eclesiásticos',
      'Autorização pastoral digital integrada',
      'Recibo automático via WhatsApp com 1 clique',
      'Exportação CSV completa',
    ],
  },
  {
    icon: '📱',
    title: 'Portaria Digital',
    description: 'Check-in pelo celular na porta do evento. Controle de presença em tempo real. Fim do papel impresso.',
    color: 'from-sky-500/20 to-sky-600/5',
    borderColor: 'border-sky-500/20',
    items: [
      'Check-in digital direto do celular',
      'Presença em tempo real na portaria',
      'Aposente a prancheta de papel',
      'Lista de confirmados atualizada na hora',
    ],
  },
];

const STEPS = [
  {
    step: '1',
    title: 'Crie o evento e envie o link para a igreja',
    description: 'Preencha título, datas, local e valor. Um link público é gerado automaticamente — compartilhe no WhatsApp ou redes sociais.',
  },
  {
    step: '2',
    title: 'O membro se inscreve e faz o PIX direto para a tesouraria',
    description: 'Os participantes acessam o link, preenchem o formulário e fazem o PIX diretamente para a conta da igreja. Sem taxas, sem intermediários.',
  },
  {
    step: '3',
    title: 'A secretária dá baixa, envia o recibo pelo WhatsApp e faz o check-in na porta',
    description: 'Com 1 clique a secretária confirma o pagamento, dispara o recibo via WhatsApp e faz o check-in digital na hora do evento.',
  },
];

const FINANCIAL_CARDS = [
  { label: 'Entradas (inscrições)', value: 'R$ 4.200', color: 'text-white' },
  { label: 'Ofertas recebidas', value: 'R$ 950', color: 'text-white' },
  { label: 'Saídas', value: 'R$ 2.300', color: 'text-red-400' },
  { label: 'Saldo do evento', value: 'R$ 2.850', color: 'text-emerald-400' },
];

const AUDIENCE = [
  {
    emoji: '⛪',
    title: 'Igrejas locais',
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
      <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-white/10 bg-slate-900/80 px-4 backdrop-blur-md sm:px-8">
        <span className="font-serif text-lg font-bold text-white">
          Kairós <span className="text-amber-500">Events</span>
        </span>
        <Button
          onClick={() => navigate('/login')}
          className="bg-amber-600 text-white hover:bg-amber-700"
          size="sm"
        >
          Entrar <ChevronRight className="size-3.5" />
        </Button>
      </header>

      <main className="pt-14">
        <HeroSection />

        {/* ======== FEATURES ======== */}
        <section className="bg-white px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                Funcionalidades
              </span>
              <h2 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight text-slate-900 lg:text-6xl">
        Tudo que sua igreja precisa para organizar eventos
              </h2>
              <p className="mt-3 text-base text-slate-500">
                Três módulos integrados que cobrem todo o ciclo do evento — da inscrição ao fechamento financeiro.
              </p>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {FEATURES.map((f) => (
                <motion.div key={f.title} variants={staggerItem}>
                  <div
                    className={`group relative overflow-hidden rounded-xl border ${f.borderColor} bg-gradient-to-b ${f.color} p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 lg:p-8`}
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
              Pronto em 3 passos
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-slate-500">
              Sem treinamento. Sem complicação. Qualquer secretária ou pastor consegue usar no primeiro dia.
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
                O inimigo
              </span>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl text-balance">
                Chega de Excel que quebra no meio do evento.
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-slate-400">
                Planilha não avisa quem pagou, não dispara recibo e uma célula errada bagunça tudo. O Kairós resolve o descontrole financeiro do seu retiro ou congresso.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Saiba exatamente quem pagou e quem não pagou',
                  'Sem planilha perdida, sem célula apagada sem querer',
                  'Baixa manual de PIX com confirmação visual',
                  'Tudo organizado em um painel, não em 5 planilhas diferentes',
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
              className="grid flex-1 grid-cols-2 gap-3"
            >
              {FINANCIAL_CARDS.map((card) => (
                <motion.div
                  key={card.label}
                  variants={staggerItem}
                  className="rounded-xl border border-white/[7%] bg-white/[4%] p-5 backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg hover:shadow-amber-500/5"
                >
                  <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
                  <div className={`mt-1 font-serif text-2xl font-bold lg:text-3xl ${card.color}`}>
                    {card.value}
                  </div>
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
              Feito para a realidade das igrejas brasileiras
            </h2>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-12 grid gap-6 text-left md:grid-cols-3"
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
              Plataformas tradicionais cobram 10% por inscrição. Em um evento de R$ 30.000, você perde R$ 3.000 só de comissão. No Kairós Events o valor é fixo. O PIX cai 100% na conta da sua igreja.
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
                <p className="mt-2 text-sm text-slate-500">Ideal para igrejas que querem organizar um evento específico sem compromisso anual.</p>
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
                <Button variant="outline" className="mt-8 w-full border-amber-200 text-amber-700 hover:bg-amber-50">
                  Assinar Mensal
                </Button>
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
                <Button className="mt-8 w-full bg-amber-500 text-slate-900 hover:bg-amber-400">
                  Assinar Anual com Desconto
                </Button>
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
              onClick={() => navigate('/login')}
              className="mt-8 animate-cta-pulse bg-amber-600 text-white hover:bg-amber-700"
            >
              Começar agora <ArrowRight className="size-4" />
            </Button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950 px-4 py-6 sm:px-8">
        <span className="font-serif text-sm font-bold text-slate-600">
          Kairós <span className="text-amber-600">Events</span>
        </span>
        <div className="flex items-center gap-4">
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
