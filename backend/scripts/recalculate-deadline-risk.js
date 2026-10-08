// Executa a manutencao horaria do campo riskLevel para a Fila de Acao.
// Uso: node scripts/recalculate-deadline-risk.js          (dry-run)
//       node scripts/recalculate-deadline-risk.js --apply  (atualiza documentos)

const { atualizarNiveisRisco } = require('../src/jobs/deadline-risk.job');

const dryRun = !process.argv.includes('--apply');

atualizarNiveisRisco({ dryRun })
  .then((resultado) => {
    console.log(
      `Risco de prazos: ${resultado.avaliados} avaliados, ${resultado.atualizados} a atualizar` +
        (dryRun ? ' (dry-run).' : `, ${resultado.commits} lote(s) gravado(s).`)
    );
  })
  .catch((error) => {
    console.error('Falha ao recalcular risco de prazos:', error.message);
    process.exitCode = 1;
  });
