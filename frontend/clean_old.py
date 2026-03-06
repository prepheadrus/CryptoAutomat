# Clean old strategy_builder.html content from index.html

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Eski CSS'i bul ve sil
css_start = content.find('.modal-content { background: #0d1117')
if css_start != -1:
    css_end = content.find('.strategy-info { margin-bottom: 20px')
    if css_end != -1:
        css_end = content.find('}', css_end) + 1
        content = content[:css_start] + content[css_end:]
        print('[OK] CSS silindi!')
else:
    print('[INFO] CSS bulunamadi (zaten silinmis)')

# Eski HTML'i bul ve sil
html_start = content.find('<!-- Strateji Builder Container -->')
if html_start != -1:
    # Sonrasini bul (</div></div></div> pattern'i)
    html_end = content.find('<!-- SEKME: STRATEJI KUTUPHANESI -->')
    if html_end == -1:
        html_end = content.find('<!-- SEKME: STRATEJİ KÜTÜPHANESİ -->')

    if html_end != -1:
        content = content[:html_start] + content[html_end:]
        print('[OK] HTML silindi!')
    else:
        print('[ERROR] Bitis marker bulunamadi!')
else:
    print('[INFO] HTML bulunamadi (zaten silinmis)')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('[OK] TEMIZLENDI!')
