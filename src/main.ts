import './ui/styles.css';
import { startApp } from './ui/app';

startApp(document.getElementById('app')!);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* 离线缓存不可用时不影响游玩 */
    });
  });
}
