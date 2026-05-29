// tweaks-app.jsx — Chariot Drop 0 tweaks panel

function ChariotTweaksApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks to the page
  React.useEffect(() => {
    const root = document.documentElement;

    // Accent tone — Kente gold vs Laterite vs Salt (no accent)
    const tones = {
      kente:    { color: '#C9921E' }, // signal-gold
      laterite: { color: '#9B4523' }, // signal-urgent
      salt:     { color: '#FAFAF8' }, // mono / no chromatic accent
    };
    const accent = tones[t.accentTone] || tones.kente;
    root.style.setProperty('--signal-gold', accent.color);

    // Hero line visibility
    const heroLine = document.querySelector('.hero__line');
    if (heroLine) heroLine.style.display = t.showHeroLine ? '' : 'none';

    // Density (reduce hero+section padding)
    document.body.style.setProperty('--sec-pad-y',
      t.denser ? 'clamp(48px, 7vw, 96px)' : 'clamp(80px, 12vw, 160px)');
    document.querySelectorAll('.sec, .fm').forEach((el) => {
      el.style.paddingTop = t.denser ? 'clamp(48px, 7vw, 96px)' : '';
      el.style.paddingBottom = t.denser ? 'clamp(48px, 7vw, 96px)' : '';
    });

    // Spots remaining counter
    const remEl = document.getElementById('remaining');
    if (remEl) {
      remEl.textContent = String(t.spotsRemaining);
      if (window.__chariotRefreshCounter) window.__chariotRefreshCounter();
    }
  }, [t.accentTone, t.showHeroLine, t.denser, t.spotsRemaining]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Accent" />
      <TweakRadio
        label="Tone"
        value={t.accentTone}
        options={[
          { value: 'kente',    label: 'Kente' },
          { value: 'laterite', label: 'Laterite' },
          { value: 'salt',     label: 'None' },
        ]}
        onChange={(v) => setTweak('accentTone', v)}
      />

      <TweakSection label="Hero" />
      <TweakToggle
        label="Show transit line"
        value={t.showHeroLine}
        onChange={(v) => setTweak('showHeroLine', v)}
      />

      <TweakSection label="Layout" />
      <TweakToggle
        label="Denser sections"
        value={t.denser}
        onChange={(v) => setTweak('denser', v)}
      />

      <TweakSection label="Founding Member counter" />
      <TweakSlider
        label="Spots remaining"
        value={t.spotsRemaining}
        min={0}
        max={50}
        step={1}
        onChange={(v) => setTweak('spotsRemaining', v)}
      />
    </TweaksPanel>
  );
}

const __chariotTweakMount = document.createElement('div');
document.body.appendChild(__chariotTweakMount);
ReactDOM.createRoot(__chariotTweakMount).render(<ChariotTweaksApp />);
