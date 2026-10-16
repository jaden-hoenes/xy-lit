// Demo: <xy-viewport-portal> (content in flow coordinates, in front of and behind the nodes).
import '@xy-lit/flow/define.js';
import type { Mount } from '../router';
import { createFlow, show } from '../lib/e2e';

const mount: Mount = (root) => {
  const flow = createFlow({
    nodes: [{ id: 'a', position: { x: 100, y: 100 }, data: { label: 'Node' } }],
  });
  const front = document.createElement('xy-viewport-portal');
  const note = document.createElement('div');
  note.dataset.testid = 'portal-front';
  note.textContent = 'Front: pinned to flow position (300, 120)';
  note.style.cssText =
    'position:absolute;transform:translate(300px,120px);padding:6px;background:#fef3c7;font:12px sans-serif;pointer-events:all';
  front.append(note);
  const back = document.createElement('xy-viewport-portal');
  back.setAttribute('target', 'back');
  const zone = document.createElement('div');
  zone.dataset.testid = 'portal-back';
  zone.style.cssText =
    'position:absolute;transform:translate(60px,60px);width:260px;height:120px;background:rgba(99,102,241,.12);border:1px dashed #6366f1';
  back.append(zone);
  flow.append(front, back);
  show(root, flow);
};
export default mount;
