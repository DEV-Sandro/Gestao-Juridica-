import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface TopicoAjuda {
  categoria: string;
  pergunta: string;
  resposta: string;
}

@Component({
  selector: 'app-ajuda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './ajuda.html',
  styleUrl: './ajuda.scss'
})
export class AjudaComponent {
  busca = '';

  readonly topicos: TopicoAjuda[] = [
    {
      categoria: 'Acesso',
      pergunta: 'Como entro no JustaPro?',
      resposta: 'Use o e-mail e a senha da sua conta na página Entrar. Se recebeu um convite do escritório, escolha Finalizar convite antes do primeiro acesso.'
    },
    {
      categoria: 'Clientes',
      pergunta: 'Como cadastro uma pessoa física ou jurídica?',
      resposta: 'Abra Clientes e escolha Novo cliente. Selecione Pessoa física · CPF ou Pessoa jurídica · CNPJ, preencha os dados e salve. Confira os dados antes de associar o cliente a um processo.'
    },
    {
      categoria: 'Clientes',
      pergunta: 'O CEP e o CNPJ preenchem o endereço automaticamente?',
      resposta: 'Ao completar um CEP de oito dígitos, o sistema tenta buscar rua, bairro, cidade e UF pelo ViaCEP. Para pessoa jurídica, o botão Buscar dados do CNPJ tenta preencher campos vazios pela BrasilAPI. Se a consulta externa falhar, você pode preencher tudo manualmente.'
    },
    {
      categoria: 'Processos',
      pergunta: 'Onde vejo e atualizo os processos?',
      resposta: 'Abra Processos para pesquisar, filtrar e abrir um registro. Use Novo processo para cadastrar e as ações do item para ver ou editar. Confira os prazos cadastrados; o sistema não substitui a conferência dos autos e intimações.'
    },
    {
      categoria: 'Agenda',
      pergunta: 'Como separo prazos, audiências e financeiro no calendário?',
      resposta: 'Na Agenda, escolha um dos filtros: Todos, Prazos processuais, Audiências, Outras agendas ou Financeiro. Selecione uma data ou um evento para ver os compromissos do período.'
    },
    {
      categoria: 'Financeiro',
      pergunta: 'Como registro receitas, despesas e horas?',
      resposta: 'Abra Financeiro. Use Novo lançamento para registrar um valor e seu vencimento. No bloco de horas, selecione o processo, informe a atividade e o tempo trabalhado. Você pode vincular lançamentos a processos para acompanhar o resultado estimado.'
    },
    {
      categoria: 'Financeiro',
      pergunta: 'O que significa resultado estimado?',
      resposta: 'É uma visão gerencial do período: valores recebidos menos despesas pagas e custo das horas registradas. Confira os lançamentos e critérios do escritório antes de usar esse número para decisões contábeis ou fiscais.'
    },
    {
      categoria: 'Documentos',
      pergunta: 'Como preparo um documento?',
      resposta: 'Abra Documentos, escolha um modelo e selecione os dados disponíveis do cliente e do escritório. Revise cuidadosamente o arquivo gerado, sobretudo qualificações, valores e cláusulas, antes de utilizá-lo.'
    },
    {
      categoria: 'Aparência',
      pergunta: 'Posso usar o sistema no celular ou mudar as cores?',
      resposta: 'Sim. As telas se adaptam ao celular. No escritório, use o seletor de tema no cabeçalho para escolher modo claro ou escuro. A preferência fica salva neste navegador.'
    },
    {
      categoria: 'Conta',
      pergunta: 'Não recebi acesso. Com quem falo?',
      resposta: 'Peça ao administrador do seu escritório que confira o convite e o e-mail usado no cadastro. O canal público de suporte do JustaPro ainda será divulgado na página inicial.'
    }
  ];

  get topicosFiltrados(): TopicoAjuda[] {
    const termo = this.normalizar(this.busca.trim());
    if (!termo) return this.topicos;
    return this.topicos.filter((topico) =>
      this.normalizar(`${topico.categoria} ${topico.pergunta} ${topico.resposta}`).includes(termo)
    );
  }

  limparBusca(): void {
    this.busca = '';
  }

  private normalizar(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
}
