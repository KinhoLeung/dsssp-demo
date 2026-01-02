import * as React from 'react';

import { Knob } from './Knob';

export function Example() {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = React.useState(0);

  React.useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume / 100;
  }, [volume]);

  const handleChange = React.useCallback((nextVolume: number) => {
    setVolume(nextVolume);
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => undefined);
  }, []);

  return (
    <div style={{ backgroundColor: '#181818', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontWeight: 'normal', margin: '2em 0', color: '#aaa' }}>
        Click/drag volume knob (mouse or finger) to control volume
      </h1>
      <p style={{ lineHeight: '150%', maxWidth: '36em', margin: '1em auto', color: '#aaa' }}>
        Current volume: <span style={{ color: '#eee' }}>{volume}%</span>
      </p>

      <div style={{ display: 'inline-block', margin: '5em auto' }}>
        <Knob value={volume} onChange={handleChange} aria-label='Volume' theme="dark" />
      </div>

      <audio ref={audioRef} preload='auto' src='https://www.cineblueone.com/maskWall/audio/skylar.mp3' />
    </div>
  );
}
