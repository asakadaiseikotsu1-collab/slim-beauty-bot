const sharp = require('sharp');
const fs = require('fs');

const svg = `<svg viewBox="0 0 2500 843" xmlns="http://www.w3.org/2000/svg">
  <rect width="2500" height="843" fill="#FFF5F7"/>
  <line x1="1250" y1="0" x2="1250" y2="843" stroke="#E8789A" stroke-width="2"/>
  <rect x="0" y="0" width="1250" height="843" fill="#FFF5F7"/>
  <rect x="574" y="170" width="110" height="100" rx="8" fill="none" stroke="#E8789A" stroke-width="4"/>
  <line x1="574" y1="205" x2="684" y2="205" stroke="#E8789A" stroke-width="4"/>
  <line x1="608" y1="155" x2="608" y2="188" stroke="#E8789A" stroke-width="4"/>
  <line x1="650" y1="155" x2="650" y2="188" stroke="#E8789A" stroke-width="4"/>
  <rect x="590" y="225" width="20" height="20" rx="3" fill="#E8789A"/>
  <rect x="619" y="225" width="20" height="20" rx="3" fill="#E8789A"/>
  <rect x="648" y="225" width="20" height="20" rx="3" fill="#E8789A"/>
  <rect x="590" y="252" width="20" height="20" rx="3" fill="#E8789A"/>
  <rect x="619" y="252" width="20" height="20" rx="3" fill="#E8789A"/>
  <text x="625" y="370" text-anchor="middle" font-family="Hiragino Sans" font-size="44" font-weight="bold" fill="#C94F72">無料カウンセリング</text
cat > /Users/furutake/slim-beauty-bot/make-richmenu.js << 'EOF'
const sharp = require('sharp');
const fs = require('fs');

const svg = `<svg viewBox="0 0 2500 843" xmlns="http://www.w3.org/2000/svg">
  <rect width="2500" height="843" fill="#FFF5F7"/>
  <line x1="1250" y1="0" x2="1250" y2="843" stroke="#E8789A" stroke-width="2"/>
  <rect x="0" y="0" width="1250" height="843" fill="#FFF5F7"/>
  <rect x="574" y="170" width="110" height="100" rx="8" fill="none" stroke="#E8789A" stroke-width="4"/>
  <line x1="574" y1="205" x2="684" y2="205" stroke="#E8789A" stroke-width="4"/>
  <line x1="608" y1="155" x2="608" y2="188" stroke="#E8789A" stroke-width="4"/>
  <line x1="650" y1="155" x2="650" y2="188" stroke="#E8789A" stroke-width="4"/>
  <rect x="590" y="225" width="20" height="20" rx="3" fill="#E8789A"/>
  <rect x="619" y="225" width="20" height="20" rx="3" fill="#E8789A"/>
  <rect x="648" y="225" width="20" height="20" rx="3" fill="#E8789A"/>
  <rect x="590" y="252" width="20" height="20" rx="3" fill="#E8789A"/>
  <rect x="619" y="252" width="20" height="20" rx="3" fill="#E8789A"/>
  <text x="625" y="370" text-anchor="middle" font-family="Hiragino Sans" font-size="44" font-weight="bold" fill="#C94F72">無料カウンセリング</text>
  <text x="625" y="430" text-anchor="middle" font-family="Hiragino Sans" font-size="44" font-weight="bold" fill="#C94F72">予約</text>
  <line x1="475" y1="470" x2="775" y2="470" stroke="#E8789A" stroke-width="2"/>
  <text x="625" y="525" text-anchor="middle" font-family="Hiragino Sans" font-size="28" fill="#B07080">初回無料・売り込みなし</text>
  <text x="625" y="565" text-anchor="middle" font-family="Hiragino Sans" font-size="28" fill="#B07080">朝霞台駅南口 徒歩1分</text>
  <rect x="425" y="660" width="400" height="76" rx="38" fill="#E8789A"/>
  <text x="625" y="707" text-anchor="middle" font-family="Hiragino Sans" font-size="32" font-weight="bold" fill="#ffffff">予約する</text>
  <rect x="1250" y="0" width="1250" height="843" fill="#FFF0F3"/>
  <rect x="1824" y="165" width="110" height="90" rx="14" fill="none" stroke="#E8789A" stroke-width="4"/>
  <polygon points="1845,255 1870,288 1895,255" fill="#FFF0F3" stroke="#E8789A" stroke-width="4" stroke-linejoin="round"/>
  <line x1="1845" y1="198" x2="1915" y2="198" stroke="#E8789A" stroke-width="3.5"/>
  <line x1="1845" y1="220" x2="1915" y2="220" stroke="#E8789A" stroke-width="3.5"/>
  <line x1="1845" y1="242" x2="1890" y2="242" stroke="#E8789A" stroke-width="3.5"/>
  <text x="1875" y="370" text-anchor="middle" font-family="Hiragino Sans" font-size="44" font-weight="bold" fill="#C94F72">フルルンに</text>
  <text x="1875" y="430" text-anchor="middle" font-family="Hiragino Sans" font-size="44" font-weight="bold" fill="#C94F72">相談する</text>
  <line x1="1725" y1="470" x2="2025" y2="470" stroke="#E8789A" stroke-width="2"/>
  <text x="1875" y="525" text-anchor="middle" font-family="Hiragino Sans" font-size="28" fill="#B07080">AIコーチが24時間対応</text>
  <text x="1875" y="565" text-anchor="middle" font-family="Hiragino Sans" font-size="28" fill="#B07080">まずは気軽に話しかけてみて</text>
  <rect x="1675" y="660" width="400" height="76" rx="38" fill="#E8789A"/>
  <text x="1875" y="707" text-anchor="middle" font-family="Hiragino Sans" font-size="32" font-weight="bold" fill="#ffffff">相談する</text>
  <rect x="1" y="1" width="2498" height="841" fill="none" stroke="#E8789A" stroke-width="2"/>
</svg>`;

sharp(Buffer.from(svg))
  .resize(2500, 843)
  .png()
  .toFile('/Users/furutake/Downloads/richmenu.png', (err, info) => {
    if (err) console.error(err);
    else console.log('完成！', info);
  });
