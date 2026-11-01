import type { Faction, Look } from '../core/types';

const FACTION_BG: Record<Faction | 'enemy', [string, string]> = {
  shu: ['#2f7d4f', '#134a2b'],
  wei: ['#2b4f8f', '#12294f'],
  enemy: ['#8a6a2a', '#4a3512'],
};

let uidCounter = 0;

function hair(look: Look): string {
  const c = look.accent;
  switch (look.hair) {
    case 'crown':
      return `<path d="M32 36 Q50 12 68 36 L68 30 Q50 6 32 30Z" fill="#2a1f1a"/><rect x="38" y="14" width="24" height="7" rx="2" fill="${c}"/><rect x="46" y="8" width="8" height="8" rx="2" fill="${c}"/>`;
    case 'helmet':
      return `<path d="M30 40 Q30 10 50 10 Q70 10 70 40 L66 36 Q50 22 34 36Z" fill="#7d8794"/><rect x="47" y="2" width="6" height="14" rx="3" fill="${c}"/><path d="M30 40 L34 36" stroke="#59616c" stroke-width="2"/>`;
    case 'hat':
      return `<path d="M28 34 Q50 4 72 34 Q50 26 28 34Z" fill="#2a1f1a"/><rect x="34" y="14" width="32" height="14" rx="5" fill="#2a1f1a"/><rect x="36" y="26" width="28" height="3" fill="${c}"/>`;
    case 'bandana':
      return `<path d="M31 38 Q50 8 69 38 Q50 28 31 38Z" fill="#2a1f1a"/><rect x="31" y="30" width="38" height="6" rx="2" fill="${c}"/><path d="M69 33 L80 40 L70 40Z" fill="${c}"/>`;
    case 'hood':
      return `<path d="M26 54 Q22 10 50 8 Q78 10 74 54 L68 40 Q50 22 32 40Z" fill="#3d3550"/><rect x="36" y="22" width="28" height="5" fill="${c}" opacity=".8"/>`;
    case 'long':
      return `<path d="M30 56 Q26 12 50 12 Q74 12 70 56 L66 38 Q50 22 34 38Z" fill="#2a1f1a"/>`;
    default:
      return `<path d="M32 38 Q50 12 68 38 Q50 28 32 38Z" fill="#2a1f1a"/><circle cx="50" cy="14" r="6" fill="#2a1f1a"/>`;
  }
}

function beard(look: Look): string {
  if (look.beard === 'none') return '';
  if (look.beard === 'short') return `<path d="M38 56 Q50 70 62 56 Q50 62 38 56Z" fill="#2a1f1a"/>`;
  return `<path d="M36 54 Q40 92 50 94 Q60 92 64 54 Q50 66 36 54Z" fill="#2a1f1a"/>`;
}

function weapon(look: Look): string {
  const c = look.accent;
  switch (look.weapon) {
    case 'blade':
      return `<g transform="rotate(18 82 80)"><rect x="80" y="30" width="4" height="86" fill="#5a4630"/><path d="M84 30 Q108 34 104 62 L84 56Z" fill="#cfd6df"/></g>`;
    case 'spear':
      return `<g transform="rotate(12 84 70)"><rect x="82" y="14" width="3.5" height="106" fill="#5a4630"/><path d="M83.7 2 L89 20 L78.4 20Z" fill="#dfe5ee"/><rect x="79" y="20" width="9" height="3" fill="${c}"/></g>`;
    case 'fan':
      return `<g transform="rotate(-10 80 90)"><path d="M70 96 L90 70 Q100 86 90 104Z" fill="#f4f1e2" stroke="${c}" stroke-width="1.5"/><rect x="68" y="94" width="3" height="16" fill="#5a4630"/></g>`;
    case 'sword':
      return `<g transform="rotate(25 82 92)"><rect x="81" y="52" width="3.5" height="50" fill="#dfe5ee"/><rect x="76" y="100" width="14" height="3.5" fill="${c}"/><rect x="81" y="103" width="3.5" height="10" fill="#5a4630"/></g>`;
    case 'halberd':
      return `<g transform="rotate(10 84 70)"><rect x="82" y="16" width="3.5" height="104" fill="#5a4630"/><path d="M85.5 14 Q104 18 100 40 L85.5 36Z" fill="#cfd6df"/><path d="M82 14 L82 4 L85.5 12Z" fill="#cfd6df"/></g>`;
    case 'bow':
      return `<g transform="rotate(8 84 80)"><path d="M78 40 Q104 80 78 120" stroke="#6b4a2a" stroke-width="3" fill="none"/><line x1="78" y1="40" x2="78" y2="120" stroke="#eee" stroke-width="1"/></g>`;
    case 'staff':
      return `<g transform="rotate(8 84 70)"><rect x="82" y="22" width="3.5" height="98" fill="#6b4a2a"/><circle cx="83.7" cy="18" r="7" fill="${c}"/></g>`;
    case 'axe':
      return `<g transform="rotate(14 84 78)"><rect x="82" y="28" width="3.5" height="92" fill="#5a4630"/><path d="M85 30 Q108 32 104 56 Q94 60 85 54Z" fill="#bcc4cf"/></g>`;
  }
}

/** 生成武将/敌人的占位 SVG 头像（纯代码绘制，非任何游戏素材） */
export function portrait(look: Look, faction: Faction | 'enemy', glyph = ''): string {
  const id = `g${uidCounter++}`;
  const [c1, c2] = FACTION_BG[faction];
  return `<svg class="portrait" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="100" height="120" rx="12" fill="url(#${id})"/>
  <circle cx="50" cy="52" r="46" fill="#ffffff" opacity=".06"/>
  ${weapon(look)}
  <path d="M14 120 Q16 84 50 80 Q84 84 86 120Z" fill="${look.armor}"/>
  <path d="M38 82 L50 100 L62 82" fill="none" stroke="${look.accent}" stroke-width="3"/>
  <rect x="44" y="66" width="12" height="18" rx="4" fill="${look.skin}"/>
  <ellipse cx="50" cy="48" rx="19" ry="22" fill="${look.skin}"/>
  ${hair(look)}
  <circle cx="43" cy="48" r="2" fill="#2a1f1a"/><circle cx="57" cy="48" r="2" fill="#2a1f1a"/>
  <path d="M44 58 Q50 62 56 58" stroke="#7a3b2b" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  ${beard(look)}
  ${glyph ? `<text x="8" y="18" font-size="14" fill="#fff" opacity=".85" font-weight="700">${glyph}</text>` : ''}
</svg>`;
}

export const FACTION_NAME: Record<Faction, string> = { shu: '蜀', wei: '魏' };
export const ROLE_NAME = { warrior: '猛将', strategist: '谋士', guardian: '守护', support: '辅助' } as const;
