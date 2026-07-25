const processoService = require('./processo.service');
const clienteService = require('./cliente.service');

// Busca global. Reaproveita listarProcessos/listarClientes de proposito: assim o
// escopo por perfil (CLIENT ve so o seu, ADVOGADO so os seus, ADMIN tudo) e
// herdado automaticamente, sem risco de vazar registro por um caminho paralelo.
//
// A filtragem e feita em memoria sobre a lista ja carregada. Para a base atual
// isso e adequado e sempre consistente (nao existe indice para ficar defasado).
// Se a base crescer muito, o passo seguinte e materializar um campo
// `buscaTokens` nos documentos e usar array-contains-any — mesmo padrao ja
// existente em tituloBusca/clienteNomeBusca.

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function apenasDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function contem(alvo, termo) {
  return normalizar(alvo).includes(termo);
}

function processoCasa(processo, termo, termoDigitos) {
  if (
    contem(processo.titulo, termo) ||
    contem(processo.descricao, termo) ||
    contem(processo.clienteNome, termo) ||
    contem(processo.situacao, termo) ||
    contem(processo.categoria, termo) ||
    contem(processo.tipoCausa, termo) ||
    contem(processo.localCompromisso, termo)
  ) {
    return true;
  }

  if (Array.isArray(processo.tags) && processo.tags.some((tag) => contem(tag, termo))) {
    return true;
  }

  // Permite localizar pelo id do processo (usado como referencia/protocolo).
  if (termoDigitos && apenasDigitos(processo.id).includes(termoDigitos)) return true;

  return contem(processo.id, termo);
}

function clienteCasa(cliente, termo, termoDigitos) {
  if (
    contem(cliente.nome, termo) ||
    contem(cliente.email, termo) ||
    contem(cliente.profissao, termo) ||
    contem(cliente.cidade, termo)
  ) {
    return true;
  }

  if (termoDigitos) {
    if (apenasDigitos(cliente.cpf).includes(termoDigitos)) return true;
    if (apenasDigitos(cliente.telefone).includes(termoDigitos)) return true;
    if (apenasDigitos(cliente.rg).includes(termoDigitos)) return true;
    if (apenasDigitos(cliente.documentoSecundario).includes(termoDigitos)) return true;
  }

  return false;
}

async function buscar(termoBruto, user, limite = 8) {
  const termo = normalizar(termoBruto);

  if (termo.length < 2) {
    return { termo: termoBruto || '', processos: [], clientes: [] };
  }

  const termoDigitos = apenasDigitos(termoBruto);

  // Busca cobre ativos E encerrados/arquivados: quem procura um processo antigo
  // espera encontra-lo. listarProcessos separa os dois conjuntos (historico=true
  // devolve justamente os que ficam de fora da listagem padrao), entao unimos.
  const [ativos, historicos] = await Promise.all([
    processoService.listarProcessos({}, user).catch((error) => {
      console.error('[busca.service] falha ao carregar processos ativos', error.message);
      return [];
    }),
    processoService.listarProcessos({ historico: 'true' }, user).catch((error) => {
      console.error('[busca.service] falha ao carregar processos historicos', error.message);
      return [];
    })
  ]);

  const vistos = new Set();
  const processos = [...ativos, ...historicos].filter((processo) => {
    if (vistos.has(processo.id)) return false;
    vistos.add(processo.id);
    return true;
  });

  // Clientes nao sao expostos ao perfil CLIENT.
  const clientes =
    user.role === 'CLIENT'
      ? []
      : await clienteService.listarClientes().catch((error) => {
          console.error('[busca.service] falha ao carregar clientes', error.message);
          return [];
        });

  return {
    termo: termoBruto,
    processos: processos
      .filter((processo) => processoCasa(processo, termo, termoDigitos))
      .slice(0, limite)
      .map((processo) => ({
        id: processo.id,
        titulo: processo.titulo || 'Processo sem titulo',
        cliente: processo.clienteNome || null,
        status: processo.statusCalculado || processo.status || null,
        prazo: processo.prazo || null
      })),
    clientes: clientes
      .filter((cliente) => clienteCasa(cliente, termo, termoDigitos))
      .slice(0, limite)
      .map((cliente) => ({
        id: cliente.id,
        nome: cliente.nome,
        cpf: cliente.cpf || null,
        email: cliente.email || null,
        telefone: cliente.telefone || null
      }))
  };
}

module.exports = {
  buscar
};
