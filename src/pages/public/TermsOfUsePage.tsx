import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

export default function TermsOfUsePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-300 antialiased">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-16">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-8 text-slate-400 hover:text-white"
        >
          <ChevronLeft className="mr-1 size-4" />
          Voltar
        </Button>

        <h1 className="font-serif text-3xl font-bold text-white sm:text-4xl">
          Termos de Uso
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Última atualização: maio de 2026
        </p>

        <div className="mt-10 space-y-8">
          <section>
            <h2 className="font-serif text-xl font-semibold text-white">
              1. Trial Gratuito
            </h2>
            <p className="mt-3 leading-relaxed text-slate-400">
              Ao criar sua conta no Kairós Events, você recebe acesso a um período de teste gratuito
              que inclui o limite de <strong className="text-white">15 inscrições gratuitas</strong>.
              Durante esse período, todas as funcionalidades da plataforma estão disponíveis sem
              qualquer custo e sem necessidade de cadastro de cartão de crédito.
            </p>
            <p className="mt-2 leading-relaxed text-slate-400">
              O trial gratuito se aplica por evento ou de forma cumulativa conforme a utilização
              da conta, permitindo que você avalie o sistema antes de contratar um plano.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-white">
              2. Exclusão de Dados
            </h2>
            <p className="mt-3 leading-relaxed text-slate-400">
              Após atingir o limite de 15 inscrições, sua conta será pausada automaticamente.
              Você terá um prazo de <strong className="text-white">14 dias corridos</strong> para
              realizar a assinatura de um dos planos disponíveis e dar continuidade ao uso da
              plataforma.
            </p>
            <p className="mt-2 leading-relaxed text-slate-400">
              Caso nenhuma assinatura seja efetuada dentro desse período, todos os dados
              associados à sua conta — incluindo informações de eventos, inscrições e
              participantes — serão <strong className="text-white">excluídos permanentemente</strong>{' '}
              de nossos servidores por segurança e conformidade com a legislação aplicável
              (LGPD).
            </p>
            <p className="mt-2 leading-relaxed text-slate-400">
              Recomendamos que você realize backups dos dados antes do vencimento do prazo
              caso deseje mantê-los.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-white">
              3. Pagamentos e Assinatura via Kiwify
            </h2>
            <p className="mt-3 leading-relaxed text-slate-400">
              O processamento de pagamentos das assinaturas do Kairós Events é realizado
              exclusivamente por meio da plataforma{' '}
              <strong className="text-white">Kiwify</strong>, responsável por toda a
              infraestrutura de cobrança, emissão de notas fiscais e gestão de
              faturamento.
            </p>
            <p className="mt-2 leading-relaxed text-slate-400">
              Ao assinar um de nossos planos, você será redirecionado ao ambiente seguro da
              Kiwify para concluir o pagamento. As formas de pagamento disponíveis incluem
              cartão de crédito, PIX e boleto bancário, conforme a oferta vigente no momento
              da contratação.
            </p>
            <p className="mt-2 leading-relaxed text-slate-400">
              A renovação da assinatura ocorre automaticamente ao final de cada ciclo
              (mensal ou anual), podendo ser cancelada a qualquer momento pela área
              administrativa da sua conta. O cancelamento não reembolsa valores já pagos
              do ciclo vigente.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-white">
              4. Disposições Gerais
            </h2>
            <p className="mt-3 leading-relaxed text-slate-400">
              O Kairós Events se reserva o direito de alterar estes Termos de Uso a
              qualquer momento, notificando os usuários por e-mail ou por meio da
              plataforma. O uso continuado após tais alterações constitui aceitação dos
              novos termos.
            </p>
            <p className="mt-2 leading-relaxed text-slate-400">
              Para dúvidas ou solicitações relacionadas a estes Termos, entre em contato
              através do e-mail <a href="https://mail.google.com/mail/?view=cm&fs=1&to=kairosevents.suporte@gmail.com" target="_blank" rel="noopener noreferrer" className="text-amber-500 underline underline-offset-2 hover:text-amber-400 transition-colors">kairosevents.suporte@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
