const processoService = require('./processo.service');
const lancamentoService = require('./lancamento.service');
const compromissoService = require('./compromisso.service');
const apontamentoTempoService = require('./apontamento-tempo.service');
const { projecaoEstaPronta } = require('./rentabilidade-projecao.service');

const TIPOS_TEMPO_AUTOMATICO = new Set(['AUDIENCIA', 'REUNIAO']);

function arredondar(valor, casas = 2) {
  return Number((Number(valor) || 0).toFixed(casas));
}

function chaveCliente(clienteId, clienteNome) {
  return clienteId || `nome:${String(clienteNome || 'Sem cliente').trim().toLowerCase()}`;
}

function nomeArea(processo) {
  return processo.categoria || 'Não informada';
}

function valorPago(lancamento) {
  const valor = Number(lancamento.valorPago);
  return Number.isFinite(valor) && valor > 0 ? valor : Number(lancamento.valor) || 0;
}

function classificacaoRentabilidade(lancamento, processo) {
  if (processo) return 'PROCESSO';
  return lancamento.classificacaoRentabilidade === 'GERAL' ? 'GERAL' : 'PENDENTE';
}

function criarAcumulador({ id, titulo, clienteId, clienteNome, area } = {}) {
  return {
    id: id || null,
    titulo: titulo || 'Não informado',
    clienteId: clienteId || null,
    clienteNome: clienteNome || 'Não informado',
    area: area || 'Não informada',
    honorarios: 0,
    reembolsos: 0,
    custos: 0,
    minutosAgenda: 0,
    minutosManuais: 0,
    processos: 0
  };
}

function adicionarLancamento(acumulador, lancamento) {
  if (!acumulador || lancamento.statusEfetivo !== 'PAGO') return;
  const valor = valorPago(lancamento);

  if (lancamento.tipo === 'HONORARIO') acumulador.honorarios += valor;
  if (lancamento.tipo === 'REEMBOLSO') acumulador.reembolsos += valor;
  if (lancamento.tipo === 'DESPESA') acumulador.custos += valor;
}

function adicionarTempo(acumulador, minutos, origem) {
  if (!acumulador || !Number.isFinite(minutos) || minutos <= 0) return;
  if (origem === 'AGENDA') acumulador.minutosAgenda += minutos;
  if (origem === 'MANUAL') acumulador.minutosManuais += minutos;
}

function finalizarAcumulador(acumulador) {
  const minutos = acumulador.minutosAgenda + acumulador.minutosManuais;
  const horas = minutos / 60;
  // Reembolsos sao fluxo de caixa, mas nao receita do servico: por isso entram
  // na receita bruta e saem da receita liquida antes do calculo de lucro.
  const receitaBruta = acumulador.honorarios + acumulador.reembolsos;
  const receitaLiquida = acumulador.honorarios;
  const lucro = receitaLiquida - acumulador.custos;

  return {
    ...acumulador,
    receitaBruta: arredondar(receitaBruta),
    receitaLiquida: arredondar(receitaLiquida),
    custos: arredondar(acumulador.custos),
    lucro: arredondar(lucro),
    minutos,
    horas: arredondar(horas),
    horasAgenda: arredondar(acumulador.minutosAgenda / 60),
    horasManuais: arredondar(acumulador.minutosManuais / 60),
    rentabilidade: horas > 0 ? arredondar(lucro / horas) : null
  };
}

function ordenarPorLucro(a, b) {
  return b.lucro - a.lucro || (b.rentabilidade || -Infinity) - (a.rentabilidade || -Infinity);
}

function ordenarPorRentabilidade(a, b) {
  return (b.rentabilidade ?? -Infinity) - (a.rentabilidade ?? -Infinity) || b.lucro - a.lucro;
}

function duracaoAutomatica(compromisso, agora) {
  if (
    compromisso.deletado ||
    compromisso.status === 'CANCELADO' ||
    compromisso.diaTodo === true ||
    !TIPOS_TEMPO_AUTOMATICO.has(compromisso.tipo) ||
    !compromisso.dataInicio ||
    !compromisso.dataFim
  ) {
    return 0;
  }

  const inicio = new Date(compromisso.dataInicio).getTime();
  const fim = new Date(compromisso.dataFim).getTime();
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio || fim > agora) return 0;

  const minutos = Math.round((fim - inicio) / 60000);
  // Protege o indicador contra um evento antigo preenchido acidentalmente como
  // se durasse dias inteiros. Audiencias/reunioes usuais cabem em 12h.
  return minutos > 0 && minutos <= 12 * 60 ? minutos : 0;
}

async function listarCompromissosVisiveis(user) {
  try {
    // Administradores e usuarios com permissao recebem a visao do escritorio.
    return await compromissoService.listarAgenda({ modo: 'todas' }, user);
  } catch (error) {
    // Para advogado sem visao dos colegas, o calculo permanece correto para a
    // propria carteira e nao falha por uma permissao lateral da agenda.
    return compromissoService.listarAgenda({ modo: 'individual' }, user);
  }
}

function criarInsight(tipo, titulo, descricao, processoId = null) {
  return { tipo, titulo, descricao, processoId };
}

function montarInsights({ processos, areas, clientes, totais, qualidade }) {
  const insights = [];
  const areasComHoras = areas.filter((area) => area.horas > 0);
  const maisRentavel = [...areasComHoras].sort(ordenarPorRentabilidade)[0];
  const menosRentavel = [...areasComHoras].sort(ordenarPorRentabilidade).at(-1);

  if (maisRentavel) {
    insights.push(
      criarInsight(
        'SUCESSO',
        `${maisRentavel.area} lidera a rentabilidade`,
        `A área registra R$ ${maisRentavel.rentabilidade.toLocaleString('pt-BR', {
          maximumFractionDigits: 0
        })}/h de lucro com base nas horas registradas.`
      )
    );
  }

  if (menosRentavel && maisRentavel && menosRentavel.area !== maisRentavel.area) {
    insights.push(
      criarInsight(
        'ATENCAO',
        `${menosRentavel.area} merece revisão`,
        `A área está em R$ ${menosRentavel.rentabilidade.toLocaleString('pt-BR', {
          maximumFractionDigits: 0
        })}/h, abaixo das demais áreas com horas registradas.`
      )
    );
  }

  const deficit = processos.filter((processo) => processo.lucro < 0).sort(ordenarPorLucro)[0];
  if (deficit) {
    insights.push(
      criarInsight(
        'ATENCAO',
        'Há processo com prejuízo registrado',
        `${deficit.titulo} acumula R$ ${Math.abs(deficit.lucro).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} em custos acima dos honorários recebidos.`,
        deficit.id
      )
    );
  }

  const processosSemHoras = processos.filter(
    (processo) => processo.receitaLiquida > 0 && processo.horas === 0
  );
  if (processosSemHoras.length) {
    insights.push(
      criarInsight(
        'INFO',
        `${processosSemHoras.length} processo(s) sem horas registradas`,
        'A rentabilidade por hora será calculada automaticamente ao concluir audiências/reuniões ou ao lançar apenas o tempo externo que ficou faltando.'
      )
    );
  }

  const gruposArea = new Map();
  for (const processo of processos.filter((item) => item.horas > 0)) {
    const grupo = gruposArea.get(processo.area) || [];
    grupo.push(processo);
    gruposArea.set(processo.area, grupo);
  }

  for (const grupo of gruposArea.values()) {
    if (grupo.length < 2) continue;
    const mediaHoras = grupo.reduce((soma, processo) => soma + processo.horas, 0) / grupo.length;
    const acimaDoEsperado = grupo.find((processo) => processo.horas > mediaHoras * 1.4);
    if (acimaDoEsperado) {
      insights.push(
        criarInsight(
          'ATENCAO',
          'Tempo acima do padrão da área',
          `${acimaDoEsperado.titulo} já consumiu mais de 40% acima da média dos casos de ${acimaDoEsperado.area}.`,
          acimaDoEsperado.id
        )
      );
      break;
    }
  }

  if (qualidade.lancamentosSemProcesso > 0) {
    insights.push(
      criarInsight(
        'INFO',
        'Há lançamentos aguardando classificação',
        `${qualidade.lancamentosSemProcesso} lançamento(s) já entram no resultado geral. Vincule cada um a um processo ou confirme que deve permanecer no resultado geral.`
      )
    );
  }

  if (!insights.length && totais.horasTrabalhadas === 0) {
    insights.push(
      criarInsight(
        'INFO',
        'Aguardando dados de tempo',
        'Audiências e reuniões concluídas passam a alimentar este painel automaticamente. Use o ajuste manual apenas para trabalho externo não registrado.'
      )
    );
  }

  return insights.slice(0, 6);
}

function aplicarIndicadorVisual(processos, rentabilidadeMedia) {
  return processos.map((processo) => {
    if (processo.rentabilidade === null) return { ...processo, indicador: 'SEM_HORAS' };
    if (processo.lucro < 0) {
      return { ...processo, indicador: 'BAIXA' };
    }
    // Sem lucro/hora medio positivo ainda nao ha uma referencia saudavel para
    // chamar um caso de alta rentabilidade. Mantemos a leitura neutra.
    if (rentabilidadeMedia <= 0) return { ...processo, indicador: 'MEDIA' };
    if (processo.rentabilidade < rentabilidadeMedia * 0.7) {
      return { ...processo, indicador: 'BAIXA' };
    }
    if (processo.rentabilidade >= rentabilidadeMedia * 1.1) {
      return { ...processo, indicador: 'ALTA' };
    }
    return { ...processo, indicador: 'MEDIA' };
  });
}

async function montarRentabilidade(user) {
  const processos = await processoService.listarProcessos({ incluirEncerrados: 'true' }, user);
  const processosPorId = new Map();
  const processosOriginaisPorId = new Map();
  const clientesPorChave = new Map();
  const areasPorNome = new Map();

  for (const processo of processos) {
    const acumulador = criarAcumulador({
      id: processo.id,
      titulo: processo.titulo,
      clienteId: processo.clienteId,
      clienteNome: processo.clienteNome,
      area: nomeArea(processo)
    });
    processosPorId.set(processo.id, acumulador);
    processosOriginaisPorId.set(processo.id, processo);

    const chave = chaveCliente(processo.clienteId, processo.clienteNome);
    if (!clientesPorChave.has(chave)) {
      clientesPorChave.set(
        chave,
        criarAcumulador({ id: processo.clienteId || chave, titulo: processo.clienteNome, clienteNome: processo.clienteNome })
      );
    }
    clientesPorChave.get(chave).processos += 1;

    const area = nomeArea(processo);
    if (!areasPorNome.has(area)) areasPorNome.set(area, criarAcumulador({ id: area, titulo: area, area }));
    areasPorNome.get(area).processos += 1;
  }

  const todosComProjecao = processos.every(projecaoEstaPronta);
  const idsProcessos = [...processosPorId.keys()];
  const [lancamentos, compromissos, apontamentos] = await Promise.all([
    lancamentoService.listarLancamentos({}, user),
    listarCompromissosVisiveis(user),
    todosComProjecao
      ? apontamentoTempoService.listarRecentesPorProcessos(idsProcessos, user)
      : apontamentoTempoService.listarPorProcessos(idsProcessos, user)
  ]);

  const totais = criarAcumulador({ titulo: 'Escritório' });
  let lancamentosSemProcesso = 0;
  let lancamentosClassificadosGerais = 0;
  const lancamentosParaClassificar = [];

  for (const lancamento of lancamentos) {
    adicionarLancamento(totais, lancamento);
    const processo = lancamento.processoId ? processosPorId.get(lancamento.processoId) : null;
    if (lancamento.statusEfetivo === 'PAGO' && !processo) {
      const classificacao = classificacaoRentabilidade(lancamento, processo);
      if (classificacao === 'GERAL') {
        lancamentosClassificadosGerais += 1;
      } else {
        lancamentosSemProcesso += 1;
      }
      lancamentosParaClassificar.push({
        ...lancamento,
        classificacaoRentabilidade: classificacao
      });
    }
    if (!processo) {
      // Um lançamento sem processo ainda pode enriquecer o ranking do cliente
      // quando o vínculo do cliente foi informado no financeiro.
      if (lancamento.clienteId || lancamento.clienteNome) {
        const chave = chaveCliente(lancamento.clienteId, lancamento.clienteNome);
        if (!clientesPorChave.has(chave)) {
          clientesPorChave.set(
            chave,
            criarAcumulador({
              id: lancamento.clienteId || chave,
              titulo: lancamento.clienteNome,
              clienteId: lancamento.clienteId,
              clienteNome: lancamento.clienteNome
            })
          );
        }
        adicionarLancamento(clientesPorChave.get(chave), lancamento);
      }
      continue;
    }

    adicionarLancamento(processo, lancamento);
    const cliente = clientesPorChave.get(chaveCliente(processo.clienteId, processo.clienteNome));
    const area = areasPorNome.get(processo.area);
    adicionarLancamento(cliente, lancamento);
    adicionarLancamento(area, lancamento);
  }

  let compromissosAutomaticos = 0;
  const agora = Date.now();
  for (const compromisso of compromissos) {
    const processo = processosPorId.get(compromisso.processoId);
    const minutos = processo ? duracaoAutomatica(compromisso, agora) : 0;
    if (!minutos) continue;

    compromissosAutomaticos += 1;
    adicionarTempo(totais, minutos, 'AGENDA');
    adicionarTempo(processo, minutos, 'AGENDA');
    adicionarTempo(clientesPorChave.get(chaveCliente(processo.clienteId, processo.clienteNome)), minutos, 'AGENDA');
    adicionarTempo(areasPorNome.get(processo.area), minutos, 'AGENDA');
  }

  if (todosComProjecao) {
    for (const [processoId, processo] of processosPorId) {
      const original = processosOriginaisPorId.get(processoId);
      const minutos = Number(original?.rentabilidadeProjection?.totalSeconds || 0) / 60;
      if (!Number.isFinite(minutos) || minutos <= 0) continue;

      adicionarTempo(totais, minutos, 'MANUAL');
      adicionarTempo(processo, minutos, 'MANUAL');
      adicionarTempo(clientesPorChave.get(chaveCliente(processo.clienteId, processo.clienteNome)), minutos, 'MANUAL');
      adicionarTempo(areasPorNome.get(processo.area), minutos, 'MANUAL');
    }
  } else {
    for (const apontamento of apontamentos) {
      const processo = processosPorId.get(apontamento.processoId);
      const minutos = Number(apontamento.minutos);
      if (!processo || !Number.isFinite(minutos) || minutos <= 0) continue;

      adicionarTempo(totais, minutos, 'MANUAL');
      adicionarTempo(processo, minutos, 'MANUAL');
      adicionarTempo(clientesPorChave.get(chaveCliente(processo.clienteId, processo.clienteNome)), minutos, 'MANUAL');
      adicionarTempo(areasPorNome.get(processo.area), minutos, 'MANUAL');
    }
  }

  const totaisFinalizados = finalizarAcumulador(totais);
  const rentabilidadeMedia = totaisFinalizados.rentabilidade || 0;
  const processosFinalizados = aplicarIndicadorVisual(
    [...processosPorId.values()].map(finalizarAcumulador),
    rentabilidadeMedia
  );
  const clientesFinalizados = [...clientesPorChave.values()].map(finalizarAcumulador);
  const areasFinalizadas = [...areasPorNome.values()].map(finalizarAcumulador);
  const processosPorRentabilidade = processosFinalizados.filter((processo) => processo.rentabilidade !== null).sort(ordenarPorRentabilidade);
  const qualidade = {
    compromissosAutomaticos,
    apontamentosManuais: todosComProjecao
      ? processos.reduce((total, processo) => total + Number(processo.rentabilidadeProjection?.timeEntryCount || 0), 0)
      : apontamentos.length,
    lancamentosSemProcesso,
    lancamentosClassificadosGerais,
    processosComReceitaSemHoras: processosFinalizados.filter(
      (processo) => processo.receitaLiquida > 0 && processo.horas === 0
    ).length
  };

  return {
    geradoEm: new Date().toISOString(),
    criterio: {
      baseReceita: 'Valores efetivamente pagos',
      receitaBruta: 'Honorários recebidos + reembolsos',
      receitaLiquida: 'Honorários recebidos',
      tempoAutomatico: 'Audiências e reuniões já encerradas na agenda'
    },
    indicadores: {
      receitaBruta: totaisFinalizados.receitaBruta,
      receitaLiquida: totaisFinalizados.receitaLiquida,
      custos: totaisFinalizados.custos,
      lucro: totaisFinalizados.lucro,
      horasTrabalhadas: totaisFinalizados.horas,
      horasAgenda: totaisFinalizados.horasAgenda,
      horasManuais: totaisFinalizados.horasManuais,
      rentabilidadeMedia: totaisFinalizados.rentabilidade,
      processoMaisRentavel: processosPorRentabilidade[0] || null,
      processoMenosRentavel: processosPorRentabilidade.at(-1) || null,
      clienteMaisRentavel: clientesFinalizados.filter((cliente) => cliente.rentabilidade !== null).sort(ordenarPorRentabilidade)[0] || null,
      clienteMenosRentavel: clientesFinalizados.filter((cliente) => cliente.rentabilidade !== null).sort(ordenarPorRentabilidade).at(-1) || null,
      areaMaisLucrativa: [...areasFinalizadas].sort(ordenarPorLucro)[0] || null,
      areaMenosLucrativa: [...areasFinalizadas].sort(ordenarPorLucro).at(-1) || null
    },
    rankings: {
      processosMaisRentaveis: [...processosPorRentabilidade].slice(0, 10),
      clientesMaisRentaveis: clientesFinalizados
        .filter((cliente) => cliente.rentabilidade !== null)
        .sort(ordenarPorRentabilidade)
        .slice(0, 10),
      clientesMaisTempo: [...clientesFinalizados]
        .filter((cliente) => cliente.horas > 0)
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 10),
      porArea: [...areasFinalizadas].sort(ordenarPorLucro)
    },
    insights: montarInsights({
      processos: processosFinalizados,
      areas: areasFinalizadas,
      clientes: clientesFinalizados,
      totais: totaisFinalizados,
      qualidade
    }),
    qualidade,
    processosDisponiveis: processosFinalizados
      .map((processo) => ({ id: processo.id, titulo: processo.titulo, clienteNome: processo.clienteNome, area: processo.area }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo)),
    lancamentosParaClassificar: lancamentosParaClassificar
      .sort((a, b) => String(b.pagoEm || b.vencimento || '').localeCompare(String(a.pagoEm || a.vencimento || '')))
      .slice(0, 20),
    apontamentosRecentes: apontamentos.slice(0, 20)
  };
}

module.exports = {
  montarRentabilidade
};
