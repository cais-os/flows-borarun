export function getCronSecret() {
  const secret = process.env.CRON_SECRET?.trim();
  return secret ? secret : null;
}

export function validateCronAuthorization(authHeader: string | null) {
  const secret = getCronSecret();

  if (!secret) {
    return {
      ok: false as const,
      status: 500,
      message: "CRON_SECRET is not configured",
    };
  }

  if (authHeader !== `Bearer ${secret}`) {
    return {
      ok: false as const,
      status: 401,
      message: "Unauthorized",
    };
  }

  return {
    ok: true as const,
    secret,
  };
}

export function validateInternalSecret(secretHeader: string | null) {
  const secret = getCronSecret();

  if (!secret) {
    return {
      ok: false as const,
      status: 500,
      message: "CRON_SECRET is not configured",
    };
  }

  if (secretHeader !== secret) {
    return {
      ok: false as const,
      status: 401,
      message: "Unauthorized",
    };
  }

  return {
    ok: true as const,
    secret,
  };
}
