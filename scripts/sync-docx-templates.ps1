param(
  [string]$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

$sourceDir = Join-Path $WorkspaceRoot 'backend\templates'
$outputDir = Join-Path $WorkspaceRoot 'front\src\assets\document-templates'

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

function Get-DocxXml {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $entry = $zip.GetEntry('word/document.xml')
    if (-not $entry) {
      throw "Arquivo sem word/document.xml: $Path"
    }

    $reader = [System.IO.StreamReader]::new($entry.Open())
    try {
      return $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }
  } finally {
    $zip.Dispose()
  }
}

function Set-DocxXml {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Xml
  )

  $zip = [System.IO.Compression.ZipFile]::Open($Path, [System.IO.Compression.ZipArchiveMode]::Update)
  try {
    $entry = $zip.GetEntry('word/document.xml')
    if (-not $entry) {
      throw "Arquivo sem word/document.xml: $Path"
    }

    $entry.Delete()
    $newEntry = $zip.CreateEntry('word/document.xml')
    $writer = [System.IO.StreamWriter]::new($newEntry.Open())
    try {
      $writer.Write($Xml)
    } finally {
      $writer.Dispose()
    }
  } finally {
    $zip.Dispose()
  }
}

function Replace-ParagraphContaining {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputText,
    [Parameter(Mandatory = $true)]
    [string]$Needle,
    [Parameter(Mandatory = $true)]
    [string]$Replacement,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  $paragraph = [regex]::Matches($InputText, '(?s)<w:p\b[^>]*>.*?</w:p>') |
    Where-Object { $_.Value.Contains($Needle) } |
    Select-Object -First 1

  if (-not $paragraph) {
    throw "Nao foi possivel localizar o paragrafo esperado: $Description"
  }

  return $InputText.Remove($paragraph.Index, $paragraph.Length).Insert($paragraph.Index, $Replacement)
}

function Replace-ParagraphWhere {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputText,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Predicate,
    [Parameter(Mandatory = $true)]
    [string]$Replacement,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  $paragraph = [regex]::Matches($InputText, '(?s)<w:p\b[^>]*>.*?</w:p>') |
    Where-Object { & $Predicate $_.Value } |
    Select-Object -First 1

  if (-not $paragraph) {
    throw "Nao foi possivel localizar o paragrafo esperado: $Description"
  }

  return $InputText.Remove($paragraph.Index, $paragraph.Length).Insert($paragraph.Index, $Replacement)
}

function Build-ProcuracaoTemplate {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Xml
  )

  $outorgante = @'
<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>OUTORGANTE:</w:t></w:r><w:r><w:t xml:space="preserve"> {cliente_nome}, inscrito(a) no CPF sob o n.&#186; {cliente_cpf}, e no documento complementar n.&#186; {cliente_documento_secundario}, com telefone/WhatsApp {cliente_telefone}, residente e domiciliado(a) em {cliente_endereco_completo}.</w:t></w:r></w:p>
'@

  $outorgado = @'
<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>OUTORGADO:</w:t></w:r><w:r><w:t xml:space="preserve"> {advogado_nome}, advogado(a), inscrito(a) na OAB sob o n.&#186; {advogado_oab}, com telefone/WhatsApp {advogado_telefone}.</w:t></w:r></w:p>
'@

  $poderesEspecificos = @'
<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>PODERES ESPEC&#205;FICOS:</w:t></w:r><w:r><w:t xml:space="preserve"> Concede poderes espec&#237;ficos para defender seus interesses nos autos sob o n.&#186; {processo_referencia}.</w:t></w:r></w:p>
'@

  $localData = @'
<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>LOCAL/DATA:</w:t></w:r><w:r><w:t xml:space="preserve"> {local_assinatura}, {data_extenso}.</w:t></w:r></w:p>
'@

  $assinaturaNome = @'
<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>{cliente_nome}</w:t></w:r></w:p>
'@

  $assinaturaCpf = @'
<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">CPF n.&#186;: </w:t></w:r><w:r><w:t>{cliente_cpf}</w:t></w:r></w:p>
'@

  $Xml = Replace-ParagraphContaining $Xml 'OUTORGANTE' $outorgante 'paragrafo do outorgante'
  $Xml = Replace-ParagraphContaining $Xml 'OUTORGADO' $outorgado 'paragrafo do outorgado'
  $Xml = Replace-ParagraphContaining $Xml 'defender seus interesses nos autos sob o' $poderesEspecificos 'paragrafo de poderes especificos'
  $Xml = Replace-ParagraphContaining $Xml 'LOCAL/DATA' $localData 'paragrafo de local e data'
  $Xml = Replace-ParagraphContaining $Xml 'MATHEUS HENRIQUE TONELLO' $assinaturaNome 'assinatura do cliente'
  $Xml = Replace-ParagraphContaining $Xml '108.404.079-47' $assinaturaCpf 'cpf da assinatura do cliente'

  return $Xml
}

function Build-ContratoTemplate {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Xml
  )

  $partes = @'
<w:p><w:pPr><w:ind w:firstLine="3402"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>{cliente_nome}</w:t></w:r><w:r><w:t xml:space="preserve">, inscrito(a) no CPF/MF n.&#186; {cliente_cpf}, telefone/WhatsApp n.&#186; {cliente_telefone}, domiciliado(a) em {cliente_endereco_completo}. Pelo presente instrumento particular de contrato de honor&#225;rios, contrata os servi&#231;os profissionais do Advogado: {advogado_nome}, inscrito(a) na OAB sob o n.&#186; {advogado_oab}, telefone/WhatsApp {advogado_telefone}.</w:t></w:r></w:p>
'@

  $clausula1 = @'
<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Cl&#225;usula 1&#170;.</w:t></w:r><w:r><w:t xml:space="preserve"> A CLIENTE contrata neste ato os servi&#231;os profissionais do ADVOGADO para atuar em {processo_objeto}, sob a refer&#234;ncia interna {processo_referencia}.</w:t></w:r></w:p>
'@

  $clausula2 = @'
<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Cl&#225;usula 2&#170;.</w:t></w:r><w:r><w:t xml:space="preserve"> Para execu&#231;&#227;o dos servi&#231;os acima especificados ser&#225; pago ao ADVOGADO o montante de R$ {contrato_valor} ({contrato_valor_extenso}) reais.</w:t></w:r></w:p>
'@

  $paragrafoPagamento = @'
<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Par&#225;grafo 1&#186;.</w:t></w:r><w:r><w:t xml:space="preserve"> O pagamento ser&#225; realizado conforme negocia&#231;&#227;o entre as partes, e o contato do escrit&#243;rio para tratativas e documentos ser&#225; {advogado_telefone}.</w:t></w:r></w:p>
'@

  $clausula9 = @'
<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Cl&#225;usula 9&#170;.</w:t></w:r><w:r><w:t xml:space="preserve"> Para os efeitos do presente contrato, fica eleito o foro da Comarca de {cliente_cidade_estado}.</w:t></w:r></w:p>
'@

  $dataCentro = @'
<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:t>{local_assinatura}, {data_extenso}.</w:t></w:r></w:p>
'@

  $assinaturaAdvogado = @'
<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{advogado_nome} </w:t></w:r></w:p>
'@

  $oabAdvogado = @'
<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">OAB </w:t></w:r><w:r><w:t>{advogado_oab}</w:t></w:r></w:p>
'@

  $assinaturaCliente = @'
<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>{cliente_nome}</w:t></w:r></w:p>
'@

  $cpfCliente = @'
<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">CPF n.&#186;: </w:t></w:r><w:r><w:t>{cliente_cpf}</w:t></w:r></w:p>
'@

  $Xml = Replace-ParagraphContaining $Xml 'GLAUCYA ROBERTA PAGNONCELLI BATTISTON' $partes 'paragrafo das partes do contrato'
  $Xml = Replace-ParagraphContaining $Xml 'cumprimento' $clausula1 'clausula 1'
  $Xml = Replace-ParagraphContaining $Xml '2.000,00' $clausula2 'clausula 2'
  $Xml = Replace-ParagraphContaining $Xml '98821-6107.' $paragrafoPagamento 'paragrafo de pagamento'
  $Xml = Replace-ParagraphContaining $Xml 'foro da Comarca' $clausula9 'clausula 9'
  $Xml = Replace-ParagraphContaining $Xml 'janeiro' $dataCentro 'paragrafo central de data'
  $Xml = Replace-ParagraphWhere $Xml { param($paragraph) $paragraph.Contains('___________________________') -and $paragraph.Contains('ELIAN FERNANDO ALVES ') } $assinaturaAdvogado 'assinatura do advogado'
  $Xml = Replace-ParagraphContaining $Xml 'OAB/PR ' $oabAdvogado 'linha da oab'
  $Xml = Replace-ParagraphWhere $Xml { param($paragraph) $paragraph.Contains('___________________________') -and $paragraph.Contains('<w:t>CLIENTE</w:t>') } $assinaturaCliente 'assinatura do cliente'
  $Xml = Replace-ParagraphContaining $Xml '072.646.249-78' $cpfCliente 'cpf do cliente na assinatura'

  return $Xml
}

function Build-DeclaracaoTemplate {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Xml
  )

  $start = [regex]::Match($Xml, '(?s)^.*?<w:body>').Value
  $sectPrIndex = $Xml.LastIndexOf('<w:sectPr')

  if (-not $start -or $sectPrIndex -lt 0) {
    throw 'Nao foi possivel identificar a estrutura base da declaracao.'
  }

  $end = $Xml.Substring($sectPrIndex)

  $body = @'
<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>DECLARA&#199;&#195;O DE HIPOSSUFICI&#202;NCIA</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:p>
<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:r><w:t xml:space="preserve">Eu, {cliente_nome}, inscrito(a) no CPF n.&#186; {cliente_cpf}, residente e domiciliado(a) em {cliente_endereco_completo}, declaro, sob as penas da lei, que momentaneamente n&#227;o possuo recursos suficientes para custear qualquer demanda judicial, sem preju&#237;zo do sustento pr&#243;prio e da fam&#237;lia, nos termos da legisla&#231;&#227;o aplic&#225;vel.</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:t>{local_assinatura}, {data_extenso}.</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:t>_____________________</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>{cliente_nome}</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">CPF n.&#186;: </w:t></w:r><w:r><w:t>{cliente_cpf}</w:t></w:r></w:p>
'@

  return $start + $body + $end
}

function Resolve-TemplateSource {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Pattern
  )

  $matches = @(Get-ChildItem -Path $sourceDir -Filter $Pattern)
  if ($matches.Count -eq 0) {
    throw "Nenhum template encontrado para o padrao: $Pattern"
  }

  return $matches[0].FullName
}

function Export-TemplateCopy {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePattern,
    [Parameter(Mandatory = $true)]
    [string]$TargetName,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Transform
  )

  $sourcePath = Resolve-TemplateSource -Pattern $SourcePattern
  $targetPath = Join-Path $outputDir $TargetName

  Copy-Item $sourcePath $targetPath -Force
  $xml = Get-DocxXml -Path $targetPath
  $transformed = & $Transform $xml
  Set-DocxXml -Path $targetPath -Xml $transformed

  Write-Host "Template sincronizado: $TargetName"
}

Export-TemplateCopy -SourcePattern 'Procura* - Copia.docx' -TargetName 'procuracao-template.docx' -Transform ${function:Build-ProcuracaoTemplate}
Export-TemplateCopy -SourcePattern 'Contrato*.docx' -TargetName 'contrato-honorarios-template.docx' -Transform ${function:Build-ContratoTemplate}
Export-TemplateCopy -SourcePattern 'DECLARA*.docx' -TargetName 'declaracao-hipossuficiencia-template.docx' -Transform ${function:Build-DeclaracaoTemplate}
