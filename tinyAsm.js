// This file contains the TinyAsm object, which can be used to parse and run
// or step strings of code written in the tinyAsm instruction set.
//
// The instruction set is described below, in tinyAsmInstructions.

// TODO:
//  - After updating slots, wait before selecting new instruction.
//  - make runningCode and slots scroll boxes? or don't make heights fixed...

var tinyAsmInstructions = {
    "ADD": {
        "args": [{"name": "slot1", "type": "slot"}, {"name": "slot2", "type": "slot"}],
        "desc": "Adds value in slot1 to value in slot2.",
        "_exec": function(ta, args) {
            var slot1 = args[0];
            var slot2 = args[1];
            if (ta.slots[slot1] === undefined) {
                return "Can't add slot " + slot1 + " to slot " + slot2 + ". Slot " + slot1 + " is empty";
            } else if (ta.slots[slot2] == undefined) {
                return "Can't add slot " + slot1 + " to slot " + slot2 + ". Slot " + slot2 + " is empty";
            } else {
                ta.slots[slot2] += ta.slots[slot1];
                ta.pc++;
                return "";
            }
        }
    },
    "SUB": {
        "args": [{"name": "slot1", "type": "slot"}, {"name": "slot2", "type": "slot"}],
        "desc": "Subtracts value in slot1 from value in slot2.",
        "_exec": function(ta, args) {
            var slot1 = args[0];
            var slot2 = args[1];
            if (ta.slots[slot1] === undefined) {
                return "Can't subtract slot " + slot1 + " from slot " + slot2 + ". Slot " + slot1 + " is empty";
            } else if (ta.slots[slot2] == undefined) {
                return "Can't subtract slot " + slot1 + " from slot " + slot2 + ". Slot " + slot2 + " is empty";
            } else {
                ta.slots[slot2] -= ta.slots[slot1];
                ta.pc++;
                return "";
            }
        }
    },
    "STR": {
        "args": [{"name": "number", "type": "number"}, {"name": "slot", "type": "slot"}],
        "desc": "Stores number in slot.",
        "_exec": function(ta, args) {
            var number = parseInt(args[0]);
            var slot = args[1];
            ta.slots[slot] = number;
            ta.pc++;
            return "";
        }
    },
    "BNE": {
        "args": [{"name": "slot1", "type": "slot"}, {"name": "slot2", "type": "slot"}, {"name": "label", "type": "label"}],
        "desc": "Jumps to label if value in slot1 doesn't equal value in slot2.",
        "_exec": function(ta, args) {
            var slot1 = args[0];
            var slot2 = args[1];
            var label = args[2];
            if (ta.slots[slot1] === undefined) {
                return "Can't compare slot " + slot1 + " to slot " + slot2 + ". Slot " + slot1 + " is empty";
            } else if (ta.slots[slot2] == undefined) {
                return "Can't compare slot " + slot1 + " to slot " + slot2 + ". Slot " + slot2 + " is empty";
            } else if (ta.labels[label] === undefined) {
                return "Can't jump to label '" + label + "'. It doesn't exist";
            } else {
                // Jump if the values at slot1 and slot2 are non-equal.
                if (ta.slots[slot1] == ta.slots[slot2]) {
                    ta.pc++; 
                } else {
                    ta.pc = ta.labels[label];
                }
                return "";
            }
        }
    }
};

// An example program.
var tinyAsmExample =
    "# Counts to 10 in slot A\n" +
    "\n" +
    "STR 0 A  # counter\n" +
    "STR 10 B # max value of A\n" +
    "STR 1 C  # amount we increment A by each loop\n" +
    "\n" +
    ">loop\n" +
    "ADD C A       # add C to A (increment A)\n" +
    "BNE A B loop  # (keep looping unless A == B)\n";

// A TinyAsm allows a user to run (with TinyAsm.run()) or step (with
// TinyAsm.step()) code derived from the string rawCode.
// 
// As the user runs or steps rawCode the TinyAsm visualizes code execution in
// runningCodeDive and slotsDiv.
//
// Before code can be run or stepped, the user must call TinyAsm.parse(),
// which may return a non-empty error string, indicating that rawCode was
// invalid.
function TinyAsm(rawCode, runningCodeDiv, slotsDiv) {
    // Constants.
    this.DELAY = 500;
    this.LABEL_CHAR = ">";
    this.COMMENT_CHAR = "#";

    // Internal vars.
    this.rawCode = rawCode;
    this.runningCodeDiv = runningCodeDiv;
    this.slotsDiv = slotsDiv;
    this.slots = {};
    this.labels = {};
    this.parsedCode = [];
    this.pc = 0;

    // External flags which indicate whether the TinyAsm object is either
    // currently running or currently in the middle of a step.
    this.running = false;
    this.stepping = false;
}

// A line of parsed code.
function _Line(op, args) {
    this.op = op;
    this.args = args;
}

// Runs the code to completion, visualizing it as we go.
TinyAsm.prototype.run = function() {
    if (!this.running) {
        // Record that we are running.
        this.running = true;

        this.redrawAll();
        setTimeout(this._run.bind(this), this.DELAY);   
    }
}

// Runs the code to completion (private helper for TinyAsm.run()).
TinyAsm.prototype._run = function() {
    if (this.pc < this.parsedCode.length) {
        this.step(function(err) {
            if (err) {
                // The most recent step returned an error,
                // so record that we are done running and exit.
                this.running = false;
                alert("Error: " + err + "!");
            } else {
                // The most recent time returned no error, so contine.
                setTimeout(this._run.bind(this), this.DELAY);
            }
        }.bind(this));
    } else {
        // Record that we are done running.
        this.running = false;
    }
}

// Executes the current instruction, and updates the visualization.
// If a callback is provided, calls it with any error that occured while
// stepping.
TinyAsm.prototype.step = function(callback) {
    // Record that we are stepping.
    this.stepping = true;

    // Perform the step, saving the old pc.
    var oldPc = this.pc;
    var line = this.parsedCode[this.pc];
    var _exec = tinyAsmInstructions[line.op]._exec;
    var err = _exec(this, line.args);
    var newPc = this.pc;

    // First, draw with the old pc.
    this.pc = oldPc;
    this.redrawAll();
    setTimeout(function() {
        // Now, draw with updated pc.
        this.pc = newPc;
        this.redrawAll();

        // Call callback if it exists,
        // and record that the step has finished.
        this.stepping = false;
        if (callback) {
            callback(err);
        }
    }.bind(this), this.DELAY);
}

// Refreshes the view.
TinyAsm.prototype.redrawAll = function() {
    this.redrawSlots();
    this.redrawRunningCode();
}

TinyAsm.prototype.redrawSlots = function() {
    // Remove children from slotsDiv.
    while (this.slotsDiv.firstChild) {
        this.slotsDiv.removeChild(this.slotsDiv.firstChild);
    }

    // Display each (slot, value) pair in slotsDiv.
    for (var code = "A".charCodeAt(0); code <= "J".charCodeAt(0); code++) {
        var slotDiv = document.createElement("p");
        var slot = String.fromCharCode(code);
        var value = this.slots[slot];
        slotDiv.innerHTML = slot + ": " + (value !== undefined ? value : "-");
        this.slotsDiv.appendChild(slotDiv);
    }
}

TinyAsm.prototype.redrawRunningCode = function() {
    // Remove current running code drawing.
    while (this.runningCodeDiv.firstChild) {
        this.runningCodeDiv.removeChild(this.runningCodeDiv.firstChild);
    } 

    // Draw each line of code in runningCodeDiv.
    for (var i = 0; i < this.parsedCode.length; i++) {
        var lineDiv = document.createElement("p");
        var op = this.parsedCode[i].op;
        var args = this.parsedCode[i].args;
        lineDiv.innerHTML = "" + i + ": " + op;
        for (var j = 0; j < args.length; j++) {
            lineDiv.innerHTML += " " + args[j];
        }
        if (i === this.pc) {
            // If this is the current instruction, highlight it.
            lineDiv.className += " current-instruction";
        }
        this.runningCodeDiv.appendChild(lineDiv);
    }
}

// Attempts to parse this.rawCode.
// If it is successful, places the result in this.parsedCode and returns an
// empty string.
// Otherwise, returns an error string. 
TinyAsm.prototype.parse = function() {
    // Interpret each line as an instruction (an op and args).
    // Empty lines are okay. We'll skip these later on.
    var lines = this.rawCode.split("\n");

    // Parse the code line-by-line, and store the _Line objects
    // resulting from the parsing in this.parsedCode.
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Remove comments and trailing whitespace.
        var commentIndex = line.indexOf(this.COMMENT_CHAR);
        if (commentIndex >= 0) {
            line = line.slice(0, commentIndex);
        }
        line = line.trim();

        // Skip empty lines, or lines that are empty after removing comments
        // and whitespace.
        if (!line) {
            continue;
        }

        var err = this.parseLine(line);
        if (err) {
            // The line could not be parsed, so return the parse error
            // and the line that caused it.
            return "Invalid line: " + line + " (" + err + ")";
        }
    }

    // All of this.rawCode was successfully parsed.
    ta.redrawAll();
    return "";
}

// Attempts to parse the given line of code.
// If it is successful, appends the generated _Line object to this.parsedCode
// and returns an empty string.
// Otherwise, returns an error string.
// 
// Checks for:
//   * valid operator
//   * correct number and types of arguments
//
// Assumes that the line is not an empty string.
TinyAsm.prototype.parseLine = function(line) {
    // First, check if this line is a label.
    if (line[0] === this.LABEL_CHAR) {
        // This line is a label, not an op followed by args.
        // Instead of adding it to this.parsedCode,
        // map it to the index which the next operation will occupy in
        // this.parsedCode (i.e. this.parsedCode.length).
        var label = line.slice(1, line.length).trim();
        this.labels[label] = this.parsedCode.length;
        return "";
    }

    // Otherwise, assume that the line is an op followed by args,
    // all of which are seperated by spaces.
    var tokens = line.split(" ");
    var op = tokens[0];
    var args = tokens.slice(1, tokens.length);

    // Check that op is valid.
    if (!(op in tinyAsmInstructions)) {
        return "'" + op + "' is not a valid operation";
    }

    // Check that we have the correct number of arguments.
    var expectedNumArgs = tinyAsmInstructions[op].args.length;
    if (args.length != expectedNumArgs) {
        return "'" + op + "' needs " + expectedNumArgs + " arguments, but was given " + args.length;
    }

    // Check that all args have the correct type.
    // Note that all args are still inserted into this.parsedCode as strings
    // (e.g. "1" is a valid "int", and will be inserted into this.parsedCode
    // as "1").
    for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        var type = tinyAsmInstructions[op].args[i].type;
        var err = this.checkType(arg, type);
        if (err) {
            return err;
        }
    }

    // This is a valid line.
    this.parsedCode.push(new _Line(op, args));
}

// Determines if a given arg (represented as a string) contains a valid value
// for the given type.
// If it does, returns an empty string.
// Otherwise, returns an error string.
TinyAsm.prototype.checkType = function(arg, type) {
    switch (type) {
        case "number":
            var intArg = parseInt(arg);
            if (!intArg && intArg !== 0) {
                // Arg isn't a number.
                return "'" + arg + " ' should be a number";
            }
            break;

        case "slot":
            if (arg.length !== 1) {
                // Arg is not a single character.
                return "'" + arg + "' should be a single upper-case character between A and J";
            }

            if (arg.charCodeAt(0) < "A".charCodeAt(0)
                    || arg.charCodeAt(0) > "J".charCodeAt(0)) {
                // Arg is not an upper-case character between A and J.
                return "'" + arg + "' should be a single upper-case character between A and J";
            }
            break;

        case "label":
            // Labels cannot contain spaces, the comment character, or the
            // label character.
            if (arg.indexOf(" ") >= 0) {
                return "Labels cannot contain spaces";
            } else if (arg.indexOf(this.LABEL_CHAR) >= 0) {
                return "Labels cannot contain " + this.LABEL_CHAR;
            } else if (arg.indexOf(this.COMMENT_CHAR) >= 0) {
                return "Labels cannot contain " + this.COMMENT_CHAR;
            }
            break;

        default:
            // Invalid type. This should never happen.
            console.log("Found invalid type: " + type);
    }

    // The argument is valid for the given type.
    return "";
}
