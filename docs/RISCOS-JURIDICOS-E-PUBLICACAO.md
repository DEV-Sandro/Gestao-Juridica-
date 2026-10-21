# Revisão jurídica e de publicação — JustaPro

Estado em 21/10/2026. Este documento registra o que foi verificado no código e o que ainda exige decisão do responsável pelo serviço. As páginas públicas são minutas, não uma declaração de conformidade integral.

| Tema solicitado | Implementação ou estado | Pendência antes de contratar clientes |
| --- | --- | --- |
| Política de privacidade | Página e PDF descrevem categorias de dados, finalidades, fornecedores, direitos e armazenamento. | Identificar o responsável, contato público, retenção por categoria, bases legais por operação e papéis contratuais com escritórios. |
| Termos de serviço | Página com escopo, responsabilidades, fontes externas e limites das calculadoras. | Identificar fornecedor, contrato, SLA, condições de renovação e cancelamento. |
| Aviso de cookies | Aviso discreto e página que distinguem sessão, preferências e estado local. | Reavaliar antes de adicionar qualquer tecnologia opcional. |
| Reembolso | Página informa preços, ausência de checkout e direito de arrependimento quando aplicável. | Definir cobrança real, canal de atendimento e cláusulas contratuais sem reduzir direitos legais. |
| Formulários LGPD | Usuário autenticado pode registrar pedido de privacidade em Suporte. Os pedidos ficam ligados à sua conta. | Configurar `PLATFORM_SUPPORT_UIDS` para a caixa de entrada e publicar canal para titulares sem conta. Definir verificação de identidade e fluxo de resposta. |
| Dados necessários | CPF/CNPJ, endereço e contatos do cliente são opcionais. A interface orienta a não cadastrar dados excessivos. | Definir política de retenção, exportação, eliminação e revisão de campos por finalidade com os escritórios. |
| Modelos DOCX próprios | Upload limitado a 2 MB, sem macros e conteúdo incorporado, com acesso restrito ao escritório; autor ou administrador pode remover. | Confirmar direitos de uso do conteúdo carregado e definir retenção de cópias de segurança após a remoção. |
| Tracking | Não há Google Analytics, pixels de anúncios ou scripts de acompanhamento no frontend. | Se forem adicionados, avaliar base legal e implementar bloqueio até consentimento quando cabível. |
| Acessibilidade, contraste e teclado | Foco visível global, atalho para conteúdo, redução de movimento e melhora das cores de status. | Fazer auditoria manual completa com teclado e leitor de tela em todos os fluxos e medir contraste dos pares reais nos dois temas. Não declarar certificação WCAG antes disso. |
| Avaliações e promessas | A página inicial não exibe avaliações ou depoimentos. Preços são informativos e não prometem disponibilidade ou resultado jurídico. | Validar qualquer futura alegação comercial e obter autorização comprovável de quem der depoimento. |
| Imagens e marca | As páginas públicas usam o SVG `justapro-mark.svg`, baseado na referência visual fornecida pelo proprietário, e a fonte Material Icons acompanhada da licença Apache 2.0 em `front/src/assets/fonts/`. Não há fotos de bancos de imagens nas páginas públicas. | Confirmar que o proprietário pode usar comercialmente a marca de referência; manter registro de criação ou cessão. Revisar direitos de modelos de documento e futuras imagens antes de usar. |
| Dados da empresa | Ausentes por declaração do proprietário. Nenhum nome, CNPJ ou e-mail foi inventado. | Publicar razão social/nome, documento quando aplicável, endereço e contato efetivo antes da contratação. |
| Conformidade LGPD | Controle por conta, papel e escritório, autenticação, acesso do próprio autor aos chamados e minimização na interface. | Confirmar regras e serviços implantados em produção, contratos com fornecedores, bases legais, encarregado/canal, registro de operações, plano de incidentes, retenção e atendimento de direitos. |
| Riscos jurídicos do produto | Calculadoras avisam que resultados são estimativas; consulta legislativa exige conferência na fonte oficial; modelos devem ser revisados pelo advogado. | Testar cálculos por tribunal e caso concreto. Não vender como pesquisa processual oficial ou substituição do profissional. |

## Fontes de referência

- [LGPD, Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [CDC, Lei nº 8.078/1990, art. 49](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm)
- [Guia de cookies da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais)
- [WCAG 2.2, W3C](https://www.w3.org/TR/WCAG22/)
- [Acervo ctresb/leis](https://github.com/ctresb/leis): textos oficiais convertidos e indexados por terceiro. Conferir vigência e fonte oficial; scripts do acervo sob MIT.

## Publicação

Não marcar o produto como “conforme à LGPD” nem iniciar cobrança enquanto identificação, canal de atendimento, contrato e operação de pedidos de titulares não estiverem definidos. O código publicado no GitHub não equivale a regras de segurança implantadas no Firebase/Cloud Run; verificar ambos separadamente.
