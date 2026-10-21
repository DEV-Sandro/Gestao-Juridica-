export function calcularPrazoUtil(inicio: string, quantidade: number, feriados: Iterable<string>): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 365) return null;
  const data = new Date(`${inicio}T12:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== inicio) return null;
  const diasSemExpediente = new Set(feriados);
  let contados = 0;
  while (contados < quantidade) {
    data.setUTCDate(data.getUTCDate() + 1);
    const diaSemana = data.getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6 && !diasSemExpediente.has(data.toISOString().slice(0, 10))) contados++;
  }
  return data.toISOString().slice(0, 10);
}

export function calcularHonorarios(base: number, percentual: number, entrada: number, parcelas: number) {
  if (![base, percentual, entrada, parcelas].every(Number.isFinite) || base < 0 || percentual < 0 || percentual > 100 || !Number.isInteger(parcelas) || parcelas < 1 || parcelas > 60) return null;
  const totalCentavos = Math.round(base * percentual);
  const entradaCentavos = Math.round(entrada * 100);
  if (entradaCentavos < 0 || entradaCentavos > totalCentavos) return null;
  const restanteCentavos = totalCentavos - entradaCentavos;
  const parcelaBase = Math.floor(restanteCentavos / parcelas);
  const parcelasCentavos = Array.from({ length: parcelas }, (_, indice) => parcelaBase + (indice < restanteCentavos % parcelas ? 1 : 0));
  return { total: totalCentavos / 100, entrada: entradaCentavos / 100, restante: restanteCentavos / 100, parcelas: parcelasCentavos.map(valor => valor / 100) };
}
