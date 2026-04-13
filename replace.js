const fs = require('fs');

const filePath = './components/GiliGuard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = {
  '#080f1e': '#050505',
  '#0d1829': '#111111',
  '#121f35': '#1a1a1a',
  '#18284a': '#111111',
  '#1e3258': '#1a1a1a',
  '#ddeeff': '#ffffff',
  '#7a9ab8': '#a1a1aa',
  '#3d6080': '#52525b',
  '#ff3c3c': '#FF4444',
  '#c81a1a': '#CC0000',
  '#00e5b0': '#00E5FF',
  '#3d9bff': '#0066FF',
  '#ffb830': '#FFB800',
  '#3ecf80': '#00FF00',
  '#ff7c35': '#FF6321',
  '#c81414': '#CC0000',
  '#ff6060': '#FF6666',
  '#2563eb': '#0055CC',
  '#2b7cd9': '#0055CC',
  '#1a2b4a': '#1a1a1a'
};

for (const [oldColor, newColor] of Object.entries(replacements)) {
  const regex = new RegExp(oldColor, 'gi');
  content = content.replace(regex, newColor);
}

// Add font-display to some key elements
content = content.replace(/text-3xl font-black text-white tracking-tighter/g, 'text-3xl font-black text-white tracking-tighter font-display');
content = content.replace(/text-6xl font-black text-white tracking-widest/g, 'text-6xl font-black text-white tracking-widest font-display');
content = content.replace(/text-lg font-black tracking-tighter text-white uppercase italic/g, 'text-lg font-black tracking-tighter text-white uppercase italic font-display');
content = content.replace(/text-lg font-black tracking-tighter text-\[#0066FF\] uppercase italic/g, 'text-lg font-black tracking-tighter text-[#0066FF] uppercase italic font-display');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replacement complete.');
