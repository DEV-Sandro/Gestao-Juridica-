import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AgendaEvento, diferencaDiasParaPrazo } from '../../shared/processo-ui';

type NivelRisco = 'critico' | 'alerta' | 'tranquilo';

export interface PrazoTriado {
  evento: AgendaEvento;
  dias: number;
  nivel: NivelRisco;
  resumoDias: string;
  ciente: boolean;
}

/**
 * Central de Prazos Inteligente — centro de comando triado por risco.
 * Reaproveita os eventos que o sistema já calcula (prazos de processos +
 * compromissos) e os organiza por urgência com semáforo verde/amarelo/vermelho,
 * confirmação de ciência (persistida) e ação "Resolver agora". Não depende de
 * nenhuma integração externa — é o analgésico entregue com dados que já existem.
 */
@Component({
  selector: 'app-central-prazos',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './central-prazos.component.html',
  styleUrls: ['./central-prazos.component.scss']
})
export class CentralPrazosComponent {
  @Input() eventos: AgendaEvento[] = [];
  @Output() resolver = new EventEmitter<AgendaEvento>();

  // Ciência (confirmação de leitura) por evento — persistida no navegador do
  // usuário. Numa fase seguinte vira campo no backend + escalonamento real.
  private readonly CIENCIA_KEY = 'justapro-prazos-ciencia';
  private ciencia = new Set<string>(this.lerCiencia());

  // Categorias financeiras não são "prazos jurídicos" — ficam fora da central.
  private readonly FINANCEIRAS = new Set(['RECEBIMENTO', 'PAGAMENTO']);
  private readonly STATUS_FINAIS = new Set(['Concluído', 'Arquivado', 'Cancelado', 'Indeferido']);

  get prazos(): PrazoTriado[] {
    const hoje = this.eventos
      .filter((evento) => !this.FINANCEIRAS.has(evento.categoria) && !this.STATUS_FINAIS.has(evento.status))
      .map((evento) => {
        const dias = diferencaDiasParaPrazo(evento.data);
        return { evento, dias: dias ?? 9999 };
      })
      .filter((item) => item.dias !== 9999)
      // Só o que já venceu ou vence nos próximos 60 dias — o horizonte de ação.
      .filter((item) => item.dias <= 60)
      .map((item) => this.triar(item.evento, item.dias))
      .sort((a, b) => a.dias - b.dias);

    return hoje;
  }

  get criticos(): PrazoTriado[] {
    return this.prazos.filter((p) => p.nivel === 'critico');
  }

  get alertas(): PrazoTriado[] {
    return this.prazos.filter((p) => p.nivel === 'alerta');
  }

  get tranquilos(): PrazoTriado[] {
    return this.prazos.filter((p) => p.nivel === 'tranquilo');
  }

  // Críticos sem ciência confirmada = o que realmente precisa de ação agora.
  get criticosPendentes(): number {
    return this.criticos.filter((p) => !p.ciente).length;
  }

  get temPrazos(): boolean {
    return this.prazos.length > 0;
  }

  private triar(evento: AgendaEvento, dias: number): PrazoTriado {
    let nivel: NivelRisco;
    if (dias <= 1 || evento.status === 'Data Fatal' || evento.status === 'Atrasado') {
      nivel = 'critico';
    } else if (dias <= 7) {
      nivel = 'alerta';
    } else {
      nivel = 'tranquilo';
    }

    return {
      evento,
      dias,
      nivel,
      resumoDias: this.resumoDias(dias),
      ciente: this.ciencia.has(evento.id)
    };
  }

  private resumoDias(dias: number): string {
    if (dias < 0) {
      const d = Math.abs(dias);
      return `Atrasado há ${d} dia${d === 1 ? '' : 's'}`;
    }
    if (dias === 0) return 'Vence hoje';
    if (dias === 1) return 'Vence amanhã';
    return `Vence em ${dias} dias`;
  }

  resolverAgora(prazo: PrazoTriado): void {
    this.resolver.emit(prazo.evento);
  }

  confirmarCiencia(prazo: PrazoTriado, evento?: Event): void {
    evento?.stopPropagation();
    if (this.ciencia.has(prazo.evento.id)) {
      this.ciencia.delete(prazo.evento.id);
    } else {
      this.ciencia.add(prazo.evento.id);
    }
    this.persistirCiencia();
  }

  private lerCiencia(): string[] {
    try {
      const bruto = localStorage.getItem(this.CIENCIA_KEY);
      const lista = bruto ? (JSON.parse(bruto) as string[]) : [];
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  }

  private persistirCiencia(): void {
    try {
      localStorage.setItem(this.CIENCIA_KEY, JSON.stringify(Array.from(this.ciencia)));
    } catch {
      /* armazenamento indisponível — ciência fica só na sessão */
    }
  }

  trackByPrazo(_: number, prazo: PrazoTriado): string {
    return prazo.evento.id;
  }
}
