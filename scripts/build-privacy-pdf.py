"""Gera o PDF público a partir da página de política de privacidade."""

from html import escape
from pathlib import Path

from lxml import html
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'front/src/app/politica-privacidade/politica-privacidade.html'
DESTINATION = ROOT / 'front/src/assets/politica-de-privacidade.pdf'

pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', r'C:\Windows\Fonts\arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='ArialBold')

NAVY = colors.HexColor('#172638')
BLUE = colors.HexColor('#245a78')
MUTED = colors.HexColor('#596b7f')

title_style = ParagraphStyle('title', fontName='ArialBold', fontSize=25, leading=32, textColor=NAVY, spaceAfter=10)
lead_style = ParagraphStyle('lead', fontName='Arial', fontSize=10.5, leading=15, textColor=MUTED, spaceAfter=6)
note_style = ParagraphStyle('note', fontName='Arial', fontSize=9, leading=13, textColor=colors.HexColor('#6d501d'), spaceAfter=10, borderColor=colors.HexColor('#efd59c'), borderWidth=1, borderPadding=9, backColor=colors.HexColor('#fff8e7'))
heading_style = ParagraphStyle('heading', fontName='ArialBold', fontSize=12, leading=16, textColor=NAVY, spaceBefore=13, spaceAfter=6, keepWithNext=True)
body_style = ParagraphStyle('body', fontName='Arial', fontSize=9.2, leading=13, textColor=MUTED, spaceAfter=6, alignment=TA_LEFT)
bullet_style = ParagraphStyle('bullet', parent=body_style, leftIndent=14, firstLineIndent=-9, bulletIndent=0)


def mark_up(element):
    """Preserva negrito de termos sem trazer tags Angular para o PDF."""
    pieces = []
    if element.text:
        pieces.append(escape(element.text))
    for child in element:
        if child.tag == 'strong':
            pieces.append(f'<b>{escape(child.text_content())}</b>')
        else:
            pieces.append(escape(child.text_content()))
        if child.tail:
            pieces.append(escape(child.tail))
    return ''.join(pieces).strip()


class PolicyDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(filename, pagesize=A4, leftMargin=52, rightMargin=52, topMargin=68, bottomMargin=58,
                         title='Política de Privacidade | JustaPro', author='JustaPro')
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id='main', frames=frame, onPage=self.draw_page))

    def draw_page(self, canvas, doc):
        canvas.saveState()
        width, height = A4
        canvas.setFillColor(BLUE)
        canvas.roundRect(52, height - 44, 25, 25, 6, fill=1, stroke=0)
        canvas.setFont('ArialBold', 18)
        canvas.setFillColor(colors.white)
        canvas.drawCentredString(64.5, height - 39, '§')
        canvas.setFont('ArialBold', 11)
        canvas.setFillColor(NAVY)
        canvas.drawString(86, height - 36, 'JustaPro')
        canvas.setStrokeColor(colors.HexColor('#e0e6eb'))
        canvas.line(52, 45, width - 52, 45)
        canvas.setFont('Arial', 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(52, 31, 'Política de Privacidade · Minuta para revisão')
        canvas.drawRightString(width - 52, 31, str(doc.page))
        canvas.restoreState()


def main():
    tree = html.fromstring(SOURCE.read_text(encoding='utf-8'))
    content = tree.xpath('//article[contains(@class, "policy-content")]')[0]
    story = [
        Paragraph('Política de Privacidade', title_style),
        Paragraph('Como os dados são utilizados no sistema de gestão jurídica JustaPro.', lead_style),
        Paragraph('Minuta para revisão · 21/10/2026', lead_style),
        Spacer(1, 8),
        Paragraph('<b>Antes de publicar esta política:</b> preencher a identificação do responsável pelo JustaPro, '
                  'CNPJ (se houver), canal de contato para pedidos sobre dados e definir formalmente os papéis de '
                  'controlador e operador com cada escritório.', note_style),
    ]

    for section in content.xpath('./section'):
        heading = section.xpath('./h2')[0].text_content()
        elements = [Paragraph(escape(heading), heading_style)]
        for item in section.xpath('./p|./ul/li'):
            if item.tag == 'li':
                elements.append(Paragraph('• ' + mark_up(item), bullet_style))
            else:
                elements.append(Paragraph(mark_up(item), body_style))
        story.extend(elements)

    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    PolicyDoc(str(DESTINATION)).build(story)
    print(DESTINATION)


if __name__ == '__main__':
    main()
