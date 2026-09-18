import { captionMediaLink } from "./public/language/caption-capture";
const L = (...s) => s.map(x => ({ start: x, text: "t" }));
test("probe", () => {
  const rows = [
    ["plain", { url: "https://s.test/v", timeParam: "position" }, L(128.9)],
    ["zero", { url: "https://s.test/v", timeParam: "position" }, L(0)],
    ["negative", { url: "https://s.test/v", timeParam: "position" }, L(-5)],
    ["string start", { url: "https://s.test/v", timeParam: "position" }, [{ start: "300" }]],
    ["NaN only", { url: "https://s.test/v", timeParam: "position" }, [{ start: "soon" }]],
    ["no lines", { url: "https://s.test/v", timeParam: "position" }, []],
    ["null lines", { url: "https://s.test/v", timeParam: "position" }, null],
    ["hash-routed", { url: "https://s.test/v#/w?position=5", timeParam: "position" }, L(42)],
    ["existing param", { url: "https://s.test/v?position=5&a=1", timeParam: "position" }, L(42)],
    ["bare flag", { url: "https://s.test/v?flag", timeParam: "position" }, L(42)],
    ["trailing ?", { url: "https://s.test/v?", timeParam: "position" }, L(42)],
    ["double &&", { url: "https://s.test/v?a=1&&b=2", timeParam: "position" }, L(42)],
    ["relative url", { url: "/v", timeParam: "position" }, L(42)],
    ["about:", { url: "about:blank", timeParam: "position" }, L(42)],
    ["javascript:", { url: "javascript:alert(1)", timeParam: "position" }, L(42)],
    ["weird name", { url: "https://s.test/v", timeParam: "t&x=1" }, L(42)],
    ["no timeParam", { url: "https://s.test/v?position=99" }, L(42)],
    ["no url", { timeParam: "position" }, L(42)],
    ["null cap", null, L(42)],
    ["huge", { url: "https://s.test/v", timeParam: "position" }, L(1e21)],
  ];
  for (const [n, cap, lines] of rows) console.log(n.padEnd(16), JSON.stringify(captionMediaLink(cap, lines)));
});
