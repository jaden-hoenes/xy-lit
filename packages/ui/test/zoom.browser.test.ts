import { afterEach, describe, expect, it } from 'vitest';
import type { XyZoomSelectElement, XyZoomSliderElement } from '../src/index.js';
import { cleanup, frames, mountFlow, node, rendered, waitFor } from './helpers.js';

afterEach(cleanup);

/** WCAG contrast of the text colour of `el` against opaque white (the light panel surface). */
function contrastOnWhite(el: Element): number {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = getComputedStyle(el).color; // a colour-mix() result may be semi-transparent
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  return 1.05 / (lum + 0.05);
}

describe('muted text contrast (WCAG AA, light mode)', () => {
  it('the zoom-slider percentage reaches 4.5:1 with the default light node colour', async () => {
    const slider = document.createElement('xy-zoom-slider') as XyZoomSliderElement;
    const flow = await mountFlow({ nodes: [node('a')], children: [slider] });
    flow.style.setProperty('--xy-node-color', '#1a192b');
    await rendered(slider);
    const value = slider.shadowRoot!.querySelector('.xy-ui-zoom__value')!;
    expect(contrastOnWhite(value)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('<xy-zoom-slider>', () => {
  const mount = async () => {
    const slider = document.createElement('xy-zoom-slider') as XyZoomSliderElement;
    const flow = await mountFlow({
      nodes: [node('a', 0, 0)],
      children: [slider],
      attributes: { 'min-zoom': '0.25', 'max-zoom': '3' },
    });
    await rendered(slider);
    const root = slider.shadowRoot!;
    return {
      flow,
      slider,
      range: root.querySelector<HTMLInputElement>('input[type="range"]')!,
      button: (name: string) =>
        root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!,
      readout: () => root.querySelector<HTMLElement>('.xy-ui-zoom__value')!.textContent!.trim(),
    };
  };

  it('is a panel at bottom-center with a range from minZoom to maxZoom in steps of 0.01', async () => {
    const { slider, range } = await mount();
    expect(slider.position).toBe('bottom-center');
    expect(slider.shadowRoot!.querySelector('.lit-flow__panel')?.classList.contains('bottom')).toBe(
      true,
    );
    expect(range.min).toBe('0.25');
    expect(range.max).toBe('3');
    expect(range.step).toBe('0.01');
    expect(Number(range.value)).toBeCloseTo(1, 2);
    expect(range.getAttribute('aria-label')).toBe('Zoom level');
  });

  it('dragging the range zooms the flow, and the range follows zoom changes', async () => {
    const { flow, range, readout } = await mount();
    range.value = '2';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => Math.abs(flow.getZoom() - 2) < 0.01);
    await waitFor(() => readout() === '200%');
    await flow.zoomTo(0.5, { duration: 0 });
    await waitFor(() => Number(range.value) === 0.5);
    expect(range.getAttribute('aria-valuetext')).toBe('50%');
  });

  it('+, − and the percentage button zoom in, out and reset', async () => {
    const { flow, button, readout, slider } = await mount();
    button('Zoom in').click();
    await waitFor(() => flow.getZoom() > 1.15);
    await waitFor(() => Math.abs(flow.getZoom() - 1.2) < 0.01);
    button('Zoom out').click();
    await waitFor(() => Math.abs(flow.getZoom() - 1) < 0.01);
    button('Zoom out').click();
    await waitFor(() => flow.getZoom() < 0.9);
    slider.shadowRoot!.querySelector<HTMLButtonElement>('.xy-ui-zoom__value')!.click();
    await waitFor(() => Math.abs(flow.getZoom() - 1) < 0.01);
    await waitFor(() => readout() === '100%');
  });

  it('disables − at minZoom and + at maxZoom', async () => {
    const { flow, button } = await mount();
    await flow.zoomTo(0.25, { duration: 0 });
    await waitFor(() => button('Zoom out').disabled);
    expect(button('Zoom in').disabled).toBe(false);
    await flow.zoomTo(3, { duration: 0 });
    await waitFor(() => button('Zoom in').disabled);
  });
});

describe('<xy-zoom-select>', () => {
  const mount = async () => {
    const select = document.createElement('xy-zoom-select') as XyZoomSelectElement;
    const flow = await mountFlow({
      nodes: [node('a', 0, 0), node('b', 600, 300)],
      children: [select],
    });
    await rendered(select);
    const el = () => select.shadowRoot!.querySelector<HTMLSelectElement>('select')!;
    const choose = (value: string) => {
      el().value = value;
      el().dispatchEvent(new Event('change', { bubbles: true }));
    };
    return { flow, select, el, choose };
  };

  it('offers 50/100/150/200 % and fit view, showing the current zoom', async () => {
    const { select, el } = await mount();
    expect(select.position).toBe('top-center');
    expect([...el().options].map((o) => o.textContent!.trim())).toEqual([
      '50%',
      '100%',
      '150%',
      '200%',
      'Fit view',
    ]);
    expect(el().value).toBe('1');
  });

  it('choosing a level zooms to it; choosing fit view fits the nodes', async () => {
    const { flow, choose, el } = await mount();
    choose('2');
    await waitFor(() => Math.abs(flow.getZoom() - 2) < 0.01);
    await waitFor(() => el().value === '2');
    choose('0.5');
    await waitFor(() => Math.abs(flow.getZoom() - 0.5) < 0.01);
    choose('fit');
    await waitFor(() => Math.abs(flow.getZoom() - 0.5) > 0.02 && flow.getZoom() > 0.7);
    // the selection is not stuck on "Fit view": it shows an extra entry for the live zoom
    await waitFor(() => el().value !== 'fit');
  });

  it('adds an entry for a zoom that is not a preset', async () => {
    const { flow, el } = await mount();
    await flow.zoomTo(0.73, { duration: 0 });
    await waitFor(() => el().value === 'current');
    expect(el().selectedOptions[0]?.textContent?.trim()).toBe('73%');
    await frames(1);
  });
});
