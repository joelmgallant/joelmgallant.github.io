// Shared HTTP helpers for the exchange Lambda: JSON responses, body parsing and signed media links.
export const respond = (statusCode, body) => ({
  statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body),
});
export const fail = (statusCode, error) => respond(statusCode, { error });

export function parseBody(event) {
  if (!event.body) return {};
  const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return null; }
}

export async function signAnswer(answer, media) {
  if (!answer) return answer;
  const signed = { ...answer };
  if (answer.photoKey) signed.photoUrl = await media.getUrl(answer.photoKey);
  if (answer.audioKey) signed.audioUrl = await media.getUrl(answer.audioKey);
  return signed;
}

export async function signShape(shape, media) {
  const signed = { ...shape, me: await signAnswer(shape.me, media), them: { ...shape.them } };
  if (shape.them.answer) signed.them.answer = await signAnswer(shape.them.answer, media);
  return signed;
}
