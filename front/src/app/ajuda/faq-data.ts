export interface FaqItem {
  pergunta: string;
  resposta: string;
}

export interface FaqCategoria {
  categoria: string;
  icone: string;
  itens: FaqItem[];
}

// FAQ com respostas precisas ao funcionamento REAL do JustaPro.
// Ao mudar um fluxo do produto, atualizar a resposta correspondente aqui.
export const FAQ: FaqCategoria[] = [
  {
    categoria: 'Primeiros passos',
    icone: 'rocket_launch',
    itens: [
      {
        pergunta: 'Como cadastrar meu primeiro cliente?',
        resposta:
          'No menu lateral, abra "Clientes" e clique em "Novo cliente". Preencha ao menos o nome (obrigatório) e os dados disponíveis — CPF, contato, endereço. Clique em "Salvar cliente". Pronto: ele já pode ser vinculado a processos e usado na geração de documentos.'
      },
      {
        pergunta: 'Como cadastrar um processo?',
        resposta:
          'Abra "Processos" e clique em "Novo processo". Informe o cliente, o tipo/assunto, o prazo, a área jurídica e a situação. Se quiser, adicione tags. Ao salvar, o processo entra na sua fila e passa a ser monitorado (Data Fatal, urgência, etc.).'
      },
      {
        pergunta: 'Como editar um cliente?',
        resposta:
          'Em "Clientes", selecione o cliente na lista à esquerda. A ficha abre à direita para edição. Altere os campos e clique em "Salvar cliente".'
      },
      {
        pergunta: 'Como excluir um cadastro?',
        resposta:
          'Para preservar o histórico jurídico, o sistema não apaga: ele arquiva. Abra o cliente e use "Arquivar cliente" — ele deixa de aparecer nas listas ativas, mas os processos vinculados continuam preservados.'
      },
      {
        pergunta: 'Como pesquisar clientes ou processos?',
        resposta:
          'Use a busca global no topo do sistema (ícone de lupa no mobile). Ela procura por nome, CPF, telefone, número do processo e tags ao mesmo tempo, e mostra os resultados agrupados. Na tela de Clientes há também um campo de pesquisa específico.'
      }
    ]
  },
  {
    categoria: 'Documentos',
    icone: 'description',
    itens: [
      {
        pergunta: 'Como enviar um modelo do Word?',
        resposta:
          'Em "Documentos", clique em "Novo modelo" (disponível para administradores). Selecione o arquivo .docx, dê um nome e uma descrição, e clique em "Cadastrar modelo". O sistema detecta automaticamente as variáveis presentes no documento.'
      },
      {
        pergunta: 'Como funcionam as variáveis?',
        resposta:
          'No texto do seu modelo Word, escreva as variáveis entre chaves simples — por exemplo {cliente_nome} e {cliente_cpf}. Ao gerar o documento para um cliente, o sistema substitui cada variável pelos dados cadastrados dele. Use o botão "Como funciona" na tela de Documentos para ver o passo a passo e a lista completa de variáveis.'
      },
      {
        pergunta: 'Qual o formato correto das variáveis?',
        resposta:
          'Use chaves simples: {cliente_nome}. Não use chaves duplas ({{ }}). Os nomes precisam ser exatamente os da lista de variáveis disponíveis (ex.: cliente_cpf, processo_referencia, data_extenso).'
      },
      {
        pergunta: 'Como gerar e baixar um documento preenchido?',
        resposta:
          'Escolha o modelo, selecione o cliente, informe o nome do documento e clique em "Baixar DOCX editável". O arquivo é gerado já preenchido com os dados do cliente e salvo com o nome que você informou.'
      },
      {
        pergunta: 'O que acontece quando uma variável não existe nos dados?',
        resposta:
          'A variável sai no documento como uma linha em branco (________) para você preencher à mão. Nada trava — o documento é gerado normalmente.'
      }
    ]
  },
  {
    categoria: 'Agenda',
    icone: 'calendar_month',
    itens: [
      {
        pergunta: 'Como criar uma audiência ou compromisso?',
        resposta:
          'Abra "Agenda" e clique em "Novo compromisso". Escolha o tipo (Audiência, Reunião, Prazo, Evento), a data e o horário, o local e, se quiser, vincule a um processo. Se houver choque de horário com outro compromisso seu, o sistema avisa.'
      },
      {
        pergunta: 'Como filtrar a agenda por categoria?',
        resposta:
          'Use os filtros no topo da Agenda para ligar ou desligar cada categoria — Audiências, Reuniões, Prazos e os eventos Financeiros (recebimentos e pagamentos). Assim você vê apenas o que interessa no momento.'
      },
      {
        pergunta: 'Por que alguns compromissos aparecem como "Ocupado"?',
        resposta:
          'Se você tem permissão para ver a agenda de colegas mas não os detalhes, os compromissos deles aparecem apenas como blocos de horário "Ocupado", sem título nem local. Essa configuração é definida pelo administrador.'
      }
    ]
  },
  {
    categoria: 'Financeiro',
    icone: 'account_balance_wallet',
    itens: [
      {
        pergunta: 'Como lançar honorários?',
        resposta:
          'Em "Financeiro", clique em "Novo lançamento". Escolha o tipo Honorário, informe o valor total, o vencimento e o número de parcelas. Se informar mais de uma parcela, o sistema gera cada uma automaticamente, mês a mês.'
      },
      {
        pergunta: 'Como registrar um pagamento (dar baixa)?',
        resposta:
          'Na lista de lançamentos, clique no ícone de confirmar (✓) na linha do lançamento. Ele passa para "Pago" e registra a data. Se precisar desfazer, use o ícone de estornar.'
      },
      {
        pergunta: 'Como controlar contas a receber e vencimentos?',
        resposta:
          'Os cartões de resumo mostram Recebido no mês, A receber, Em atraso e Previsto no mês. O status "Atrasado" é calculado automaticamente a partir do vencimento — você não precisa marcar nada. Use o filtro de status para ver só os atrasados ou pendentes.'
      }
    ]
  },
  {
    categoria: 'Processos',
    icone: 'folder_special',
    itens: [
      {
        pergunta: 'O que é "Data Fatal"?',
        resposta:
          'Data Fatal é o termo jurídico para o prazo peremptório (improrrogável). O sistema marca automaticamente um processo como Data Fatal quando o prazo está vencido, vence hoje ou falta apenas 1 dia — e o destaca no topo da fila para ação imediata.'
      },
      {
        pergunta: 'Como marcar um processo como urgente?',
        resposta:
          'Abra o processo e use "Marcar como urgente" (ou o botão de urgência direto na fila do Dashboard). A urgência manual mantém o processo priorizado até você removê-la.'
      },
      {
        pergunta: 'Como alterar o status ou concluir um processo?',
        resposta:
          'Dentro do processo você ajusta o status. Para encerrar, use "Marcar concluído" — o processo sai da fila ativa. Depois de um período configurável ele é arquivado automaticamente.'
      },
      {
        pergunta: 'Como classifico um processo (área, tipo, tags)?',
        resposta:
          'Ao criar ou editar o processo, defina a Área Jurídica, o Tipo de causa, a Situação e adicione tags livres. Esses campos alimentam os filtros rápidos e a busca.'
      }
    ]
  },
  {
    categoria: 'Minha conta',
    icone: 'person',
    itens: [
      {
        pergunta: 'Como alterar minha senha?',
        resposta:
          'Na tela de login, clique em "Esqueci minha senha" e informe seu e-mail. Você recebe um link seguro para criar uma nova senha. O link é gerado e validado pelo próprio provedor de autenticação.'
      },
      {
        pergunta: 'Como trocar minha foto ou meus dados?',
        resposta:
          'Abra "Meu perfil" no menu. Ali você atualiza a foto, o nome de exibição, telefone, cargo e OAB.'
      },
      {
        pergunta: 'Como funcionam as permissões da equipe?',
        resposta:
          'Administradores gerenciam a equipe em "Equipe": definem o papel de cada membro e se um advogado pode ver a agenda dos colegas (e com quanto detalhe). Cada advogado enxerga por padrão apenas os próprios processos.'
      }
    ]
  }
];
