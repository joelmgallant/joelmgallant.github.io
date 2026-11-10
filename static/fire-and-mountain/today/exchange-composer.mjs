// The Exchange answer composer: text, a resized photo, and a voice memo of up to 60 seconds.
import { ApiError } from './exchange-api.mjs';
import { pickRecordingType, scaledSize } from './exchange-core.mjs';
import { playSting } from './exchange-sounds.mjs';
import { element } from './exchange-ui.mjs';

const MAX_SECONDS = 60;

async function resizePhoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = scaledSize(bitmap.width, bitmap.height, 1600);
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', 0.85));
}

/** Builds the answer form. `existing` pre-fills an edit; onSaved gets the API response; onCancel (optional) abandons an edit. */
export function createComposer({ api, date, existing, onSaved, onCancel }) {
  const draft = { photoBlob: null, photoKey: existing?.photoKey ?? null, audioBlob: null, audioType: existing?.audioType ?? null,
    audioKey: existing?.audioKey ?? null };
  const text = element('textarea', { className: 'answer-input', maxLength: 500, rows: 3, placeholder: 'Your answer…', value: existing?.text ?? '' });
  const status = element('p', { className: 'composer-status', role: 'status' });
  const photoPreview = element('div', { className: 'media-preview' });
  const audioPreview = element('div', { className: 'media-preview' });
  const lockButton = element('button', { type: 'button', className: 'big-button lock', textContent: 'Lock it in' });

  const fileInput = element('input', { type: 'file', accept: 'image/*', hidden: true });
  const photoButton = element('button', { type: 'button', className: 'chunky', textContent: '📷 Photo' });
  photoButton.addEventListener('click', () => fileInput.click());
  const showPhoto = (src) => {
    const remove = element('button', { type: 'button', className: 'mini', textContent: 'Remove' });
    remove.addEventListener('click', () => { draft.photoBlob = null; draft.photoKey = null; photoPreview.replaceChildren(); refresh(); });
    photoPreview.replaceChildren(element('img', { src, alt: 'Your photo' }), remove);
  };
  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files;
    if (!file) return;
    status.textContent = 'Shrinking your photo…';
    try {
      draft.photoBlob = await resizePhoto(file);
      draft.photoKey = null;
      showPhoto(URL.createObjectURL(draft.photoBlob));
      status.textContent = '';
    } catch { status.textContent = "Couldn't read that photo. Try another?"; }
    refresh();
  });
  if (existing?.photoUrl) showPhoto(existing.photoUrl);

  const recording = pickRecordingType((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
  const recordButton = element('button', { type: 'button', className: 'chunky', textContent: '🎙️ Record', hidden: !recording });
  const showAudio = (src) => {
    const remove = element('button', { type: 'button', className: 'mini', textContent: 'Remove' });
    remove.addEventListener('click', () => { draft.audioBlob = null; draft.audioKey = null; audioPreview.replaceChildren(); refresh(); });
    audioPreview.replaceChildren(element('audio', { src, controls: true }), remove);
  };
  if (existing?.audioUrl) showAudio(existing.audioUrl);
  let recorder = null;
  let countdown = null;
  recordButton.addEventListener('click', async () => {
    if (recorder?.state === 'recording') { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream, { mimeType: recording.recorderType });
      recorder.addEventListener('dataavailable', (event) => chunks.push(event.data));
      recorder.addEventListener('stop', () => {
        clearInterval(countdown);
        stream.getTracks().forEach((track) => track.stop());
        draft.audioBlob = new Blob(chunks, { type: recording.uploadType });
        draft.audioType = recording.uploadType;
        draft.audioKey = null;
        showAudio(URL.createObjectURL(draft.audioBlob));
        recordButton.textContent = '🎙️ Record again';
        recordButton.classList.remove('recording');
        refresh();
      });
      recorder.start();
      let remaining = MAX_SECONDS;
      recordButton.classList.add('recording');
      recordButton.textContent = `⏹ Stop (${remaining}s)`;
      countdown = setInterval(() => {
        remaining -= 1;
        recordButton.textContent = `⏹ Stop (${remaining}s)`;
        if (remaining <= 0) recorder.stop();
      }, 1000);
    } catch { status.textContent = 'No microphone access. You can still type or add a photo.'; }
  });

  const hasContent = () => text.value.trim() || draft.photoBlob || draft.photoKey || draft.audioBlob || draft.audioKey;
  const refresh = () => { lockButton.disabled = !hasContent(); };
  text.addEventListener('input', refresh);
  refresh();

  lockButton.addEventListener('click', async () => {
    lockButton.disabled = true;
    status.textContent = 'Locking it in…';
    try {
      const answer = { text: text.value.trim() || undefined };
      if (draft.photoBlob) answer.photoKey = await api.upload(date, 'photo', draft.photoBlob, 'image/jpeg');
      else if (draft.photoKey) answer.photoKey = draft.photoKey;
      if (draft.audioBlob) { answer.audioKey = await api.upload(date, 'audio', draft.audioBlob, draft.audioType); answer.audioType = draft.audioType; }
      else if (draft.audioKey) { answer.audioKey = draft.audioKey; answer.audioType = draft.audioType; }
      const updated = await api.put(date, answer);
      playSting('lock');
      onSaved(updated);
    } catch (error) {
      playSting('buzz');
      status.textContent = error instanceof ApiError && error.status === 409 ? "Too late, this round's closed." : `${error.message} Try again?`;
      refresh();
    }
  });

  const cancel = onCancel ? element('button', { type: 'button', className: 'mini', textContent: 'Never mind' }) : null;
  cancel?.addEventListener('click', onCancel);
  return element('div', { className: 'composer' }, text,
    element('div', { className: 'composer-tools' }, photoButton, recordButton, fileInput),
    photoPreview, audioPreview, element('div', { className: 'composer-actions' }, lockButton, cancel), status);
}
