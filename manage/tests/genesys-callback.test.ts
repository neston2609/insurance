import assert from "node:assert/strict";
import test from "node:test";
import {
  CallbackServiceError,
  createGenesysCallbackScheduler,
  formatThaiCallbackTime,
  genesysRegionHosts,
  normalizeCallbackPhone,
  readGenesysCallbackConfig,
  resolveCallbackTime,
  validateScheduleCallbackInput,
  type CallbackAuditRepository,
  type GenesysCallbackAuditRecord,
  type ScheduleCallbackInput,
} from "../server/services/genesys-callback.service";

const validInput = (
  overrides: Partial<ScheduleCallbackInput> = {},
): ScheduleCallbackInput => ({
  scheduleType: "RELATIVE_MINUTES",
  delayMinutes: 10,
  dayOffset: 0,
  callbackDate: "",
  callbackTime: "",
  timezone: "Asia/Bangkok",
  callbackNumber: "0652936493",
  callbackUserName: "สุวัจชัย รสิกวรรณ",
  customerIntent: "RENEWAL_REQUEST",
  productInterest: "Accident Usage Protection",
  customerQuestion: "ต้องการสอบถามส่วนลดต่ออายุ",
  conversationSummary: "ลูกค้าสนใจต่ออายุประกันรถ BYD Atto 3",
  ...overrides,
});

function memoryRepository(): CallbackAuditRepository & {
  records: GenesysCallbackAuditRecord[];
} {
  const repository = {
    records: [] as GenesysCallbackAuditRecord[],
    async all() {
      return this.records;
    },
    async mutate<R>(
      change: (records: GenesysCallbackAuditRecord[]) => R | Promise<R>,
    ) {
      return change(this.records);
    },
  };
  return repository;
}

function makeFetchMock(
  onCallback: (
    payload: Record<string, unknown>,
  ) => Response | Promise<Response>,
  options: { authFailure?: boolean } = {},
) {
  let tokenCalls = 0;
  let callbackCalls = 0;
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/oauth/token")) {
      tokenCalls++;
      if (options.authFailure)
        return Response.json({ error: "invalid_client" }, { status: 401 });
      return Response.json({
        access_token: "test-access-token",
        expires_in: 3600,
      });
    }
    assert.equal(
      url,
      "https://api.mypurecloud.com.au/api/v2/conversations/callbacks",
    );
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer test-access-token",
    );
    callbackCalls++;
    return onCallback(
      JSON.parse(String(init?.body)) as Record<string, unknown>,
    );
  };
  return {
    fetchMock,
    counts: () => ({ tokenCalls, callbackCalls }),
  };
}

const config = {
  clientId: "client-id",
  clientSecret: "never-log-this",
  region: "ap_southeast_2",
  queueId: "configured-mfec-queue",
  duplicateWindowMs: 300000,
};

test("relative-minute schedules resolve 10 and 60 minutes forward as UTC", () => {
  const now = new Date("2026-11-11T07:00:00.000Z");
  const ten = resolveCallbackTime(validInput(), now);
  assert.equal(ten.scheduledTimeUtc, "2026-11-11T07:10:00.000Z");
  assert.equal(ten.scheduledTimeLocal, "2026-11-11T14:10:00+07:00");
  const sixty = resolveCallbackTime(validInput({ delayMinutes: 60 }), now);
  assert.equal(sixty.scheduledTimeUtc, "2026-11-11T08:00:00.000Z");
  assert.equal(sixty.scheduledTimeLocal, "2026-11-11T15:00:00+07:00");
});

test("day-offset schedules resolve today, tomorrow and the day after in Bangkok", () => {
  const now = new Date("2026-11-11T07:00:00.000Z");
  const today = resolveCallbackTime(
    validInput({ scheduleType: "DAY_OFFSET_TIME", callbackTime: "15:00" }),
    now,
  );
  assert.equal(today.scheduledTimeUtc, "2026-11-11T08:00:00.000Z");
  const tomorrow = resolveCallbackTime(
    validInput({
      scheduleType: "DAY_OFFSET_TIME",
      dayOffset: 1,
      callbackTime: "14:00",
    }),
    now,
  );
  assert.equal(tomorrow.scheduledTimeUtc, "2026-11-12T07:00:00.000Z");
  const dayAfter = resolveCallbackTime(
    validInput({
      scheduleType: "DAY_OFFSET_TIME",
      dayOffset: 2,
      callbackTime: "14:30",
    }),
    now,
  );
  assert.equal(dayAfter.scheduledTimeUtc, "2026-11-13T07:30:00.000Z");
});

test("absolute date-time resolves Bangkok wall time to UTC and Thai Buddhist-year display", () => {
  const resolved = resolveCallbackTime(
    validInput({
      scheduleType: "ABSOLUTE_DATE_TIME",
      callbackDate: "2026-11-15",
      callbackTime: "10:00",
    }),
    new Date("2026-11-11T07:00:00.000Z"),
  );
  assert.equal(resolved.scheduledTimeUtc, "2026-11-15T03:00:00.000Z");
  assert.equal(resolved.scheduledTimeThai, "15 พฤศจิกายน 2569 เวลา 10:00 น.");
  assert.equal(
    formatThaiCallbackTime(resolved.scheduledTime),
    resolved.scheduledTimeThai,
  );
});

test("normalizes Thai and international mobile formats without damaging E.164", () => {
  assert.equal(normalizeCallbackPhone("0652936493"), "+66652936493");
  assert.equal(normalizeCallbackPhone("065-293-6493"), "+66652936493");
  assert.equal(normalizeCallbackPhone("+66 65 293 6493"), "+66652936493");
  assert.equal(normalizeCallbackPhone("+66652936493"), "+66652936493");
  assert.equal(normalizeCallbackPhone("+14155552671"), "+14155552671");
  assert.throws(() => normalizeCallbackPhone("020001111"), {
    code: "INVALID_PHONE",
  });
});

test("rejects unsupported schedule types, missing time, malformed date and past time", () => {
  assert.throws(
    () =>
      validateScheduleCallbackInput({ ...validInput(), scheduleType: "NOW" }),
    { code: "INVALID_REQUEST" },
  );
  assert.throws(
    () =>
      resolveCallbackTime(
        validInput({ scheduleType: "DAY_OFFSET_TIME" }),
        new Date("2026-11-11T07:00:00Z"),
      ),
    { message: "callbackTime is required for DAY_OFFSET_TIME" },
  );
  assert.throws(
    () =>
      resolveCallbackTime(
        validInput({
          scheduleType: "ABSOLUTE_DATE_TIME",
          callbackDate: "bad",
          callbackTime: "10:00",
        }),
        new Date("2026-11-11T07:00:00Z"),
      ),
    { code: "INVALID_REQUEST" },
  );
  assert.throws(
    () =>
      resolveCallbackTime(
        validInput({ scheduleType: "DAY_OFFSET_TIME", callbackTime: "13:59" }),
        new Date("2026-11-11T07:00:00Z"),
      ),
    { code: "INVALID_CALLBACK_TIME" },
  );
});

test("uses AP Southeast region hosts and validates callback configuration", () => {
  assert.deepEqual(genesysRegionHosts("ap_southeast_2"), {
    api: "https://api.mypurecloud.com.au",
    login: "https://login.mypurecloud.com.au",
  });
  assert.equal(
    readGenesysCallbackConfig({
      GENESYS_CLIENT_ID: "id",
      GENESYS_CLIENT_SECRET: "secret",
      GENESYS_REGION: "ap_southeast_2",
      GENESYS_CALLBACK_QUEUE_ID: "queue",
    })?.queueId,
    "queue",
  );
  assert.throws(
    () =>
      readGenesysCallbackConfig({
        GENESYS_CLIENT_ID: "id",
        GENESYS_CLIENT_SECRET: "",
        GENESYS_REGION: "ap_southeast_2",
        GENESYS_CALLBACK_QUEUE_ID: "queue",
      }),
    /GENESYS_CLIENT_SECRET/,
  );
});

test("creates one callback with AVA and Conversation Details attributes", async () => {
  const repository = memoryRepository();
  let sent: Record<string, unknown> | undefined;
  const logMessages: string[] = [];
  const mock = makeFetchMock((payload) => {
    sent = payload;
    return Response.json({ conversation: { id: "genesys-conversation-123" } });
  });
  const scheduler = createGenesysCallbackScheduler({
    config,
    repository,
    fetchImpl: mock.fetchMock,
    now: () => new Date("2026-11-11T07:00:00.000Z"),
    logger: {
      info(message) {
        logMessages.push(message);
      },
      warn() {},
      error() {},
    },
  });
  const result = await scheduler.schedule(
    validInput({
      sourceChannel: "VOICE",
      customerIntent: "POLICY_COVERAGE",
      productInterest: "Accident Usage Protection, Motor Smart 3+",
      customerQuestion:
        "ต้องการสอบถามรายละเอียดความคุ้มครองของกรมธรรม์ทั้ง 2 ฉบับ",
      conversationSummary:
        "ลูกค้าต้องการให้เจ้าหน้าที่ติดต่อกลับเพื่อสอบถามรายละเอียดความคุ้มครองของกรมธรรม์ Accident Usage Protection และ Motor Smart 3+",
    }),
  );
  assert.equal(result.callbackCreated, true);
  assert.equal(result.callbackId, "genesys-conversation-123");
  assert.equal(result.scheduledTimeUtc, "2026-11-11T07:10:00.000Z");
  assert.equal(result.scheduledTimeThai, "11 พฤศจิกายน 2569 เวลา 14:10 น.");
  assert.equal(sent?.queueId, "configured-mfec-queue");
  assert.equal("routingData" in (sent ?? {}), false);
  assert.deepEqual(sent?.callbackNumbers, ["+66652936493"]);
  assert.deepEqual(sent?.data, {
    AVA_CUSTOMER_NAME: "สุวัจชัย รสิกวรรณ",
    AVA_CALLBACK_PHONE: "0652936493",
    AVA_INTENT: "POLICY_COVERAGE",
    AVA_PRODUCT_INTEREST: "Accident Usage Protection, Motor Smart 3+",
    AVA_CUSTOMER_QUESTION:
      "ต้องการสอบถามรายละเอียดความคุ้มครองของกรมธรรม์ทั้ง 2 ฉบับ",
    AVA_SUMMARY:
      "ลูกค้าต้องการให้เจ้าหน้าที่ติดต่อกลับเพื่อสอบถามรายละเอียดความคุ้มครองของกรมธรรม์ Accident Usage Protection และ Motor Smart 3+",
    AVA_CALLBACK_TIME_TH: result.scheduledTimeThai,
    AVA_SOURCE_CHANNEL: "VOICE",
    "conversationDetails.participantData.Customer Name":
      "identifier:สุวัจชัย รสิกวรรณ",
    "conversationDetails.participantData.Callback Phone":
      "identifier:0652936493",
    "conversationDetails.participantData.Intent": "enum:POLICY_COVERAGE",
    "conversationDetails.participantData.Product Interest":
      "tag:Accident Usage Protection,Motor Smart 3+",
    "conversationDetails.participantData.Customer Request":
      "longtext:ต้องการสอบถามรายละเอียดความคุ้มครองของกรมธรรม์ทั้ง 2 ฉบับ",
    "conversationDetails.participantData.AVA Summary":
      "longtext:ลูกค้าต้องการให้เจ้าหน้าที่ติดต่อกลับเพื่อสอบถามรายละเอียดความคุ้มครองของกรมธรรม์ Accident Usage Protection และ Motor Smart 3+",
    "conversationDetails.participantData.Callback Time": `text:${result.scheduledTimeThai}`,
    "conversationDetails.participantData.Source Channel": "enum:VOICE",
  });
  assert.equal(sent?.callbackUserName, "สุวัจชัย รสิกวรรณ");
  assert.equal(repository.records[0].callbackId, "genesys-conversation-123");
  assert.equal(repository.records[0].status, "SCHEDULED");
  assert.equal(repository.records[0].customerName, "สุวัจชัย รสิกวรรณ");
  assert.equal(repository.records[0].callbackNumber, "0652936493");
  assert.equal(repository.records[0].callbackNumberE164, "+66652936493");
  assert.equal(repository.records[0].customerIntent, "POLICY_COVERAGE");
  assert.equal(
    repository.records[0].productInterest,
    "Accident Usage Protection, Motor Smart 3+",
  );
  assert.equal(
    repository.records[0].customerQuestion,
    "ต้องการสอบถามรายละเอียดความคุ้มครองของกรมธรรม์ทั้ง 2 ฉบับ",
  );
  assert.equal(
    repository.records[0].conversationSummary,
    "ลูกค้าต้องการให้เจ้าหน้าที่ติดต่อกลับเพื่อสอบถามรายละเอียดความคุ้มครองของกรมธรรม์ Accident Usage Protection และ Motor Smart 3+",
  );
  assert.equal(
    repository.records[0].scheduledTimeThai,
    result.scheduledTimeThai,
  );
  assert.equal(repository.records[0].sourceChannel, "VOICE");
  assert.equal(
    repository.records[0].scheduledTimeLocal,
    "2026-11-11T14:10:00+07:00",
  );
  assert.ok(
    logMessages.some(
      (message) =>
        message.includes("Callback scheduled") &&
        message.includes("callbackId=genesys-conversation-123") &&
        message.includes("scheduledTimeUtc=2026-11-11T07:10:00.000Z") &&
        message.includes("sourceChannel=VOICE") &&
        message.includes("conversationDetails=true") &&
        message.includes("hasCustomerName=true") &&
        message.includes("hasIntent=true") &&
        message.includes("hasProductInterest=true"),
    ),
  );
  assert.deepEqual(mock.counts(), { tokenCalls: 1, callbackCalls: 1 });
  const logs = logMessages.join("\n");
  assert.doesNotMatch(
    logs,
    /test-access-token|never-log-this|0652936493|Authorization|Basic/i,
  );
});

test("omitted or generic customer name is blank participant data; source defaults UNKNOWN", async () => {
  for (const callbackUserName of [undefined, "Customer", " customer ", ""]) {
    let sent: Record<string, unknown> | undefined;
    const mock = makeFetchMock((payload) => {
      sent = payload;
      return Response.json({ conversation: { id: "unknown-customer" } });
    });
    const scheduler = createGenesysCallbackScheduler({
      config,
      repository: memoryRepository(),
      fetchImpl: mock.fetchMock,
      now: () => new Date("2026-11-11T07:00:00.000Z"),
      logger: { info() {}, warn() {}, error() {} },
    });
    await scheduler.schedule(
      validInput({
        callbackUserName,
        customerIntent: "",
        productInterest: "",
        customerQuestion: "",
        conversationSummary: "",
      }),
    );
    assert.equal((sent?.data as Record<string, unknown>).AVA_CUSTOMER_NAME, "");
    assert.equal(
      (sent?.data as Record<string, unknown>).AVA_SOURCE_CHANNEL,
      "UNKNOWN",
    );
    assert.equal(
      sent?.callbackUserName,
      callbackUserName?.trim() || "Customer",
    );
    const data = sent?.data as Record<string, unknown>;
    for (const label of [
      "Customer Name",
      "Intent",
      "Product Interest",
      "Customer Request",
      "AVA Summary",
      "Source Channel",
    ])
      assert.equal(
        `conversationDetails.participantData.${label}` in data,
        false,
        `${label} should be omitted when its source value is unavailable`,
      );
    assert.equal(
      data["conversationDetails.participantData.Callback Phone"],
      "identifier:0652936493",
    );
    assert.equal(
      data["conversationDetails.participantData.Callback Time"],
      "text:11 พฤศจิกายน 2569 เวลา 14:10 น.",
    );
  }
});

test("maps DIGITAL source channel to an enum Conversation Details value", async () => {
  let sent: Record<string, unknown> | undefined;
  const scheduler = createGenesysCallbackScheduler({
    config,
    repository: memoryRepository(),
    fetchImpl: makeFetchMock((payload) => {
      sent = payload;
      return Response.json({ conversation: { id: "digital-callback" } });
    }).fetchMock,
    now: () => new Date("2026-11-11T07:00:00.000Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  await scheduler.schedule(validInput({ sourceChannel: "digital" }));
  assert.equal(
    (sent?.data as Record<string, unknown>)[
      "conversationDetails.participantData.Source Channel"
    ],
    "enum:DIGITAL",
  );
});

test("keeps a Thai display phone when input is already E.164", async () => {
  let sent: Record<string, unknown> | undefined;
  const scheduler = createGenesysCallbackScheduler({
    config,
    repository: memoryRepository(),
    fetchImpl: makeFetchMock((payload) => {
      sent = payload;
      return Response.json({ conversation: { id: "e164-callback" } });
    }).fetchMock,
    now: () => new Date("2026-11-11T07:00:00.000Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  await scheduler.schedule(validInput({ callbackNumber: "+66652936493" }));
  assert.deepEqual(sent?.callbackNumbers, ["+66652936493"]);
  assert.equal(
    (sent?.data as Record<string, unknown>).AVA_CALLBACK_PHONE,
    "0652936493",
  );
});

test("rejects an empty callback phone before OAuth or Genesys callback calls", async () => {
  const repository = memoryRepository();
  const mock = makeFetchMock(() =>
    Response.json({ conversation: { id: "must-not-be-created" } }),
  );
  const scheduler = createGenesysCallbackScheduler({
    config,
    repository,
    fetchImpl: mock.fetchMock,
    now: () => new Date("2026-11-11T07:00:00.000Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  await assert.rejects(
    scheduler.schedule(validInput({ callbackNumber: "  " })),
    (error: unknown) => {
      assert.ok(error instanceof CallbackServiceError);
      assert.equal(error.code, "INVALID_PHONE");
      assert.equal(error.message, "Callback phone number is required");
      return true;
    },
  );
  assert.deepEqual(mock.counts(), { tokenCalls: 0, callbackCalls: 0 });
  assert.equal(repository.records.length, 0);
});

test("caches OAuth token and reuses the scheduled callback for duplicate requests", async () => {
  const repository = memoryRepository();
  const mock = makeFetchMock(() =>
    Response.json({ conversation: { id: "same-callback" } }),
  );
  const scheduler = createGenesysCallbackScheduler({
    config,
    repository,
    fetchImpl: mock.fetchMock,
    now: () => new Date("2026-11-11T07:00:00.000Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  const first = await scheduler.schedule(validInput());
  const second = await scheduler.schedule(validInput());
  assert.equal(first.callbackId, second.callbackId);
  assert.deepEqual(mock.counts(), { tokenCalls: 1, callbackCalls: 1 });
  assert.equal(repository.records.length, 1);
});

test("matches quick relative-time retries and keeps the original scheduled time", async () => {
  const repository = memoryRepository();
  const mock = makeFetchMock(() =>
    Response.json({ conversation: { id: "same-callback" } }),
  );
  let nowCalls = 0;
  const scheduler = createGenesysCallbackScheduler({
    config,
    repository,
    fetchImpl: mock.fetchMock,
    now: () =>
      new Date(
        new Date("2026-11-11T07:00:00.000Z").getTime() +
          (nowCalls++ >= 3 ? 10000 : 0),
      ),
    logger: { info() {}, warn() {}, error() {} },
  });
  const first = await scheduler.schedule(validInput());
  const retried = await scheduler.schedule(validInput());
  assert.equal(retried.callbackId, first.callbackId);
  assert.equal(retried.scheduledTimeUtc, first.scheduledTimeUtc);
  assert.deepEqual(mock.counts(), { tokenCalls: 1, callbackCalls: 1 });
});

test("uses a stable local audit ID only when Genesys accepts without returning an identifier", async () => {
  const repository = memoryRepository();
  const scheduler = createGenesysCallbackScheduler({
    config,
    repository,
    fetchImpl: makeFetchMock(() => new Response(null, { status: 202 }))
      .fetchMock,
    now: () => new Date("2026-11-11T07:00:00.000Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  const result = await scheduler.schedule(validInput());
  assert.equal(result.callbackCreated, true);
  assert.equal(typeof result.callbackId, "string");
  assert.equal(result.callbackId, repository.records[0].recordId);
});

test("reports OAuth and Genesys create failures without exposing upstream body", async () => {
  const logger = { info() {}, warn() {}, error() {} };
  const authMock = makeFetchMock(() => Response.json({}), {
    authFailure: true,
  });
  const authScheduler = createGenesysCallbackScheduler({
    config,
    repository: memoryRepository(),
    fetchImpl: authMock.fetchMock,
    now: () => new Date("2026-11-11T07:00:00Z"),
    logger,
  });
  await assert.rejects(
    authScheduler.schedule(validInput()),
    (error: unknown) => {
      assert.ok(error instanceof CallbackServiceError);
      assert.equal(error.code, "GENESYS_AUTH_ERROR");
      assert.equal(
        error.message,
        "Unable to authenticate with callback service",
      );
      return true;
    },
  );

  const failedRepository = memoryRepository();
  const callbackMock = makeFetchMock(() =>
    Response.json({ error: "private detail" }, { status: 500 }),
  );
  const callbackScheduler = createGenesysCallbackScheduler({
    config,
    repository: failedRepository,
    fetchImpl: callbackMock.fetchMock,
    now: () => new Date("2026-11-11T07:00:00Z"),
    logger,
  });
  await assert.rejects(
    callbackScheduler.schedule(validInput()),
    (error: unknown) => {
      assert.ok(error instanceof CallbackServiceError);
      assert.equal(error.code, "GENESYS_CALLBACK_ERROR");
      assert.equal(error.message, "Unable to schedule callback");
      return true;
    },
  );
  // A server-side 5xx is ambiguous: Genesys may have accepted the create before
  // failing the response, so keep it reserved to prevent duplicate callbacks.
  assert.equal(failedRepository.records[0].status, "PENDING");
});

test("keeps ambiguous Genesys create outcomes reserved to protect against retries", async () => {
  const repository = memoryRepository();
  const mock = makeFetchMock(() => {
    throw new Error("connection dropped after request");
  });
  const scheduler = createGenesysCallbackScheduler({
    config,
    repository,
    fetchImpl: mock.fetchMock,
    now: () => new Date("2026-11-11T07:00:00Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  await assert.rejects(scheduler.schedule(validInput()), {
    code: "GENESYS_CALLBACK_ERROR",
  });
  assert.equal(repository.records[0].status, "PENDING");
  await assert.rejects(scheduler.schedule(validInput()), {
    code: "DUPLICATE_REQUEST",
  });
  assert.deepEqual(mock.counts(), { tokenCalls: 1, callbackCalls: 1 });
});

test("allows retry after a definitive Genesys rejection while retaining its audit record", async () => {
  const repository = memoryRepository();
  let callbackAttempts = 0;
  const mock = makeFetchMock(() => {
    callbackAttempts++;
    return callbackAttempts === 1
      ? Response.json({ error: "invalid queue" }, { status: 400 })
      : Response.json({ conversation: { id: "retry-success" } });
  });
  const scheduler = createGenesysCallbackScheduler({
    config,
    repository,
    fetchImpl: mock.fetchMock,
    now: () => new Date("2026-11-11T07:00:00Z"),
    logger: { info() {}, warn() {}, error() {} },
  });
  await assert.rejects(scheduler.schedule(validInput()), {
    code: "GENESYS_CALLBACK_ERROR",
  });
  const result = await scheduler.schedule(validInput());
  assert.equal(result.callbackId, "retry-success");
  assert.equal(repository.records.length, 2);
  assert.deepEqual(
    repository.records.map((item) => item.status),
    ["SCHEDULED", "FAILED"],
  );
});
