import crypto from "crypto";

/**
 * WhatsApp Flows data endpoint encryption/decryption.
 *
 * Meta sends flow responses encrypted with AES-128-GCM.
 * The AES key itself is encrypted with the business's RSA public key.
 *
 * References:
 * - https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint
 */

const FLOW_DATA_TAG_LENGTH = 16; // AES-GCM auth tag length in bytes

/**
 * Decrypt an incoming WhatsApp Flow data request.
 *
 * @param body - The raw JSON body from Meta: { encrypted_flow_data, encrypted_aes_key, initial_vector }
 * @param privateKeyPem - Your RSA private key in PEM format
 * @returns The decrypted JSON payload and the AES key + IV needed to encrypt the response
 */
export function decryptFlowRequest(
  body: {
    encrypted_flow_data: string;
    encrypted_aes_key: string;
    initial_vector: string;
  },
  privateKeyPem: string
): {
  decryptedBody: Record<string, unknown>;
  aesKeyBuffer: Buffer;
  ivBuffer: Buffer;
} {
  const { encrypted_flow_data, encrypted_aes_key, initial_vector } = body;

  // 1. Decrypt the AES key using the RSA private key
  const aesKeyBuffer = crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64")
  );

  // 2. Decrypt the flow data using AES-128-GCM
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const ivBuffer = Buffer.from(initial_vector, "base64");

  // The last 16 bytes are the GCM auth tag
  const encryptedData = flowDataBuffer.subarray(
    0,
    flowDataBuffer.length - FLOW_DATA_TAG_LENGTH
  );
  const authTag = flowDataBuffer.subarray(
    flowDataBuffer.length - FLOW_DATA_TAG_LENGTH
  );

  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKeyBuffer, ivBuffer);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  const decryptedBody = JSON.parse(decrypted.toString("utf-8"));

  return { decryptedBody, aesKeyBuffer, ivBuffer };
}

/**
 * Encrypt a response to send back to WhatsApp Flows.
 *
 * @param responsePayload - The JSON response object
 * @param aesKeyBuffer - The same AES key from the decrypted request
 * @param ivBuffer - The same IV from the decrypted request (flipped for response)
 * @returns Base64-encoded encrypted response string
 */
export function encryptFlowResponse(
  responsePayload: Record<string, unknown>,
  aesKeyBuffer: Buffer,
  ivBuffer: Buffer
): string {
  // Flip the IV for the response per Meta's spec
  const flippedIv = Buffer.alloc(ivBuffer.length);
  for (let i = 0; i < ivBuffer.length; i++) {
    flippedIv[i] = ~ivBuffer[i]! & 0xff;
  }

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, flippedIv);

  const jsonStr = JSON.stringify(responsePayload);
  const encrypted = Buffer.concat([
    cipher.update(jsonStr, "utf-8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([encrypted, authTag]).toString("base64");
}
