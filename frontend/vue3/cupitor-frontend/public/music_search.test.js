// findIntervalMatches.test.js
import { findIntervalMatches } from "./music_search";

const debugMatches = function (melody, pattern) {
  const res = findIntervalMatches(melody, pattern);
  console.log('\n🔍 Debug Info');
  console.log('Melody:', melody);
  console.log('Pattern:', pattern);
  console.log('Matches:', JSON.stringify(res, null, 2));
  return res;
}

const notesFromString = function (str) {
  return str.split(' ');
}
describe("findIntervalMatches", () => {
  test("1. Exact match", () => {
    const melody = "E D C";
    const pattern = "E D C";
    const matches = findIntervalMatches(melody, pattern);
    if (matches.length !== 1) {
      // show debug info for failing cases
      debugMatches(melody, pattern);
    }
    expect(matches.length).toBe(1);
  });

  test("2. Ignore Octave Exact match", () => {
    const melody = "E3 D3 C3";
    const pattern = "E D C";
    const matches = findIntervalMatches(melody, pattern);
    if (matches.length !== 1) {
      // show debug info for failing cases
      debugMatches(melody, pattern);
    }
    expect(matches.length).toBe(1);
  });

  test("2. Repeated note in melody", () => {
    const melody = "E D D C"
    const pattern = "E D C"
    const matches = findIntervalMatches(melody, pattern);
    if (matches.length !== 1) {
      // show debug info for failing cases
      debugMatches(melody, pattern);
    }
    expect(matches.length).toBe(1);
  });

  test("3. Repeated note in pattern", () => {
    const melody = "E E D C"
    const pattern = "E E D C"
    const matches = findIntervalMatches(melody, pattern);
    if (matches.length !== 1) {
      // show debug info for failing cases
      debugMatches(melody, pattern);
    }
    expect(matches.length).toBe(1);
  });

  test("4. Transposed match", () => {
    const melody = "G F D#"
    const pattern = "E D C"
    const matches = findIntervalMatches(melody, pattern);
    if (matches.length !== 1) {
      // show debug info for failing cases
      debugMatches(melody, pattern);
    }
    expect(matches.length).toBe(1);
  });

  test("5. Passing tone between D→C (ornament)", () => {


  });

  test("6. Multiple ornaments", () => {


  });

  test("7. Repeated + ornament", () => {


  });

  test("8. Opposite direction ornament → should fail", () => {


  });

  test("9. Too large jump → should fail", () => {
    const melody = "E4 D3 C3";
    const pattern = "E D C";
    const matches = findIntervalMatches(melody, pattern);
    expect(matches.length).toBe(0);
  });

  test("10. Partial sequence (wrong start) → should fail", () => {


  });
});
