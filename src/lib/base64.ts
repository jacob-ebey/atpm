export async function base64ToBlob(input: { content_type: string; data: string; length: number }) {
  const { data, length } = input;

  const buffer = Buffer.from(data, "base64");

  if (buffer.length !== length) {
    throw new Error(`Decoded length (${buffer.length}) does not match expected length (${length})`);
  }

  return new Blob([buffer], { type: input.content_type });
}
