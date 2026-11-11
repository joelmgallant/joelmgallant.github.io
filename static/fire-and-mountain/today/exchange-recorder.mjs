// Voice memo recording on a single toggle button, shared by the Exchange composer and the Bonus Round.
import { pickRecordingType } from './exchange-core.mjs';

/** Null when the browser can't record; otherwise wires `button` to record up to maxSeconds and calls onRecorded(blob, type). */
export function attachRecorder(button, { onRecorded, onError, maxSeconds = 60, label = '🎙️ Record' }) {
  const recording = pickRecordingType((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
  if (!recording) { button.hidden = true; return null; }
  button.textContent = label;
  let recorder = null;
  let countdown = null;
  button.addEventListener('click', async () => {
    if (recorder?.state === 'recording') { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream, { mimeType: recording.recorderType });
      recorder.addEventListener('dataavailable', (event) => chunks.push(event.data));
      recorder.addEventListener('stop', () => {
        clearInterval(countdown);
        stream.getTracks().forEach((track) => track.stop());
        button.textContent = '🎙️ Record again';
        button.classList.remove('recording');
        onRecorded(new Blob(chunks, { type: recording.uploadType }), recording.uploadType);
      });
      recorder.start();
      let remaining = maxSeconds;
      button.classList.add('recording');
      button.textContent = `⏹ Stop (${remaining}s)`;
      countdown = setInterval(() => {
        remaining -= 1;
        button.textContent = `⏹ Stop (${remaining}s)`;
        if (remaining <= 0) recorder.stop();
      }, 1000);
    } catch { onError?.(); }
  });
  return recording;
}
