import { createHash, randomUUID } from "node:crypto";

export const BANGKOK_TIMEZONE = "Asia/Bangkok";
export const GENESYS_CALLBACK_CONTEXT_KEYS = [
  "AVA_CUSTOMER_NAME",
  "AVA_CALLBACK_PHONE",
  "AVA_INTENT",
  "AVA_PRODUCT_INTEREST",
  "AVA_CUSTOMER_QUESTION",
  "AVA_SUMMARY",
  "AVA_CALLBACK_TIME_TH",
  "AVA_SOURCE_CHANNEL",
] as const;

export type CallbackScheduleType =
  "RELATIVE_MINUTES" | "DAY_OFFSET_TIME" | "ABSOLUTE_DATE_TIME";

export interface ScheduleCallbackInput {
  scheduleType: CallbackScheduleType;
  delayMinutes: number;
  dayOffset: number;
  callbackDate: string;
  callbackTime: string;
  timezone: string;
  callbackNumber: string;
  callbackUserName?: string | null;
  customerIntent: string;
  productInterest: string;
  customerQuestion: string;
  conversationSummary: string;
  sourceChannel?: string | null;
}

export interface ResolvedCallbackTime {
  scheduledTime: Date;
  scheduledTimeUtc: string;
  scheduledTimeLocal: string;
  scheduledTimeThai: string;
}

export interface GenesysCallbackAuditRecord {
  recordId: string;
  requestFingerprint: string;
  callbackId: string;
  callbackNumber: string;
  callbackNumberE164?: string;
  scheduleType: CallbackScheduleType;
  requestedTimezone: string;
  scheduledTimeLocal: string;
  scheduledTimeUtc: string;
  scheduledTimeThai: string;
  callbackUserName: string;
  customerName: string;
  customerIntent: string;
  productInterest: string;
  customerQuestion: string;
  conversationSummary: string;
  sourceChannel: string;
  queueId: string;
  status: "PENDING" | "SCHEDULED" | "FAILED";
  createdAt: string;
  updatedAt: string;
}

export interface CallbackAuditRepository {
  all(): Promise<GenesysCallbackAuditRecord[]>;
  mutate<R>(
    change: (records: GenesysCallbackAuditRecord[]) => R | Promise<R>,
  ): Promise<R>;
}

export interface GenesysCallbackConfig {
  clientId: string;
  clientSecret: string;
  region: string;
  queueId: string;
  duplicateWindowMs?: number;
}

export type CallbackServiceErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_PHONE"
  | "INVALID_CALLBACK_TIME"
  | "GENESYS_AUTH_ERROR"
  | "GENESYS_CALLBACK_ERROR"
  | "DUPLICATE_REQUEST"
  | "INTERNAL_ERROR";

export class CallbackServiceError extends Error {
  constructor(
    public readonly code: CallbackServiceErrorCode,
    message: string,
    public readonly ambiguous = false,
  ) {
    super(message);
    this.name = "CallbackServiceError";
  }
}

export type FetchLike = typeof fetch;
type Logger = Pick<Console, "info" | "warn" | "error">;

const GENESYS_REGION_HOSTS: Readonly<Record<string, string>> = {
  us_east_1: "mypurecloud.com",
  eu_west_1: "mypurecloud.ie",
  ap_southeast_2: "mypurecloud.com.au",
  ap_northeast_1: "mypurecloud.jp",
  eu_central_1: "mypurecloud.de",
  us_west_2: "usw2.pure.cloud",
  ca_central_1: "cac1.pure.cloud",
  ap_northeast_2: "apne2.pure.cloud",
  eu_west_2: "euw2.pure.cloud",
  ap_south_1: "aps1.pure.cloud",
  us_east_2: "use2.us-gov-pure.cloud",
  sa_east_1: "sae1.pure.cloud",
  me_central_1: "mec1.pure.cloud",
  ap_northeast_3: "apne3.pure.cloud",
  eu_central_2: "euc2.pure.cloud",
  mx_central_1: "mxc1.pure.cloud",
  ap_southeast_1: "apse1.pure.cloud",
  eusc_de_east_1: "edee1.eusc-pure.cloud",
};

const textLimits = {
  callbackUserName: 160,
  customerIntent: 120,
  productInterest: 240,
  customerQuestion: 600,
  conversationSummary: 1200,
  sourceChannel: 40,
} as const;

function invalid(message: string): never {
  throw new CallbackServiceError("INVALID_REQUEST", message);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateScheduleCallbackInput(
  value: unknown,
): ScheduleCallbackInput {
  if (!record(value)) invalid("Request body must be a JSON object");

  const requiredStrings = [
    "callbackDate",
    "callbackTime",
    "timezone",
    "customerIntent",
    "productInterest",
    "customerQuestion",
    "conversationSummary",
  ] as const;
  for (const field of requiredStrings) {
    if (typeof value[field] !== "string")
      invalid(`${field} is required and must be a string`);
  }

  if (
    value.callbackUserName !== undefined &&
    value.callbackUserName !== null &&
    typeof value.callbackUserName !== "string"
  )
    invalid("callbackUserName must be a string when provided");
  if (
    value.sourceChannel !== undefined &&
    value.sourceChannel !== null &&
    typeof value.sourceChannel !== "string"
  )
    invalid("sourceChannel must be a string when provided");

  const scheduleType = value.scheduleType;
  if (
    scheduleType !== "RELATIVE_MINUTES" &&
    scheduleType !== "DAY_OFFSET_TIME" &&
    scheduleType !== "ABSOLUTE_DATE_TIME"
  )
    invalid(
      "scheduleType must be RELATIVE_MINUTES, DAY_OFFSET_TIME, or ABSOLUTE_DATE_TIME",
    );

  for (const field of ["delayMinutes", "dayOffset"] as const) {
    if (
      typeof value[field] !== "number" ||
      !Number.isInteger(value[field]) ||
      value[field] < 0
    )
      invalid(`${field} must be a non-negative integer`);
  }

  if (value.timezone !== BANGKOK_TIMEZONE)
    invalid(`timezone must be ${BANGKOK_TIMEZONE}`);
  if (typeof value.callbackNumber !== "string" || !value.callbackNumber.trim())
    throw new CallbackServiceError(
      "INVALID_PHONE",
      "Callback phone number is required",
    );

  for (const [field, limit] of Object.entries(textLimits)) {
    const text = value[field];
    if (field === "callbackUserName" || field === "sourceChannel") {
      if (text === undefined || text === null) continue;
    }
    if (typeof text !== "string" || text.length > limit)
      invalid(`${field} must be a string no longer than ${limit} characters`);
  }

  const sourceChannel =
    typeof value.sourceChannel === "string"
      ? value.sourceChannel.trim().toUpperCase()
      : "";
  if (sourceChannel && !/^[A-Z][A-Z0-9_-]{0,39}$/.test(sourceChannel))
    invalid(
      "sourceChannel must contain only letters, numbers, underscores, or hyphens",
    );

  return {
    ...value,
    callbackUserName:
      typeof value.callbackUserName === "string" ? value.callbackUserName : "",
    sourceChannel: sourceChannel || "UNKNOWN",
  } as unknown as ScheduleCallbackInput;
}

export function normalizeCallbackPhone(value: string): string {
  const phone = value.trim().replace(/[\s().-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(phone)) return phone;
  if (/^66[689]\d{8}$/.test(phone)) return `+${phone}`;
  if (/^0[689]\d{8}$/.test(phone)) return `+66${phone.slice(1)}`;
  throw new CallbackServiceError(
    "INVALID_PHONE",
    "Invalid callback phone number",
  );
}

function callbackPhoneForDisplay(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (/^\+66[689]\d{8}$/.test(compact)) return `0${compact.slice(3)}`;
  if (/^66[689]\d{8}$/.test(compact)) return `0${compact.slice(2)}`;
  return compact;
}

function actualCustomerName(value: string | null | undefined): string {
  const name = value?.trim() ?? "";
  return name && name.toLocaleLowerCase() !== "customer" ? name : "";
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function datePartString(parts: { year: number; month: number; day: number }) {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function parseDate(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) invalid("callbackDate must use YYYY-MM-DD format");
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    year > 9999 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  )
    invalid("callbackDate is not a valid calendar date");
  return { year, month, day };
}

function parseTime(value: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) invalid("callbackTime must use HH:mm format");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) invalid("callbackTime is not a valid time");
  return { hour, minute };
}

function datePartsAfterDays(
  parts: { year: number; month: number; day: number },
  days: number,
) {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** Resolve a wall-clock date/time using IANA zone data rather than the host timezone. */
function localDateTimeToInstant(
  date: { year: number; month: number; day: number },
  time: { hour: number; minute: number },
  timeZone: string,
): Date {
  const target = {
    ...date,
    ...time,
    second: 0,
  };
  const nominalUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );
  let candidate = nominalUtc;
  for (let attempt = 0; attempt < 5; attempt++) {
    const actual = zonedParts(new Date(candidate), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const adjustment = actualAsUtc - candidate;
    if (adjustment === 0) break;
    candidate = nominalUtc - adjustment;
  }
  const result = new Date(candidate);
  const check = zonedParts(result, timeZone);
  if (
    check.year !== target.year ||
    check.month !== target.month ||
    check.day !== target.day ||
    check.hour !== target.hour ||
    check.minute !== target.minute
  )
    invalid(
      "The requested local callback time does not exist in the requested timezone",
    );
  return result;
}

function localIsoWithOffset(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMinutes = Math.round((localAsUtc - date.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}:${String(absoluteOffset % 60).padStart(2, "0")}`;
  return `${datePartString(parts)}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}${offset}`;
}

export function formatThaiCallbackTime(date: Date): string {
  const displayDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", {
    timeZone: BANGKOK_TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const displayTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${displayDate} เวลา ${displayTime} น.`;
}

export function resolveCallbackTime(
  input: ScheduleCallbackInput,
  now = new Date(),
): ResolvedCallbackTime {
  let scheduledTime: Date;
  if (input.scheduleType === "RELATIVE_MINUTES") {
    if (input.delayMinutes < 1 || input.delayMinutes > 525600)
      invalid("delayMinutes must be between 1 and 525600");
    scheduledTime = new Date(now.getTime() + input.delayMinutes * 60_000);
  } else {
    const callbackTime = input.callbackTime.trim();
    if (!callbackTime) {
      invalid(
        input.scheduleType === "DAY_OFFSET_TIME"
          ? "callbackTime is required for DAY_OFFSET_TIME"
          : "callbackTime is required for ABSOLUTE_DATE_TIME",
      );
    }
    const time = parseTime(callbackTime);
    let date: { year: number; month: number; day: number };
    if (input.scheduleType === "DAY_OFFSET_TIME") {
      if (input.dayOffset > 365) invalid("dayOffset must be between 0 and 365");
      date = datePartsAfterDays(
        zonedParts(now, BANGKOK_TIMEZONE),
        input.dayOffset,
      );
    } else {
      date = parseDate(input.callbackDate);
    }
    scheduledTime = localDateTimeToInstant(date, time, BANGKOK_TIMEZONE);
  }

  if (
    !Number.isFinite(scheduledTime.getTime()) ||
    scheduledTime.getTime() <= now.getTime()
  )
    throw new CallbackServiceError(
      "INVALID_CALLBACK_TIME",
      "The requested callback time is in the past",
    );

  return {
    scheduledTime,
    scheduledTimeUtc: scheduledTime.toISOString(),
    scheduledTimeLocal: localIsoWithOffset(scheduledTime, BANGKOK_TIMEZONE),
    scheduledTimeThai: formatThaiCallbackTime(scheduledTime),
  };
}

export function maskCallbackPhone(phone: string): string {
  if (phone.startsWith("+66") && phone.length >= 8)
    return `${phone.slice(0, 3)}${"X".repeat(Math.max(1, phone.length - 7))}${phone.slice(-4)}`;
  return `${"X".repeat(Math.max(1, phone.length - 4))}${phone.slice(-4)}`;
}

export function readGenesysCallbackConfig(
  env: NodeJS.ProcessEnv = process.env,
): GenesysCallbackConfig | null {
  const names = [
    "GENESYS_CLIENT_ID",
    "GENESYS_CLIENT_SECRET",
    "GENESYS_REGION",
    "GENESYS_CALLBACK_QUEUE_ID",
  ] as const;
  const values = names.map((name) => env[name]?.trim() || "");
  if (values.every((value) => !value)) return null;
  const missing = names.filter((_name, index) => !values[index]);
  if (missing.length)
    throw new Error(
      `Genesys callback configuration is incomplete: ${missing.join(", ")}`,
    );
  const region = values[2];
  if (!GENESYS_REGION_HOSTS[region])
    throw new Error(
      "GENESYS_REGION is not a supported Genesys Cloud region identifier",
    );
  const configuredWindow = Number(
    env.GENESYS_CALLBACK_DUPLICATE_WINDOW_MS || 300000,
  );
  const duplicateWindowMs =
    Number.isInteger(configuredWindow) &&
    configuredWindow >= 1000 &&
    configuredWindow <= 86400000
      ? configuredWindow
      : 300000;
  return {
    clientId: values[0],
    clientSecret: values[1],
    region,
    queueId: values[3],
    duplicateWindowMs,
  };
}

export function validateGenesysCallbackStartupConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Console, "info" | "error"> = console,
): GenesysCallbackConfig | null {
  try {
    const config = readGenesysCallbackConfig(env);
    if (!config)
      logger.info(
        "Genesys callback integration disabled: configuration is not set",
      );
    return config;
  } catch (error) {
    logger.error(
      error instanceof Error
        ? error.message
        : "Genesys callback configuration is invalid",
    );
    throw error;
  }
}

export function genesysRegionHosts(region: string) {
  const domain = GENESYS_REGION_HOSTS[region];
  if (!domain) throw new Error("Unsupported Genesys Cloud region");
  return {
    api: `https://api.${domain}`,
    login: `https://login.${domain}`,
  };
}

interface GenesysCallbackResponse {
  conversation?: { id?: string };
  callbackIdentifiers?: Array<{ id?: string; type?: string }>;
}

function responseCallbackId(value: unknown): string | null {
  if (!record(value)) return null;
  const conversation = record(value.conversation) ? value.conversation : null;
  if (typeof conversation?.id === "string" && conversation.id)
    return conversation.id;
  if (Array.isArray(value.callbackIdentifiers)) {
    const identifier = value.callbackIdentifiers.find(
      (item) => record(item) && typeof item.id === "string" && item.id,
    );
    if (record(identifier) && typeof identifier.id === "string")
      return identifier.id;
  }
  return null;
}

export function createGenesysCallbackScheduler(options: {
  config: GenesysCallbackConfig | null;
  repository: CallbackAuditRepository;
  fetchImpl?: FetchLike;
  now?: () => Date;
  logger?: Logger;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const logger = options.logger ?? console;
  let cachedToken = "";
  let tokenExpiresAt = 0;

  async function accessToken(): Promise<string> {
    const config = options.config;
    if (!config)
      throw new CallbackServiceError(
        "GENESYS_AUTH_ERROR",
        "Callback service is not configured",
      );
    if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
    const hosts = genesysRegionHosts(config.region);
    let response: Response;
    try {
      response = await fetchImpl(`${hosts.login}/oauth/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      logger.error("Genesys OAuth token request failed (network error)");
      throw new CallbackServiceError(
        "GENESYS_AUTH_ERROR",
        "Unable to authenticate with callback service",
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (
      !response.ok ||
      !record(body) ||
      typeof body.access_token !== "string" ||
      !body.access_token
    ) {
      logger.error(
        `Genesys OAuth token request failed (HTTP ${response.status})`,
      );
      throw new CallbackServiceError(
        "GENESYS_AUTH_ERROR",
        "Unable to authenticate with callback service",
      );
    }
    const expiresIn =
      typeof body.expires_in === "number" ? body.expires_in : 3600;
    cachedToken = body.access_token;
    tokenExpiresAt =
      Date.now() +
      Math.max(1, expiresIn - Math.min(60, expiresIn * 0.1)) * 1000;
    return cachedToken;
  }

  async function postCallback(
    payload: Record<string, unknown>,
    retryUnauthorized = true,
  ): Promise<GenesysCallbackResponse> {
    const config = options.config;
    if (!config)
      throw new CallbackServiceError(
        "GENESYS_AUTH_ERROR",
        "Callback service is not configured",
      );
    const token = await accessToken();
    const hosts = genesysRegionHosts(config.region);
    let response: Response;
    try {
      response = await fetchImpl(
        `${hosts.api}/api/v2/conversations/callbacks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      logger.error("Genesys callback creation failed (network error)");
      throw new CallbackServiceError(
        "GENESYS_CALLBACK_ERROR",
        "Unable to schedule callback",
        true,
      );
    }
    if (response.status === 401 && retryUnauthorized) {
      cachedToken = "";
      tokenExpiresAt = 0;
      return postCallback(payload, false);
    }
    if (response.status === 401 || response.status === 403) {
      logger.error(
        `Genesys callback authorization failed (HTTP ${response.status})`,
      );
      throw new CallbackServiceError(
        "GENESYS_AUTH_ERROR",
        "Unable to authenticate with callback service",
      );
    }
    if (!response.ok) {
      logger.error(
        `Genesys callback creation failed (HTTP ${response.status})`,
      );
      throw new CallbackServiceError(
        "GENESYS_CALLBACK_ERROR",
        "Unable to schedule callback",
        response.status >= 500,
      );
    }
    try {
      return (await response.json()) as GenesysCallbackResponse;
    } catch {
      return {};
    }
  }

  async function schedule(value: unknown) {
    const input = validateScheduleCallbackInput(value);
    const requestTime = now();
    const phone = normalizeCallbackPhone(input.callbackNumber);
    const callbackPhoneDisplay = callbackPhoneForDisplay(input.callbackNumber);
    const scheduled = resolveCallbackTime(input, requestTime);
    const customerName = actualCustomerName(input.callbackUserName);
    const callbackUserName = input.callbackUserName?.trim() || "Customer";
    const sourceChannel = input.sourceChannel || "UNKNOWN";
    const context = {
      AVA_CUSTOMER_NAME: customerName,
      AVA_CALLBACK_PHONE: callbackPhoneDisplay,
      AVA_INTENT: input.customerIntent.trim(),
      AVA_PRODUCT_INTEREST: input.productInterest.trim(),
      AVA_CUSTOMER_QUESTION: input.customerQuestion.trim(),
      AVA_SUMMARY: input.conversationSummary.trim(),
      AVA_CALLBACK_TIME_TH: scheduled.scheduledTimeThai,
      AVA_SOURCE_CHANNEL: sourceChannel,
    };
    const conversationDetails: Record<string, string> = {};
    const addConversationDetail = (
      label: string,
      displayType: "identifier" | "enum" | "tag" | "longtext" | "text",
      value: string,
    ) => {
      if (value)
        conversationDetails[`conversationDetails.participantData.${label}`] =
          `${displayType}:${value}`;
    };
    addConversationDetail("Customer Name", "identifier", customerName);
    addConversationDetail("Callback Phone", "identifier", callbackPhoneDisplay);
    addConversationDetail("Intent", "enum", context.AVA_INTENT);
    addConversationDetail(
      "Product Interest",
      "tag",
      context.AVA_PRODUCT_INTEREST.replace(/\s*,\s*/g, ","),
    );
    addConversationDetail(
      "Customer Request",
      "longtext",
      context.AVA_CUSTOMER_QUESTION,
    );
    addConversationDetail("AVA Summary", "longtext", context.AVA_SUMMARY);
    addConversationDetail("Callback Time", "text", scheduled.scheduledTimeThai);
    if (sourceChannel !== "UNKNOWN")
      addConversationDetail("Source Channel", "enum", sourceChannel);
    Object.assign(context, conversationDetails);
    const loggerFields = `scheduleType=${input.scheduleType} phone=${maskCallbackPhone(phone)} local=${scheduled.scheduledTimeLocal} utc=${scheduled.scheduledTimeUtc}`;
    logger.info(`Callback schedule request received (${loggerFields})`);
    const config = options.config;
    if (!config)
      throw new CallbackServiceError(
        "GENESYS_AUTH_ERROR",
        "Unable to authenticate with callback service",
      );

    const requestFingerprint = createHash("sha256")
      .update(
        [
          phone,
          scheduled.scheduledTimeUtc,
          context.AVA_INTENT,
          context.AVA_SUMMARY,
        ].join("\u001f"),
      )
      .digest("hex");
    const duplicateWindowMs = config.duplicateWindowMs ?? 300000;
    const reserveTime = now().toISOString();
    const reservation = {
      recordId: randomUUID(),
      requestFingerprint,
      callbackId: "",
      scheduleType: input.scheduleType,
      requestedTimezone: input.timezone,
      scheduledTimeLocal: scheduled.scheduledTimeLocal,
      scheduledTimeUtc: scheduled.scheduledTimeUtc,
      scheduledTimeThai: scheduled.scheduledTimeThai,
      callbackUserName,
      customerName,
      customerIntent: context.AVA_INTENT,
      productInterest: context.AVA_PRODUCT_INTEREST,
      customerQuestion: context.AVA_CUSTOMER_QUESTION,
      conversationSummary: context.AVA_SUMMARY,
      callbackNumber: callbackPhoneDisplay,
      callbackNumberE164: phone,
      sourceChannel,
      queueId: config.queueId,
      status: "PENDING" as const,
      createdAt: reserveTime,
      updatedAt: reserveTime,
    } satisfies GenesysCallbackAuditRecord;

    const existing = await options.repository.mutate((records) => {
      const cutoff = now().getTime() - duplicateWindowMs;
      const duplicate = records.find(
        (item) =>
          item.status !== "FAILED" &&
          new Date(item.createdAt).getTime() >= cutoff &&
          (item.requestFingerprint === requestFingerprint ||
            (input.scheduleType === "RELATIVE_MINUTES" &&
              item.scheduleType === "RELATIVE_MINUTES" &&
              (item.callbackNumberE164 ?? item.callbackNumber) === phone &&
              item.customerIntent === context.AVA_INTENT &&
              item.conversationSummary === context.AVA_SUMMARY &&
              Math.abs(
                new Date(item.scheduledTimeUtc).getTime() -
                  scheduled.scheduledTime.getTime(),
              ) <= 60_000)),
      );
      if (duplicate) return duplicate;
      records.unshift(reservation);
      return null;
    });
    if (existing) {
      if (existing.status === "SCHEDULED") {
        logger.info(
          `Callback duplicate request reused callbackId=${existing.callbackId}`,
        );
        return {
          callbackCreated: true as const,
          callbackId: existing.callbackId || null,
          callbackNumber: input.callbackNumber,
          scheduledTimeUtc: existing.scheduledTimeUtc,
          scheduledTimeThai:
            existing.scheduledTimeThai ||
            formatThaiCallbackTime(new Date(existing.scheduledTimeUtc)),
        };
      }
      throw new CallbackServiceError(
        "DUPLICATE_REQUEST",
        "An equivalent callback request was already received",
      );
    }

    const payload = {
      callbackUserName,
      callbackNumbers: [phone],
      callbackScheduledTime: scheduled.scheduledTimeUtc,
      queueId: config.queueId,
      data: context,
    };
    let callbackId: string;
    try {
      logger.info("Genesys callback creation started");
      const result = await postCallback(payload);
      const genesysCallbackId = responseCallbackId(result);
      callbackId = genesysCallbackId ?? reservation.recordId;
      if (!genesysCallbackId)
        logger.warn(
          `Genesys accepted callback creation without an identifier; using audit ID ${callbackId}`,
        );
    } catch (error) {
      await options.repository.mutate((records) => {
        const item = records.find(
          (row) => row.recordId === reservation.recordId,
        );
        if (
          item &&
          !(error instanceof CallbackServiceError && error.ambiguous)
        ) {
          item.status = "FAILED";
          item.updatedAt = now().toISOString();
        }
      });
      throw error;
    }

    try {
      await options.repository.mutate((records) => {
        const item = records.find(
          (row) => row.recordId === reservation.recordId,
        );
        if (!item) throw new Error("Callback audit reservation is missing");
        item.callbackId = callbackId;
        item.status = "SCHEDULED";
        item.updatedAt = now().toISOString();
      });
    } catch {
      logger.error(
        `Genesys callback was created but its audit record could not be finalized callbackId=${callbackId}`,
      );
      throw new CallbackServiceError(
        "INTERNAL_ERROR",
        "Unable to schedule callback",
      );
    }
    logger.info(
      `Callback scheduled callbackId=${callbackId} scheduledTimeUtc=${scheduled.scheduledTimeUtc} sourceChannel=${sourceChannel} conversationDetails=${Object.keys(conversationDetails).length > 0} hasCustomerName=${Boolean(customerName)} hasIntent=${Boolean(context.AVA_INTENT)} hasProductInterest=${Boolean(context.AVA_PRODUCT_INTEREST)}`,
    );
    return {
      callbackCreated: true as const,
      callbackId,
      callbackNumber: input.callbackNumber,
      scheduledTimeUtc: scheduled.scheduledTimeUtc,
      scheduledTimeThai: scheduled.scheduledTimeThai,
    };
  }

  return { schedule };
}
