import assert from "node:assert/strict";
import test from "node:test";
import { matchLine, speechLanguage } from "./lines.ts";

test("matchLine understands Portuguese intents", () => {
  assert.equal(matchLine("oi"), "greet");
  assert.equal(matchLine("Olá, quem é você?"), "greet");
  assert.equal(matchLine("quero ver futebol ao vivo"), "sports");
  assert.equal(matchLine("onde passa isso"), "where");
  assert.equal(matchLine("um anime leve hoje"), "anime");
  assert.equal(matchLine("algo aconchegante"), "feelgood");
  assert.equal(matchLine("something warm"), "feelgood");
});

test("speechLanguage keeps Portuguese listeners on pt-BR", () => {
  assert.equal(speechLanguage("pt-BR"), "pt-BR");
  assert.equal(speechLanguage("pt"), "pt-BR");
  assert.equal(speechLanguage("en-US"), "en-US");
  assert.equal(speechLanguage(""), "en-US");
});
