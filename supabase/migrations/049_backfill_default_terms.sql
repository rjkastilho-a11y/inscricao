-- ==============================================================
-- MIGRAÇÃO 049: Backfill do texto padrão de termos e condições
--
-- Define o "Termo de Inscrição e Uso de Imagem" como padrão
-- para todos os eventos que ainda não têm terms_text.
-- ==============================================================

UPDATE public.events
SET terms_text = E'Termo de Inscrição e Uso de Imagem\n\n1. Aceitação dos Termos\nAo se inscrever no evento, você declara que leu, compreendeu e concorda em cumprir estes Termos e Condições. Caso não concorde com qualquer cláusula, não clique no aceite e não prossiga com a sua inscrição.\n\n2. Política de Reembolso e Destinação de Recursos\nAo confirmar sua inscrição, você declara estar ciente de que não haverá devolução ou reembolso de valores pagos. Todos os recursos arrecadados são integralmente direcionados, em caráter imediato, para o custeio operacional, infraestrutura, materiais e compromissos firmados para a realização do evento.\n\n3. Autorização de Uso de Imagem e Voz\nVocê autoriza, de forma gratuita, irrevogável e definitiva, o uso de sua imagem e voz em fotos, vídeos e quaisquer materiais audiovisuais captados durante o evento. Esta autorização permite que o organizador utilize este material para fins de divulgação, publicação em redes sociais, sites institucionais e materiais de comunicação, em território nacional ou internacional, sem limite de tempo, visando a promoção das atividades da organização.\n\n4. Responsabilidade do Inscrito\nVocê se declara responsável pela veracidade das informações fornecidas no ato da inscrição. A organização não se responsabiliza por dados incorretos que impossibilitem a comunicação de informações vitais sobre o evento.\n\n5. LGPD e Tratamento de Dados\nSeus dados pessoais serão tratados para fins de organização do evento, credenciamento e comunicação oficial. Estamos comprometidos com a Lei Geral de Proteção de Dados (Lei 13.709/2018), garantindo que suas informações não serão compartilhadas com terceiros para fins estranhos à realização deste evento.\n\n6. Foro\nFica eleito o Foro da Comarca indicada pelo organizador para dirimir quaisquer dúvidas oriundas deste instrumento.'
WHERE terms_text IS NULL;

-- ==============================================================
-- FIM DA MIGRAÇÃO 049
-- ==============================================================
