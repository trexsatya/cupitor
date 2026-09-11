#!/usr/bin/env python3
"""Tests for sbc_clean.

Run: python3 tools/sbc/test_sbc_clean.py

Each case pins a hazard that real SBC markup actually creates. Lines are taken
verbatim from SBC002 wherever possible.
"""

import json
import unittest

from sbc_clean import (
    build_modes,
    build_utterances,
    clean_text,
    convert,
    decode,
    parse_formats,
    parse_line,
    render_jsonl,
    render_markdown,
)

READABLE = build_modes("readable")
LINGUISTIC = build_modes("linguistic")


class DecodingTests(unittest.TestCase):
    def test_windows_1252_apostrophes_survive_as_ascii(self):
        """SBC060 writes every apostrophe as byte 0x92, not as "'"."""
        self.assertEqual(decode(b"his art was distinctive. And he\x92s"),
                         "his art was distinctive. And he's")
        self.assertEqual(decode(b"I\x92d\x92ve had to replace it"), "I'd've had to replace it")

    def test_stray_control_bytes_are_removed(self):
        """SBC015 line 175 has a NUL where the "c" of "church" should be."""
        self.assertEqual(decode(b"JOANNE:\t\x00hurch things."), "JOANNE:\thurch things.")

    def test_utf8_is_preferred_over_the_fallbacks(self):
        self.assertEqual(decode("café ~Renée".encode("utf-8")), "café ~Renée")


class ParsingTests(unittest.TestCase):
    def test_parses_tab_separated_line(self):
        row = parse_line("0.00 6.52\tJAMIE:  \tHow [can you] ta=p [2dance2].")
        self.assertEqual(row, (0.0, 6.52, "JAMIE", "How [can you] ta=p [2dance2]."))

    def test_parses_the_later_files_separate_time_columns(self):
        """SBC001-014 write "start end" in one column; later files use two."""
        row = parse_line("0.00\t6.52\tJAMIE:  \tHow are you.")
        self.assertEqual(row, (0.0, 6.52, "JAMIE", "How are you."))

    def test_a_non_participant_source_is_not_a_speaker(self):
        """">RADIO" must not become the speaker that blank columns inherit."""
        lines = [
            "9.00 10.00\tHAROLD: \tI have no idea.",
            "10.00 11.00\t>RADIO: \tand now the weather",
            "11.00 12.00\t        \tIt was probably her idea.",
        ]
        utterances = convert(lines, READABLE, merge=False)
        self.assertEqual(
            [(u.speaker, u.kind) for u in utterances],
            [("HAROLD", "speech"), ("RADIO", "event"), ("HAROLD", "speech")],
        )

    def test_blank_speaker_continues_previous(self):
        lines = [
            "9.56 10.41\tHAROLD: \tI have no idea.",
            "10.41 13.06\t        \tIt was probably my= .. sister-in-law's idea.",
        ]
        utterances = build_utterances([parse_line(line) for line in lines])
        self.assertEqual([u.speaker for u in utterances], ["HAROLD", "HAROLD"])

    def test_event_line_is_not_attributed_to_previous_speaker(self):
        """((CLAP)) has a blank speaker column but belongs to the room."""
        lines = [
            "1160.00 1161.00\tJAMIE:  \tThat's funny.",
            "1161.12 1161.26\t        \t((CLAP))",
        ]
        utterances = convert(lines, READABLE, merge=True)
        self.assertEqual(
            [(u.speaker, u.kind, u.text) for u in utterances],
            [("JAMIE", "speech", "That's funny."), ("ENV", "event", "[clap]")],
        )


class ContinuationTests(unittest.TestCase):
    def test_ampersand_rejoins_across_an_interrupter(self):
        lines = [
            "296.10 297.00\tJAMIE:  \tThere gonna have another &",
            "296.50 297.10\tMILES:  \t[3Oh no3],",
            "297.20 298.25\tJAMIE:  \t& [3br=at .. kid-3],",
        ]
        utterances = convert(lines, READABLE, merge=False)
        self.assertEqual(len(utterances), 2)
        self.assertEqual(utterances[0].speaker, "JAMIE")
        self.assertEqual(utterances[0].text, "There gonna have another brat kid-,")
        self.assertEqual(utterances[0].end, 298.25)
        self.assertEqual(utterances[1].text, "Oh no,")


class CleaningTests(unittest.TestCase):
    def test_numbered_and_plain_overlaps_unwrap(self):
        raw = "How [can you teach a three-year-old to] ta=p [2dance2]."
        self.assertEqual(
            clean_text(raw, READABLE),
            "How can you teach a three-year-old to tap dance.",
        )

    def test_nested_quality_spans(self):
        raw = "... <P<% I like this song %>P>."
        self.assertEqual(clean_text(raw, READABLE), "I like this song.")
        self.assertEqual(
            clean_text(raw, LINGUISTIC),
            '<pp/> <q type="piano"><q type="creaky">I like this song</q></q>.',
        )

    def test_an_undocumented_quality_label_passes_through(self):
        """The quality set is open-ended; unknown labels are not guessed at."""
        self.assertEqual(clean_text("<SING la la SING>", READABLE), "la la")
        self.assertEqual(
            clean_text("<SING la la SING>", LINGUISTIC), '<q type="sing">la la</q>'
        )

    def test_pauses_go_but_sentence_periods_stay(self):
        self.assertEqual(clean_text("...We have % --", READABLE), "We have")
        self.assertEqual(clean_text("... Bud's.", READABLE), "Bud's.")

    def test_codeswitch_label_carries_a_digit(self):
        """<L2 ... L2> marks a switch into another language."""
        self.assertEqual(clean_text("the <L2 Pub L2>.", READABLE), "the Pub.")
        self.assertEqual(
            clean_text("the <L2 Pub L2>.", LINGUISTIC),
            'the <q type="codeswitch">Pub</q>.',
        )
        self.assertEqual(clean_text("wasn't he the <L2 garante L2>?", READABLE),
                         "wasn't he the garante?")

    def test_unwrapping_does_not_glue_neighbours_together(self):
        """SBC060 793 -- stripping the inner spaces would hide the stray >."""
        self.assertEqual(
            clean_text("[Catch <<SNAPPING +on] like +that SNAPPING>>.", READABLE),
            "Catch +on like +that.",
        )
        self.assertEqual(
            clean_text("did you see !Mike on TV= VOX>FF>?", READABLE),
            "did you see Mike on TV?",
        )

    def test_a_pause_glued_to_the_previous_word(self):
        self.assertEqual(clean_text("so I thought I'd.. try", READABLE),
                         "so I thought I'd try")
        self.assertEqual(clean_text("Bud's.", READABLE), "Bud's.")

    def test_empty_parens_are_removed(self):
        self.assertEqual(clean_text("@()", READABLE), "[laughs]")

    def test_laughter_run_versus_laughing_while_speaking(self):
        self.assertEqual(clean_text(".. @@@ (H)", READABLE), "[laughs]")
        self.assertEqual(clean_text(".. @you never know", READABLE), "you never know")
        self.assertEqual(
            clean_text(".. @@@ (H)", LINGUISTIC),
            '<p/> <laugh pulses="3"/> <breath dir="in"/>',
        )

    def test_pseudonym_marker_follows_the_level(self):
        self.assertEqual(clean_text("So ~Jamie", READABLE), "So Jamie")
        self.assertEqual(clean_text("So ~Jamie", LINGUISTIC), "So ~Jamie")

    def test_spans_that_straddle_lines(self):
        """SBC002 line 163 opens <@ ; its @> lands two lines later."""
        self.assertEqual(clean_text("<@ [But he's my] --", READABLE), "But he's my")
        self.assertEqual(clean_text("he's my [2friend2] @>.", READABLE), "he's my friend.")

    def test_overlaps_that_straddle_lines_drop_their_index_digit(self):
        self.assertEqual(clean_text("[3@@", READABLE), "[laughs]")
        self.assertEqual(clean_text("@@3]", READABLE), "[laughs]")

    def test_doubled_span_delimiters(self):
        """Line 908 opens <<SLAPPING ; line 910 closes SLAPPING>>."""
        self.assertEqual(
            clean_text("<<SLAPPING beating up against you,", READABLE),
            "beating up against you,",
        )
        self.assertEqual(
            clean_text("like that fa=st SLAPPING>>.", READABLE), "like that fast."
        )

    def test_nested_span_where_only_the_inner_one_closes(self):
        """Line 1138: <X<P opens two spans, only X> ever closes."""
        self.assertEqual(
            clean_text("[<X<P Oh I think you] told me X>.", READABLE),
            "Oh I think you told me.",
        )

    def test_vocalism_with_a_missing_closing_paren(self):
        """Line 466 is '(TSK (H)3]' -- a typo in the corpus itself."""
        self.assertEqual(clean_text("(TSK (H)3]", READABLE), "[tsk]")

    def test_vocalism_with_a_missing_opening_paren(self):
        """The mirror of the line-466 typo: absent here, possible corpus-wide."""
        self.assertEqual(clean_text("SNIFF) and then", READABLE), "[sniff] and then")

    def test_ordinary_parenthetical_is_not_treated_as_a_vocalism(self):
        self.assertEqual(clean_text("(Some words here)", READABLE), "(Some words here)")

    def test_a_year_is_not_mistaken_for_an_overlap_index(self):
        self.assertEqual(clean_text("back in 1992]", READABLE), "back in 1992")

    def test_keep_override_restores_preset_removals(self):
        modes = build_modes("readable", keep="pauses,lengthening")
        raw = "... I think they saw= ... that movie."
        self.assertEqual(clean_text(raw, modes), raw)


    def test_bang_marks_a_name_and_keeps_its_space(self):
        """! prefixes a mentioned person, the way ~ prefixes a participant."""
        raw = "Well I'm sure !Thomas is all over it."
        self.assertEqual(clean_text(raw, READABLE), "Well I'm sure Thomas is all over it.")
        self.assertEqual(clean_text(raw, LINGUISTIC), raw)
        self.assertEqual(clean_text("Well !Sue !Swing,", READABLE), "Well Sue Swing,")

    def test_kept_event_is_not_reread_as_a_vocalism(self):
        for level in ("readable", "linguistic", "minimal"):
            modes = build_modes(level, keep="events")
            self.assertEqual(clean_text("((MUSIC_STOPS))", modes), "((MUSIC_STOPS))")
        modes = build_modes("readable", keep="events", drop="noises")
        self.assertEqual(clean_text("((MUSIC_STOPS))", modes), "((MUSIC_STOPS))")

    def test_orphan_vocalism_repair_covers_the_two_letter_breath(self):
        """(Hx) is the mirror of (H); both halves of both must work."""
        self.assertEqual(clean_text("(Hx and then", READABLE), "and then")
        self.assertEqual(clean_text("Hx) and then", READABLE), "and then")
        self.assertEqual(clean_text("(TSK. and then", READABLE), "[tsk]. and then")

    def test_balanced_parens_are_never_read_as_a_vocalism(self):
        self.assertEqual(
            clean_text("he said (NOT me) that", READABLE), "he said (NOT me) that"
        )

    def test_tag_level_keeps_syllable_and_pulse_counts(self):
        self.assertEqual(clean_text("XXXX could have", LINGUISTIC),
                         '<unclear syllables="4"/> could have')
        self.assertEqual(clean_text("X could have", LINGUISTIC), "<unclear/> could have")
        self.assertEqual(clean_text("@@@ yeah", LINGUISTIC), '<laugh pulses="3"/> yeah')

    def test_tag_level_marks_speech_said_while_laughing(self):
        self.assertEqual(clean_text("@doing @okay", LINGUISTIC),
                         "<laughing/>doing <laughing/>okay")
        self.assertEqual(clean_text("@doing @okay", READABLE), "doing okay")


class OutputTests(unittest.TestCase):
    def test_merge_joins_a_speakers_consecutive_units(self):
        lines = [
            "9.56 10.41\tHAROLD: \tI have no idea.",
            "10.41 13.06\t        \tIt was probably my= .. sister-in-law's idea because,",
            "13.06 15.01\t        \t... I think they saw= ... that movie.",
            "15.01 16.43\tJAMIE:  \t... Tap?",
        ]
        merged = convert(lines, READABLE, merge=True)
        self.assertEqual(len(merged), 2)
        self.assertEqual(
            merged[0].text,
            "I have no idea. It was probably my sister-in-law's idea because, "
            "I think they saw that movie.",
        )
        self.assertEqual(merged[0].end, 15.01)
        self.assertEqual(merged[0].units, 3)

    def test_a_discarded_unit_does_not_split_a_turn(self):
        """SBC002 232: JAMIE's "[(H)=]" cleans away between two HAROLD units."""
        lines = [
            "218.00 219.00\tHAROLD: \tThe speakers.",
            "219.00 220.00\t        \tYou [know these ..] boxes?",
            "220.00 220.50\tJAMIE:  \t[(H)=]",
            "220.50 221.50\tHAROLD: \t[2@@@@@2]",
        ]
        merged = convert(lines, READABLE, merge=True)
        self.assertEqual(
            [(u.speaker, u.text) for u in merged],
            [("HAROLD", "The speakers. You know these boxes? [laughs]")],
        )

    def test_dropping_env_does_not_split_a_turn(self):
        lines = [
            "10.00 11.00\tMILES:  \tpeople would like cheering,",
            "11.00 11.20\t        \t((CLAP))",
            "11.20 12.00\tMILES:  \tand clapping, go for it.",
        ]
        merged = convert(lines, READABLE, merge=True, drop_env=True)
        self.assertEqual(
            [(u.speaker, u.text) for u in merged],
            [("MILES", "people would like cheering, and clapping, go for it.")],
        )

    def test_utterances_with_no_content_are_dropped_but_only_when_empty(self):
        lines = ["221.00 222.00\tMILES:  \t... %=,"]
        self.assertEqual(convert(lines, READABLE, merge=False), [])
        # minimal keeps the notation, so the unit still carries something.
        kept = convert(lines, build_modes("minimal"), merge=False)
        self.assertEqual([u.text for u in kept], ["... %=,"])

    def test_an_attributed_event_keeps_its_speaker(self):
        lines = ["10.00 11.00\tMILES:  \t((COUGH))"]
        utterances = convert(lines, READABLE, merge=False)
        self.assertEqual(
            [(u.speaker, u.kind) for u in utterances], [("MILES", "event")]
        )

    def test_merging_keeps_a_count_of_truncated_units(self):
        lines = [
            "4.43 5.78\tHAROLD: \t[I can't imagine teaching a] --",
            "6.08 6.35\t        \t[2@Yeah2],",
            "6.35 6.73\t        \treally.",
        ]
        merged = convert(lines, READABLE, merge=True)
        self.assertEqual(merged[0].units, 3)
        self.assertFalse(merged[0].truncated)  # the turn does not END truncated
        self.assertEqual(merged[0].truncations, 1)  # but one unit inside it did

    def test_markdown_renders_speech_and_events_differently(self):
        lines = [
            "0.00 6.52\tJAMIE:  \tHow [can you] ta=p [2dance2].",
            "6.52 6.60\t        \t((MUSIC_STOPS))",
        ]
        utterances = convert(lines, READABLE, merge=True)
        self.assertEqual(
            render_markdown(utterances, title="SBC002"),
            "# SBC002\n\n**JAMIE:** How can you tap dance.\n\n> *[music stops]*\n",
        )

    def test_markdown_keeps_linguistic_tags_visible(self):
        utterances = convert(["0.00 1.00\tJAMIE:  \t... Tap?"], LINGUISTIC, merge=True)
        self.assertEqual(
            render_markdown(utterances), "**JAMIE:** &lt;pp/> Tap?\n"
        )

    def test_format_list_parsing(self):
        self.assertEqual(parse_formats("md"), ("md",))
        self.assertEqual(parse_formats("md,jsonl"), ("md", "jsonl"))
        self.assertEqual(parse_formats("all"), ("md", "txt", "jsonl"))
        self.assertEqual(parse_formats("md,md"), ("md",))
        with self.assertRaises(ValueError):
            parse_formats("both")

    def test_truncation_is_flagged_even_when_stripped_from_text(self):
        line = "16.50 17.00\tHAROLD: \t    [2<X They had X>2] --"
        utterances = convert([line], READABLE, merge=False)
        record = json.loads(render_jsonl(utterances).strip())
        self.assertEqual(record["text"], "They had")
        self.assertTrue(record["truncated"])
        self.assertEqual(record["speaker"], "HAROLD")


if __name__ == "__main__":
    unittest.main(verbosity=2)
