// helper functions

var _32 = function(n){return isNaN(n) ? NaN : n << 0;}
var ops = {
    '+'  : function(x,y){return _32(x+y);},
    '-'  : function(x,y){return _32(x-y);},
    '*'  : function(x,y){return _32(x*y);},
    '&'  : function(x,y){return x&y;},
    '|'  : function(x,y){return x|y;},
    '<<' : function(x,y){return x<<y;},
    '>>' : function(x,y){return x>>y;},
    '>>>': function(x,y){return x>>>y;},
    '^'  : function(x,y){return x^y;},
    '==' : function(x,y){return x==y?1:0;},
    '<=' : function(x,y){return x<=y?1:0;},
    '<'  : function(x,y){return x<y?1:0;},
    '!=' : function(x,y){return x!=y?1:0;}
}
var eq0  = function(x){return ops['=='](x,0);};
var neq0 = function(x){return ops['!='](x,0);};

var $  = function(id){return document.getElementById(id);};
var $$ = function(cn){return document.getElementsByClassName(cn);};
var $qa = function(q){return document.querySelectorAll(q);};

var tooltip = function(e) {
    var t = $('tooltip');
    if (e.type == 'mouseleave') {
        t.style.display = 'none';
    } else if (e.type = 'mousemove') {
        t.style.left = e.pageX+10+'px';
        t.style.top = e.pageY+10+'px';
        t.style.display = 'block';
        t.innerHTML = e.target.dataset.tooltipmsg;
        t.className = 'cm-s-'+DLX.Editor.getOption('theme');
    }
}

var addTooltip = function(m,l,rm) {
    var n = rm || $qa('.CodeMirror-code .CodeMirror-linenumber')[l];//$$('CodeMirror-linenumber')[l];
    n.dataset.tooltipmsg = m;
    n.addEventListener('mousemove', tooltip);
    n.addEventListener('mouseleave', tooltip);
}
var removeTooltip = function(l,rm) {
    var n = rm || $qa('.CodeMirror-code .CodeMirror-linenumber')[l];//$$('CodeMirror-linenumber')[l];
    delete n.dataset.tooltipmsg;
    n.removeEventListener('mousemove', tooltip);
    n.removeEventListener('mouseleave', tooltip);
    $('tooltip').style.display = 'none';
}

var prettyParamPattern = function(r) {
    var ps = {r: 'register', i: 'immediate', a: 'address', m: 'marker'};
    for (i in r) {
        r[i] = '<span class="cm-'+ps[r[i]]+'">'+r[i].toUpperCase()+'</span>';
    }
    return r.join(' ');
}
var prettyParams = function(p) {
    if (typeof p == "string") p = [p];
    for (i in p) {
        var c = 'marker';
        var r = p[i];
        if (/^R\d+$/.test(r)) {
            c = 'register';
        } else if (/^#-?\d+$/.test(r)) {
            c = 'immediate';
        } else if (/^-?\d+\(R\d+\)$/.test(r)) {
            c = 'address';
        }
        p[i] = '<span class="cm-'+c+'">'+r+'</span>';
    }
    return p.join(' ');
}


// shamelessly borrowed from orteil.dashnet.org/cookieclicker
function utf8_to_b64( str ) {
    try{return Base64.encode(unescape(encodeURIComponent( str )));}
    catch(err)
    {return '';}
}
function b64_to_utf8( str ) {
    try{return decodeURIComponent(escape(Base64.decode( str )));}
    catch(err)
    {return '';}
}

/*=======================================================================================
DLX Interpreter
=======================================================================================*/

var DLX = {};

DLX.Launch = function() {
    DLX.version = 3.180123;
    DLX.SaveTo = 'DLXInterpreter';

    // Settings
    DLX.Settings = {
        FIRST_ADDRESS: 1000,
        ALLOWED_EXECS: 10000,
        PLAY_DELAY: 300,
        STEP_RESTART: 1,
        THEME: 'dark',
        AUTOSAVE: 1,

        // hidden
        DEBUG_SETTINGS: 0,
        CORRECT_WARNING: 1
    };


    // initialize editor
    DLX.Editor = CodeMirror.fromTextArea($('editor'), {
        styleActiveLine: true,
        autofocus: true,
        cursorHeight: .85,
        lineNumbers: true,
        indentUnit: 4,
        theme: 'dlx-'+DLX.Settings.THEME,
        extraKeys: {
            Tab: function(cm) {
                if (cm.somethingSelected()) {
                    cm.indentSelection('add');
                } else {
                    cm.execCommand('insertSoftTab');
                }
            },
            'Shift-Tab': function(cm) {
                cm.indentSelection('subtract')
            },
            'Cmd-Enter': function(cm) {DLX.Run();},
            'Ctrl-Enter': function(cm) {DLX.Run();}
        }
    });



    DLX.returnCodes = {
        SUCCESS: 0,
        ERROR:   1,
        WARNING: 2
    };

    DLX.highlightedLines = [];
    DLX.highlightLine = function(m,l,t) {
        t = 'DLXhighlighted DLX' + t;
        DLX.Editor.addLineClass(l, 'background', t);
        if (m) {
            addTooltip(m,l);
            DLX.highlightedLines.push([l, t]);
        }
    };

    DLX.clearHighlights = function() {
        DLX.Editor.removeLineClass(DLX.currentLineNumber, 'background', 'DLXhighlighted DLXcurrent');
        for (var _n = 0; DLX.highlightedLines[_n]; _n++) {
            DLX.Editor.removeLineClass(DLX.highlightedLines[_n][0], 'background', DLX.highlightedLines[_n][1]);
            removeTooltip(DLX.highlightedLines[_n][0]);
        }
        DLX.highlightedLines = [];
    }

    DLX.error = function(m,l) {
        DLX.highlightLine(m,l,'error');
        return DLX.returnCodes.ERROR;
    };

    DLX.warning = function(m,l) {
        DLX.highlightLine(m,l,'warning');
        return DLX.returnCodes.WARNING;
    };

    DLX.currentLineNumber = 0;
    DLX.currentLine = function(l) {
        DLX.Editor.removeLineClass(DLX.currentLineNumber, 'background', 'DLXhighlighted DLXcurrent');
        DLX.highlightLine(false,l,'current');
        DLX.Editor.scrollIntoView(l);
        DLX.currentLineNumber = l;
    }

    DLX.PC = 0;
    DLX.PROGRESS_PC = true;
    DLX.CYCLECOUNT = new Object();
    DLX.CYCLECOUNT.ALL = 0;       //reguired cycles
    DLX.CYCLECOUNT.MEMORY = 0;    // thereof with memory access

    DLX.RefreshCyclecount = function() {
      $('cyclecount').innerHTML = DLX.CYCLECOUNT.ALL + " (" + DLX.CYCLECOUNT.MEMORY + ")";
    }

    DLX.playing = false;
    DLX.paused = false;
    DLX.StartPlaying = function() {
        if (!DLX.playing) {
            DLX.CYCLECOUNT.ALL = 0;
            DLX.CYCLECOUNT.MEMORY = 0;
            DLX.RefreshCyclecount();
            DLX.playing = true;
            DLX.paused = false;

            DLX.PC = 0;
            DLX.HALTED = false;

            DLX.ReadProgram();

            DLX.Play();
        } else if (DLX.paused) {
            DLX.paused = false;
            DLX.Play();
        }
    }

    DLX.Play = function() {
        var ret;
        if (!DLX.paused) {
          ret = DLX.Step();
          DLX.RefreshCyclecount();
        }

        if (!DLX.paused) {
            if (!DLX.HALTED && ret == DLX.returnCodes.SUCCESS) {
                DLX.playTimeout = window.setTimeout(DLX.Play, DLX.Settings.PLAY_DELAY);
            } else {
                DLX.playing = false;
                DLX.paused = false;
                $('btn-pause').style.display = 'none';
                $('btn-play').style.display = 'inline-block';
            }
        }
    };
    DLX.Pause = function() {
        window.clearTimeout(DLX.playTimeout);
        DLX.paused = true;
    };

    DLX.Reset = function() {
        DLX.CYCLECOUNT.ALL = 0;
        DLX.CYCLECOUNT.MEMORY = 0;
        if (!DLX.paused) $('btn-pause').click();
        DLX.ReadProgram();
    };

    DLX.RUNTIMEERROR = false;
    DLX.Step = function(run) {
        var ret = DLX.returnCodes.SUCCESS;
        if (!run && !DLX.programRead) DLX.ReadProgram();
        if (DLX.Settings.STEP_RESTART && DLX.HALTED) {
            DLX.PC = 0;
            DLX.HALTED = false;
            DLX.CYCLECOUNT.ALL = 0;
            DLX.CYCLECOUNT.MEMORY = 0;
        } else if (DLX.PC == DLX.program.length) {
            DLX.HALTED = true;
            return ret;
        }

        if (DLX.RUNTIMEERROR) {
            return DLX.returnCodes.ERROR;
        }

        if (!DLX.program[DLX.PC]) {
            DLX.PC++;
            return DLX.Step(run);
        }

        if (!run) {
            DLX.currentLine(DLX.PC);
        }
        DLX.PROGRESS_PC = true;
        ret = DLX.ExecLine(DLX.PC);

        if (ret & DLX.returnCodes.ERROR) {
            DLX.RUNTIMEERROR = true;
        } else if (DLX.PROGRESS_PC) {
            DLX.PC++;
        }
        return ret;
    };

    DLX.Run = function() {
        DLX.CYCLECOUNT.ALL = 0;
        DLX.CYCLECOUNT.MEMORY = 0;
        var _PROTECT = 0;
        var ret = DLX.ReadProgram();
        if (!(ret & DLX.returnCodes.ERROR)) {
            while (!DLX.HALTED) {
                ret = DLX.Step(true);
                if (ret & DLX.returnCodes.ERROR) {
                    break;
                }

                if (DLX.Settings.ALLOWED_EXECS > 0) {
                    _PROTECT++;
                    if (_PROTECT == DLX.Settings.ALLOWED_EXECS) {
                        var goon = window.confirm('The program has been running some time. Keep running?');
                        DLX.RefreshCyclecount();
                        if (goon) _PROTECT = 0;
                        else break;
                    }
                }
            }
        }
        DLX.RefreshCyclecount();
        return ret;
    };

    DLX.FormatLine = function(l,n) {
        // strip comments
        l = l.split('/')[0];

        // check for marker
        if (l.indexOf(':') > -1) {
            DLX.marker[(l=l.split(':'))[0]] = parseInt(n);
            l = l[1];
        }

        // strip leading+trailing whitespace
        l = l.replace(/^\s+/, '').replace(/\s+$/, '');

        // divide into op and params
        l = l.replace(/[,\s]+/g, ' ').split(' ');

        return l == '' ? null : l;
    };

    DLX.programRead = false;
    DLX.ReadProgram = function() {
        DLX.program = [];
        DLX.marker = {};
        DLX.PC = 0;
        DLX.HALTED = false;
        DLX.RUNTIMEERROR = false;
        DLX.clearHighlights();
        var p = DLX.Editor.getValue().toUpperCase().split('\n');
        for (l in p) {
            var r = DLX.FormatLine(p[l],l);
            DLX.program.push(r);
        }
        var ret = DLX.CheckProgram();
        DLX.programRead = !(ret & DLX.returnCodes.ERROR);
        return ret;
    };

    DLX.CheckProgram = function() {
        var ret = DLX.returnCodes.SUCCESS;
        for (var i = 0; i < DLX.program.length; i++) {
            var l = DLX.program[i];
            if (l) {
                ret |= DLX.CheckLine(l,i);
            }
        }
        return ret;
    };

    DLX.CheckLine = function(l,i) {
        var ret = DLX.returnCodes.SUCCESS;
        var c = l[0];
        if (DLX.commands.propertyIsEnumerable(c)) {
            var p = l.slice(1);
            var r = DLX.commands[c][0];
            ret = DLX.CheckParams(p,r,i);
        } else {
            ret = DLX.error('Unknown command <span class="black">' + c + '</span>',i);
        }
        return ret;
    };

    DLX.CheckParams = function(p,r,l,x) {
        var ret = DLX.returnCodes.SUCCESS;
        r = r.split('');
        if (p.length != r.length) {
            ret = DLX.error('Parameter mismatch; expected pattern '+ prettyParamPattern(r)
                    + ' , found: ' + prettyParams(p),l);
        } else {
            for (var t = 0; t < r.length; t++) {
                switch(r[t]) {
                    case 'r':
                        if (!/^R\d+$/.test(p[t])) {
                            ret = DLX.error('Register expected, found: ' + prettyParams(p[t]),l);
                            break;
                        }
                        var v = parseInt(p[t].slice(1));
                        if (!x && t == 0 && v == 0) {
                            ret = DLX.warning('Register 0 cannot be written to, it always contains the value 0.',l);
                            break;
                        }
                        if (!(0 <= v && v <= 31)) {
                            ret = DLX.error('Register ' + prettyParams(p[t]) + ' does not exist.',l)
                        }
                        break;
                    case 'i':
                        if (!(/^#0x[a-f0-9]+$/i.test(p[t]) || /^#-?\d+$/.test(p[t]))) {
                            ret = DLX.error('Immediate value expected, found: ' + prettyParams(p[t]),l);
                            break;
                        }
                        //TODO: manage extending of hex values
                        var v = parseInt(p[t].slice(1));
                        var ni = (v << 16) >> 16;
                        var hex = /x/i.test(p[t]);
                        if ((hex && p[t].slice(3).length > 4) || (!hex && ni != v)) {
                            // immediate bigger than 16 bits
                            if (hex) v = '0x'+p[t].slice(3);
                            var immWarnMsg = 'Immediate value <span class="cm-immediate">' + v
                                    + '</span> exceeds 16 bits; will be adjusted to <span class="cm-immediate">'
                                    + ni + '</span>'
                            if (ni * v < 0) {
                                immWarnMsg += '<br>The algebraic sign changed!';
                            }
                            ret = DLX.warning(immWarnMsg,l);
                        }
                        if (DLX.Settings.CORRECT_WARNING || hex) {
                            DLX.program[l][t+1] = '#'+ni;
                        }
                        break;
                    case 'a':
                        if (!/^-?\d+\(R\d+\)$/.test(p[t]) && !/^#-?\d+$/.test(p[t])) {
                            ret = DLX.error('Address or immediate expected, found: ' + prettyParams(p[t]),l);
                            break;
                        }
                        if (/R/.test(p[t])) {
                            var reg = p[t].split('(')[1].split(')')[0];
                            ret = DLX.CheckParams([reg], 'r', l, true);
                        }
                        break;
                    case 'm':
                        if (!DLX.marker.propertyIsEnumerable(p[t])) {
                            ret = DLX.error('Marker ' + prettyParams(p[t]) + ' is not defined.',l);
                        }
                        break;
                    default:
                        ret = DLX.error('Oops, something went wrong..',l);
                }
            }
        }
        return ret;
    };

    DLX.evalParams = function(p,r,l) {
        var ret = [];
        r = r.split('');
        for (var t = 0; t < r.length; t++) {
            switch(r[t]) {
                case 'r':
                    var reg = DLX.getRegister(p[t]);
                    if (!isNaN(reg)) {
                        ret.push(reg);
                    } else {
                        ret = DLX.error('Value in register ' + prettyParams(p[t]) + ' is not a number.',l);
                        return ret;
                    }
                    break;
                case 'i':
                    var imm = DLX.getImmediate(p[t]);
                    ret.push(imm);
                    break;
                case 'a':
                    var addr = DLX.getAddress(p[t]);
                    if (typeof addr == 'string') {
                        ret = DLX.error('Address ' + prettyParams(p[t]) + ' => ' + addr + ' is out of bounds.', l);
                        return ret;
                    } else if (!isNaN(addr[1])) {
                        ret.push(addr[1]);
                    } else {
                        ret = DLX.error('Value at address ' + prettyParams(p[t]) + ' => ' + addr[0] + ' is not a number.', l)
                        return ret;
                    }
                    break;
                case 'm':
                    var mark = DLX.getMarker(p[t]);
                    ret.push(mark);
                    break;
            }
        }
        return ret;
    };

    DLX.getAddress = function(p,d) {
        var address,ret;
        if (/#/.test(p)) {
            address = DLX.getImmediate(p);
        } else {
            var disp = parseInt(p.split('(')[0]);
            var reg = p.split('(')[1].split(')')[0];
            reg = DLX.getRegister(reg);
            address = disp+reg;
        }
        var sel = (address - DLX.Settings.FIRST_ADDRESS)/4 | 0;
        ret = DLX.Memory[sel];
        if (ret == undefined) {
            return address.toString();
        } else {
            return d ? ret : [address, parseInt(ret.value)];
        }
    };

    DLX.getImmediate = function(p) {
        p = p.slice(1);
        return parseInt(p);
    };

    DLX.ignoreWrite = 'ignoreWrite';
    DLX.getRegister = function(i,d) {
        if (!(typeof i == 'number')) {
            i = parseInt(i.slice(1));
        }
        var ret = d && i == 0 ? DLX.ignoreWrite : DLX.Registers[i];
        return d ? ret : parseInt(ret.value);
    };

    DLX.getMarker = function(p) {
        return DLX.marker[p] - DLX.PC;
    };

    DLX.ExecLine = function(n) {
        var ret = DLX.returnCodes.SUCCESS;
        var l = DLX.program[n];
        var c = l[0];
        var p = l.slice(1);
        var r = DLX.commands[c][0];
        var o = DLX.commands[c][1];
        var dest,ev;
        if (r == 'ra' || r == 'ar') {
            DLX.CYCLECOUNT.MEMORY++;
            // SW or LW
            dest = o(p[0], true);
            if (typeof dest == 'string') {
                ret = DLX.error('Address ' + prettyParams(p[0]) + ' => ' + dest + ' is out of bounds.', n);
            } else {
                ev = DLX.evalParams(p.slice(1),r.slice(1),n);
                if (typeof ev == "number" && ev == DLX.returnCodes.ERROR) {
                    ret = ev;
                } else {
                    if (dest != DLX.ignoreWrite) {
                        dest.value = ev[0];
                    }
                }
            }
        } else if (c.slice(0,1) == 'J') {
            // jumps
            ev = DLX.evalParams(p,r,n);
            if (typeof ev == "number" && ev == DLX.returnCodes.ERROR) {
                ret = ev;
            } else {
                if (o) {
                    DLX.getRegister(31, true).value = DLX.PC+2;
                }
                if (c.slice(-1) == 'R') {
                  DLX.PC = ev[0]-1;
                } else {
                    DLX.PC += ev[0];
                }
                DLX.PROGRESS_PC = false;
            }
        } else if (c.slice(0,1) == 'B') {
            // branches
            ev = DLX.evalParams(p,r,n);
            if (typeof ev == "number" && ev == DLX.returnCodes.ERROR) {
                ret = ev;
            } else if (o(ev[0])) {
                DLX.PC += ev[1];
                DLX.PROGRESS_PC = false;
            }
        } else if (r.slice(0,1) == 'r') {
            // logical and arithmetical operands
            dest = DLX.getRegister(p[0], true);
            ev = DLX.evalParams(p.slice(1),r.slice(1),n);
            if (typeof ev == "number" && ev == DLX.returnCodes.ERROR) {
                ret = ev;
            } else {
                if (dest != DLX.ignoreWrite) {
                    dest.value = o(ev[0],ev[1]);
                }
            }
        } else {
            // HALT or TRAP
            DLX.HALTED = true;
        }
        DLX.CYCLECOUNT.ALL++;
        return ret;
    };

    DLX.commands = {
        ADD:  ['rrr', ops['+']],
        ADDI: ['rri', ops['+']],
        ANDI: ['rri', ops['&']],
        AND:  ['rrr', ops['&']],
        ORI:  ['rri', ops['|']],
        OR:   ['rrr', ops['|']],
        SEQI: ['rri', ops['==']],
        SEQ:  ['rrr', ops['==']],
        SLEI: ['rri', ops['<=']],
        SLE:  ['rrr', ops['<=']],
        SLLI: ['rri', ops['<<']],
        SLL:  ['rrr', ops['<<']],
        SLTI: ['rri', ops['<']],
        SLT:  ['rrr', ops['<']],
        SNEI: ['rri', ops['!=']],
        SNE:  ['rrr', ops['!=']],
        SRAI: ['rri', ops['>>']],
        SRA:  ['rrr', ops['>>']],
        SRLI: ['rri', ops['>>>']],
        SRL:  ['rrr', ops['>>>']],
        SUBI: ['rri', ops['-']],
        SUB:  ['rrr', ops['-']],
        XORI: ['rri', ops['^']],
        XOR:  ['rrr', ops['^']],
        BEQZ: ['rm', eq0],
        BNEZ: ['rm', neq0],
        J:    ['m', false],
        JAL:  ['m', true],
        JALR: ['r', true],
        JR:   ['r', false],
        LW:   ['ra', DLX.getRegister],
        SW:   ['ar', DLX.getAddress],
        HALT: ['', null],
        TRAP: ['i', null],
        MULT: ['rrr', ops['*']]
    };

    DLX.autoSavedProgram = '';
    DLX.AutoSave = function() {
        if (DLX.Settings.AUTOSAVE) {
            DLX.autoSavedProgram = utf8_to_b64(DLX.Editor.getValue());
            console.log('autosaving...');
            DLX.WriteSave();
        }
    };
    DLX.autoSaveInterval = window.setInterval(DLX.AutoSave, 15*1000);
    DLX.WriteSave = function() {
        var str = '';
        str += DLX.version + '|';
        str += '|';
        str +=// settings
            DLX.Settings.FIRST_ADDRESS+';'+
            DLX.Settings.ALLOWED_EXECS+';'+
            DLX.Settings.PLAY_DELAY+';'+
            DLX.Settings.STEP_RESTART+';'+
            DLX.Settings.THEME+';'+
            DLX.Settings.DEBUG_SETTINGS+';'+
            DLX.Settings.CORRECT_WARNING+';'+
            DLX.Settings.AUTOSAVE+
            '|';
        str += DLX.autoSavedProgram+'|';
        str += // saved programs
            JSON.stringify(DLX.savedPrograms)+'|';
        str = escape(str);
        window.localStorage.setItem(DLX.SaveTo,str);
    };

    DLX.LoadSave = function() {
        var str = '';
        var storedSave = window.localStorage.getItem(DLX.SaveTo);
        if (storedSave) {
          str = unescape(storedSave);
        }

        if (str != '') {
            var version = 0;
            var spl = '';
            str = str.split('|');
            version = parseFloat(str[0]);
            // some version checking here, sometime maybe
            // settings
            spl = str[2].split(';');
            DLX.Settings.FIRST_ADDRESS = parseInt(spl[0]);
            DLX.Settings.ALLOWED_EXECS = parseInt(spl[1]);
            DLX.Settings.PLAY_DELAY = parseInt(spl[2]);
            DLX.Settings.STEP_RESTART = parseInt(spl[3]);
            DLX.Settings.THEME = spl[4];
            DLX.Editor.setOption('theme', 'dlx-'+DLX.Settings.THEME);
            DLX.Settings.DEBUG_SETTINGS = parseInt(spl[5]);
            DLX.Settings.CORRECT_WARNING = parseInt(spl[6]);
            if (version >= 3.180123) {
                DLX.Settings.AUTOSAVE = spl[7] ? parseInt(spl[7]) : 1;
            }
            // current code
            spl = str[3];
            spl = unescape(spl);
            DLX.autoSavedProgram = spl;
            spl = b64_to_utf8(spl);
            DLX.Editor.setValue(spl);
            DLX.savedPrograms = JSON.parse(str[4]);
            for (var _i = 0; DLX.savedPrograms[_i]; _i++) {
                DLX.addSaveSlot(DLX.savedPrograms[_i].name);
            }
        }
    };

    DLX.savedPrograms = [];
    DLX.addSaveSlot = function(name) {
        var li = document.createElement('li');
        li.className = 'save';
        var ov = document.createElement('span');
        ov.className = 'save-overwrite';
        var de = document.createElement('span');
        de.className = 'save-delete';
        var na = document.createElement('span');
        na.className = 'save-name';
        var n = document.createTextNode(name);
        na.appendChild(n);
        li.appendChild(ov);
        li.appendChild(de);
        li.appendChild(na);
        $('saves').insertBefore(li, $('save-new'));
        ov.addEventListener('click', function() {
            DLX.saveProgram(false, this);
        });
        na.addEventListener('click', function() {
            DLX.loadProgram(this);
            $('save-load').querySelector('button').click();
        });
        de.addEventListener('click', function() {
            DLX.deleteProgram(this);
        });
    };
    DLX.deleteProgram = function(i) {
        var slots = Array.prototype.slice.call($('saves').querySelectorAll('.save-delete'));
        var slot = slots.indexOf(i);
        DLX.savedPrograms.splice(slot,1);
        i.parentNode.remove();
        DLX.WriteSave();
    };
    DLX.saveProgram = function(_new, i) {
        var code = escape(utf8_to_b64(DLX.Editor.getValue()));
        if (_new) {
            // create new slot
            var name = window.prompt('Please enter a name', '');
            if (!name) return;
            DLX.addSaveSlot(name);
            DLX.savedPrograms.push({name: name, code: code});
        } else {
            // overwrite slot
            var slots = Array.prototype.slice.call($('saves').querySelectorAll('.save-overwrite'));
            var slot = DLX.savedPrograms[slots.indexOf(i)];
            slot.code = code;
        }
        DLX.WriteSave();
    };
    DLX.loadProgram = function(i) {
        var slots = Array.prototype.slice.call($('saves').querySelectorAll('.save-name'));
        var slot = DLX.savedPrograms[slots.indexOf(i)];
        DLX.Editor.setValue(b64_to_utf8(unescape(slot.code)));
    };

    DLX.Examples = [
        // even 1
        "Ly9Jc3QgZGllIFphaGwgbiBpbiBNZW1bMTAwMF0gZ2VyYWRlPwovL1dlbm4gamEsIHNjaHJlaWJlIDEgbmFjaCBNZW1bMTAwNF0sIHNvbnN0IDAuCgogICAgICAgTFcgICAgUjEsIDEwMDAoUjApICAgICAvLyBSMSA9IG4KICAgICAgIEFERCAgIFIyLCBSMCwgUjAgICAgICAgLy8gUjIgPSAwCmxvb3A6ICBBRERJICBSMiwgUjIsICMyICAgICAgIC8vIFIyID0gUjIgKyAyCiAgICAgICBTTFQgICBSMywgUjIsIFIxICAgICAgIC8vIFIzID0gKFIyIDwgUjEpCiAgICAgICBCTkVaICBSMywgbG9vcCAgICAgICAgIC8vIG5hY2ggbG9vcCwgd2VubiBSMiA8PSBSMQogICAgICAgU0VRICAgUjMsIFIxLCBSMiAgICAgICAvLyBSMyA9IChSMSA9PSBSMikKICAgICAgIEJORVogIFIzLCBldmVuICAgICAgICAgLy8gbmFjaCBldmVuLCB3ZW5uIFIxID09IFIyCiAgICAgICBTVyAgICAxMDA0KFIwKSwgUjAgICAgIC8vIDAgbmFjaCA0KFIwKQogICAgICAgSiAgICAgb3V0ICAgICAgICAgICAgICAvLyBuYWNoIG91dApldmVuOiAgQURESSAgUjEsIFIwLCAjMSAgICAgICAvLyBSMSA9IDEKICAgICAgIFNXICAgIDEwMDQoUjApLCBSMSAgICAgLy8gMSBuYWNoIDQoUjApCm91dDogICBIQUxU",
        // even 2
        "Ly9Jc3QgZGllIFphaGwgbiBpbiBNZW1bMTAwMF0gZ2VyYWRlPwovL1dlbm4gamEsIHNjaHJlaWJlIDEgbmFjaCBNZW1bMTAwNF0sIHNvbnN0IDAuCgpMVyAgICBSMSwgMTAwMChSMCkgICAgICAvLyBSMSA9IG4KQURESSAgUjEsIFIxLCAjMSAgICAgICAgLy8gUjEgPSBSMSArIDEKQU5ESSAgUjEsIFIxLCAjMSAgICAgICAgLy8gUjEgPSBSMSAmIDEKU1cgICAgMTAwNChSMCksIFIxICAgICAgLy8gMSBuYWNoIDEwMDQoUjApLCB3ZW5uIG4gZ2VyYWRlIGlzdCwgc29uc3QgMApIQUxU",
        // sum 1 to n
        "Ly9BZGRpZXJlIGRpZSBaYWhsZW4gdm9uIDEgYmlzIG4gdW5kIHNjaHJlaWJlIGRhcyBFcmdlYm5pcyBuYWNoIE1lbVsxMDA0XS4KLy9uIG11c3MgZGFmdWVyIHZvciBQcm9ncmFtbWJlZ2lubiBpbiBNZW1bMTAwMF0gc3RlaGVuLgoKICAgICAgIExXICAgIFIxLCAxMDAwKFIwKSAgICAgIC8vIFIxID0gbgogICAgICAgQUREICAgUjIsIFIwLCBSMCAgICAgICAgLy8gUjIgPSAwLCBaYWVobGVyCiAgICAgICBBREQgICBSMywgUjAsIFIwICAgICAgICAvLyBSMyA9IDAsIFN1bW1lCmxvb3A6ICBBREQgICBSMywgUjMsIFIyICAgICAgICAvLyBSMyA9IFIzICsgUjIKICAgICAgIEFEREkgIFIyLCBSMiwgIzEgICAgICAgIC8vIFIyID0gUjIgKyAxCiAgICAgICBTTEUgICBSNCwgUjIsIFIxICAgICAgICAvLyBSMyA9IChSMiA8PSBSMSkKICAgICAgIEJORVogIFI0LCBsb29wICAgICAgICAgIC8vIG5hY2ggb3V0LCB3ZW5uIFIyID4gUjEKICAgICAgIFNXICAgIDEwMDQoUjApLCBSMyAgICAgIC8vIFIzIG5hY2ggNChSMCkKICAgICAgIEhBTFQ%3D",
        // is prime?
        "Ly9VZWJlcnBydWVmZSwgb2IgZGllIFphaGwgaW4gTWVtWzEwMDBdIGVpbmUgUHJpbXphaGwgaXN0LgovL1dlbm4gamEsIHNjaHJlaWJlIDEgbmFjaCBNZW1bMTAwNF0sIHNvbnN0IDAuCgogICAgICAgICAgICBBRERJICBSMiwgUjAsICMyICAgICAgICAvLyBSMiA6PSAyCiAgICAgICAgICAgIExXICAgIFIxLCAxMDAwKFIwKSAgICAgIC8vIExhZGVuIGRlciB6dSB0ZXN0ZW5kZW4gWmFobAogICAgICAgICAgICBBREQgICBSNCwgUjAsIFIxICAgICAgICAvLyBLb3BpZXJlbiB2b24gUjEgbmFjaCBSNAogICAgICAgICAgICBTVUJJICBSMywgUjQsICMyICAgICAgICAvLyBSMyA6PSBSNCAtIDIKTE9PUDE6ICAgICAgU0xUICAgUjUsIFIzLCBSMiAgICAgICAgLy8gSXN0IFIzIGtsZWluZXIgYWxzIFIyPwogICAgICAgICAgICBCTkVaICBSNSwgUHJpbXphaGwgICAgICAvLyBSMSBoYXQga2VpbmUgbmljaHQgdHJpdmlhbGVuIFRlaWxlcgpMT09QMjogICAgICBTTFQgICBSNSwgUjMsIFI0ICAgICAgICAvLyBJc3QgUjMga2xlaW5lciBhbHMgUjQ/CiAgICAgICAgICAgIEJFUVogIFI1LCBHbGVpY2h0ZXN0ICAgIC8vIFdlbm4gbmljaHQsIG11c3MgUjMgPSBSNCBnZXRlc3RldCB3ZXJkZW4KICAgICAgICAgICAgU1VCICAgUjQsIFI0LCBSMyAgICAgICAgLy8gUjQgdW0gUjMgdmVycmluZ2VybgogICAgICAgICAgICBKICAgICBMT09QMgpHbGVpY2h0ZXN0OiBTRVEgICBSNSwgUjMsIFI0ICAgICAgICAvLyBJc3QgUjMgPSBSND8KICAgICAgICAgICAgQk5FWiAgUjUsIE5pY2h0cHJpbSAgICAgLy8gRGFubiB0ZWlsdCBSMyBkZW4gV2VydCBpbiBSMQogICAgICAgICAgICBBREQgICBSNCwgUjAsIFIxICAgICAgICAvLyBTZXR6ZW4gdm9uIFI0IGF1ZiB1cnNwcnVlbmdsaWNoZW4gV2VydAogICAgICAgICAgICBTVUJJICBSMywgUjMsICMxICAgICAgICAvLyBWZXJyaW5nZXJuIHZvbiBSMyB1bSAxCiAgICAgICAgICAgIEogICAgIExPT1AxClByaW16YWhsOiAgIEFEREkgIFI1LCBSMCwgIzEgICAgICAgIC8vIEtvbnN0YW50ZSAxIG5hY2ggUjUKICAgICAgICAgICAgU1cgICAgMTAwNChSMCksIFI1ICAgICAgLy8gU2NocmVpYmVuIGVpbmVyIDEKICAgICAgICAgICAgSiAgICAgRU5ERQpOaWNodHByaW06ICBTVyAgICAxMDA0KFIwKSwgUjAgICAgICAvLyBTY2hyZWliZW4gZWluZXIgMApFTkRFOiAgICAgICBIQUxU",
        // sum n recursive
        "Ly8gRGFzIFByb2dyYW1tIGJlcmVjaG5ldCBkaWUgU3VtbWUgdm9uIDEgYmlzIG4gcmVrdXJzaXYgdW5kCi8vIHNjaHJlaWJ0IGRhcyBFcmdlYm5pcyBuYWNoIE1lbVsyMDAwXS4KLy8gbiBtdXNzIGRhZsODwrxyIHZvciBQcm9ncmFtbWJlZ2lubiBpbiBSZWdpc3RlciAxIHN0ZWhlbiB1bmQKLy8gZWluZW4gV2VydCBncsODwrbDg8KfZXIgMCB1bmQga2xlaW5lciA4NCBoYWJlbi4KCkhhdXB0cHJvZ3JhbW06IEFERCAgIFIyLCBSMCwgUjAgICAgIC8vIEluaXRpYWxpc2llcmVuIGRlciBSZWdpc3RlciBtaXQgMAogICAgICAgICAgICAgICBBREQgICBSMywgUjAsIFIwICAgICAvLwogICAgICAgICAgICAgICBKQUwgICBTdW1tZSAgICAgICAgICAvLyBTdW1tZShuKSB3aXJkIGluIFI0IGJlcmVjaG5ldAogICAgICAgICAgICAgICBTVyAgICAyMDAwKFIwKSwgUjQgICAvLyBFcmdlYm5pcyBhbiBBZHJlc3NlIDIwMDAgc3BlaWNoZXJuCiAgICAgICAgICAgICAgIEogICAgIGVuZApTdW1tZTogICAgICAgICBBRERJICBSMiwgUjIsICM0ICAgICAvLyBTZXR6ZSBTdGFja3BvaW50ZXIgYXVmIG7Dg8KkY2hzdGUgQWRyZXNzZQogICAgICAgICAgICAgICBTVyAgICAxMDAwKFIyKSwgUjEgICAvLyBuIGF1ZiBkZW4gU3RhY2sgcHVzaGVuCiAgICAgICAgICAgICAgIEFEREkgIFIyLCBSMiwgIzQgICAgIC8vIFNldHplIFN0YWNrcG9pbnRlciBhdWYgbsODwqRjaHN0ZSBBZHJlc3NlCiAgICAgICAgICAgICAgIFNXICAgIDEwMDAoUjIpLCBSMyAgIC8vIGsgYXVmIGRlbiBTdGFjayBwdXNoZW4KICAgICAgICAgICAgICAgQURESSAgUjIsIFIyLCAjNCAgICAgLy8gU2V0emUgU3RhY2twb2ludGVyIGF1ZiBuw4PCpGNoc3RlIEFkcmVzc2UKICAgICAgICAgICAgICAgU1cgICAgMTAwMChSMiksIFIzMSAgLy8gUsODwrxja3NwcnVuZ2FkcmVzc2UgYXVmIGRlbiBTdGFjayBwdXNoZW4KICAgICAgICAgICAgICAgU0VRSSAgUjUsIFIxLCAjMSAgICAgLy8gV2VubiBuPTEgaXN0LAogICAgICAgICAgICAgICBCRVFaICBSNSwgZ290b1JlYyAgICAvLwogICAgICAgICAgICAgICBBRERJICBSNCwgUjAsICMxICAgICAvLyBzZXR6ZSBFcmdlYm5pcyA9IDEKICAgICAgICAgICAgICAgSiAgICAgcmV0dXJuICAgICAgICAgLy8gdW5kIGhvbGUgV2VydGUgdm9tIFN0YWNrIHVuZCByZWNobmUKZ290b1JlYzogICAgICAgQUREICAgUjMsIFIxLCBSMCAgICAgLy8gayA6PSBuCiAgICAgICAgICAgICAgIFNVQkkgIFIxLCBSMSwgIzEgICAgIC8vIFJlZHV6aWVyZSBuIHVtIDEKICAgICAgICAgICAgICAgSkFMICAgU3VtbWUgICAgICAgICAgLy8gcmVrdXJzaXZlciBBdWZydWYKYWRkaWVyZW46ICAgICAgQUREICAgUjQsIFIzLCBSNCAgICAgLy8gU3VtbWUgOj0gU3VtbWUgKyBrCnJldHVybjogICAgICAgIExXICAgIFIzMSwgMTAwMChSMikgIC8vIFLDg8K8Y2tzcHJ1bmdhZHJlc3NlIHZvbSBTdGFjayBob2xlbgogICAgICAgICAgICAgICBTVUJJICBSMiwgUjIsICM0ICAgICAvLyBTZXR6ZSBTdGFja3BvaW50ZXIgYXVmIHZvcmhlcmdlaGVuZGUgQWRyZXNzZQogICAgICAgICAgICAgICBMVyAgICBSMywgMTAwMChSMikgICAvLyBrIHZvbSBTdGFjayBob2xlbgogICAgICAgICAgICAgICBTVUJJICBSMiwgUjIsICM0ICAgICAvLyBTZXR6ZSBTdGFja3BvaW50ZXIgYXVmIHZvcmhlcmdlaGVuZGUgQWRyZXNzZQogICAgICAgICAgICAgICBMVyAgICBSMSwgMTAwMChSMikgICAvLyBuIHZvbSBTdGFjayBob2xlbgogICAgICAgICAgICAgICBTVUJJICBSMiwgUjIsICM0ICAgICAvLyBTZXR6ZSBTdGFja3BvaW50ZXIgYXVmIHZvcmhlcmdlaGVuZGUgQWRyZXNzZQogICAgICAgICAgICAgICBKUiAgICBSMzEgICAgICAgICAgICAvLyBSw4PCvGNrc3BydW5nIG5hY2ggYWRkaWVyZW4KZW5kOiAgICAgICAgICAgSEFMVA%3D%3D"
    ];


/*======================================================================
    interface
======================================================================*/
    DLX.adjustAddresses = function() {
        var addresses = $$('memory-address');
        for (var _i = 0; _i < addresses.length; _i++) {
            var _imem = String(_i*4 + DLX.Settings.FIRST_ADDRESS);
            _imem = '0000'.slice(0,-_imem.length)+_imem;
            addresses[_i].textContent = '['+_imem+']';
        }
    };
    DLX.BuildInterface = function() {
        // generate register inputs
        var insertInnerHTML = '';
        for (var _i = 1; _i < 16; _i++) {
            insertInnerHTML += '<label>R'+(_i < 10 ? '0'+_i : _i)+' <input type="text" class="register"></label>';
        }
        $$('register-col')[0].innerHTML += insertInnerHTML;
        insertInnerHTML = '';
        for (var _i = 16; _i < 32; _i++) {
            insertInnerHTML += '<label><input type="text" class="register"> R'+_i+'</label>';
        }
        $$('register-col')[1].innerHTML = insertInnerHTML;
        DLX.Registers = $$('register');
        // generate memory
        insertInnerHTML = '';
        for (var _i = 0; _i < 8; _i++) {
            insertInnerHTML += '<div class="memory-col">';
            for (var _j = 0; _j < 32; _j++) {
                insertInnerHTML += '<label><span class="memory-address"></span>'+' <input type="text" class="memory"></label>';
            }
            insertInnerHTML += '</div>';
        }
        $('memory').innerHTML = insertInnerHTML;
        DLX.adjustAddresses();
        DLX.Memory = $$('memory');


        var radios = document.getElementsByName('first-address');
        for (var _i = 0; radios[_i]; _i++) {
            radios[_i].addEventListener('click', function() {
                DLX.Settings.FIRST_ADDRESS = parseInt(this.value);
                DLX.adjustAddresses();
                DLX.WriteSave();
            });
        }
        radios = document.getElementsByName('allowed-execs');
        for (var _i = 0; radios[_i]; _i++) {
            radios[_i].addEventListener('click', function() {
                DLX.Settings.ALLOWED_EXECS = parseInt(this.value);
                DLX.WriteSave();
            });
        }
        radios = document.getElementsByName('play-delay');
        for (var _i = 0; radios[_i]; _i++) {
            radios[_i].addEventListener('click', function() {
                DLX.Settings.PLAY_DELAY = parseInt(this.value);
                DLX.WriteSave();
            });
        }
        radios = document.getElementsByName('step-restart');
        for (var _i = 0; radios[_i]; _i++) {
            radios[_i].addEventListener('click', function() {
                DLX.Settings.STEP_RESTART = parseInt(this.value);
                DLX.WriteSave();
            });
        }
        radios = document.getElementsByName('theme');
        for (var _i = 0; radios[_i]; _i++) {
            radios[_i].addEventListener('click', function() {
                DLX.Settings.THEME = this.value;
                DLX.Editor.setOption('theme', 'dlx-'+this.value);
                DLX.WriteSave();
            });
        }
        radios = document.getElementsByName('autosave');
        for (var _i = 0; radios[_i]; _i++) {
            radios[_i].addEventListener('click', function() {
                DLX.Settings.AUTOSAVE = parseInt(this.value);
                DLX.WriteSave();
            });
        }
        radios = document.getElementsByName('debug-settings');
        for (var _i = 0; radios[_i]; _i++) {
            radios[_i].addEventListener('click', function() {
                DLX.Settings.DEBUG_SETTINGS = parseInt(this.value);
                DLX.WriteSave();
            });
        }
        radios = document.getElementsByName('correct-warning');
        for (var _i = 0; radios[_i]; _i++) {
            radios[_i].addEventListener('click', function() {
                DLX.Settings.CORRECT_WARNING = parseInt(this.value);
                DLX.WriteSave();
            });
        }


        $('btn-run').addEventListener('click', function() {DLX.Run();});
        $('btn-play').addEventListener('click', function() {
            $('btn-pause').style.display = 'inline-block';
            this.style.display = 'none';
            DLX.StartPlaying();
        });
        $('btn-pause').addEventListener('click', function() {
            $('btn-play').style.display = 'inline-block';
            this.style.display = 'none';
            DLX.Pause();
        });
        $('btn-step').addEventListener('click', function() {
          DLX.Step();
          DLX.RefreshCyclecount();
        });
        $('btn-reset').addEventListener('click', function() {DLX.Reset();});


        $('btn-settings').addEventListener('click', function() {
            var s = $('settings');
            s.querySelector('input[name="first-address"][value="'+DLX.Settings.FIRST_ADDRESS+'"]').checked = true;
            s.querySelector('input[name="allowed-execs"][value="'+DLX.Settings.ALLOWED_EXECS+'"]').checked = true;
            s.querySelector('input[name="play-delay"][value="'+DLX.Settings.PLAY_DELAY+'"]').checked = true;
            s.querySelector('input[name="step-restart"][value="'+DLX.Settings.STEP_RESTART+'"]').checked = true;
            s.querySelector('input[name="theme"][value="'+DLX.Settings.THEME+'"]').checked = true;
            s.querySelector('input[name="autosave"][value="'+DLX.Settings.AUTOSAVE+'"]').checked = true;

            s.querySelector('input[name="debug-settings"][value="'+DLX.Settings.DEBUG_SETTINGS+'"]').checked = true;
            s.querySelector('input[name="correct-warning"][value="'+DLX.Settings.CORRECT_WARNING+'"]').checked = true;
            s.style.display = 'block';
            s.querySelector('.debug').style.display = DLX.Settings.DEBUG_SETTINGS ? 'block' : 'none';
        });
        $('settings').querySelector('button').addEventListener('click', function() {
            $('settings').style.display = 'none';
        });

        var exs = $('examples').querySelectorAll('.example');
        for (var _i = 0; exs[_i]; _i++) {
            exs[_i].addEventListener('click', function() {
                var ex = Array.prototype.slice.call($('examples').querySelectorAll('.example')).indexOf(this);
                DLX.Editor.setValue(b64_to_utf8(unescape(DLX.Examples[ex])));
                $('save-load').querySelector('button').click();
            });
        }

        $('btn-save-load').addEventListener('click', function() {
            $('save-load').style.display = 'block';
        });
        $('save-load').querySelector('button').addEventListener('click', function() {
            $('save-load').style.display = 'none';
        });
        $('save-new').addEventListener('click', function() {
            DLX.saveProgram(true);
        });
        $('save-auto').addEventListener('click', function() {
            var svd = b64_to_utf8(DLX.autoSavedProgram);
            DLX.Editor.setValue(svd);
            $('save-load').querySelector('button').click();
        });

        $('btn-reg').addEventListener('click', function() {
            for (var _i = 1; DLX.Registers[_i]; _i++) {
                DLX.Registers[_i].value = '';
            }
        });
        $('btn-mem').addEventListener('click', function() {
            for (var _i = 0; DLX.Memory[_i]; _i++) {
                DLX.Memory[_i].value = '';
            }
        });

        // sort saves using drag and drop
        DLX.sortingSaveFrom = null;
        DLX.sortingSaveTo = null;
        DLX.sortSaves = new Sortable($('saves'), {
            handle: '.save-name',
            draggable: '.save',
            onStart: function(evt) {
                var item = evt.item;
                DLX.sortingSaveFrom = Array.prototype.slice.call($('saves').querySelectorAll('.save')).indexOf(item);
            },
            onEnd: function(evt) {
                var item = evt.item;
                DLX.sortingSaveTo = Array.prototype.slice.call($('saves').querySelectorAll('.save')).indexOf(item);
                if (DLX.sortingSaveFrom != DLX.sortingSaveTo) {
                    var oldPos = DLX.savedPrograms.splice(DLX.sortingSaveFrom, 1);
                    DLX.savedPrograms.splice(DLX.sortingSaveTo, 0, oldPos[0]);
                    DLX.WriteSave();
                }
            }
        });

        // when entering numbers in a register/memory cell
        // highlight the text field if the number exceeeds
        // the 32 bit two's complement
        var _check2K = function() {
            this.className = this.className.replace(/ rm-.+/,'');
            removeTooltip(null, this);
            var val = parseInt(this.value);
            if (isNaN(this.value) || /[.,]/.test(this.value)) {
                this.className += ' rm-NaN';
                addTooltip('Value is not a 32 bit integer.', null, this);
            } else if (this.value != '') {
                var trim = _32(val);
                if (trim != val) {
                    this.className += ' rm-IOB';
                    addTooltip('Value exceeds 32 bits, will be read as ' + trim, null, this);
                }
            }
        };
        for (var _i = 0; DLX.Registers[_i]; _i++) { DLX.Registers[_i].addEventListener('keyup', _check2K); }
        for (var _i = 0; DLX.Memory[_i]; _i++) { DLX.Memory[_i].addEventListener('keyup', _check2K); }
    };


    DLX.LoadSave();
    DLX.BuildInterface();
};

DLX.Launch();

if (!window.navigator.onLine) document.title = 'OFFLINE | ' + document.title;

// Check if a new cache is available on page load.
window.addEventListener('load', function(e) {

  window.applicationCache.addEventListener('updateready', function(e) {
    if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
      // Browser downloaded a new app cache.
      // Swap it in and reload the page to get the new hotness.
      window.applicationCache.swapCache();
      //if (confirm('A new version of this site is available. Load it?')) {
        window.location.reload();
      //}
    } else {
      // Manifest didn't changed. Nothing new to server.
    }
  }, false);

}, false);
