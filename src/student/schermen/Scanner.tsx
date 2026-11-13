import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { Melding, tweedeKnop } from '../../gedeeld/onderdelen';

const MAX_BREEDTE = 640;

function cameraMelding(fout: unknown): string {
  const naam = fout instanceof DOMException ? fout.name : '';
  if (naam === 'NotAllowedError') return 'De app mag de camera niet gebruiken. Geef toestemming in je browser, of plak de code hieronder.';
  if (naam === 'NotFoundError' || naam === 'OverconstrainedError') return 'Er is geen camera gevonden. Plak de code hieronder.';
  return 'De camera kon niet worden gestart. Plak de code hieronder.';
}

/** Camerabeeld dat zoekt naar een QR-code. Werkt alleen via https of op localhost. */
export function Scanner({ opCode, stop }: { opCode: (tekst: string) => void; stop: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [fout, zetFout] = useState<string | null>(null);
  const opCodeRef = useRef(opCode);
  opCodeRef.current = opCode;

  useEffect(() => {
    let gestopt = false;
    let stroom: MediaStream | undefined;
    let wacht: ReturnType<typeof setTimeout> | undefined;
    const doek = document.createElement('canvas');
    const ctx = doek.getContext('2d', { willReadFrequently: true });

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        zetFout('Deze browser kan hier de camera niet gebruiken. Plak de code hieronder.');
        return;
      }
      try {
        stroom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch (e) {
        zetFout(cameraMelding(e));
        return;
      }
      const v = video.current;
      if (gestopt || !v) return stroom.getTracks().forEach((t) => t.stop());
      v.srcObject = stroom;
      await v.play().catch(() => undefined);

      const kijk = () => {
        if (gestopt) return;
        if (ctx && v.readyState >= 2 && v.videoWidth > 0) {
          const schaal = Math.min(1, MAX_BREEDTE / v.videoWidth);
          doek.width = Math.round(v.videoWidth * schaal);
          doek.height = Math.round(v.videoHeight * schaal);
          ctx.drawImage(v, 0, 0, doek.width, doek.height);
          const beeld = ctx.getImageData(0, 0, doek.width, doek.height);
          const qr = jsQR(beeld.data, beeld.width, beeld.height, { inversionAttempts: 'dontInvert' });
          if (qr?.data) {
            gestopt = true;
            navigator.vibrate?.(60);
            opCodeRef.current(qr.data);
            return;
          }
        }
        wacht = setTimeout(kijk, 200);
      };
      kijk();
    })();

    return () => {
      gestopt = true;
      clearTimeout(wacht);
      stroom?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="mt-3">
      {fout ? (
        <Melding soort="fout" titel="Scannen lukt niet">{fout}</Melding>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={video} muted playsInline className="aspect-square w-full object-cover" aria-label="Camerabeeld" />
          <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/90" aria-hidden="true" />
          <p className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-sm text-white">Houd de QR-code in het vak</p>
        </div>
      )}
      <button type="button" className={`${tweedeKnop} mt-3 w-full`} onClick={stop}>
        Camera sluiten
      </button>
    </div>
  );
}
