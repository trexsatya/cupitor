# Cupitor Study calls — specification for AI-generated import files

Format version: **1**. Verified against the Study calls importer on 23 October 2026.

Give this entire file to an AI agent, together with your topic, source material,
number of questions, preferred language and answer type. The agent should create
a JSON file you can import through **Study calls → Import file**.

## Instructions to the generating agent

Create a Cupitor Study calls import file from the user's request and source
material. Follow this specification exactly.

- Deliver a UTF-8 file named `calls.json`, containing one valid JSON document.
  If file attachments are unavailable, return the raw JSON document for saving.
- Put no prose, Markdown fences, comments or trailing commas inside the JSON.
- Use only the fields documented below. Do not invent bridge operations, IDs,
  playlists, schedules, recurrence rules, history, explanations or grading prompts.
- Generate factually correct questions grounded in the supplied material.
  Do not invent source facts or ambiguous correct answers.
- Follow the requested language and question mix. Unless the user specifies
  otherwise, default to multiple choice and Swedish (`sv-SE`). Source material
  that clearly specifies another target language takes precedence.
- Omit call dates unless the user explicitly asks for dates. The user can choose
  the first call time and interval in Cupitor. This makes the file reusable.
- Validate the final JSON and every call against the checklist in this file.

## Canonical file structure

Always generate the versioned object form:

```json
{
  "version": 1,
  "defaults": {
    "language": "sv-SE",
    "max_retries": 3,
    "match_threshold": 0.8,
    "voice_response": true,
    "enabled": true
  },
  "calls": [
    {
      "title": "Swedish vocabulary",
      "question": "Vad betyder försynt?",
      "response_type": "choice",
      "choices": [
        "Stillsam och försiktig",
        "Hård och rättfram",
        "Mycket högljudd"
      ],
      "correct_choice_index": 0
    },
    {
      "title": "Swedish geography",
      "question": "Vad heter Sveriges huvudstad?",
      "response_type": "text",
      "accepted_answers": [
        "Stockholm",
        "Stockholms stad"
      ]
    }
  ]
}
```

This example contains both supported answer types and needs no date changes.
It is an example of the format, not a requirement to reuse these questions.

### Root fields

| Field | Type | Rule |
| --- | --- | --- |
| `version` | integer | Always `1`. |
| `defaults` | object | Optional shared settings; use only the settings in the next table. |
| `calls` | array of objects | At least **1** call, up to the configured pending limit (**5,000** maximum), in the intended order. Default capacity: **50**. |

The importer also accepts a bare array of calls, but agents following this spec
must use the versioned object above for clarity and shared settings.

Keep each file at or below **1,048,576 bytes (1 MiB)** in UTF-8; preferably well
below this limit. Pending capacity is configurable in **Study calls → Settings →
Maximum pending calls** from **1 to 5,000**, with a default of **50**. Increase
that setting before importing a larger file; the file itself cannot change it.

The total pending limit applies across profiles and includes disabled calls.
Existing pending calls plus a new batch must fit within that capacity. Splitting
files does not increase it. Lowering the setting keeps existing calls, but blocks
new additions until they fit. Finished history is separate and retains at most
100 calls.

Unless the user provides a larger configured capacity, generate no more than
50 calls per file and explain that larger pending lists require changing
Settings. Split files only to stay below the byte limit or a known configured
capacity, for example `calls-01.json` and `calls-02.json`.

## Shared settings and per-call overrides

A call inherits settings from `defaults`. A setting on an individual call
overrides the same setting in `defaults`. If neither provides it, the app uses
the default shown below. Use actual JSON numbers and booleans, not quoted values
or `null`.

| Field | Type | App default | Allowed values / meaning |
| --- | --- | --- | --- |
| `language` | string | `"sv-SE"` | Speech locale, e.g. `"sv-SE"`, `"en-GB"`, `"en-US"`. Must match `^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$`. Match the language of the spoken question and expected answer. |
| `max_retries` | integer | `3` | **0–10**, retries **after** the initial attempt. `3` means at most **4 answer attempts**. |
| `match_threshold` | number | `0.8` | Finite number from **0.7 to 1.0** inclusive. Keep `0.8` unless asked otherwise. Higher is stricter. |
| `voice_response` | boolean | `true` | Allow spoken answers when speech recognition is available. On-screen answers remain available. |
| `voice_name` | string | Inherit saved Settings voice | Optional Android TTS voice name, at most **200** UTF-16 code units. Omit unless the user supplies an exact available voice name. Empty string `""` explicitly selects the device default for the question language. |
| `speech_rate` | number | Inherit saved Settings speed; initially `1.0` | Optional finite number from **0.5 to 1.5** inclusive. `1.0` is normal speed; `0.75` is slower. |
| `enabled` | boolean | `true` | `false` adds the call as disabled, without arming its alarm. |

Voice names depend on the device and speech engine. Never invent one or use a
human display label as the name. Leave `voice_name` and `speech_rate` out to let
Cupitor use the user's saved settings when the question is spoken. A missing or
language-mismatched saved voice falls back to a voice for `language`. The user
can choose and preview available voices in Settings or override them per call.
`voice_response` controls spoken answers; it does not select the reading voice.
Do not put a pending capacity or Android speech-settings operation in the JSON.

Retries repeat the question within the answered study call. A correct answer
stops retries immediately. Incorrect or unclear answers consume the attempt
budget. These settings do not request repeated telephone calls on a schedule.

## Fields on every generated call

| Field | Type | Rule |
| --- | --- | --- |
| `title` | string | Include a meaningful, nonblank label, maximum **120** characters. The app can generate a title if omitted, but agents should supply one. |
| `question` | string | Required, nonblank, maximum **4,000** characters. This is the actual question read aloud. |
| `response_type` | string | Always specify either `"choice"` or `"text"`. |

Use plain text for spoken content. Avoid HTML, Markdown, URLs as questions,
visual-only references and instructions that require seeing the source material.
Questions should be understandable when heard on their own. The title is a label;
it does not replace `question`. There is no automatic front/back mapping.

The app measures string lengths in UTF-16 code units. Ordinary letters normally
count as one; many emoji count as two. Leave headroom rather than approaching the
limits.

## Multiple-choice calls

Use `"response_type": "choice"` and these fields:

| Field | Type | Rule |
| --- | --- | --- |
| `choices` | array of strings | **2–9** nonblank alternatives, each maximum **200** characters. Each alternative must be a single line: no newline or carriage-return characters. |
| `correct_choice_index` | integer | Required for generated choice calls. **Zero-based** index into `choices`: `0` is the first choice, `1` is the second, etc. |

- Create exactly one defensible correct alternative and distinct, plausible
  distractors. Do not use duplicate or near-identical alternatives.
- Do not insert `A.`, `B.`, `1.` or similar labels into the alternative text;
  the app handles alternative numbers.
- Do not rely on an `answer`, `correct_answer`, `is_correct` or explanation field.
  Grading uses `correct_choice_index`.
- Omit `accepted_answers` for choice calls.
- Prefer concise alternatives that sound different when spoken. The user can
  answer by speaking an alternative's number or label, or by tapping it.
- If you shuffle the alternatives, update `correct_choice_index` afterward.

Example with the **second** alternative correct:

```json
{
  "title": "Swedish articles",
  "question": "Vilken artikel passar framför ordet katt?",
  "response_type": "choice",
  "choices": ["ett", "en"],
  "correct_choice_index": 1
}
```

The examples in this section are individual calls to place inside `calls`, not
complete import documents by themselves.

## Free-response calls

Use `"response_type": "text"` and this field:

| Field | Type | Rule |
| --- | --- | --- |
| `accepted_answers` | array of strings | **1–20** correct spellings or phrasings, each nonblank and maximum **500** characters. Use one complete accepted answer per array element. |

- Omit `choices` and `correct_choice_index` for text calls.
- Ask questions with compact, objectively checkable answers: a word, name,
  number or short phrase. The app does not semantically grade essays.
- List reasonable correct synonyms and phrasings explicitly. A response only
  needs to match **one** listed answer; the user does not need to say them all.
- If several facts must be supplied together, include the complete required
  answer as an accepted string, or split the task into separate questions.
- Use full answers, not regexes, wildcards, placeholders or natural-language
  grading instructions. Avoid punctuation-only entries and embedded newlines.
- Do not include deliberately incorrect answers as accepted variants.

Example:

```json
{
  "title": "Swedish synonyms",
  "question": "Ge en synonym till ordet försynt.",
  "response_type": "text",
  "accepted_answers": ["blyg", "tillbakadragen", "stillsam", "försiktig"]
}
```

## Speech-to-text and fuzzy matching

The app uses deterministic text matching, not an AI assessor. Fuzzy matching
helps with small transcription errors; it does not infer that arbitrary
paraphrases mean the same thing.

- Keep `match_threshold` at `0.8` for normal speech practice.
- Supply correct variants in `accepted_answers` when the same fact can be
  expressed in different ways. For example, `"Stockholm"` and `"Stockholms stad"`.
- Do not list arbitrary misspellings merely to simulate recognition errors.
  The fuzzy matcher already handles small character and spacing differences.
- Case, normalized whitespace, Unicode normalization and final `.`, `!`, `?`
  are normalized. Accent differences receive a smaller penalty.
- Very short answers remain strict against character changes. Use explicit
  correct variants where appropriate.
- Changed numeric tokens and changes in the count of recognized English/Swedish
  negations are protected against, rather than treated as simple spelling errors.
  This is not a general guarantee of semantic correctness.
- Even `1.0` still applies the matcher's normalization rules; it is not raw
  byte-for-byte equality.

Write unambiguous questions and answer sets. Do not lower the threshold simply
to make ambiguous or overly broad questions pass.

## Optional explicit call dates

**Default: omit both `when` and `when_ms`.** Dates are unnecessary for importing
and editing questions; Cupitor can assign them when adding the batch to pending.

Only add a date if the user explicitly requests it and the intended time and
timezone are known. Choose exactly one field per call:

| Field | Type | Rule |
| --- | --- | --- |
| `when` | string | A valid ISO date-time ending in `Z` or a numeric `±HH:MM` offset. Never use a timezone-free local date-time. |
| `when_ms` | integer | Unix epoch timestamp in **milliseconds**, representable as a JavaScript safe integer. Never use seconds. |

Every explicit date must be strictly in the future at import/scheduling time
and no more than **366 days** ahead. This applies to disabled calls too when
importing or editing them. Do not copy a fixed example date into a new file.
A timezone name such as `Europe/Stockholm` is not itself a valid `when` value;
resolve the correct offset for the requested date, including daylight saving.

For calls without dates, the import UI assigns:

`first call time + (zero-based position in the file × interval minutes)`

The interval defaults to **5 minutes** and can be set from **1 to 1,440 minutes**
in the import UI. Calls with explicit dates keep their own dates. Their positions
still count when spacing the other calls; disabled calls also keep their positions.
Do not add a `spacing`, `start_time`, `timezone` or recurrence field to the JSON.

## Final validation checklist for the generating agent

Before delivering the file:

1. Parse the complete output as JSON; ensure there are no comments, fences or
   trailing commas and that the file is UTF-8 and within the size limit.
2. Check `version` is `1` and `calls` contains at least 1 object and no more than
   the configured pending capacity (maximum 5,000; use 50 when unknown). Ensure
   existing pending calls plus this batch fit before scheduling.
3. Apply `defaults` plus each call's overrides, then validate the effective settings.
4. Check every title, question, alternative and accepted answer against its limits.
5. Check every `response_type` is explicit and has the corresponding answer fields.
6. For every choice call, verify 2–9 distinct alternatives and an integer index
   in range `0` through `choices.length - 1`. Independently check that this
   indexed alternative is factually correct.
7. For every text call, verify 1–20 genuinely correct accepted strings and a
   question suitable for deterministic matching.
8. Use JSON numbers and booleans with the correct types; avoid `null` and empty
   required values. Do not include unsupported fields.
9. Omit dates unless requested. If supplied, verify timezone, milliseconds vs
   seconds, future validity and the 366-day limit.
10. Deliver the complete import file, not a partial example, schema, bridge
    request or instructions for manually creating the questions.

## Copyable request to another AI agent

> Follow the attached Cupitor Study calls specification. Create an import file
> named calls.json with [NUMBER] questions about [TOPIC / ATTACHED MATERIAL].
> Use [LANGUAGE AND LOCALE] and [MULTIPLE CHOICE / FREE RESPONSE / A MIX].
> My configured pending capacity is [LIMIT, DEFAULT 50], with [NUMBER] calls
> already pending. Leave voice selection and speed to my Cupitor settings.
> Keep spoken answers enabled, 3 retries after the first attempt, and fuzzy
> matching at 0.8. Include correct answers in the required fields. Omit call
> dates so I can choose them in Cupitor. Validate the complete file and return
> the JSON file ready to import.

## Using the generated file

If needed, raise **Study calls → Settings → Maximum pending calls** first.
Open **Study calls → Import file**, choose the generated JSON, review or edit
its questions and enabled states, and choose a first time and interval when
needed. Select **Add imported calls to pending list** to schedule it. Importing
and reviewing a file alone does not start calls.

Pending calls can subsequently be edited, enabled/disabled or removed. A disabled
call whose time has passed needs a future time before it can be enabled.

Compatibility references:
[webapp implementation](https://github.com/trexsatya/cupitor/pull/38) and
[Android implementation](https://github.com/trexsatya/cupitor-flutter/pull/15).
Use versions containing these improvements in both the webapp and Android app.
The expanded capacity and voice settings require those updates; older versions
are limited to 50 pending calls. JSON format version remains **1**.
