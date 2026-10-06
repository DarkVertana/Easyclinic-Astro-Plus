/**
 * Build-time icon registry: SVG sources are inlined at render, so no icon JS or sprite ships.
 * Lucide (ISC) for UI icons, Simple Icons (CC0) for the WhatsApp mark.
 * Add a name to the brace list to make it available.
 */
const lucide = import.meta.glob(
  '/node_modules/lucide-static/icons/{chevron-down,chevron-right,arrow-right,arrow-up-right,menu,x,phone,mail,map-pin,check,circle-check,clock,calendar,calendar-clock,external-link,info,triangle-alert,circle-dashed,circle-dot,shield-check,badge-check,minus,plus,star,quote,file-text,users,building-2,hospital,stethoscope,pill,flask-conical,video,message-circle,chart-column,network,receipt,wallet,lock,globe,circle-play,search,user-round,languages,wifi-off,smartphone,layout-dashboard,clipboard-list,heart-handshake,file-check,trending-down,trending-up,circle-x,circle-help,notebook-pen,repeat,banknote,landmark,scan-line,layers,route,timer,sparkles,download,list-checks,hand-coins,package,boxes,activity,baby,heart,eye,bone,brain,zoom-in}.svg',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const brands = import.meta.glob('/node_modules/simple-icons/icons/{whatsapp,youtube,facebook,instagram,x}.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface IconSource {
  inner: string;
  viewBox: string;
  kind: 'stroke' | 'fill';
}

function parse(svg: string, kind: IconSource['kind']): IconSource {
  const open = svg.match(/<svg[^>]*>/);
  if (!open) throw new Error('Icon source is not an SVG');
  const viewBox = open[0].match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24';
  const inner = svg
    .slice(svg.indexOf(open[0]) + open[0].length, svg.lastIndexOf('</svg>'))
    .replace(/<title>.*?<\/title>/s, '')
    .trim();
  return { inner, viewBox, kind };
}

const registry = new Map<string, IconSource>();
// Simple Icons no longer ships the LinkedIn mark; a plain "in" monogram stands in.
registry.set('brand-linkedin', {
  kind: 'fill',
  viewBox: '0 0 24 24',
  inner: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4V9.5Z"/>',
});
for (const [path, svg] of Object.entries(lucide)) registry.set(path.split('/').pop()!.replace('.svg', ''), parse(svg, 'stroke'));
for (const [path, svg] of Object.entries(brands)) registry.set(`brand-${path.split('/').pop()!.replace('.svg', '')}`, parse(svg, 'fill'));

export function getIcon(name: string): IconSource {
  const icon = registry.get(name);
  if (!icon) throw new Error(`Unknown icon "${name}". Add it to src/components/ui/icons.ts.`);
  return icon;
}
