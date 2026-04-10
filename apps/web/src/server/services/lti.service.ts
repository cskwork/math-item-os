// LTI 1.3 프로바이더 서비스 - OIDC 로그인, 런치 콜백, 플랫폼 관리
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import * as crypto from "crypto";

// -------------------------------------------------
// 입력 타입 정의
// -------------------------------------------------

export interface RegisterPlatformInput {
  readonly name: string;
  readonly issuer: string;
  readonly clientId: string;
  readonly authEndpoint: string;
  readonly tokenEndpoint: string;
  readonly jwksEndpoint: string;
  readonly deploymentId?: string;
}

export interface OidcLoginParams {
  readonly iss: string;
  readonly login_hint: string;
  readonly target_link_uri: string;
  readonly lti_message_hint?: string;
}

export interface LaunchCallbackParams {
  readonly id_token: string;
  readonly state: string;
}

// -------------------------------------------------
// OIDC 상태 저장소 (인메모리, MVP)
// -------------------------------------------------

const oidcStateStore = new Map<string, { nonce: string; createdAt: number }>();

// 만료된 상태 정리 (5분 TTL)
function cleanExpiredStates() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, val] of oidcStateStore.entries()) {
    if (val.createdAt < cutoff) oidcStateStore.delete(key);
  }
}

// -------------------------------------------------
// JWT 디코딩/검증 유틸
// -------------------------------------------------

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  return JSON.parse(base64UrlDecode(parts[1]!).toString("utf-8"));
}

function decodeJwtHeader(token: string): { alg: string; kid?: string } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  return JSON.parse(base64UrlDecode(parts[0]!).toString("utf-8"));
}

interface JwksKey {
  readonly kty: string;
  readonly kid?: string;
  readonly n?: string;
  readonly e?: string;
  readonly alg?: string;
  readonly use?: string;
}

async function fetchJwks(jwksEndpoint: string): Promise<JwksKey[]> {
  const res = await fetch(jwksEndpoint, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`JWKS 조회 실패: ${res.status}`);
  const data = (await res.json()) as { keys: JwksKey[] };
  return data.keys;
}

function verifyJwtSignature(
  token: string,
  publicKey: crypto.KeyObject,
): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const signedData = `${parts[0]}.${parts[1]}`;
  const signature = base64UrlDecode(parts[2]!);

  return crypto.verify("RSA-SHA256", Buffer.from(signedData), publicKey, signature);
}

function jwkToPublicKey(jwk: JwksKey): crypto.KeyObject {
  return crypto.createPublicKey({
    key: {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    },
    format: "jwk",
  });
}

// -------------------------------------------------
// 서명 키 관리 (이 플랫폼의 JWKS 노출용)
// -------------------------------------------------

let signingKeyPair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject } | null = null;
let signingKid: string | null = null;

function getOrCreateSigningKey() {
  if (signingKeyPair) return { ...signingKeyPair, kid: signingKid! };

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  signingKid = crypto.randomUUID();
  signingKeyPair = { publicKey, privateKey };
  return { publicKey, privateKey, kid: signingKid };
}

// -------------------------------------------------
// 플랫폼 관리 CRUD
// -------------------------------------------------

/** LTI 플랫폼을 등록한다. */
export async function registerPlatform(
  input: RegisterPlatformInput,
  orgId: string,
) {
  return prisma.ltiPlatform.create({
    data: {
      orgId,
      name: input.name,
      issuer: input.issuer,
      clientId: input.clientId,
      authEndpoint: input.authEndpoint,
      tokenEndpoint: input.tokenEndpoint,
      jwksEndpoint: input.jwksEndpoint,
      deploymentId: input.deploymentId,
    },
  });
}

/** 플랫폼 상세 조회 */
export async function getPlatform(platformId: string, orgId: string) {
  const platform = await prisma.ltiPlatform.findFirst({
    where: { id: platformId, orgId },
  });

  if (!platform) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "LTI 플랫폼을 찾을 수 없습니다",
    });
  }

  return platform;
}

/** 플랫폼 목록 조회 */
export async function listPlatforms(orgId: string) {
  return prisma.ltiPlatform.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
}

/** 플랫폼 비활성화 */
export async function deactivatePlatform(platformId: string, orgId: string) {
  const platform = await prisma.ltiPlatform.findFirst({
    where: { id: platformId, orgId },
  });

  if (!platform) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "LTI 플랫폼을 찾을 수 없습니다",
    });
  }

  return prisma.ltiPlatform.update({
    where: { id: platformId },
    data: { isActive: !platform.isActive },
  });
}

// -------------------------------------------------
// OIDC 로그인 처리
// -------------------------------------------------

/** OIDC 로그인 요청을 처리하고 리다이렉트 URL을 반환한다. */
export async function handleOidcLogin(params: OidcLoginParams) {
  cleanExpiredStates();

  // issuer로 플랫폼 조회
  const platform = await prisma.ltiPlatform.findFirst({
    where: { issuer: params.iss, isActive: true },
  });

  if (!platform) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `등록되지 않은 LTI 플랫폼: ${params.iss}`,
    });
  }

  // state + nonce 생성
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  oidcStateStore.set(state, { nonce, createdAt: Date.now() });

  // 리다이렉트 URL 구성
  const redirectUrl = new URL(platform.authEndpoint);
  redirectUrl.searchParams.set("scope", "openid");
  redirectUrl.searchParams.set("response_type", "id_token");
  redirectUrl.searchParams.set("client_id", platform.clientId);
  redirectUrl.searchParams.set("redirect_uri", params.target_link_uri);
  redirectUrl.searchParams.set("login_hint", params.login_hint);
  redirectUrl.searchParams.set("state", state);
  redirectUrl.searchParams.set("nonce", nonce);
  redirectUrl.searchParams.set("response_mode", "form_post");
  if (params.lti_message_hint) {
    redirectUrl.searchParams.set("lti_message_hint", params.lti_message_hint);
  }

  return { redirectUrl: redirectUrl.toString() };
}

// -------------------------------------------------
// 런치 콜백 처리
// -------------------------------------------------

/** LTI 런치 콜백을 처리하고 런치 데이터를 반환한다. */
export async function handleLaunchCallback(params: LaunchCallbackParams) {
  // state 검증
  const stateEntry = oidcStateStore.get(params.state);
  if (!stateEntry) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "유효하지 않거나 만료된 state",
    });
  }
  oidcStateStore.delete(params.state);

  // JWT 헤더/페이로드 디코딩
  const header = decodeJwtHeader(params.id_token);
  const payload = decodeJwtPayload(params.id_token);

  // 기본 클레임 검증
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "만료된 id_token",
    });
  }

  // nonce 검증
  if (payload.nonce !== stateEntry.nonce) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "nonce 불일치",
    });
  }

  // issuer로 플랫폼 조회
  const issuer = payload.iss as string;
  const platform = await prisma.ltiPlatform.findFirst({
    where: { issuer, isActive: true },
  });

  if (!platform) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `등록되지 않은 LTI 플랫폼: ${issuer}`,
    });
  }

  // aud 검증
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(platform.clientId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "aud 클레임이 clientId와 일치하지 않습니다",
    });
  }

  // JWKS에서 서명 검증
  try {
    const keys = await fetchJwks(platform.jwksEndpoint);
    const matchingKey = keys.find(
      (k) => (header.kid ? k.kid === header.kid : true) && k.kty === "RSA",
    );

    if (!matchingKey) {
      throw new Error("일치하는 JWK를 찾을 수 없습니다");
    }

    const publicKey = jwkToPublicKey(matchingKey);
    if (!verifyJwtSignature(params.id_token, publicKey)) {
      throw new Error("JWT 서명 검증 실패");
    }
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `id_token 서명 검증 실패: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }

  // LTI 클레임 추출
  const ltiClaims = {
    messageType: payload["https://purl.imsglobal.org/spec/lti/claim/message_type"],
    resourceLink: payload["https://purl.imsglobal.org/spec/lti/claim/resource_link"],
    roles: payload["https://purl.imsglobal.org/spec/lti/claim/roles"],
    context: payload["https://purl.imsglobal.org/spec/lti/claim/context"],
    targetLinkUri: payload["https://purl.imsglobal.org/spec/lti/claim/target_link_uri"],
  };

  return {
    platform: { id: platform.id, name: platform.name },
    sub: payload.sub as string | undefined,
    ltiClaims,
  };
}

// -------------------------------------------------
// JWKS 엔드포인트 (이 플랫폼의 공개키 노출)
// -------------------------------------------------

/** 이 플랫폼의 JWKS를 반환한다. */
export function getToolJwks() {
  const { publicKey, kid } = getOrCreateSigningKey();

  const exported = publicKey.export({ format: "jwk" }) as {
    kty: string;
    n: string;
    e: string;
  };

  return {
    keys: [
      {
        kty: exported.kty,
        kid,
        n: exported.n,
        e: exported.e,
        alg: "RS256",
        use: "sig",
      },
    ],
  };
}
