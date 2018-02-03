(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"), require("../../mode/css/css"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror", "../../mode/css/css"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  function words(str) {
    return str.split(' ');
  }

  var keywords = words('ADDI ADD ANDI AND BEQZ BNEZ J JAL JALR JR LW '
                      + 'ORI OR SEQI SEQ SLEI SLE SLLI SLL SLTI SLT SNEI SNE '
                      + 'SRAI SRA SRLI SRL SUBI SUB SW XORI XOR HALT TRAP '
                      + 'MULT');

  CodeMirror.registerHelper("hint", "dlx", function(cm) {
    var cur = cm.getCursor(), token = cm.getTokenAt(cur);
    var inner = CodeMirror.innerMode(cm.getMode(), token.state);
    if (inner.mode.name != "dlx") return;

    var start = token.start, end = cur.ch, word = token.string.slice(0, end - start);
    if (/[^\w$_-]/.test(word)) {
      word = ""; start = end = cur.ch;
    }

    var result = keywords.filter(function(kw) {
      return kw.indexOf(word.toUpperCase()) == 0;
    });

    if (result.length) return {
      list: result,
      from: CodeMirror.Pos(cur.line, start),
      to: CodeMirror.Pos(cur.line, end)
    };
  });
});
