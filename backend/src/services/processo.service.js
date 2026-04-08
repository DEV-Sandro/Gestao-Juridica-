const { db } = require('../config/firebase');
const processoRepository = require('../repositories/processo.repository');
const auditoriaService = require('./auditoria.service');
const { calcularStatusInteligente } = require('../utils/status.util');

async function obterDiasArquivamento() {
  const doc = await db.collection('configuracoes').doc('arquivamento').get();

  if (!doc.exists) return 30;

  return Number(doc.data().dias) || 30;
}

async function listarProcessos(query, user) {
  const processos = await processoRepository.buscarTodos();
  const dias = await obterDiasArquivamento();

  const lista = [];
  const updates = [];

  for (const proc of processos) {
    if (proc.deletado) continue;

    const statusCalculado = calcularStatusInteligente(proc, dias);

    if (user.role === 'CLIENT' && proc.clienteId !== user.uid) {
      continue;
    }

    if (
      statusCalculado === 'Arquivado' &&
      proc.status === 'Concluído' &&
      !proc.arquivado
    ) {
      updates.push(
        processoRepository.atualizar(proc.id, {
          arquivado: true,
          status: 'Arquivado',
          atualizadoEm: new Date().toISOString(),
          atualizadoPor: user.uid
        })
      );
    }

    const item = {
      ...proc,
      statusCalculado
    };

    const isHistorico = query.historico === 'true';

    if (isHistorico) {
      if (['Arquivado', 'Cancelado', 'Indeferido'].includes(statusCalculado)) {
        lista.push(item);
      }
      continue;
    }

    if (!['Arquivado', 'Cancelado', 'Indeferido'].includes(statusCalculado)) {
      if (!query.status || query.status === statusCalculado) {
        lista.push(item);
      }
    }
  }

  if (updates.length) {
    await Promise.all(updates);
  }

  lista.sort((a, b) => {
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return new Date(a.prazo) - new Date(b.prazo);
  });

  return lista;
}

async function buscarPorId(id, user) {
  const proc = await processoRepository.buscarPorId(id);

  if (!proc || proc.deletado) {
    throw new Error('PROCESSO_NAO_ENCONTRADO');
  }

  if (user.role === 'CLIENT' && proc.clienteId !== user.uid) {
    try {
      await auditoriaService.registrarEvento({
        acao: 'ACESSO_NEGADO',
        entidade: 'PROCESSO',
        entidadeId: id,
        usuario: user,
        detalhes: {
          motivo: 'Cliente tentou acessar processo de outro usuário'
        }
      });
    } catch (error) {
      console.error('ERRO AO SALVAR AUDITORIA DE ACESSO_NEGADO:', error);
    }

    throw new Error('ACESSO_NEGADO');
  }

  const dias = await obterDiasArquivamento();

  return {
    ...proc,
    statusCalculado: calcularStatusInteligente(proc, dias)
  };
}

async function criarProcesso(dados, user) {
  const agora = new Date().toISOString();

  const titulo =
    dados.titulo ||
    dados.tipo ||
    dados.assunto ||
    'Processo sem título';

  const descricao =
    dados.descricao ||
    dados.observacao ||
    '';

  const clienteId =
    dados.clienteId ||
    dados.cliente ||
    user.uid;

  const novo = {
    titulo,
    descricao,
    clienteId,
    advogadoId: dados.advogadoId || user.uid,
    status: dados.status || 'Em Andamento',
    prazo: dados.prazo || null,
    arquivado: false,
    deletado: false,
    criadoEm: agora,
    criadoPor: user.uid,
    atualizadoEm: agora,
    atualizadoPor: user.uid
  };

  const id = await processoRepository.criar(novo);

  console.log('PASSOU NO CRIAR PROCESSO:', id);

  try {
    await db.collection('auditoria').add({
      acao: 'TESTE_AUDITORIA',
      entidade: 'PROCESSO',
      entidadeId: id,
      usuarioId: user?.uid || null,
      usuarioEmail: user?.email || null,
      perfil: user?.role || null,
      detalhes: {
        titulo: novo.titulo,
        clienteId: novo.clienteId,
        advogadoId: novo.advogadoId,
        status: novo.status
      },
      criadoEm: new Date().toISOString()
    });

    console.log('AUDITORIA SALVA DIRETO NO FIRESTORE');
  } catch (error) {
    console.error('ERRO AO SALVAR AUDITORIA DIRETO NO FIRESTORE:', error);
  }

  try {
    await auditoriaService.registrarEvento({
      acao: 'CRIAR',
      entidade: 'PROCESSO',
      entidadeId: id,
      usuario: user,
      detalhes: {
        titulo: novo.titulo,
        clienteId: novo.clienteId,
        advogadoId: novo.advogadoId,
        status: novo.status
      }
    });

    console.log('AUDITORIA SALVA VIA SERVICE');
  } catch (error) {
    console.error('ERRO AO SALVAR AUDITORIA VIA SERVICE:', error);
  }

  return id;
}

async function atualizarProcesso(id, dados, user) {
  const processoAtual = await processoRepository.buscarPorId(id);

  if (!processoAtual || processoAtual.deletado) {
    throw new Error('PROCESSO_NAO_ENCONTRADO');
  }

  if (user.role === 'CLIENT') {
    try {
      await auditoriaService.registrarEvento({
        acao: 'ACESSO_NEGADO',
        entidade: 'PROCESSO',
        entidadeId: id,
        usuario: user,
        detalhes: {
          motivo: 'Cliente tentou atualizar processo'
        }
      });
    } catch (error) {
      console.error('ERRO AO SALVAR AUDITORIA DE ACESSO_NEGADO:', error);
    }

    throw new Error('ACESSO_NEGADO');
  }

  const payload = {
    ...dados,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  };

  await processoRepository.atualizar(id, payload);

  try {
    await auditoriaService.registrarEvento({
      acao: 'ATUALIZAR',
      entidade: 'PROCESSO',
      entidadeId: id,
      usuario: user,
      detalhes: {
        camposAtualizados: Object.keys(dados)
      }
    });
  } catch (error) {
    console.error('ERRO AO SALVAR AUDITORIA DE ATUALIZACAO:', error);
  }
}

async function deletarProcesso(id, user) {
  const processoAtual = await processoRepository.buscarPorId(id);

  if (!processoAtual || processoAtual.deletado) {
    throw new Error('PROCESSO_NAO_ENCONTRADO');
  }

  if (user.role === 'CLIENT') {
    try {
      await auditoriaService.registrarEvento({
        acao: 'ACESSO_NEGADO',
        entidade: 'PROCESSO',
        entidadeId: id,
        usuario: user,
        detalhes: {
          motivo: 'Cliente tentou excluir processo'
        }
      });
    } catch (error) {
      console.error('ERRO AO SALVAR AUDITORIA DE ACESSO_NEGADO:', error);
    }

    throw new Error('ACESSO_NEGADO');
  }

  await processoRepository.deletarSoft(id, {
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  });

  try {
    await auditoriaService.registrarEvento({
      acao: 'DELETAR_SOFT',
      entidade: 'PROCESSO',
      entidadeId: id,
      usuario: user,
      detalhes: {
        titulo: processoAtual.titulo || null
      }
    });
  } catch (error) {
    console.error('ERRO AO SALVAR AUDITORIA DE EXCLUSAO:', error);
  }
}

module.exports = {
  listarProcessos,
  buscarPorId,
  criarProcesso,
  atualizarProcesso,
  deletarProcesso
};